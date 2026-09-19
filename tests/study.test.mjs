import test from 'node:test';
import assert from 'node:assert/strict';
import {SAMPLE, parseTranscript, buildNotes, youtubeId, validateFile, validateDuration, LIMITS, studySheet} from '../study.mjs';

test('YouTube accepts common pasted forms and rejects lookalike domains', () => {
  for (const url of ['https://www.youtube.com/watch?v=jNQXAC9IVRw', 'youtu.be/jNQXAC9IVRw?t=10', 'm.youtube.com/watch?v=jNQXAC9IVRw', 'https://youtube.com/shorts/jNQXAC9IVRw']) assert.equal(youtubeId(url), 'jNQXAC9IVRw');
  for (const url of ['https://youtube.com.evil.test/watch?v=jNQXAC9IVRw', 'https://fake-youtube.com/watch?v=jNQXAC9IVRw', 'javascript:alert(1)', 'https://youtube.com/playlist?list=123']) assert.equal(youtubeId(url), '');
});
test('timestamps, decimal values and conditions survive parsing', () => {
  const doc = parseTranscript('WEBVTT\n\n00:00:12.500 --> 00:00:18.000\nThe test uses 2.5 grams of salt, but only if the water temperature stays below 30 degrees.\n00:00:18.000 --> 00:00:25.000\nThe comparison requires three samples because one result can be misleading.');
  assert.equal(doc.cues[0].time, 12.5);
  const notes = buildNotes(doc);
  assert.ok(notes.some(n => n.text.includes('2.5 grams') && n.text.includes('only if') && n.text.includes('30 degrees')));
  assert.ok(notes.some(n => n.text.includes('because one result can be misleading')));
  assert.ok(notes.every(n => doc.text.includes(n.text)));
});
test('original sample produces factual passages and source times', () => {
  const doc = parseTranscript(SAMPLE), notes = buildNotes(doc);
  assert.equal(notes.length, 6);
  assert.ok(notes.every(n => doc.text.includes(n.text) && n.context.includes(n.text) && n.time !== null));
  assert.ok(notes.some(n => /darkness|day and night/.test(n.text)));
});
test('meta introduction is not presented as an essential lesson', () => {
  const doc = parseTranscript('This is a synthetic study test about plants and energy. Plants use sunlight to make sugars through photosynthesis. Chlorophyll in chloroplasts absorbs light energy. Water and carbon dioxide provide the materials needed to build glucose. Oxygen is released as a byproduct. Plants also perform cellular respiration, which releases usable energy from glucose. Photosynthesis requires light, but cellular respiration can occur during both day and night.');
  const notes = buildNotes(doc);
  assert.ok(notes.every(n => !n.text.includes('synthetic study test')));
  assert.ok(notes.every(n => doc.text.includes(n.text)));
});
test('paragraph without punctuation is not truncated at an arbitrary word', () => {
  const text = Array.from({length:100}, (_,i) => `concept${i}`).join(' ') + ' unless the initial condition changes';
  const notes = buildNotes(parseTranscript(text));
  assert.equal(notes[0].text, text);
});
test('input ceilings reject oversized, invalid and overlong media', () => {
  assert.throws(() => validateFile({name:'a.exe', size:10}));
  assert.throws(() => validateFile({name:'a.mp3', size:0}));
  assert.throws(() => validateFile({name:'a.mp3', size:LIMITS.bytes+1}));
  validateFile({name:'a.MP3', size:LIMITS.bytes});
  assert.throws(() => validateDuration(601));
  assert.throws(() => validateDuration(Infinity));
  validateDuration(600);
  assert.throws(() => buildNotes(parseTranscript('Too short.')));
});
test('download includes source, highlights, timestamps and complete transcript', () => {
  const doc = parseTranscript(SAMPLE), notes = buildNotes(doc);
  const sheet = studySheet(notes, doc, 'Sample');
  assert.ok(sheet.includes(doc.text));
  assert.ok(sheet.includes('Source: Sample'));
  assert.ok(sheet.includes('[00:'));
});
