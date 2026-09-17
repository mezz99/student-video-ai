import {SAMPLE, parseTranscript, buildNotes, youtubeId, clock, words, validateFile, validateDuration, studySheet} from './study.mjs';

const $ = id => document.getElementById(id);
let mode = 'youtube', video = '', selectedFile = null, currentDoc = null, notes = [], label = '';
let worker = null, workerRequest = null, operation = 0, audioContext = null, locked = false;

function status(message, error = false) {
  $('status').hidden = false;
  $('status').classList.toggle('error', error);
  $('statusText').textContent = message;
}
function clearResults() { currentDoc = null; notes = []; $('results').hidden = true; $('points').replaceChildren(); }
function lock(value) {
  locked = value;
  document.querySelectorAll('button:not(#cancelBtn), input, textarea').forEach(element => element.disabled = value);
  $('cancelBtn').hidden = !value;
  $('transcribeBtn').disabled = value || !selectedFile;
}
function setMode(next) {
  if (locked) return;
  mode = next;
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === next)));
  $('youtubePanel').hidden = next !== 'youtube';
  $('textPanel').hidden = next === 'file';
  $('filePanel').hidden = next !== 'file';
  $('sourceLabel').textContent = next === 'youtube' ? '2. Paste the transcript' : 'Paste your English transcript';
  $('status').hidden = true;
  clearResults();
}
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));

function openVideo() {
  if (locked) return;
  const id = youtubeId($('videoUrl').value);
  if (!id) return status('Paste a complete YouTube video, Shorts or youtu.be link. You can also use Paste transcript without a link.', true);
  if (id !== video) clearResults();
  video = id;
  $('openYoutube').href = `https://www.youtube.com/watch?v=${id}`;
  $('youtubeFrame').src = `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
  $('youtubeWorkspace').hidden = false;
  status('Video opened. Paste its transcript below, then choose Make study notes. The link alone cannot provide captions in this version.');
  $('sourceText').focus();
}
$('loadUrlBtn').addEventListener('click', openVideo);
$('videoUrl').addEventListener('keydown', event => { if (event.key === 'Enter') {event.preventDefault(); openVideo();} });
$('videoUrl').addEventListener('input', () => {
  // Never attach old timestamp links to a newly edited video URL.
  video = ''; $('youtubeFrame').removeAttribute('src'); $('youtubeWorkspace').hidden = true; clearResults();
});
$('clearBtn').addEventListener('click', () => {
  $('sourceText').value = ''; $('videoUrl').value = ''; video = '';
  $('youtubeFrame').removeAttribute('src'); $('youtubeWorkspace').hidden = true;
  clearResults(); $('status').hidden = true;
});

function makeNotes(text, source) {
  try {
    const document = parseTranscript(text);
    const result = buildNotes(document);
    currentDoc = document; notes = result; label = source;
    render();
    status('Study sheet ready. Download it to keep a copy.');
    $('results').scrollIntoView({behavior:'smooth', block:'start'});
    $('results').focus({preventScroll:true});
  } catch (error) { clearResults(); status(error.message, true); }
}
$('makeNotes').addEventListener('click', () => makeNotes($('sourceText').value, mode === 'youtube' && video ? 'Pasted YouTube transcript (not verified against the video)' : 'Pasted transcript'));
$('sourceText').addEventListener('input', clearResults);
$('sampleBtn').addEventListener('click', () => {
  setMode('text'); video = ''; $('videoUrl').value = ''; $('youtubeFrame').removeAttribute('src'); $('youtubeWorkspace').hidden = true;
  $('sourceText').value = SAMPLE;
  makeNotes(SAMPLE, 'Sample lesson · Photosynthesis · Original demonstration text');
});
$('regenerate').addEventListener('click', () => {
  const edited = $('transcript').value;
  video = '';
  makeNotes(edited, 'Edited transcript');
});
$('transcript').addEventListener('input', () => {
  $('copyNotes').disabled = true; $('downloadNotes').disabled = true;
  status('Transcript changed. Choose Update notes from edits before downloading.');
});

function render() {
  $('results').hidden = false;
  $('resultMeta').textContent = `${label} · ${words(currentDoc.text).length.toLocaleString()} words · ${notes.length} ${notes.length === 1 ? 'highlight' : 'highlights'}`;
  $('resultLabel').textContent = label.startsWith('Sample') ? 'Try it yourself · Sample result' : 'Your study sheet';
  $('points').replaceChildren();
  notes.forEach((note, index) => {
    const item = document.createElement('li'); item.dataset.n = String(index + 1).padStart(2,'0');
    const text = document.createElement('span'); text.className = 'point-text'; text.textContent = note.text; item.append(text);
    const tools = document.createElement('div'); tools.className = 'source-tools';
    if (note.time !== null) {
      if (video && mode === 'youtube') {
        const link = document.createElement('a'); link.href = `https://www.youtube.com/watch?v=${video}&t=${Math.floor(note.time)}s`; link.target = '_blank'; link.rel = 'noopener'; link.textContent = `Check at ${clock(note.time)} ↗`; tools.append(link);
      } else { const stamp = document.createElement('span'); stamp.className = 'review-note'; stamp.textContent = 'Source time ' + clock(note.time); tools.append(stamp); }
    }
    const details = document.createElement('details'), summary = document.createElement('summary'), quote = document.createElement('blockquote');
    summary.textContent = 'Read surrounding context'; quote.textContent = note.context; quote.className = 'source-quote'; details.append(summary, quote);
    item.append(tools, details); $('points').append(item);
  });
  $('transcript').value = currentDoc.text;
  $('copyNotes').disabled = false; $('downloadNotes').disabled = false;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], {type:'text/plain;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('downloadNotes').addEventListener('click', () => { if (currentDoc) download('videobrief-study-sheet.md', studySheet(notes, currentDoc, label, video && mode === 'youtube' ? `https://www.youtube.com/watch?v=${video}` : '')); });
$('downloadTranscript').addEventListener('click', () => download('videobrief-transcript.txt', $('transcript').value));
$('copyNotes').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(notes.map((note,i) => `${i+1}. ${note.text}`).join('\n\n')); status('Notes copied.'); }
  catch { status('Clipboard access was unavailable. Use Download study sheet instead.'); }
});

function readDuration(file) {
  return new Promise((resolve,reject) => {
    const media = document.createElement('audio'), url = URL.createObjectURL(file);
    const timer = setTimeout(() => finish(new Error('Reading the file took too long. Try an MP3 or WAV recording.')), 15000);
    function finish(error, value) { clearTimeout(timer); media.onloadedmetadata = null; media.onerror = null; media.removeAttribute('src'); media.load(); URL.revokeObjectURL(url); error ? reject(error) : resolve(value); }
    media.onloadedmetadata = () => finish(null, media.duration);
    media.onerror = () => finish(new Error('Your browser cannot read this recording. Try MP3, WAV, or MP4 with AAC audio.'));
    media.preload = 'metadata'; media.src = url;
  });
}
async function chooseFile(file) {
  if (!file || locked) return;
  const ticket = ++operation;
  clearResults(); selectedFile = null; $('transcribeBtn').disabled = true; $('fileCard').classList.remove('show');
  try {
    validateFile(file); status('Checking your recording…');
    const duration = await readDuration(file);
    if (ticket !== operation) return;
    validateDuration(duration); selectedFile = file;
    $('fileName').textContent = file.name;
    $('fileMeta').textContent = `${clock(duration)} · ${(file.size / 1048576).toFixed(1)} MB`;
    $('fileCard').classList.add('show'); $('transcribeBtn').disabled = false;
    status('Ready. The first transcription may need a model download.');
  } catch (error) { if (ticket === operation) status(error.message, true); }
}
$('fileInput').addEventListener('change', () => chooseFile($('fileInput').files[0]));
$('removeFile').addEventListener('click', () => { operation++; selectedFile = null; $('fileInput').value = ''; $('fileCard').classList.remove('show'); $('transcribeBtn').disabled = true; clearResults(); $('status').hidden = true; });
['dragenter','dragover'].forEach(name => $('dropZone').addEventListener(name, event => {event.preventDefault(); if (!locked) $('dropZone').classList.add('drag');}));
['dragleave','drop'].forEach(name => $('dropZone').addEventListener(name, event => {event.preventDefault(); $('dropZone').classList.remove('drag');}));
$('dropZone').addEventListener('drop', event => chooseFile(event.dataTransfer.files[0]));

function stopWorker() {
  worker?.terminate(); worker = null;
  if (workerRequest) { clearTimeout(workerRequest.timer); workerRequest.reject(new Error('Cancelled')); workerRequest = null; }
}
function cancel() {
  operation++; stopWorker();
  if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
  audioContext = null; lock(false); status('Transcription cancelled. Your file is still selected; you can try again.');
}
$('cancelBtn').addEventListener('click', cancel);
window.addEventListener('pagehide', () => { operation++; stopWorker(); if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {}); });

function runWhisper(audio, ticket) {
  return new Promise((resolve,reject) => {
    worker = new Worker('./transcribe-worker.js', {type:'module'});
    const timer = setTimeout(() => {stopWorker(); status('Transcription exceeded the time limit. Try a shorter audio clip or paste a transcript.', true);}, 15 * 60 * 1000);
    workerRequest = {resolve, reject, timer};
    worker.onmessage = event => {
      if (ticket !== operation) return;
      const data = event.data;
      if (data.type === 'status') return status(data.message);
      const request = workerRequest;
      if (!request) return;
      clearTimeout(request.timer); workerRequest = null;
      worker.terminate(); worker = null;
      if (data.type === 'result') request.resolve(data.result);
      else request.reject(new Error(data.message || 'Transcription failed.'));
    };
    worker.onerror = () => {
      const request = workerRequest;
      if (!request) return;
      clearTimeout(request.timer); workerRequest = null; worker.terminate(); worker = null;
      request.reject(new Error('The speech model could not start or download. Check your connection, try a shorter audio file, or paste a transcript.'));
    };
    worker.postMessage({audio}, [audio.buffer]);
  });
}
$('transcribeBtn').addEventListener('click', async () => {
  if (!selectedFile || locked) return;
  const file = selectedFile, ticket = ++operation;
  lock(true); clearResults(); status('Preparing the audio on your device…');
  $('status').scrollIntoView({behavior:'smooth', block:'center'});
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context || !window.OfflineAudioContext) throw new Error('This browser cannot process audio. Try a desktop browser or paste a transcript.');
    const context = new Context(); audioContext = context;
    const bytes = await file.arrayBuffer(); if (ticket !== operation) return;
    let decoded;
    try { decoded = await context.decodeAudioData(bytes); }
    catch { throw new Error('The audio cannot be decoded in this browser. Try MP3, WAV, or a smaller MP4 with AAC audio.'); }
    if (ticket !== operation) return;
    validateDuration(decoded.duration);
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
    const rendered = await offline.startRendering(); source.disconnect(); source.buffer = null; decoded = null;
    if (context.state !== 'closed') await context.close(); audioContext = null;
    if (ticket !== operation) return;
    status('Starting AI transcription. The first run downloads the speech model…');
    const result = await runWhisper(new Float32Array(rendered.getChannelData(0)), ticket);
    if (ticket !== operation) return;
    if (!result.text?.trim()) throw new Error('No speech was found. Try a clearer English recording.');
    video = '';
    const timed = result.chunks?.length ? result.chunks.map(chunk => `${clock(chunk.timestamp?.[0] || 0)}\n${chunk.text}`).join('\n') : result.text;
    makeNotes(timed, `${file.name} · AI transcript · Please check accuracy`);
  } catch (error) { if (ticket === operation) status(error.message === 'Cancelled' ? 'Transcription stopped. Try a shorter clip.' : error.message, true); }
  finally {
    if (ticket === operation) {
      if (audioContext && audioContext.state !== 'closed') await audioContext.close().catch(() => {});
      audioContext = null; lock(false);
    }
  }
});
