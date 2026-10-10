import assert from 'node:assert/strict';
import test from 'node:test';
import { findExactOfficialMeetingDateSection } from '../src/evidence/senate-committee-date-section.js';

test('dated LRL committee section excludes global media and unrelated Minutes links',()=>{
  const html=`<html><header><a href="/video">Senate Audio Video Archive</a>
    <a href="/archive/minutes/senate/2023/X/20230112/X_20230112_minutes.pdf">Minutes</a></header>
    <h2>General Documents</h2><a href="billindex.pdf">Bill Index</a>
    <h2>1/10/2023</h2><a href="agenda.pdf">Agenda</a>
    <a href="meeting.mp4">Watch video</a>
    <h3>Additional documents</h3><a href="testimony.pdf">Testimony</a>
    <h2>1/12/2023</h2><a href="anotherminutes.pdf">Minutes</a>
    </html>`;
  const a=findExactOfficialMeetingDateSection(html,'2023-01-10');
  assert.equal(a.scopeVerified,true);
  assert.equal(a.headingMatches,1);
  assert.ok(a.sectionHtml?.includes('agenda.pdf'));
  assert.ok(a.sectionHtml?.includes('meeting.mp4'));
  assert.ok(a.sectionHtml?.includes('testimony.pdf'));
  assert.equal(a.sectionHtml?.includes('Senate Audio Video Archive'),false);
  assert.equal(a.sectionHtml?.includes('anotherminutes.pdf'),false);
  const b=findExactOfficialMeetingDateSection(html,'2023-01-12');
  assert.equal(b.scopeVerified,true);
  assert.ok(b.sectionHtml?.includes('anotherminutes.pdf'));
  assert.equal(b.sectionHtml?.includes('agenda.pdf'),false);
});

test('source date attribution fails closed for missing, duplicate or unrelated headings',()=>{
  const html='<h2>2/8/2022</h2><a href="one.pdf">Document</a>';
  assert.equal(findExactOfficialMeetingDateSection(html,'2022-02-08').scopeVerified,true);
  assert.equal(findExactOfficialMeetingDateSection(html,'2022-02-09').scopeVerified,false);
  assert.equal(findExactOfficialMeetingDateSection(html+html,'2022-02-08').scopeVerified,false);
  assert.equal(findExactOfficialMeetingDateSection(html,'2021-02-08').scopeVerified,false);
});

test('HTML with only site-wide navigation cannot yield meeting-specific candidate sources',()=>{
  const html='<nav><a href="/media">Audio and Video</a><a href="/minutes">Minutes</a></nav>';
  const x=findExactOfficialMeetingDateSection(html,'2025-02-20');
  assert.equal(x.headingMatches,0);
  assert.equal(x.sectionHtml,null);
  assert.equal(x.scopeVerified,false);
});
