# IACTA

Autonomous strategy agents compete on live DreamDEX event-contract windows on Somnia Shannon. The chain records the battle, and every score points back to a transaction.

[Watch the arena](https://easily-synergy-canopener.ngrok-free.dev/arena) · [Somnia Shannon](https://shannon-explorer.somnia.network) · chain `50312` · [`@somnia-chain/markets-sdk` 0.29.0](https://www.npmjs.com/package/@somnia-chain/markets-sdk)

The arena preview uses a temporary ngrok tunnel. Its availability depends on the local preview process.

## The arena in 30 seconds

- Spectators need no wallet connection. The board reads the verified local event ledger.
- Four distinct strategies inspect live binary markets, pass on-chain status and price-grid guards, and place testnet orders when their wallets are funded.
- Fills, mint-a-pair crossings, redemptions, and refusals appear with explorer links.
- Wallets found in indexed DreamDEX fills outside the IACTA roster are shown as external participants. Ownership and strategy remain unverified.

## Verified proof

| Evidence | Receipt or surface |
| --- | --- |
| SECUTOR IOC fill | [transaction](https://shannon-explorer.somnia.network/tx/0xab0e58324ed330dbcf0fbe8ee50e974010c342b18d5e17896268e49c30a8d01b) |
| FRESH and SECUTOR mint-a-pair crossing | [transaction](https://shannon-explorer.somnia.network/tx/0x199f1edb5591bd5a8af5f994ac06dc302158223c357e7d4d99cb563a304b46ed) |
| SECUTOR redemption | [transaction](https://shannon-explorer.somnia.network/tx/0xa173604cc9ca85930bf12650c096278c33e71ad4bdc84bb988edad4d83f26dd4) |
| Autonomous FRESH order | [transaction](https://shannon-explorer.somnia.network/tx/0xb9dded887a0a62b86bf3df2c9d59f21dbaf723a0d471dd6153eed479d2570365) |
| Current spectator surface | [arena preview](https://easily-synergy-canopener.ngrok-free.dev/arena) |

## The invariant

No redemption, no payout credit. The score is `redeemed proceeds + sell proceeds - buy costs`, and every term is backed by a successful transaction receipt.

## How it works

1. Discover a live BTC or ETH binary window and read its venue, pool, status, expiry, and quote scale.
2. Read the order book and recent fills.
3. Run each configured strategy against the same market snapshot.
4. Recheck on-chain status, expiry headroom, tick grid, lot grid, and collateral before every order.
5. Record only successful order and fill receipts in the SQLite ledger.
6. Sweep settled positions, verify `Redeemed` events, and recompute standings from the receipts.

## The gladiators

| Agent | Architecture | Behavior |
| --- | --- | --- |
| RETIARIUS | Two-sided quoting | Posts opposing YES and NO quotes around the live midpoint. |
| SECUTOR | Momentum IOC | Follows recent direction and crosses the best available level. |
| THRAEX | Mean reversion | Fades a move when the latest YES price is extended from its recent mean. |
| MURMILLO | Conservative minimum lot | Trades only in a narrow, stable window with the venue minimum quantity. |

The isolated `FRESH` burner can stand in for RETIARIUS during a funding-blocked proof run. It remains disclosed as a fallback wallet.

## Why this is an arena

| | IACTA | Desk-style product | Gamified app |
| --- | --- | --- | --- |
| Primary view | Public battle board | Private strategy report | User activity feed |
| Score source | Venue fills and redemptions | Self-reported or paper PnL | App points |
| Sponsor mechanism | DreamDEX mint-a-pair is visible | Usually hidden behind an adapter | Not required |
| Wallet UX | No wallet needed to watch | Often operator-focused | Often account-focused |

## Run it yourself

Requirements: Node.js 22 and npm.

```bash
npm install
npm run engine:doctor
npm run engine:test
npm run engine:redeem-sweep -- --dry-run
npm run engine:recompute-standings
npm run engine:negative-proof
```

The loop defaults to read-only dry-run mode:

```bash
npm run engine:loop -- --once
```

To place guarded testnet orders, generate isolated burner wallets, fund their collateral, and opt in explicitly:

```bash
npm run engine:wallets
IACTA_FUND_ROLES=SECUTOR npm run engine:fund
IACTA_LOOP_ROLES=SECUTOR npm run engine:loop -- --once --live
```

Use `IACTA_LOOP_ROLES=FRESH,SECUTOR` for the disclosed two-wallet fallback. The long-running loop keeps redemption sweeping enabled. `--skip-redemptions` is only for a bounded order-path smoke check.

The engine uses a 3M gas ceiling and 9 gwei fee cap by default so a 0.05 STT burner can cover a bounded collateral, approval, order, and redemption path. These settings are configurable through `IACTA_WRITE_GAS_LIMIT` and `IACTA_MAX_FEE_PER_GAS`. The node only charges gas actually used, but its balance check considers the signed transaction envelope.

`npm run engine:negative-proof` submits one deliberately expired order to a real finalized round, records the reverted receipt, and exits. It is a bounded testnet write for the locked-market refusal artifact.

Public endpoints can be changed through `.env.example`. Burner keys belong only in the ignored `engine/.env.local` file. The event ledger is stored locally at `engine/data/iacta.db`.

## FAQ

### Is this an AI model?

The core lineup is four deterministic autonomous strategy processes, not an LLM. Each strategy has a separate wallet attribution, distinct decision rules, and the same order and receipt guards. An LLM agent is outside the core path.

### Are the agents self-dealing?

The lineup uses disclosed burner wallets funded on Somnia Shannon testnet. The verified trading proof currently includes SECUTOR and FRESH, while the loop supports the four named roles when their wallets are funded. This is transparent testnet order flow, not an adoption claim. The score cannot be self-reported because it is recomputed from venue redemption receipts.

### Why no custom contracts?

DreamDEX already supplies the market, pool, mint-a-pair path, settlement, and redemption layer. IACTA adds the strategy loop and spectator surface, so the sponsor venue remains the contract surface and the explorer remains the audit log.

### What does an external participant prove?

Only that a wallet appeared as a maker or taker in indexed DreamDEX fills. The UI does not infer its owner, bot status, or strategy.

## Hackathon compliance

- Testnet: Somnia Shannon, chain `50312`, with burner wallets only.
- SDK: official `@somnia-chain/markets-sdk` pinned to `0.29.0`.
- Custom contracts: none.
- Collateral: the documented DreamDEX test collateral faucet. STT gas is supplied through supported Somnia testnet funding paths.
- Venue addresses: [`BinaryMarketsModule`](https://shannon-explorer.somnia.network/address/0x3ecC694Cef705358864a646142ac17A90E29e388), [`BinarySettlement`](https://shannon-explorer.somnia.network/address/0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23), and [`test collateral`](https://shannon-explorer.somnia.network/address/0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E).
- Protocol references: [DreamDEX market structure](https://app.dreamdex.io/docs/developers/event-contracts/market-structure) and [DreamDEX recipes](https://app.dreamdex.io/docs/developers/event-contracts/recipes).

The chain keeps score. Come watch it happen.
