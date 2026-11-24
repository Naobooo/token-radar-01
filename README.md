[![make.fun - token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Naobooo/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Naobooo/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Built for the [make.fun token-radar-01 bounty](https://make.fun/bounty/token-radar-01).

# Token Launch Radar

An offline dashboard fitted from a sealed protocol snapshot. It ranks every eligible protocol with no token recorded and keeps the 24 largest trading tokens in a separate view.

Run with Node 22.18 or later, without installing dependencies:

```powershell
$env:MAKEFUN_OUTPUT_DIR='out'
node main.ts --input ..\token-radar-01-kit\input\snapshot.json
```

Open `out/dashboard/index.html` in a browser. All scripts and styles are local. `#detail=<slug>` opens a protocol; `#filter=Lending` selects a category.

The estimator uses winsorized trading-peer market-cap/TVL medians by category, with a global fallback below eight peers, then growth and maturity factors. Its check excludes each token from its fitted peers before comparing TVL times the held-out median with actual market cap. This evaluates the multiple estimator; the growth/maturity overlay is a pre-token assumption.

Farm plans are category templates with explicit capital, transaction counts, weekly cadence and cost arithmetic. They assume supported products and eligibility, which must be checked in the actual app. A snapshot record does not establish a launch, points program or product availability.

`vendor/makefun-board.ts` is the kit's unchanged dossier builder. Screenshots were captured from this dashboard. MIT licensed.
