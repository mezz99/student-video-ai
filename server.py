"""Optional local caption companion. Run: pip install -r requirements.txt; python server.py.
Only listens on your own computer. GitHub Pages cannot run this Python process.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import json
import re
import threading

ROOT = Path(__file__).resolve().parent
SLOTS = threading.BoundedSemaphore(2)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != '/api/captions':
            return super().do_GET()
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            return self.reply(403, {'error': 'Open the app on this computer to import captions.'})
        video_id = parse_qs(parsed.query).get('id', [''])[0]
        if not re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id):
            return self.reply(400, {'error': 'Invalid video ID.'})
        if not SLOTS.acquire(blocking=False):
            return self.reply(429, {'error': 'Caption import is busy. Try again shortly.'})
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            from requests import Session
            class TimedSession(Session):
                page = ''
                def request(self, *args, **kwargs):
                    kwargs.setdefault('timeout', 12)
                    response = super().request(*args, **kwargs)
                    if '/watch?' in response.url:
                        self.page = response.text
                    return response
            with TimedSession() as session:
                result = YouTubeTranscriptApi(http_client=session).fetch(video_id, languages=['en', 'en-US', 'en-GB'])
                chapters = []
                marker = re.search(r'(?:var\s+)?ytInitialPlayerResponse\s*=\s*', session.page)
                if marker:
                    try:
                        player, _ = json.JSONDecoder().raw_decode(session.page[marker.end():])
                        description = player.get('videoDetails', {}).get('shortDescription', '')
                        for line in description.splitlines():
                            match = re.match(r'^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s+(.{3,190})$', line)
                            if match:
                                seconds = 0
                                for part in match[1].split(':'):
                                    seconds = seconds * 60 + int(part)
                                chapters.append((seconds, match[2]))
                        chapters.sort()
                    except (ValueError, TypeError):
                        pass
                lines = []
                for snippet in result.snippets:
                    while chapters and chapters[0][0] <= snippet.start:
                        start, title = chapters.pop(0)
                        lines.extend([f'{start//3600:02}:{start//60%60:02}:{start%60:02}', '# ' + title])
                    lines.extend([f'{int(snippet.start)//3600:02}:{int(snippet.start)//60%60:02}:{int(snippet.start)%60:02}', snippet.text])
                transcript = '\n'.join(lines)
            if len(transcript) > 250000:
                return self.reply(413, {'error': 'Captions exceed the lesson size limit.'})
            self.reply(200, {'videoId': video_id, 'transcript': transcript, 'language': result.language_code})
        except ImportError:
            self.reply(503, {'error': 'Install requirements.txt to enable local caption import.'})
        except Exception:
            self.reply(422, {'error': 'English captions unavailable or the request was blocked. Use a transcript or recording.'})
        finally:
            SLOTS.release()

    def reply(self, status, value):
        body = json.dumps(value).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, fmt, *args):
        # Do not put submitted video identifiers or transcript contents in logs.
        pass

if __name__ == '__main__':
    print('VideoBrief: http://127.0.0.1:8766 (local computer only)', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8766), Handler).serve_forever()
