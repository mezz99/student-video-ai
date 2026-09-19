import test from 'node:test';
import assert from 'node:assert/strict';
import {SAMPLE} from '../study.mjs';
import {buildLearningPack, learningSheet, isHeading, reviewItems, progressCounts} from '../learning.mjs';

test('chapter detection distinguishes headings from capitalised speech',()=>{
  assert.ok(isHeading('Sleep & Neuroplasticity, Tool: Non-Sleep Deep Rest (NSDR)'));
  assert.ok(isHeading('Self-Testing & Offsetting Forgetting'));
  assert.equal(isHeading('I thought I understood the whole teaching and learning process but'),false);
  assert.equal(isHeading('Mastery over them and I will teach you how to best do that using data'),false);
});
test('chapters skip sponsors while preserving educational qualifiers',()=>{
  const raw='Welcome everyone to the podcast about learning today.\nSponsor: Sample Mattress\nBuy our mattress today using a discount code for a free trial.\nPeriodic Testing\nTesting shortly after learning can help recall, but the benefit depends on the material and the test.\nSleep & Memory\nSleep supports memory consolidation. A poor night does not mean every memory is permanently lost.\nZero-Cost Support, Social Media, Newsletter\nSubscribe to our newsletter and follow us on every social platform.';
  const pack=buildLearningPack(raw);
  assert.equal(pack.sections.length,2);
  assert.equal(pack.omitted,3);
  assert.ok(pack.sections[0].points[0].text.includes('but the benefit depends'));
  assert.ok(pack.sections.every(s=>!s.source.includes('mattress')));
  assert.ok(pack.cards.every(c=>pack.document.text.includes(c.reference)));
});
test('unpunctuated caption line endings do not cut source passages',()=>{
  const raw='Learning Methods\nthe best way to study is to use retrieval after reading and you should keep the\nimportant conditions in mind because rereading alone may feel familiar without showing whether you can recall the ideas\nnow let\'s talk about another method that helps with study preparation and provides enough context to avoid fragmented notes';
  const pack=buildLearningPack(raw);
  assert.ok(pack.sections[0].points.some(p=>p.text.includes('keep the important conditions in mind')));
  assert.ok(pack.sections[0].points.every(p=>!p.text.endsWith('the')));
});
test('flashcard references and timestamps come from the source',()=>{
  const pack=buildLearningPack(SAMPLE);
  assert.ok(pack.cards.length>=3);
  for(const c of pack.cards){
    assert.ok(c.prompt.includes('______'));
    assert.ok(pack.document.text.includes(c.reference));
    assert.equal(typeof c.time,'number');
    assert.ok(c.reference.toLowerCase().includes(c.answer));
  }
});
test('review list reflects self assessment and clears mastered items',()=>{
  const pack=buildLearningPack(SAMPLE), progress={};
  progress[pack.cards[0].id]='review';assert.equal(reviewItems(pack,progress).length,1);
  progress[pack.cards[0].id]='understood';assert.equal(reviewItems(pack,progress).length,0);
  assert.equal(progressCounts(pack,progress).understood,1);
});
test('download retains questions, separate answer key, typed answers and original transcript',()=>{
  const pack=buildLearningPack(SAMPLE), card=pack.cards[0];
  const sheet=learningSheet(pack,'Sample','',{[card.id]:'review'},{[card.id]:'My explanation'});
  for(const text of ['## Self-test','## Flashcards','## Answer key','My explanation','## Your review list',SAMPLE])assert.ok(sheet.includes(text));
  assert.ok(sheet.indexOf('## Answer key')>sheet.indexOf('## Self-test'));
});
test('short input fails instead of inventing teaching material',()=>{
  assert.throws(()=>buildLearningPack('Hello everyone.'),/18 words/);
});
