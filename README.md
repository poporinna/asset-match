# WealthLens

Asset-declaration reconciliation on [GenLayer](https://genlayer.com). A reporter files a public official's declared assets alongside a public-record extract; a panel of validators estimates the unexplained-wealth gap, freezes a verdict, and pays the reporter a band-scaled bounty from a shared pool.

## How it works

1. Fund the pool: anyone attaches GEN to `fund_pool` to stock the investigation bounty pool.
2. Report a subject: a reporter submits the subject, their declared assets, and a public-record extract.
3. Reconcile: a validator panel reads both texts through an LLM and estimates the unexplained-wealth gap in whole USD, agreeing on the gap's order of magnitude and which independent record types concur.
4. Rule: the gap is frozen into a verdict band — CONSISTENT at or below $25,000, UNEXPLAINED_WEALTH at or above $250,000, DISCREPANCY in between.
5. Award: the reporter is paid a band-scaled share of the pool — 100% for unexplained wealth, 40% for a discrepancy, nothing for a consistent declaration.

## Architecture

```
backend/asset-match.py   GenLayer Intelligent Contract (Python, runs on the GenVM)
frontend/                React + Vite + TypeScript dashboard (genlayer-js)
```

Because the gap can range from thousands to billions, consensus is judged on the base-10 magnitude bucket plus a relative tolerance, so two juries must agree on the scale of the gap rather than on an exact figure.

## Live deployment

- **Network**: GenLayer Asimov Testnet (chain id 4221)
- **Contract**: `0x1aca6eE1D0913817665d3C72fEAcf35eacE3DC38`
- **App**: https://poporinna.github.io/asset-match/

## Run locally

```bash
cd frontend
npm install
npm run dev
npm run build
```

The committed `.env` holds the public Asimov config; no secrets are required. Copy `.env.example` to `.env.local` only to override.

## Environment variables

| Name | Required | Description |
|------|----------|-------------|
| `VITE_CONTRACT_ADDRESS` | yes | Deployed WealthLens contract on Asimov |
| `VITE_CHAIN_ID` | yes | GenLayer chain id (4221) |
| `VITE_RPC_URL` | yes | Asimov JSON-RPC endpoint |

## Deploy the contract

```bash
npx genlayer deploy --contract backend/asset-match.py
```

## Contract methods (`WealthLens`)

| Method | Type | Description |
|--------|------|-------------|
| `fund_pool` | payable | Add attached GEN to the investigation bounty pool. |
| `report_subject` | write | File a subject with their declared assets and a public-record extract. |
| `reconcile` | write | LLM jury estimates the unexplained-wealth gap and the concurring source types. |
| `rule` | write | Freeze the verdict band from the reconciled gap. |
| `award_bounty` | write | Pay the reporter a band-scaled bounty out of the pool. |
| `get_case` | view | Full case record: reporter, texts, gap, verdict, concurrence, rationale. |
| `get_step` | view | Current lifecycle stage name. |
| `get_verdict` | view | The frozen verdict string. |
| `get_gap` | view | Gap in whole USD with its base-10 magnitude bucket. |
| `get_concurrence` | view | Five-way concurring-source flags and their count. |
| `describe_source` | view | Human-readable label for a source key. |
| `get_reporter` | view | Address that filed the case, as checksummed hex. |
| `get_rationale` | view | The jury's stored rationale for the case. |
| `get_bounty_estimate` | view | Current payout estimate (percent and GEN) against the live pool. |
| `describe_bands` | view | Configured monetary thresholds and bounty percentages. |
| `get_pool_balance` | view | Pool and paid-out totals in GEN. |
| `get_subject` | view | Name of the official under review. |
| `get_summary` | view | Compact one-line case digest for dashboards. |
| `get_stats` | view | Reported, ruled, and unexplained-wealth counters. |

## License

MIT
