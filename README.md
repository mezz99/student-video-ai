# VideoBrief AI

Free English study highlights from pasted transcripts and recordings. Live at https://mezz99.github.io/student-video-ai/

## Why it exists

VideoBrief helps learners revisit a lesson without replaying the entire recording. It keeps original passages and nearby context beside every highlight. It is an early beta, not a validated learning-outcomes claim or a client case study.

## Try it

Choose **Try a sample lesson** for an original photosynthesis example. Or paste an English transcript and choose **Make study notes**. Download a Markdown study sheet to keep notes and the transcript offline.

- YouTube links open an embedded player. Paste the transcript separately; automatic caption retrieval from arbitrary links is not implemented.
- Direct transcript input does not require a video link, account, model download or AI API key.
- Audio/video transcription uses Whisper Tiny English in a browser worker. First use downloads the model from Hugging Face through Transformers.js (Apache-2.0 projects); inference processes audio locally.
- Highlights use transparent extractive sentence ranking. They do not use a generative summary model. Original wording, numbers and qualifications are preserved, with timestamp links when supplied.
- Accepted recording extensions: MP3, WAV, M4A, MP4, WebM. Actual codec support depends on the browser. Protective input ceilings are 100 MB and 10 minutes; a device may fail below these ceilings. Prefer short clips on phones.
- Cancel stops the speech worker and prevents stale results. Initial audio decoding can still briefly occupy the browser while it releases resources.
- English only. Recognition and highlight selection can be wrong; check the source.

## Privacy and cost

No account, backend, paid API, analytics, database or transcript persistence is configured. Download work before refreshing. App/model files may be cached by the browser. YouTube embeds and model/CDN downloads contact their respective providers and expose ordinary network metadata. There is no claim that initial model downloads work offline.

## Development

Serve this directory over HTTP (for example `python -m http.server 8765`) and open it in a browser. Production needs HTTPS for browser features. Run the pure processing regression tests with `node --test tests/study.test.mjs`.

## Next validation

Measure transcription accuracy and speed on representative phones, test longer recordings, and collect real student feedback. The demo does not establish accuracy, saved time or learning improvements. A contest entry should describe actual functionality and a concrete plan to improve it, without claiming universal YouTube support or guaranteed device capacity.

The existing GitHub Pages deployment serves these static files. No hosting purchase is required by this application.
