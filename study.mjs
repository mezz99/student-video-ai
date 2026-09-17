export const LIMITS = { bytes: 100 * 1024 * 1024, seconds: 600, characters: 250000 };

export const SAMPLE = `0:00
Photosynthesis is the process plants use to convert light energy into chemical energy stored in sugars.
0:12
Chlorophyll in chloroplasts absorbs sunlight. Water and carbon dioxide are the raw materials used to produce glucose.
0:26
Oxygen is released as a byproduct of photosynthesis. Plants use glucose for energy and to build new tissues.
0:40
Cellular respiration releases usable energy from glucose. Unlike photosynthesis, respiration can happen during both day and night.
0:55
Plants perform both photosynthesis and respiration. A plant in darkness cannot photosynthesize, but it still needs energy and continues to respire.
1:10
Light, water and carbon dioxide can each limit the rate of photosynthesis. Increasing light will not necessarily increase growth if the plant lacks water.
1:28
To compare the effect of light fairly, keep the plant species, water supply and temperature the same. Change only the amount of light.
1:43
Record observations across several plants instead of drawing a conclusion from one plant. Repeated observations make a comparison more dependable.`;

export function youtubeId(value) {
  let text = String(value).trim();
  if (!/^https?:\/\//i.test(text)) text = 'https://' + text;
  let url;
  try { url = new URL(text); } catch { return ''; }
  if (!['https:', 'http:'].includes(url.protocol)) return '';
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let id = '';
  if (host === 'youtu.be') id = url.pathname.split('/')[1];
  else if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1];
  }
  return /^[\w-]{11}$/.test(id || '') ? id : '';
}

export function clock(value) {
  const seconds = Math.max(0, Math.floor(value || 0));
  const hours = Math.floor(seconds / 3600);
  return (hours ? hours + ':' : '') + String(Math.floor(seconds / 60) % 60).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}

function seconds(value) {
  return value.replace(',', '.').split(':').reduce((total, part) => total * 60 + Number(part), 0);
}
export function words(text) { return String(text).toLowerCase().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []; }

export function parseTranscript(input) {
  if (String(input).length > LIMITS.characters) throw new Error('This transcript is too long. Use fewer than 250,000 characters.');
  const cues = [];
  let time = null;
  const lines = String(input).replace(/\r/g, '').split('\n');
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    let line = lines[lineIndex];
    line = line.trim();
    if (!line || /^(?:WEBVTT|Kind:|Language:)/i.test(line)) continue;
    if (/^\d+$/.test(line) && /^\s*\d{1,3}:\d{2}.*-->/.test(lines[lineIndex + 1] || '')) continue;
    const stamp = line.match(/^\[?(\d{1,3}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\]?\s*(?:-->\s*\d{1,3}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\s*)?/);
    if (stamp) { time = seconds(stamp[1]); line = line.slice(stamp[0].length); }
    line = line.replace(/<[^>]*>/g, '').replace(/\[(?:music|applause|laughter|silence)\]/gi, '').replace(/\s+/g, ' ').trim();
    if (!line || cues.at(-1)?.text === line) continue;
    cues.push({text: line, time});
  }
  let text = '';
  const ranges = cues.map(cue => {
    if (text) text += ' ';
    const start = text.length;
    text += cue.text;
    return {...cue, start, end: text.length};
  });
  return {text, cues: ranges};
}

const STOP = new Set('the a an and or but to of in on for with at by from is are was were be been being it this that these those i you he she we they as so do does did have has had can could would should will just also more some into about their our your its than then there here very only one all each every'.split(' '));
const terms = text => words(text).filter(word => word.length > 2 && !STOP.has(word));
const meta = text => /^(?:hello|hi everyone|welcome|thanks for watching|thank you for watching|please subscribe|in (?:this|today's) (?:video|lesson)|today (?:we|i)(?:'re| are| will)|this is (?:a |an )?(?:synthetic |sample |practice )?(?:study )?(?:test|lesson|video)\b)/i.test(text);

export function buildNotes(document, max = 6) {
  const text = document.text;
  if (words(text).length < 18) throw new Error('Add at least 18 words from an English lesson to make useful notes.');
  let units;
  if (typeof Intl.Segmenter === 'function') {
    units = [...new Intl.Segmenter('en', {granularity: 'sentence'}).segment(text)].map(item => ({text: item.segment.trim(), start: item.index}));
  } else {
    units = [...text.matchAll(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)].map(item => ({text: item[0].trim(), start: item.index}));
  }
  // Unpunctuated captions use whole cue groups, never a cut-off word count.
  units = units.flatMap(unit => {
    if (words(unit.text).length <= 90) return [unit];
    const cues = document.cues.filter(c => c.start >= unit.start && c.start < unit.start + unit.text.length);
    if (cues.length < 2) return [unit];
    const groups = [];
    let group = null;
    for (const cue of cues) {
      if (!group) group = {text: cue.text, start: cue.start};
      else group.text += ' ' + cue.text;
      if (words(group.text).length >= 30) { groups.push(group); group = null; }
    }
    if (group) groups.push(group);
    return groups;
  });
  const candidates = units.filter(unit => words(unit.text).length >= 5 && !meta(unit.text));
  if (!candidates.length) throw new Error('No clear study passages found. Try a longer lesson with complete sentences.');
  const frequency = new Map();
  candidates.forEach(unit => new Set(terms(unit.text)).forEach(term => frequency.set(term, (frequency.get(term) || 0) + 1)));
  const ranked = candidates.map((unit, order) => {
    const tokens = terms(unit.text);
    let score = tokens.reduce((sum, term) => sum + Math.log(1 + (frequency.get(term) || 0)), 0) / Math.sqrt(Math.max(1, tokens.length));
    if (/\b(?:because|requires?|means?|unlike|however|therefore|if|unless|without|not|must|only|compared|increase|decrease|process)\b/i.test(unit.text)) score += 1.4;
    if (words(unit.text).length > 65) score -= 2;
    if (words(unit.text).length < 8) score -= 2;
    if (/\?$/.test(unit.text)) score -= 1.5;
    return {...unit, order, tokens, score};
  }).sort((a,b) => b.score - a.score);
  const chosen = [];
  while (ranked.length && chosen.length < max) {
    // Spread highlights across the lesson rather than picking adjacent repeats.
    ranked.sort((a,b) => adjustedScore(b) - adjustedScore(a));
    const candidate = ranked.shift();
    const set = new Set(candidate.tokens);
    const duplicate = chosen.some(other => {
      const otherSet = new Set(other.tokens);
      const common = [...set].filter(token => otherSet.has(token)).length;
      return common / Math.max(1, new Set([...set, ...otherSet]).size) > .72;
    });
    if (duplicate) continue;
    chosen.push(candidate);
  }
  function adjustedScore(candidate) {
    const cue = document.cues.find(c => c.end > candidate.start);
    const nearby = chosen.filter(other => {
      const otherCue = document.cues.find(c => c.end > other.start);
      return cue?.time !== null && cue?.time === otherCue?.time || Math.abs(candidate.order - other.order) <= 1;
    }).length;
    return candidate.score - nearby * 2.5;
  }
  return chosen.sort((a,b) => a.start - b.start).map(unit => {
    const cue = document.cues.find(c => c.end > unit.start);
    const contextStart = Math.max(0, unit.order - 1);
    const context = candidates.slice(contextStart, unit.order + 2).map(c => c.text).join(' ');
    return {text: unit.text, time: cue?.time ?? null, context, start: unit.start};
  });
}

export function validateFile(file) {
  if (!/\.(mp3|wav|m4a|mp4|webm)$/i.test(file.name)) throw new Error('Choose MP3, WAV, M4A, MP4 or WebM.');
  if (!file.size) throw new Error('This file is empty. Choose another recording.');
  if (file.size > LIMITS.bytes) throw new Error('This file exceeds the 100 MB beta limit. Use a smaller audio file or paste a transcript.');
}
export function validateDuration(duration) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not read a valid recording duration. Try MP3 or WAV.');
  if (duration > LIMITS.seconds) throw new Error('This recording exceeds the 10-minute beta limit. Split it into shorter clips or paste a transcript.');
}

export function studySheet(notes, document, label, url = '') {
  return '# VideoBrief study sheet\n\nSource: ' + label + (url ? '\n' + url : '') + '\n\n## Study highlights\n\n' + notes.map((note, i) => `${i+1}. ${note.time === null ? '' : '[' + clock(note.time) + '] '}${note.text}`).join('\n\n') + '\n\nSelected passages from the supplied transcript. Review the source for full context.\n\n## Transcript\n\n' + document.text + '\n';
}
