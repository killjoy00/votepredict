import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseMemberEvidenceTargets,stageMemberStatementDrafts,discoverHouseIndexArticles,chooseHouseIndexArticles,HOUSE_NEWS_INDEXES,type EvidenceMember } from '../src/operations/2027-member-evidence-intake.js';
import { classify2027CollectionUrl,with2027ArchivedSources,collectionSourceFetch,getArchivedCollectionResponse,COLLECTION_LIMITS } from '../src/sources/minnesota/2027-collection-source.js';

const member:EvidenceMember={membership_id:'fixture1',legislator_id:'person1',external_key:'lrl:99999',name:'Alice Example',district:'1A',chamber_slug:'house',party:'Fixture',newSincePrior:true};
test('evidence rotation prioritizes new unobserved members but never starves older attempts',()=>{
  const returning={...member,membership_id:'fixture2',newSincePrior:false};
  const newest={...member,membership_id:'fixture3'};
  assert.deepEqual(chooseMemberEvidenceTargets([returning,newest,member],new Map(),2).map(x=>x.membership_id),['fixture1','fixture3']);
  assert.deepEqual(chooseMemberEvidenceTargets([returning,newest,member],new Map([['fixture1','2027-01-12'],['fixture3','2027-01-13']]),2).map(x=>x.membership_id),['fixture2','fixture1']);
});
test('member primary archives are scoped to known official and caucus hosts, GET only',async()=>{
  const house='https://www.house.mn.gov/members/profile/news/99999/123';
  assert.equal(classify2027CollectionUrl(house),'member_evidence');
  assert.equal(classify2027CollectionUrl('https://senatedfl.mn/senators/'),'member_evidence');
  assert.equal(classify2027CollectionUrl('https://www.mnsenaterepublicans.com/senators/'),'member_evidence');
  for(const url of [house+'?other=1','https://example.com/members/profile/news/99999/123','https://www.house.mn.gov/members/profile/99999','https://senatedfl.mn/wp-admin/','https://senatedfl.mn/senators/?s=person'])
    assert.throws(()=>classify2027CollectionUrl(url));
  await with2027ArchivedSources('601:1',async(receipt,bytes)=>{
    assert.equal(receipt.sourceKind,'member_evidence');assert.equal(receipt.sourceUrl,house);assert.ok(bytes.length);
    return 'a'.repeat(64);
  },async counters=>{
    const result=await collectionSourceFetch(house);
    assert.equal(getArchivedCollectionResponse(result)?.receiptSha256,'a'.repeat(64));
    await assert.rejects(collectionSourceFetch(house,{method:'POST',body:'test'}),/GET only/);
    assert.equal(counters.byKind.member_evidence,1);
    assert.equal(COLLECTION_LIMITS.memberEvidenceRequests,58);
    assert.equal(COLLECTION_LIMITS.totalRequests,228);
  },async()=>new Response('<html>Official member statement fixture</html>'));
});
test('existing extractors stage issue context and bill-specific statements without model activation',()=>{
  const page={text:'I support increased funding for public education. I support HF 1 and will vote for HF 1.',publishedAt:'2027-01-12T14:00:00.000Z',fetchedAt:'2027-01-13T12:00:00.000Z'};
  const drafts=stageMemberStatementDrafts(member,page,[{id:'bill1',identifier:'HF1'}]);
  assert.ok(drafts.length>0);
  for(const draft of drafts){
    assert.equal(draft.metadata.servingEligible,false);assert.equal(draft.metadata.modelWeight,0);
    assert.equal(draft.metadata.quickEvidenceCandidate,false);
    assert.equal(draft.target?.membershipId,member.membership_id);
    if(draft.candidateKind==='bill_statement_candidate')assert.equal(draft.target?.billId,'bill1');
  }
  assert.throws(()=>stageMemberStatementDrafts(member,{...page,publishedAt:'2026-11-01T12:00:00.000Z'},[]),/outside live session/);
  assert.throws(()=>stageMemberStatementDrafts(member,{...page,publishedAt:'2027-01-14T12:00:00.000Z'},[]),/outside live session/);
  assert.throws(()=>stageMemberStatementDrafts(member,{...page,publishedAt:undefined},[]),/publication date unproved/);
});

test('official House caucus indexes discover stable member-specific article links without relying on party or surname',()=>{
  const page={canonicalUrl:HOUSE_NEWS_INDEXES[0],rawContent:
    '<ul><li><h4><a href="/members/Profile/News/99999/42">New policy</a></h4><div>Posted: Tuesday, January 12, 2027 - <a href="/members/profile/99999">Rep. Alice Example</a> 1A</div></li>'+
    '<li><a href="/members/Profile/News/99999/43">Future</a> Posted: January 15, 2027</li>'+
    '<li><a href="/members/Profile/News/99999/44">Before session</a> Posted: January 11, 2027</li>'+
    '<li><a href="/members/Profile/News/12345/42">Other member</a> Posted: January 12, 2027</li>'+
    '<li><a href="https://example.com/members/Profile/News/99999/46">External</a> Posted: January 12, 2027</li></ul>'};
  const links=discoverHouseIndexArticles(page,[member],'2027-01-13');
  assert.deepEqual(links.map(x=>[x.member.membership_id,x.url,x.date]),[['fixture1','https://www.house.mn.gov/members/Profile/News/99999/42','2027-01-12']]);
  assert.equal(classify2027CollectionUrl(HOUSE_NEWS_INDEXES[0]),'member_evidence');
  assert.equal(classify2027CollectionUrl(HOUSE_NEWS_INDEXES[1]),'member_evidence');
  assert.equal(classify2027CollectionUrl(links[0].url),'member_evidence');
  assert.throws(()=>classify2027CollectionUrl(HOUSE_NEWS_INDEXES[0]+'?page=2'));
  assert.throws(()=>classify2027CollectionUrl('https://www.house.mn.gov/members/party/news/OTHER'));
  assert.throws(()=>discoverHouseIndexArticles({...page,canonicalUrl:'https://example.com/'},[member],'2027-01-13'));
  assert.deepEqual(chooseHouseIndexArticles(links,new Set(['/members/profile/news/99999/42']),new Map(),4),[]);
});
test('House index scheduling gives unattempted sources priority, retries older failures, and respects the per-index cap',()=>{
  const links=Array.from({length:6},(_,i)=>({member,url:'https://www.house.mn.gov/members/Profile/News/99999/'+(i+1),date:'2027-01-12'}));
  const selected=chooseHouseIndexArticles(links,new Set(['/members/profile/news/99999/6']),new Map([['/members/profile/news/99999/1','2027-01-13'],['/members/profile/news/99999/2','2027-01-14']]),4);
  assert.deepEqual(selected.map(x=>x.url.split('/').at(-1)),['3','4','5','1']);
  assert.throws(()=>chooseHouseIndexArticles(links,new Set(),new Map(),5));
});
