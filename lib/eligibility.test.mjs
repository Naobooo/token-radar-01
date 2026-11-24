import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isRankable, buildRadar, boardIssue } from './model.ts';

const candidate = {slug:'candidate',name:'Candidate',category:'Lending',chains:['Ethereum'],tvl_usd:5_000_000,change_7d:null,mcap_usd:null,listed_at:null,gecko_id:null,symbol:null};

test('launch eligibility excludes trading-token products at any TVL', () => {
  for (const category of ['Bridge','Canonical Bridge','Liquid Staking','Liquid Restaking','Restaked BTC','CEX']) {
    assert.equal(isRankable({...candidate,category}),false,category);
  }
  for (const name of ['Wrapped Bitcoin','A STAKED asset','Some staking product','re-wrapped asset','Binance Bitcoin','coinbase product','BYBIT product','Kraken product','Bitget product','OKX product','Bitfinex product','Gemini product','Candidate V2','Candidate v2.1','Candidate 2.0']) {
    assert.equal(isRankable({...candidate,name}),false,name);
  }
  for (const name of ['Candidate','Unwrapped Labs','Restaked Labs','Stakington','The Binance Researcher']) {
    assert.equal(isRankable({...candidate,name}),true,name);
  }
  assert.equal(isRankable({...candidate,category:null}),true);
  for (const field of ['mcap_usd','gecko_id','symbol']) {
    assert.equal(isRankable({...candidate,[field]:field==='mcap_usd'?0:'TOKEN'}),false,field);
  }
});

test('board builder and validator apply product exclusions while covering all 40 watchlist protocols', () => {
  const snapshot=JSON.parse(readFileSync(new URL('../../token-radar-01-kit/input/snapshot.json',import.meta.url)));
  const {board,radar}=buildRadar(snapshot);
  assert.ok(!board.some(row=>['base-bridge','wbtc','binance-bitcoin','usdt0','binance-staked-eth'].includes(row.slug)));
  assert.equal(radar.watchlist_covered,40);
  assert.ok(board.some(row=>row.tvl_usd<50_000_000),'No watchlist TVL floor on the board');
  assert.equal(boardIssue(board,snapshot),null);
  for (const product of [{category:'Bridge'},{name:'Wrapped product'},{name:'Binance product'},{name:'Candidate V2'}]) {
    const contaminated=[{...board[0],...product},...board.slice(1)];
    assert.notEqual(boardIssue(contaminated,snapshot),null,JSON.stringify(product));
  }
});
