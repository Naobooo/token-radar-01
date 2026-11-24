'use strict';
const data = window.RADAR;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categoryOf = row => row.category || 'Uncategorized';
const money = n => n == null ? 'Not recorded' : '$' + (n >= 1e12 ? (n/1e12).toFixed(2)+'T' : n >= 1e9 ? (n/1e9).toFixed(2)+'B' : n >= 1e6 ? (n/1e6).toFixed(2)+'M' : n.toLocaleString('en-US'));
const exactMoney = n => '$'+n.toLocaleString('en-US');
const mult = n => n.toFixed(3)+'×';
const gasMoney = cents => '$'+(cents/100).toFixed(2).replace(/\.00$/,'');
const percentage = n => n == null ? '—' : (n>=0?'+':'')+n.toFixed(2)+'%';
const growthClass = n => n==null ? 'dim' : n>=0 ? 'positive' : 'negative';
const ageOf = row => {
  if (!row.listed_at) return null;
  const days=(Date.parse(data.as_of+'T00:00:00Z')-Date.parse(row.listed_at+'T00:00:00Z'))/86400000;
  return Number.isFinite(days)?Math.max(0,Math.floor(days)):null;
};

// Recompute from snapshot fields and fitted medians, never from the supplied board value.
function impliedOf(row) {
  const multiple=data.fit.categories[categoryOf(row)]?.multiple ?? data.fit.global_multiple;
  const growth=1+(Math.min(60,Math.max(-40,row.change_7d ?? 0))/100)*0.6;
  const maturity=0.75+0.5*Math.min(ageOf(row) ?? 365,1460)/1460;
  return Math.min(100_000_000_000_000,Math.max(1,Math.round(row.tvl_usd*multiple*growth*maturity)));
}
window.impliedOf=impliedOf;

let view='board', sortKey='rank', direction=1;
function options() {
  const all=view==='board'?data.rows:data.live;
  for (const [id,values,title] of [
    ['category',all.map(categoryOf),'All categories'],
    ['chain',all.flatMap(p=>p.chains),'All chains']
  ]) {
    const previous=$(id).value;
    $(id).innerHTML='<option value="">'+title+'</option>'+[...new Set(values)].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if ([...$(id).options].some(o=>o.value===previous)) $(id).value=previous;
  }
}
function draw() {
  const all=view==='board'?data.rows:data.live, query=$('search').value.trim().toLowerCase();
  const category=$('category').value, chain=$('chain').value, floor=Number($('min-tvl').value);
  const rows=all.filter(p=>(!query || (p.name+' '+p.slug).toLowerCase().includes(query)) && (!category || categoryOf(p)===category) && (!chain || p.chains.includes(chain)) && p.tvl_usd>=floor && (!$('watch-only').checked || p.watchlist));
  const sortValue=row=>sortKey==='age_days'?ageOf(row):sortKey==='rank'&&view==='live'?data.live.indexOf(row)+1:row[sortKey];
  rows.sort((a,b)=>{
    const aa=sortValue(a), bb=sortValue(b);
    if (aa==null && bb!=null) return 1;
    if (bb==null && aa!=null) return -1;
    const order=typeof aa==='string'?(aa.toLowerCase()<bb.toLowerCase()?-1:aa.toLowerCase()>bb.toLowerCase()?1:0):(aa??0)-(bb??0);
    return direction*order || (a.slug<b.slug?-1:a.slug>b.slug?1:0);
  });
  $('result-count').innerHTML=`Showing <strong>${rows.length}</strong> of <strong>${all.length}</strong> protocols${category?`<span class="filter-pill">${esc(category)}</span>`:''}${$('watch-only').checked?'<span class="filter-pill">Watchlist only</span>':''}`;
  $('rows').innerHTML=rows.map(p=>{
    const live=view==='live', age=ageOf(p), value=live?p.mcap_usd:impliedOf(p);
    const rank=live?data.live.findIndex(q=>q.slug===p.slug)+1:p.rank;
    const chains=p.chains.slice(0,2).join(' · ') || 'Not recorded';
    return `<tr data-slug="${esc(p.slug)}"><td>${String(rank).padStart(2,'0')}</td><td><a class="name-link" href="#detail=${encodeURIComponent(p.slug)}">${esc(p.name)}</a><div class="row-sub"><span class="chip">${esc(categoryOf(p))}</span>${p.watchlist?'<span class="watch-badge">Watchlist</span>':''}${live?'<span class="watch-badge">Trading</span>':''}</div></td><td><div class="chains" title="${esc(p.chains.join(', '))}">${esc(chains)}${p.chains.length>2?`<span class="chain-count">+${p.chains.length-2}</span>`:''}</div></td><td class="numeric">${money(p.tvl_usd)}</td><td class="numeric ${growthClass(p.change_7d)}">${percentage(p.change_7d)}</td><td class="numeric dim" title="Days since listed, not necessarily protocol launch">${age==null?'Unknown':age.toLocaleString('en-US')+'d'}</td><td class="numeric value" title="${exactMoney(value)}">${money(value)}<small>${live?'OBSERVED MCAP':'MODEL ESTIMATE'}</small></td><td class="arrow">↗</td></tr>`;
  }).join('');
  $('empty').hidden=rows.length>0;
  for(const button of document.querySelectorAll('[data-sort]')) {
    const active=button.dataset.sort===sortKey;
    button.querySelector('span').textContent=active?(direction===1?'↑':'↓'):'';
    button.closest('th').setAttribute('aria-sort',active?(direction===1?'ascending':'descending'):'none');
  }
}
function setView(next) {
  view=next;
  sortKey=next==='board'?'rank':'mcap_usd'; direction=next==='board'?1:-1;
  $('watch-only').checked=false; $('watch-only').disabled=next==='live';
  for(const [id,active] of [['board-tab',next==='board'],['live-tab',next==='live']]) {
    $(id).classList.toggle('active',active); $(id).setAttribute('aria-selected',String(active));
  }
  $('value-heading').dataset.sort=next==='board'?'implied_value_usd':'mcap_usd';
  $('value-heading').innerHTML=(next==='board'?'Implied value':'Market cap')+' <span></span>';
  $('workspace-heading').textContent=next==='board'?'The launch watch':'Already trading';
  $('view-label').textContent=next==='board'?'NO TOKEN RECORDED':'OBSERVED MARKET CAPITALIZATION';
  $('view-description').textContent=next==='board'?'Ranked by implied token value. Select any protocol for the math and a farm plan.':'Top 24 with a token recorded. Real market caps, kept separate from the launch radar.';
  options(); draw();
}
function fact(label,value) { return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`; }
function showDetail(slug) {
  const row=data.rows.find(p=>p.slug===slug) || data.live.find(p=>p.slug===slug);
  if (!row) { closeDetail(); return; }
  const live=row.mcap_usd!==null, age=ageOf(row);
  const fitted=data.fit.categories[categoryOf(row)] || {multiple:data.fit.global_multiple,peer_count:0,source:'global'};
  const growth=1+Math.min(60,Math.max(-40,row.change_7d ?? 0))/100*0.6;
  const maturity=0.75+0.5*Math.min(age ?? 365,1460)/1460;
  const {steps,budget}=window.RADAR_PLAN.planFor(row,age);
  const value=live?row.mcap_usd:impliedOf(row);
  const factor=(label,value,note)=>`<div class="factor"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
  const factors=live?factor('OBSERVED MARKET CAP',money(value),'Trading token · no implied estimate')+factor('TVL',money(row.tvl_usd),'Sealed snapshot'):factor('OBSERVED TVL',money(row.tvl_usd),'Base value from snapshot')+factor('CATEGORY MULTIPLE',mult(fitted.multiple),`${row.benchmark_peer_count ?? fitted.peer_count} peers · ${fitted.source==='global'?'global fallback':'category median'}`)+factor('GROWTH FACTOR',mult(growth),`${percentage(row.change_7d)} over 7 days`)+factor('MATURITY FACTOR',mult(maturity),age==null?'Unknown age → 365d':`${age} days · cap 1,460d`)+factor('IMPLIED TOKEN VALUE',money(value),exactMoney(value)+' · rounded');
  const evidence=live?'':`<div class="detail-evidence"><div class="valuation-range"><span class="eyebrow">PEER VALUE RANGE</span><strong>range ${money(row.implied_low_usd)} – ${money(row.implied_high_usd)}</strong><small>(peer 25th–75th percentile) · same growth &amp; maturity</small></div><section class="peer-benchmarks" aria-label="Peer benchmarks"><div class="peer-heading"><h3>Peer benchmarks</h3><p>median of ${row.benchmark_peer_count} peers · ${fitted.source==='global'?'global fallback':'category peers'}</p></div><ul>${row.peers.map(peer=>`<li><span>${esc(peer.name)}</span><strong>${mult(peer.multiple)}</strong></li>`).join('')}</ul></section></div>`;
  const titles=['Prepare a safe wallet','Establish the core position','Build a weekly record','Keep capital in place','Check rewards safely','Log and unwind'];
  $('detail').innerHTML=`<div class="detail-top"><div class="detail-title"><span class="rank-block">${live?'LIVE':'#'+String(row.rank).padStart(2,'0')}</span><div><h2>${esc(row.name)}</h2>${live?'':`<p class="driver">${esc(row.driver)}</p>`}<div class="eyebrow">${esc(categoryOf(row))} <span>/</span> ${esc(row.chains[0] || 'Chain not recorded')} ${row.watchlist?'<span>/</span> WATCHLIST':''}</div></div></div><button class="detail-close" id="close-detail">← Back to radar</button></div><div class="breakdown">${factors}</div>${evidence}<details class="record"><summary>Snapshot record <span>${esc(row.slug)} · ${esc(row.chains[0] || 'Chain not recorded')} · ${data.as_of}</span></summary><dl class="facts">${fact('Slug',row.slug)}${fact('Category',categoryOf(row))}${fact('Chains',row.chains.join(', ')||'Not recorded')}${fact('TVL',exactMoney(row.tvl_usd))}${fact('7d TVL change',percentage(row.change_7d))}${fact('Listed / age',`${row.listed_at || 'Unknown'} / ${age==null?'unknown':age+' days'}`)}${fact('Market cap',live?exactMoney(row.mcap_usd):'Not recorded')}${fact('CoinGecko ID',row.gecko_id || 'Not recorded')}${fact('Symbol',row.symbol || 'Not recorded')}${fact('Name',row.name)}${fact('Snapshot',data.as_of)}${fact('Record status',live?'Already trading':'No token recorded')}</dl></details>${live?'<p class="plan-caveat live-note">This token already trades. Its actual market cap is shown; it does not enter the pre-token ranking.</p>':`<div class="plan-heading"><h3>Six steps. One accountable budget.</h3><p><strong>${gasMoney(budget.total_cents)} estimated costs</strong> + $${budget.capital} capital <span>·</span> ${budget.hold_days} total days <span>·</span> ${budget.visits} weekly visits</p></div><ol class="plan">${steps.map((s,i)=>`<li><h4>${titles[i]}</h4><p>${esc(s)}</p></li>`).join('')}</ol><p class="plan-caveat">Category-based route, not verified product eligibility. Gas is an estimated per-transaction budget on ${esc(budget.chain)}; fees, queues and supported assets require app checks. Capital can lose value. A points page or launch is not established by this snapshot.</p>`}`;
  $('detail').hidden=false; $('method').hidden=true; $('workspace').hidden=true;
  document.body.classList.add('detail-mode');
  $('close-detail').onclick=()=>{history.replaceState(null,'',location.pathname+location.search);closeDetail();};
  window.scrollTo(0,0);
}
function closeDetail() { $('detail').hidden=true; $('method').hidden=false; $('workspace').hidden=false; document.body.classList.remove('detail-mode'); }
function route() {
  let hash;
  try {hash=decodeURIComponent(location.hash.slice(1));} catch {hash='';}
  if (hash.startsWith('detail=')) {showDetail(hash.slice(7));return;}
  closeDetail();
  if (hash.startsWith('filter=')) {
    if(view!=='board')setView('board');
    $('category').value=hash.slice(7); draw();
  }
}
function initialize() {
  if (!data) { $('workspace-heading').textContent='Build the radar to load the sealed snapshot'; return; }
  $('snapshot-date').textContent=data.as_of;
  $('metrics').innerHTML=[[''+data.protocols_scanned,'Protocols scanned','Across the sealed universe',''],[`${data.watchlist_covered}<small> / ${data.watchlist.length}</small>`,'Watchlist covered','Every required protocol','coverage'],[''+data.board_size,'Pre-token protocols','All eligible records, ranked',''],[''+data.live_size,'Already trading','Observed values, separate view','']].map(([n,label,note,cls])=>`<div class="metric ${cls}"><strong>${n}</strong><span>${label}<small>${note}</small></span></div>`).join('');
  $('board-count').textContent=data.board_size; $('live-count').textContent=data.live_size;
  $('global-median').textContent=mult(data.fit.global_multiple);
  $('peer-count').textContent=data.fit.peer_count+' token peers fitted';
  $('log-error').textContent=data.validation.median_abs_log10_error.toFixed(3);
  $('within').textContent=(data.validation.within_3x*100).toFixed(1)+'%';
  $('validation-note').textContent=`${data.validation.sample_size} positive-cap peers; ${data.validation.excluded_nonpositive} zero-cap errors excluded. TVL × held-out median; growth/maturity apply to pre-token values only.`;
  for(const id of ['search','chain','min-tvl','watch-only']) $(id).addEventListener('input',draw);
  $('category').addEventListener('change',()=>{history.replaceState(null,'',location.pathname+location.search+($('category').value?'#filter='+encodeURIComponent($('category').value):''));draw();});
  $('reset').onclick=()=>{for(const id of ['search','category','chain'])$(id).value='';$('min-tvl').value='0';$('watch-only').checked=false;history.replaceState(null,'',location.pathname+location.search);draw();};
  for(const button of document.querySelectorAll('[data-sort]'))button.onclick=()=>{const key=button.dataset.sort;direction=sortKey===key?-direction:key==='name'||key==='rank'?1:-1;sortKey=key;draw();};
  $('rows').onclick=event=>{const row=event.target.closest('tr');if(row)location.hash='detail='+encodeURIComponent(row.dataset.slug);};
  $('board-tab').onclick=()=>{history.replaceState(null,'',location.pathname+location.search);closeDetail();setView('board');};
  $('live-tab').onclick=()=>{history.replaceState(null,'',location.pathname+location.search);closeDetail();setView('live');};
  window.addEventListener('hashchange',route);
  options();draw();route();
}
initialize();
