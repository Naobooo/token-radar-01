// Shared by Node and the page: one source for the six steps and their arithmetic.
const dollars = cents => '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');

function actions(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('lend')) return { core: 'supply USDC, enable only the intended collateral, borrow at most 20% of the supply and resupply the borrowed amount once; keep health factor above 2', weekly: 'repay a small part of the borrow and resupply it once; review utilization and health factor', exit: 'repay the outstanding borrow before withdrawing the supplied collateral', units: 4, weeklyUnits: 2 };
  if (c.includes('cdp')) return { core: 'post collateral and mint the supported debt asset at no more than 20% loan-to-value; keep the minted asset available for repayment', weekly: 'repay and remint a small part of the debt while checking the liquidation buffer', exit: 'repay the minted debt and release the collateral', units: 3, weeklyUnits: 2 };
  if (c.includes('bridge')) return { core: 'bridge USDC into the primary chain, verify receipt, then supply the received asset to a destination-chain lending market if supported', weekly: 'withdraw and resupply a small amount in that destination market; avoid circular bridge volume', exit: 'withdraw the destination position and bridge the balance back', units: 3, weeklyUnits: 2, feeBps: 10 };
  if (c.includes('stak') || c.includes('restaked')) return { core: 'stake the native asset and place the receipt token in a second, unlevered lending venue only if that receipt is supported', weekly: 'check the receipt balance in the second venue and add a small portion of earned rewards if available', exit: 'withdraw receipt tokens from the second venue, then request unstaking; allow any published withdrawal queue', units: 3, weeklyUnits: 1 };
  if (c.includes('derivative') || c.includes('perp') || c.includes('option') || c.includes('basis')) return { core: 'deposit USDC margin and open one small delta-hedged spot/perpetual pair, limiting each leg to 10% of the budget and gross leverage to 1x', weekly: 'rebalance that hedge once and check funding, liquidation distance and realized fees', exit: 'close both hedge legs before withdrawing all available margin', units: 3, weeklyUnits: 2, feeBps: 20 };
  if (c.includes('dex') || c.includes('liquidity')) return { core: 'add balanced liquidity to the highest-TVL supported stable pair in the app; check both asset addresses and the pool fee before approving', weekly: 'make one small swap in the same main pool and inspect LP balances and price divergence', exit: 'remove the LP position and collect available fees', units: 3, weeklyUnits: 1, feeBps: 30 };
  if (c.includes('rwa')) return { core: 'complete any required eligibility check, then mint the supported tokenized yield asset and retain the receipt; skip the route if ineligible', weekly: 'inspect accrued yield and perform one supported reinvestment if a balance is available', exit: 'redeem the yield asset through its published redemption window', units: 2, weeklyUnits: 1 };
  if (c.includes('insurance')) return { core: 'reserve the working capital in the supported cover position and buy a policy protecting that position; read exclusions and expiry before signing', weekly: 'review cover utilization and renew or adjust the policy only through the app', exit: 'close or redeem the covered position after checking the policy expiry', units: 2, weeklyUnits: 1, premium: 500 };
  if (c.includes('curator') || c.includes('allocator')) return { core: 'deposit into a curated lending vault after checking curator permissions, collateral limits and the underlying markets; retain the vault shares', weekly: 'review the curator allocation and add available earned yield to the same curated vault', exit: 'redeem the curated vault shares through its withdrawal queue', units: 2, weeklyUnits: 1 };
  if (c.includes('yield') || c.includes('farm')) return { core: 'deposit into the supported auto-compounding stablecoin vault; verify the underlying pool and retain the vault shares', weekly: 'check the vault auto-compound event and redeposit available yield only if compounding is manual', exit: 'redeem the vault shares and withdraw the underlying assets', units: 2, weeklyUnits: 1 };
  return { core: 'deposit USDC or the supported base asset in the main deposit product and retain the position receipt; verify withdrawal terms first', weekly: 'inspect the deposit receipt and add available earned yield to that same position if supported', exit: 'redeem the deposit receipt and withdraw the underlying assets', units: 2, weeklyUnits: 1 };
}

function planFor(row, age) {
  const chain = row.chains[0] || 'primary chain (unspecified)';
  const gas = chain === 'Ethereum' ? 900 : ['Arbitrum', 'Base', 'Optimism'].includes(chain) ? 60 : chain === 'Solana' ? 15 : 200;
  const capital = row.tvl_usd >= 1e9 ? 250 : row.tvl_usd >= 1e8 ? 100 : row.tvl_usd >= 5e7 ? 75 : 50;
  const days = (age ?? 365) < 180 ? 60 : (age ?? 365) < 365 ? 45 : 30;
  const visits = Math.floor(days / 7);
  const a = actions(row.category);
  const reserve = Math.round(capital * 100 * (a.feeBps || 0) / 10000) + (a.premium || 0);
  const setup = gas * a.units + reserve;
  const weekly = gas * a.weeklyUnits;
  const exit = gas * a.units;
  const total = setup + visits * weekly + exit;
  const steps = [
    `Create a fresh wallet for ${row.name} on ${chain}; store the seed offline, verify the app from independent official references, and cap approvals at the planned amount. Cost: $0; do not connect a treasury wallet. Time: 5 minutes.`,
    `On ${chain}, ${a.core}. Working capital: $${capital}. Cost: ${dollars(setup)} budget (${a.units} transactions at ${dollars(gas)} gas each plus ${dollars(reserve)} fee/premium reserve). Time: 15 minutes.`,
    `On ${chain}, ${a.weekly}. Repeat on days 7, 14 and each seventh day through day ${days}: ${visits} visits. Cost: ${dollars(weekly)}/week (${a.weeklyUnits} transactions at ${dollars(gas)}); reuse the existing capital. Time: 10 minutes/week.`,
    `Hold the ${row.name} position on ${chain} for ${days} days, with $${capital} of capital locked or reserved throughout. Cost: $0 extra scheduled spend; interest, asset loss and opportunity cost are excluded. Time: ${days} days; monitor the position between weekly visits.`,
    `Open ${row.name}'s own points/rewards page on ${chain}, if available, and record eligibility without signing. Never pay an upfront claim fee or reveal a seed; any actual onchain claim needs a separate budget. Cost: $0. Time: 10 minutes near the end of the hold.`,
    `Log dates, wallet and transaction IDs on ${chain}; ${a.exit}, then revoke remaining approvals. Cost: ${dollars(exit)} gas for ${a.units} transactions. Time: 15 minutes plus any queue. Plan total: about ${dollars(total)} in costs plus $${capital} of working capital over ${days} days.`
  ];
  return {steps, budget:{chain,capital,hold_days:days,visits,gas_cents:gas,setup_cents:setup,weekly_cents:weekly,exit_cents:exit,total_cents:total}};
}
// Classic script support lets the offline dashboard open directly from disk.
globalThis.RADAR_PLAN = { planFor };
