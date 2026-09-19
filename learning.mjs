import {parseTranscript, words, clock} from './study.mjs?v=10';

const AD = /\b(?:sponsors?|sponsored|brought to you by|brought to us by|promo code|discount code|free trial|subscribe to|following me|follow us on|social media|zero.cost support|newsletter|percent off|% off|save \$|pre.sale|preorder|pod cover|mattress cover)\b/i;
const INTRO = /^(?:welcome|hello everyone|hi everyone|thanks for|thank you for|this is (?:a |an )?(?:synthetic |sample )?(?:study )?test)/i;
const STOP = new Set('the a an and or but to of in on for with at by from is are was were be been being it this that these those i you he she we they as so do does did have has had can could would should will just also more some into about their our your its than then there here very only one all each every what how which when why not because get got really know thing things going okay well actually material information'.split(' '));
const tokens = text => words(text).filter(w => w.length > 3 && !STOP.has(w));

// Detect explicit chapter lines, not random capitalised caption lines.
export function isHeading(line) {
  const clean = line.replace(/^#{1,6}\s*/, '').trim();
  const parts = clean.split(/\s+/);
  if (!clean || clean.length > 190 || parts.length > 23) return false;
  if (/^#{1,6}\s/.test(line) || /^(?:chapter \d+|tools?:|sponsors?:)/i.test(clean)) return true;
  if (/[.!?]/.test(clean) || /[,;]$/.test(clean) || /\b(?:the|a|an|for|of|to|and|with)$/i.test(clean)) return false;
  if (parts.length < 2 || /\b(?:I'm|I've|you're|we're|that's|there's|I|you|we|they|it's)\b/.test(clean)) return false;
  const significant = parts.filter(p => !/^(?:a|an|and|of|the|to|for|vs\.?|as|in|with|&|—|-)$/i.test(p));
  return significant.length >= 2 && significant.every(p => /^[A-Z0-9(]/.test(p));
}

function sourceSections(raw) {
  const sections = [];
  let current = {title:'', lines:[]};
  let stamp = null;
  for (const original of raw.replace(/\r/g, '').split('\n')) {
    const line = original.trim();
    if (isHeading(line)) {
      if (current.lines.length) sections.push(current);
      current = {title:line.replace(/^#{1,6}\s*/, ''), lines: stamp ? [stamp] : []};
    } else {
      if (/^\[?\d{1,3}:\d{2}(?::\d{2})?(?:[.,]\d+)?\]?\s*$/.test(line)) stamp = line;
      current.lines.push(original);
    }
  }
  if (current.lines.length) sections.push(current);
  return sections.map(s => ({...s, doc:parseTranscript(s.lines.join('\n'))})).filter(s=>s.doc.text);
}

// Auto-captions often lack punctuation. Break only at discourse boundaries;
// never cut at a word count or at a caption line ending.
function passages(doc) {
  const sentences = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter('en', {granularity:'sentence'}).segment(doc.text)].map(s=>({text:s.segment.trim(), start:s.index}))
    : [...doc.text.matchAll(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)].map(s=>({text:s[0].trim(),start:s.index}));
  const result = [];
  for (const sentence of sentences) {
    if (words(sentence.text).length < 90) { result.push(sentence); continue; }
    const boundary = /\b(?:okay|now (?:let's|the|it's|we|I|before)|let's (?:talk|move|just)|put differently|in other words|for those of you|by the way|the point (?:here |being )?is|here's the point|what (?:this|that) (?:means|tells us)|so (?:keep|remember|again|you need|the|in keeping|yes|here)|however (?:(?:we|you|it|the)\b)|but (?:guess what|the point)|and now|in fact|and (?:I'll|I'm|I want|of course)|why did I|as you'll|think about it)\b/gi;
    const cuts = [0];
    for (const match of sentence.text.matchAll(boundary)) {
      const preceding=sentence.text.slice(cuts.at(-1),match.index).trim();
      if (words(preceding).length >= 18 && !/\b(?:the|a|an|of|to|for|with|and|or|because|that|underlies|talk|into|about|is|are|was|were|be|have|has)$/i.test(preceding)) cuts.push(match.index);
    }
    cuts.push(sentence.text.length);
    for (let i=0;i<cuts.length-1;i++) {
      const chunk=sentence.text.slice(cuts[i],cuts[i+1]).trim();
      if (chunk) result.push({text:chunk,start:sentence.start+cuts[i]});
    }
  }
  return result.map((p,i)=>({...p, time:doc.cues.find(c=>c.end>p.start)?.time ?? null,
    context:result.slice(Math.max(0,i-1),i+2).map(x=>x.text).join(' ')}));
}

function selectPassages(doc, max=2) {
  const candidates=passages(doc).filter(p=>words(p.text).length>=7 && !INTRO.test(p.text) && !AD.test(p.text) && !/^(?:about|to|have|of|or|because|which|now before|let's talk|next we'll)\b/i.test(p.text) && !/\b(?:the|a|an|of|to|for|with|and|or|because|that|underlies|talk|about|is|are|were|be|have|has|turns out|of course|I promise)$/i.test(p.text));
  const frequency=new Map();
  for(const p of candidates) for(const term of new Set(tokens(p.text))) frequency.set(term,(frequency.get(term)||0)+1);
  for(const p of candidates) {
    const terms=tokens(p.text), size=words(p.text).length;
    p.score=terms.reduce((sum,t)=>sum+Math.log(1+(frequency.get(t)||0)),0)/Math.max(1,terms.length);
    if(/\b(?:means|requires?|because|unlike|instead|the best|test yourself|you need|make it a point|important|in order to|remember|keep|avoid)\b/i.test(p.text)) p.score+=1.5;
    if(/^(?:the best|put differently|in other words|the point|here's the point|what this means)/i.test(p.text)) p.score+=1.2;
    if(size>70) p.score-=(size-70)/20;
    if(size<14) p.score-=2;
    if(/\b(?:gonna|I'm going to|we're going to|let's talk|I want to talk|as I mentioned)\b/i.test(p.text)) p.score-=1.8;
    if(/^(?:and|or|because|which|that|of|to|from)\b/i.test(p.text)) p.score-=1;
    if(/\?$/.test(p.text)) p.score-=2;
  }
  const chosen=[];
  for(const p of candidates.sort((a,b)=>b.score-a.score)) {
    const set=new Set(tokens(p.text));
    if(chosen.some(x=>{
      const other=new Set(tokens(x.text));
      return [...set].filter(t=>other.has(t)).length / Math.max(1,new Set([...set,...other]).size) > .7;
    })) continue;
    chosen.push(p); if(chosen.length===max) break;
  }
  return chosen.sort((a,b)=>a.start-b.start);
}

function titleFor(text, index) {
  const definition=text.match(/^([A-Z][\w -]{3,55}?)\s+(?:is|are|means|requires)\b/);
  if(definition && words(definition[1]).length<=7) return definition[1];
  const first=tokens(text).slice(0,3).join(' · ');
  return first ? first[0].toUpperCase()+first.slice(1) : `Lesson part ${index+1}`;
}

function makeCard(section, index) {
  // A cloze prompt and exact source answer avoid invented definitions or grading.
  const excerpt=section.points.find(p=>words(p.text).length<=80) || section.points[0];
  const candidates=tokens(excerpt.text).filter(t=>!['example','different','important','something','certain','simply','however','therefore','sometimes','first','second','third'].includes(t));
  const term=candidates.sort((a,b)=>b.length-a.length)[0];
  if(!term) return null;
  const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const prompt=excerpt.text.replace(new RegExp(`\\b${escaped}\\b`,'gi'),'______');
  return {id:`card-${index}`,sectionId:section.id,title:section.title,prompt,answer:term,reference:excerpt.text,
    question:`Explain the main idea of “${section.title}” in your own words. Include a reason, condition, or example from the source.`,time:excerpt.time};
}

export function buildLearningPack(raw) {
  const document=parseTranscript(raw);
  if(words(document.text).length<18) throw new Error('Add at least 18 words from a lesson to start learning.');
  const source=sourceSections(raw);
  const hasChapters=source.some(s=>s.title);
  let omitted=0;
  let sections=[];
  for(const s of source) {
    if(AD.test(s.title) || (!s.title && hasChapters && INTRO.test(s.doc.text))) {omitted++;continue;}
    const punctuated=(s.doc.text.match(/[.!?](?:\s|$)/g)||[]).length>words(s.doc.text).length/100;
    const selected=selectPassages(s.doc,s.title ? (punctuated?2:1) : 6);
    if(!selected.length) {omitted++;continue;}
    if(s.title) sections.push({title:s.title,points:selected,source:s.doc.text});
    else if(words(s.doc.text).length>1000) {
      const chunks=passages(s.doc), size=Math.max(1,Math.ceil(chunks.length/12));
      for(let i=0;i<chunks.length;i+=size){
        const window=chunks.slice(i,i+size), windowText=window.map(p=>p.text).join(' ');
        const picked=selectPassages(parseTranscript(windowText),1);
        if(!picked.length)continue;
        const point=picked[0], original=s.doc.text.indexOf(point.text);
        point.time=s.doc.cues.find(c=>c.end>original)?.time??null;
        sections.push({title:titleFor(point.text,sections.length),points:[point],source:windowText});
      }
    } else for(const p of selected) sections.push({title:titleFor(p.text,sections.length),points:[p],source:p.context});
  }
  if(!sections.length) throw new Error('No lesson passages found. Try the lesson itself without advertisements or introductory text.');
  const warnings=[];
  if(sections.length>40) { sections=sections.slice(0,40); warnings.push('This pack covers the first 40 sections. Split the transcript to study the rest.'); }
  sections=sections.map((s,i)=>({...s,id:`section-${i}`}));
  const cards=sections.map(makeCard).filter(Boolean);
  if(!/[.!?](?:\s|$)/.test(document.text) || sections.some(s=>s.points.some(p=>words(p.text).length>100))) warnings.push('These captions have little punctuation. Passages stay close to the source; expand a section to check the surrounding explanation.');
  return {document,sections,cards,omitted,warnings};
}

export function reviewItems(pack, progress={}) {return pack.cards.filter(c=>progress[c.id]==='review');}
export function progressCounts(pack, progress={}) {
  return {total:pack.cards.length,understood:pack.cards.filter(c=>progress[c.id]==='understood').length,review:reviewItems(pack,progress).length};
}

export function learningSheet(pack,label,url='',progress={},answers={}) {
  const parts=['# VideoBrief learning pack',`Source: ${label}${url?'\n'+url:''}`,'## Lesson sections'];
  for(const s of pack.sections) {
    parts.push(`### ${s.title}`, ...s.points.map(p=>`${p.time===null?'':`[${clock(p.time)}] `}${p.text}`));
  }
  parts.push('## Flashcards — cover the answer key');
  pack.cards.forEach((c,i)=>parts.push(`${i+1}. ${c.prompt}`));
  parts.push('## Self-test');
  pack.cards.forEach((c,i)=>parts.push(`${i+1}. ${c.question}\nYour answer: ${answers[c.id]||'________________'}\nStatus: ${progress[c.id]||'not reviewed'}`));
  parts.push('## Answer key — check after trying');
  pack.cards.forEach((c,i)=>parts.push(`${i+1}. ${c.answer}\nReference passage: ${c.reference}`));
  parts.push('## Review plan','Today: explain each section without looking. Reveal the reference and mark what needs practice.\nTomorrow: retry the marked questions before checking.\nIn three days: mix questions from across the lesson. This is a suggested plan, not an automatic reminder.');
  const review=reviewItems(pack,progress);
  parts.push('## Your review list',review.length?review.map(c=>'- '+c.title).join('\n'):'No items marked for review yet.');
  parts.push('Source passages and practice prompts, not independent fact-checking or automatic grading.', '## Full transcript',pack.document.raw);
  return parts.join('\n\n')+'\n';
}
