import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRadar, withPeerEvidence } from './model.ts';

const candidate={slug:'category-case',name:'Category Case',category:'Lending',chains:['Base'],tvl_usd:10_000_000,change_7d:20,mcap_usd:null,gecko_id:null,symbol:null,listed_at:'2020-01-01'};

test('dashboard evidence uses winsorized interpolated quartiles and the actual fallback set',()=>{
  const peers=[0,.125,.25,.375,.5,.625,.75,50].map((ratio,i)=>({...candidate,slug:'peer-'+i,name:'Peer '+i,mcap_usd:ratio*10_000_000,gecko_id:'peer-'+i,symbol:'P'}));
  peers.push({...peers[0],slug:'global-only',name:'Global Only',category:'Other',mcap_usd:20_000_000});
  const fallback={...candidate,slug:'fallback-case',category:'Other'};
  const snapshot={as_of:'2026-11-14',source:'test',floor_usd:0,watchlist:[],protocols:[...peers,candidate,fallback]};
  const {radar}=buildRadar(snapshot), original=JSON.stringify(radar);
  const enriched=withPeerEvidence(radar,snapshot);
  const category=enriched.rows.find(p=>p.slug===candidate.slug), global=enriched.rows.find(p=>p.slug===fallback.slug);
  assert.equal(category.implied_value_usd,6_125_000);
  assert.equal(category.implied_low_usd,3_062_500);
  assert.equal(category.implied_high_usd,9_187_500);
  assert.equal(category.benchmark_peer_count,8);
  assert.deepEqual(category.peers.map(p=>p.slug),['peer-3','peer-4','peer-2','peer-5','peer-1']);
  assert.deepEqual(category.peers.map(p=>p.multiple),[.375,.5,.25,.625,.125]);
  assert.equal(global.benchmark_peer_count,9);
  assert.equal(global.implied_value_usd,7_000_000);
  assert.equal(global.implied_low_usd,3_500_000);
  assert.equal(global.implied_high_usd,10_500_000);
  assert.deepEqual(global.peers.map(p=>p.slug),['peer-4','peer-3','peer-5','peer-2','peer-6']);
  assert.equal(JSON.stringify(radar),original,'Evidence cannot mutate any board fields');
  const reordered={...snapshot,protocols:[...snapshot.protocols].reverse()};
  const reversed=withPeerEvidence(buildRadar(reordered).radar,reordered);
  assert.deepEqual(reversed,enriched,'Peer ties use slug order, independent of input order');
  const edgeCases=[
    {...candidate,slug:'unknown',change_7d:null,listed_at:null},
    {...candidate,slug:'capped',tvl_usd:1e16,change_7d:1000},
    {...candidate,slug:'tiny',tvl_usd:1e-9,change_7d:-1000}
  ];
  const edgeSnapshot={...snapshot,protocols:[...peers,...edgeCases]};
  const edges=withPeerEvidence(buildRadar(edgeSnapshot).radar,edgeSnapshot).rows;
  const unknown=edges.find(p=>p.slug==='unknown');
  assert.match(unknown.driver,/no 7d data; listed age unknown/);
  assert.equal(unknown.implied_value_usd,3_828_125);
  assert.equal(unknown.implied_low_usd,1_914_063);
  assert.equal(unknown.implied_high_usd,5_742_188);
  for(const [slug,limit] of [['capped',1e14],['tiny',1]]){
    const edge=edges.find(p=>p.slug===slug);
    assert.equal(edge.implied_low_usd,limit);assert.equal(edge.implied_value_usd,limit);assert.equal(edge.implied_high_usd,limit);
  }
});

test('every snapshot route has six disjoint day spans and costs that add to the unchanged budget',()=>{
  const snapshot=JSON.parse(readFileSync(new URL('../../token-radar-01-kit/input/snapshot.json',import.meta.url)));
  const {radar}=buildRadar(snapshot);
  const enriched=withPeerEvidence(radar,snapshot);
  for(const row of enriched.rows){
    let nextDay=1,costCents=0;
    for(const step of row.farm_steps){
      const span=step.match(/^Days? (\d+)(?:–(\d+))?: /);
      assert.ok(span,row.slug);assert.equal(+span[1],nextDay,row.slug);
      const end=+(span[2]??span[1]);nextDay=end+1;
      assert.equal(+(step.match(/Time: (\d+) days?;/)?.[1]),end-Number(span[1])+1,row.slug);
      costCents+=Math.round(Number(step.match(/Cost: \$([\d.]+)/)[1])*100);
      assert.ok(step.length>=20&&step.length<=600,row.slug);
    }
    assert.equal(nextDay-1,row.budget.hold_days,row.slug);
    assert.equal(costCents,row.budget.total_cents,row.slug);
    assert.ok(row.implied_low_usd<=row.implied_value_usd&&row.implied_value_usd<=row.implied_high_usd,row.slug);
    assert.ok(row.driver.length>0&&row.driver.length<=110,row.slug);
    assert.equal(row.driver.includes('no 7d data'),row.change_7d===null,row.slug);
    assert.ok(row.driver.includes(row.age_days===null?'listed age unknown':`listed ${row.age_days}d`),row.slug);
  }
});
