# VideoBrief AI — Learning beta v10

A free English learning companion: topic sections, source passages, flashcards, written self-tests, self-assessed review lists, and a downloadable learning pack.

Live: https://mezz99.github.io/student-video-ai/

## Try it

Select **Try a sample lesson**, read a section, then use **Flashcards**, **Self-test**, and **Review list**. Write an explanation before revealing the reference. Mark it understood or save it for review. Download the pack to retain the questions, answers, review list, answer key and original transcript offline.

No account or subscription. Session answers and progress are not persisted: download before refreshing or leaving.

## YouTube: public site and local helper

The public GitHub Pages site is link-first, but currently still needs pasted captions. No public caption service is connected. GitHub Pages cannot run Python.

The optional local helper imports available English captions and chapter headings on your computer:

```sh
python -m pip install -r requirements.txt
python server.py
```

Open http://127.0.0.1:8766 and paste a YouTube link. Python 3.10+ is required. The helper listens only on loopback, not the public internet. Stop it with Ctrl+C. No API key or paid service is used.

Tested with ddq8JIMhz7c: 3,022 caption segments were retrieved and chapter headings were imported. This establishes that the specific video worked on this connection, not universal availability. Missing captions, non-English tracks and blocked requests can prevent retrieval. No proxy rotation or restriction bypass is implemented. The client times out and offers pasted text or owned recordings as fallbacks.

Public hosting remains separate work: the Cloudflare CLI is not authenticated, and no public caption endpoint has been deployed or reliability-tested. The client enables /api/captions only on localhost.

Library: https://github.com/jdepoix/youtube-transcript-api (MIT). Its documentation describes cloud-IP blocking. The official caption API requires edit permission on the video: https://developers.google.com/youtube/v3/docs/captions/download

## Learning features and limits

- Recognises chapter headings and filters obvious promotional and introduction sections. The original transcript remains in the download.
- Selects source passages without fixed-word cuts. Unpunctuated captions use inferred discourse boundaries, so source review is still needed.
- Creates fill-in-the-blank cards and open explanation prompts with source references.
- Uses self-assessment, not automatic correctness scores.
- Suggests a today/tomorrow/three-days routine. No automatic notifications.
- Supports the first 40 usable sections per pack and 250,000 characters; shows a notice when the section limit is reached.

This is a source-based learning prototype, not a generative tutor. It does not produce independent explanations, fact-check source claims, correct every transcription error, or establish learning gains.

## Recordings and privacy

Whisper Tiny English runs locally in a browser worker using fp32. First use downloads model files through Transformers.js from Hugging Face/CDN services. Recordings and pasted transcripts are not sent to an AI server. YouTube embeds, model downloads and the local helper's YouTube requests contact those providers.

Recordings: MP3, WAV, M4A, MP4 or WebM, subject to browser codec support. Protective ceilings: 100 MB / 10 minutes, not guaranteed device capacities. Prefer short clips on phones. Cancel stops the worker and blocks stale results.

## Verification

```sh
node --test tests/study.test.mjs tests/learning.test.mjs
```

Coverage includes chapter recognition, sponsor filtering, source qualifiers, timestamps, caption line continuity, flashcards, review transitions, downloadable answers, input ceilings and URL validation.

Actual iPhone hardware and maximum-size recordings still need separate testing. No contest entry has been submitted.
