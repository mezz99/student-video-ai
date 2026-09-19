import {SAMPLE, youtubeId, clock, words, validateFile, validateDuration} from './study.mjs?v=10';
import {buildLearningPack, learningSheet, progressCounts, reviewItems} from './learning.mjs?v=10';

const $ = id => document.getElementById(id);
let mode = 'youtube', video = '', selectedFile = null, currentDoc = null, notes = [], label = '';
let worker = null, workerRequest = null, operation = 0, audioContext = null, locked = false;
let pack=null, progress={}, answers={}, practiceMode='cards', cardIndex=0, revealed=false;
let captionAbort=null;
const captionEndpoint = location.hostname === '127.0.0.1' || location.hostname === 'localhost' ? '/api/captions' : '';
if(captionEndpoint){$('urlHelp').textContent='Import available English captions through the local helper. If YouTube blocks access or captions are missing, use a transcript or recording.';$('loadUrlBtn').textContent='Import lesson';}

function status(message, error = false) {
  $('status').hidden = false;
  $('status').classList.toggle('error', error);
  $('statusText').textContent = message;
}
function clearResults() { currentDoc = null; notes = []; pack=null; progress={}; answers={}; $('results').hidden = true; $('points').replaceChildren(); }
function lock(value) {
  locked = value;
  document.querySelectorAll('button:not(#cancelBtn), input, textarea').forEach(element => element.disabled = value);
  $('cancelBtn').hidden = !value;
  $('transcribeBtn').disabled = value || !selectedFile;
  if(!value && pack) renderPractice();
}
function setMode(next) {
  if (locked) return;
  mode = next;
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === next)));
  $('youtubePanel').hidden = next !== 'youtube';
  $('textPanel').hidden = next === 'file' || (next === 'youtube' && !video);
  $('filePanel').hidden = next !== 'file';
  $('sourceLabel').textContent = next === 'youtube' ? 'Add the transcript to learn from this video' : 'Paste your English lesson';
  $('status').hidden = true;
  clearResults();
}
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));

async function openVideo() {
  if (locked) return;
  const id = youtubeId($('videoUrl').value);
  if (!id) return status('Paste a complete YouTube video, Shorts or youtu.be link. You can also use Paste transcript without a link.', true);
  if (id !== video) clearResults();
  video = id;
  $('openYoutube').href = `https://www.youtube.com/watch?v=${id}`;
  $('youtubeFrame').src = `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
  $('youtubeWorkspace').hidden = false;
  if(!captionEndpoint) {
    $('textPanel').hidden=false;
    status('Video attached. Automatic caption import is not connected on this public site yet. Paste its transcript below or choose Upload file to build your learning pack.');
    $('sourceText').focus();
    return;
  }
  const ticket=++operation;
  captionAbort=new AbortController();
  const controller=captionAbort;
  const timer=setTimeout(()=>controller.abort(),30000);
  lock(true); status('Retrieving English captions…');
  $('cancelBtn').textContent='Cancel caption import';
  try {
    const response=await fetch(`${captionEndpoint}?id=${id}`,{signal:controller.signal});
    if(!response.ok) throw new Error('Captions could not be retrieved for this video. Paste its transcript or upload your own recording.');
    const data=await response.json();
    if(ticket!==operation) return;
    if(data.videoId!==id || typeof data.transcript!=='string' || !data.transcript.trim()) throw new Error('No usable English captions returned. Paste a transcript to continue.');
    $('sourceText').value=data.transcript; $('textPanel').hidden=false;
    makeNotes(data.transcript,'YouTube captions · Check recognition accuracy');
  } catch(error) {
    if(ticket===operation) { $('textPanel').hidden=false; status(error.name==='AbortError'?'Caption import timed out. You can paste a transcript or try again.':error.message,true); }
  } finally {clearTimeout(timer);if(ticket===operation){captionAbort=null;lock(false);}}
}
$('loadUrlBtn').addEventListener('click', openVideo);
$('videoUrl').addEventListener('keydown', event => { if (event.key === 'Enter') {event.preventDefault(); openVideo();} });
$('videoUrl').addEventListener('input', () => {
  // Never attach old timestamp links to a newly edited video URL.
  video = ''; $('youtubeFrame').removeAttribute('src'); $('youtubeWorkspace').hidden = true; clearResults();
  $('sourceText').value='';
  $('textPanel').hidden = mode === 'youtube';
});
$('clearBtn').addEventListener('click', () => {
  $('sourceText').value = ''; $('videoUrl').value = ''; video = '';
  $('youtubeFrame').removeAttribute('src'); $('youtubeWorkspace').hidden = true;
  clearResults(); $('status').hidden = true;
  $('textPanel').hidden = mode === 'youtube';
});

function makeNotes(text, source) {
  try {
    const result=buildLearningPack(text);
    pack=result; currentDoc=result.document; notes=result.sections.flatMap(s=>s.points); label=source;
    progress={};answers={};cardIndex=0;revealed=false;practiceMode='cards';
    render();
    status('Your learning pack is ready. Read a section, then try recalling it before revealing the answer.');
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
  $('learningArea').hidden=true;
  status('Transcript changed. Choose Rebuild learning pack to update the sections and practice questions.');
});

function render() {
  $('results').hidden = false;
  $('resultMeta').textContent = `${label} · ${words(currentDoc.text).length.toLocaleString()} words · ${pack.sections.length} sections · ${pack.cards.length} practice cards`;
  $('resultLabel').textContent = label.startsWith('Sample') ? 'Try it yourself · Sample lesson' : 'Your learning pack';
  $('learningArea').hidden=false;
  $('qualityNote').textContent=[pack.omitted?`${pack.omitted} introduction, promotion or empty sections omitted from practice.`:'',...pack.warnings].filter(Boolean).join(' ');
  $('qualityNote').hidden=!$('qualityNote').textContent;
  $('points').replaceChildren();
  pack.sections.forEach((section, index) => {
    const item = document.createElement('li'); item.dataset.n = String(index + 1).padStart(2,'0');
    const details=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent=section.title;details.open=index===0;details.append(summary);
    section.points.forEach(note=>{
    const text = document.createElement('p'); text.className = 'point-text'; text.textContent = note.text; details.append(text);
    const tools = document.createElement('div'); tools.className = 'source-tools';
    if (note.time !== null) {
      if (video && mode === 'youtube') {
        const link = document.createElement('a'); link.href = `https://www.youtube.com/watch?v=${video}&t=${Math.floor(note.time)}s`; link.target = '_blank'; link.rel = 'noopener'; link.textContent = `Check at ${clock(note.time)} ↗`; tools.append(link);
      } else { const stamp = document.createElement('span'); stamp.className = 'review-note'; stamp.textContent = 'Source time ' + clock(note.time); tools.append(stamp); }
    }
    details.append(tools);
    });
    const source = document.createElement('details'), sourceTitle=document.createElement('summary'),quote=document.createElement('blockquote');
    sourceTitle.textContent='Read section source';quote.textContent=section.source;quote.className='source-quote';source.append(sourceTitle,quote);details.append(source);
    const practise=document.createElement('button');practise.className='ghost small';practise.textContent='Practise this section';
    practise.addEventListener('click',()=>{practiceMode='quiz';cardIndex=Math.max(0,pack.cards.findIndex(c=>c.sectionId===section.id));revealed=false;renderPractice();$('practice').scrollIntoView({behavior:'smooth',block:'start'});});
    details.append(practise);item.append(details); $('points').append(item);
  });
  $('transcript').value = currentDoc.raw;
  $('copyNotes').disabled = false; $('downloadNotes').disabled = false;
  renderPractice();
}

function deck(){return !pack?[]:practiceMode==='review'?reviewItems(pack,progress):pack.cards;}
function renderPractice(){
  if(!pack)return;
  const counts=progressCounts(pack,progress);
  $('progressText').textContent=`${counts.understood} understood · ${counts.review} to review · ${counts.total-counts.understood-counts.review} unmarked. Self-assessed.`;
  $('learningProgress').max=counts.total||1;$('learningProgress').value=counts.understood;
  document.querySelectorAll('[data-practice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.practice===practiceMode)));
  const cards=deck();cardIndex=Math.max(0,Math.min(cardIndex,cards.length-1));const card=cards[cardIndex];
  $('practiceCard').hidden=!card;$('emptyReview').hidden=!!card;
  if(!card)return;
  $('cardCounter').textContent=`${practiceMode==='cards'?'Flashcard':'Question'} ${cardIndex+1} of ${cards.length}`;
  $('cardTopic').textContent=card.title;
  $('cardPrompt').textContent=practiceMode==='cards'?card.prompt:card.question;
  $('answerInputWrap').hidden=practiceMode==='cards';
  $('yourAnswer').value=answers[card.id]||'';
  $('referenceAnswer').hidden=!revealed;
  $('referenceText').textContent=(practiceMode==='cards'?`Missing term: ${card.answer}\n\n`:'')+card.reference;
  $('showAnswer').hidden=revealed;
  $('showAnswer').disabled=practiceMode!=='cards'&&!$('yourAnswer').value.trim();
  $('assessment').hidden=!revealed;
  $('previousCard').disabled=cardIndex===0;
  $('nextCard').disabled=cardIndex===cards.length-1;
  $('cardState').textContent=progress[card.id]==='understood'?'You marked this understood.':progress[card.id]==='review'?'Saved to your review list.':'Try first, then check the source answer.';
}
document.querySelectorAll('[data-practice]').forEach(b=>b.addEventListener('click',()=>{practiceMode=b.dataset.practice;cardIndex=0;revealed=false;renderPractice();}));
$('yourAnswer').addEventListener('input',()=>{const card=deck()[cardIndex];if(card){answers[card.id]=$('yourAnswer').value;$('showAnswer').disabled=!$('yourAnswer').value.trim();}});
$('showAnswer').addEventListener('click',()=>{revealed=true;renderPractice();});
for(const [id,delta] of [['previousCard',-1],['nextCard',1]])$(id).addEventListener('click',()=>{cardIndex+=delta;revealed=false;renderPractice();});
for(const [id,value] of [['markUnderstood','understood'],['markReview','review']])$(id).addEventListener('click',()=>{
  const card=deck()[cardIndex];if(!card||!revealed)return;progress[card.id]=value;
  if(practiceMode==='review'&&value==='understood')revealed=false;
  renderPractice();
});

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], {type:'text/plain;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('downloadNotes').addEventListener('click', () => { if (pack) download('videobrief-learning-pack.md', learningSheet(pack,label,video && mode === 'youtube'?`https://www.youtube.com/watch?v=${video}`:'',progress,answers)); });
$('downloadTranscript').addEventListener('click', () => download('videobrief-transcript.txt', $('transcript').value));
$('copyNotes').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(learningSheet(pack,label,'',progress,answers)); status('Learning pack copied.'); }
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
  operation++; stopWorker(); captionAbort?.abort();captionAbort=null;
  if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
  audioContext = null; lock(false); status('Processing cancelled. You can try again.');
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
  $('cancelBtn').textContent='Cancel transcription';
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
