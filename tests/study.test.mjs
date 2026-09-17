import test from 'node:test';
import assert from 'node:assert/strict';
import {SAMPLE, parseTranscript, buildNotes, youtubeId, validateFile, validateDuration, LIMITS, studySheet} from '../study.mjs';

test('common YouTube links', () => {
 for (const url of ['https://www.youtube.com/watch?v=jNQXAC9IVRw','youtu.be/jNQXAC9IVRw?t=10','m.youtube.com/watch?v=jNQXAC9IVRw']) assert.equal(youtubeId(url),'jNQXAC9IVRw');
});
test('reject lookalike domains', () => {
 assert.equal(youtubeId('https://youtube.com.evil.test/watch?v=jNQXAC9IVRw'),'');
});
test('sample preserves source and timestamps', () => {
 const doc=parseTranscript(SAMPLE), notes=buildNotes(doc);
 assert.equal(notes.length,6);
 assert.ok(notes.every(n=>doc.text.includes(n.text) && n.context.includes(n.text) && n.time!==null));
});
test('preserves full conditions and decimal values', () => {
 const text='The test uses 2.5 grams of salt, but only if the water temperature stays below 30 degrees. The comparison requires three samples because one result can be misleading.';
 const notes=buildNotes(parseTranscript(text));
 assert.ok(notes.some(n=>n.text.includes('2.5 grams') && n.text.includes('only if')));
 assert.ok(notes.every(n=>text.includes(n.text)));
});
test('reject invalid files and oversized input', () => {
 assert.throws(()=>validateFile({name:'a.exe',size:10}));
 assert.throws(()=>validateFile({name:'a.mp3',size:0}));
 assert.throws(()=>validateFile({name:'a.mp3',size:LIMITS.bytes+1}));
 validateFile({name:'a.MP3',size:LIMITS.bytes});
});
test('duration and short transcript boundaries', () => {
 assert.throws(()=>validateDuration(601));
 assert.throws(()=>validateDuration(Infinity));
 validateDuration(600);
 assert.throws(()=>buildNotes(parseTranscript('Too short.')));
});
test('download includes full transcript and source', () => {
 const doc=parseTranscript(SAMPLE);
 const sheet=studySheet(buildNotes(doc),doc,'Sample');
 assert.ok(sheet.includes(doc.text));
 assert.ok(sheet.includes('Source: Sample'));
 assert.ok(sheet.includes('[00:'));
});
