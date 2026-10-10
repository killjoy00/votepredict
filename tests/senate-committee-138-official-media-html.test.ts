import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectSenateMediaRecordHtml } from '../src/evidence/senate-committee-138-record-html-metadata.js';

test('a generic Watch/Listen nav link is never proof a specific record plays media',()=>{
  const html='<!DOCTYPE html><html><head><title>Media Archive</title></head>'+
    '<body><nav><a href="/watch">Watch video</a>'+
    '<a href="/listen">Listen Audio</a></nav><h2>Media index</h2></body></html>';
  const r=inspectSenateMediaRecordHtml(html,'1045559');
  assert.equal(r.structuralSourceTags.audio,0);
  assert.equal(r.structuralSourceTags.video,0);
  assert.equal(r.mediaTagCandidate,false);
  assert.equal(r.labeledNavigation.otherMediaLinks,2);
  assert.equal(r.specificPlaybackValidated,false);
  assert.equal(r.exactNamedVotesFromMediaVerified,false);
  assert.match(r.originalHtmlSha256,/^[a-f0-9]{64}$/);
});

test('a record page with audio tag can be a candidate but not verified playback',()=>{
  const html='<html><head><title>Official Senate Media Record</title></head>'+
    '<body><h1>Meeting audio</h1><audio controls><source src="https://archive.example/abc.mp3" type="audio/mpeg"></audio>'+
    '<a href="/media/file?mtgid=1045559">Download</a></body></html>';
  const r=inspectSenateMediaRecordHtml(html,'1045559');
  assert.equal(r.mediaTagCandidate,true);
  assert.equal(r.structuralSourceTags.audio,1);
  assert.equal(r.structuralSourceTags.source,1);
  assert.equal(r.structuralSourceTags.mediaFileRefs,1);
  assert.equal(r.originalSourceMtgidLiteralCount,1);
  assert.equal(r.specificPlaybackValidated,false);
  assert.equal(r.meetingIdentityMatchedToRecordedContent,false);
});

test('HTTP 200 HTML explicitly saying missing file is not a playable source',()=>{
  const html='<!doctype html><html><body><h1>File not found</h1></body></html>';
  const r=inspectSenateMediaRecordHtml(html,'1045559');
  assert.equal(r.explicitMissingRecordTextDetected,true);
  assert.equal(r.mediaTagCandidate,false);
  assert.equal(r.exactNamedVotesFromMediaVerified,false);
});

test('untrusted non-HTML and unbounded sources fail closed',()=>{
  assert.throws(()=>inspectSenateMediaRecordHtml('%PDF- fake object '.repeat(4),'1045559'),/did not resemble HTML/);
  assert.throws(()=>inspectSenateMediaRecordHtml('<html></html>','../foo'),/fixed source bounds/);
  assert.throws(()=>inspectSenateMediaRecordHtml('<html>'+'x'.repeat(650_000)+'</html>','1045559'),/fixed source bounds/);
});