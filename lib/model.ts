import '../dashboard/plans.js';
const planFor = globalThis.RADAR_PLAN.planFor;

export interface Protocol {
  slug: string; name: string; category: string | null; chains: string[];
  tvl_usd: number; change_7d: number | null; mcap_usd: number | null;
  listed_at: string | null; gecko_id: string | null; symbol: string | null;
}
export interface Snapshot { as_of: string; source: string; floor_usd: number; protocols: Protocol[]; watchlist: string[] }
export interface Fit { global_multiple: number; peer_count: number; categories: Record<string, {multiple:number; peer_count:number; source:string}> }
export const MODEL = {ratio_floor:0.01, ratio_cap:10, minimum_peers:8, growth_floor:-40, growth_cap:60, growth_weight:0.6, maturity_floor:0.75, maturity_range:0.5, maturity_days:1460, unknown_age_days:365, value_cap:100_000_000_000_000};
const lexical = (a:string,b:string) => a < b ? -1 : a > b ? 1 : 0;
const categoryOf = (p:Protocol) => p.category ?? 'Uncategorized';
const clamp = (n:number,lo:number,hi:number) => Math.min(hi,Math.max(lo,n));
export const median = (values:number[]):number => {
  if (!values.length) throw new Error('Cannot fit a median without peers');
  const v=[...values].sort((a,b)=>a-b), m=Math.floor(v.length/2);
  return v.length%2 ? v[m] : (v[m-1]+v[m])/2;
};
export const hasToken = (p:Protocol) => p.mcap_usd !== null && p.gecko_id !== null && p.symbol !== null;
export const isRankable = (p:Protocol) => p.mcap_usd===null && p.gecko_id===null && p.symbol===null && p.category!=='CEX' && !/\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/.test(p.name);
const tokenPeers = (protocols:Protocol[]) => protocols.filter(p=>hasToken(p) && p.tvl_usd>=5_000_000);
const ratioOf = (p:Protocol) => clamp(p.mcap_usd! / p.tvl_usd, MODEL.ratio_floor, MODEL.ratio_cap);

export function fitModel(protocols:Protocol[]):Fit {
  const peers=tokenPeers(protocols), global=median(peers.map(ratioOf));
  const categories:Fit['categories']={};
  for (const category of [...new Set(protocols.map(categoryOf))].sort(lexical)) {
    const ratios=peers.filter(p=>categoryOf(p)===category).map(ratioOf);
    categories[category]={multiple:ratios.length>=MODEL.minimum_peers?median(ratios):global,peer_count:ratios.length,source:ratios.length>=MODEL.minimum_peers?'category':'global'};
  }
  return {global_multiple:global,peer_count:peers.length,categories};
}

export function validateModel(protocols:Protocol[]) {
  const peers=tokenPeers(protocols);
  const predictions=peers.map(p=>{
    const others=peers.filter(q=>q.slug!==p.slug);
    const own=others.filter(q=>categoryOf(q)===categoryOf(p));
    const multiple=median((own.length>=MODEL.minimum_peers?own:others).map(ratioOf));
    const prediction=p.tvl_usd*multiple;
    const error=p.mcap_usd!>0?Math.abs(Math.log10(prediction/p.mcap_usd!)):null;
    return {slug:p.slug,multiple,prediction,actual:p.mcap_usd!,error};
  });
  const measured=predictions.filter(p=>p.error!==null);
  return {sample_size:measured.length,excluded_nonpositive:peers.length-measured.length,median_abs_log10_error:median(measured.map(p=>p.error!)),within_3x:measured.filter(p=>p.error!<=Math.log10(3)).length/measured.length,predictions};
}

export function ageDays(asOf:string, listed:string|null):number|null {
  if (!listed) return null;
  const end=Date.parse(asOf+'T00:00:00Z'), start=Date.parse(listed+'T00:00:00Z');
  return Number.isFinite(end) && Number.isFinite(start) ? Math.max(0,Math.floor((end-start)/86_400_000)) : null;
}
export function estimate(p:Protocol,asOf:string,fit:Fit) {
  const age=ageDays(asOf,p.listed_at), category=fit.categories[categoryOf(p)];
  const multiple=category?.multiple ?? fit.global_multiple;
  const growth=1+clamp(p.change_7d ?? 0,MODEL.growth_floor,MODEL.growth_cap)/100*MODEL.growth_weight;
  const maturity=MODEL.maturity_floor+MODEL.maturity_range*Math.min(age ?? MODEL.unknown_age_days,MODEL.maturity_days)/MODEL.maturity_days;
  return {age_days:age,category_multiple:multiple,peer_count:category?.peer_count ?? 0,multiple_source:category?.source ?? 'global',growth_multiplier:growth,maturity_multiplier:maturity,implied_value_usd:Math.min(MODEL.value_cap,Math.max(1,Math.round(p.tvl_usd*multiple*growth*maturity)))};
}

export function buildRadar(snapshot:Snapshot) {
  const fit=fitModel(snapshot.protocols), {predictions,...validation}=validateModel(snapshot.protocols);
  const watch=new Set(snapshot.watchlist);
  const board=snapshot.protocols.filter(isRankable).map(p=>{
    const result=estimate(p,snapshot.as_of,fit), plan=planFor(p,result.age_days);
    return {...p,...result,rank:0,watchlist:watch.has(p.slug),token_status:'pre-token',farm_steps:plan.steps,budget:plan.budget};
  }).sort((a,b)=>b.implied_value_usd-a.implied_value_usd || lexical(a.slug,b.slug));
  board.forEach((p,i)=>p.rank=i+1);
  const live=snapshot.protocols.filter(hasToken).sort((a,b)=>b.mcap_usd!-a.mcap_usd! || lexical(a.slug,b.slug)).slice(0,24);
  const radar={as_of:snapshot.as_of,source:snapshot.source,floor_usd:snapshot.floor_usd,protocols_scanned:snapshot.protocols.length,watchlist:snapshot.watchlist,watchlist_covered:board.filter(p=>p.watchlist).length,board_size:board.length,live_size:live.length,model:MODEL,fit,validation,rows:board,live};
  return {board,radar};
}

export function boardIssue(board:ReturnType<typeof buildRadar>['board'],snapshot:Snapshot):string|null {
  const known=new Set(snapshot.protocols.map(p=>p.slug)), seen=new Set<string>();
  if (board.length<100 || board.length>4000) return 'row count';
  for (let i=0;i<board.length;i++) {
    const row=board[i];
    if (!known.has(row.slug) || seen.has(row.slug) || !isRankable(row)) return 'unknown, duplicate or trading row '+row.slug;
    seen.add(row.slug);
    if (row.rank!==i+1 || !Number.isSafeInteger(row.implied_value_usd) || row.implied_value_usd<1 || row.implied_value_usd>MODEL.value_cap || (i>0 && row.implied_value_usd>board[i-1].implied_value_usd)) return 'rank or value '+row.slug;
    if (row.farm_steps.length!==6 || row.farm_steps.some((s:string)=>s.trim().length<20 || s.trim().length>600)) return 'farm plan '+row.slug;
  }
  if (snapshot.watchlist.some(s=>!seen.has(s))) return 'watchlist coverage';
  if (new Set(board.map(p=>p.implied_value_usd)).size<2) return 'flat ranking';
  return null;
}

export function parseSnapshot(raw:string):Snapshot {
  const snapshot=JSON.parse(raw);
  if (!Array.isArray(snapshot.protocols) || !Array.isArray(snapshot.watchlist) || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.as_of)) throw new Error('Malformed snapshot');
  return snapshot;
}
export function dataScript(radar:ReturnType<typeof buildRadar>['radar']):string {
  return 'window.RADAR = '+JSON.stringify(radar).replace(/</g,'\\u003c')+';\n';
}
