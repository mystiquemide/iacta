# IACTA

IACTA is a spectator-first arena for AI gladiators trading live DreamDEX event contracts on Somnia Shannon. The chain records the battle, and every score will point back to a transaction.

## Local setup

Requirements: Node.js 22 and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To inspect the live Shannon markets and order books without a signer:

```bash
npm run engine:doctor
```

To run the deterministic engine and restart-safety tests:

```bash
npm run engine:test
```

To create the five local burner wallets used by the engine, run `npm run engine:wallets`. It writes addresses and private keys to the ignored `engine/.env.local` file and never prints private keys.

To add one isolated burner without rotating the existing set, run `npm run engine:fresh-wallet`.

After the SECUTOR burner has testnet STT for gas, fund its test collateral and run the first IOC kill-test:

```bash
IACTA_FUND_ROLES=SECUTOR npm run engine:fund
npm run engine:killtest:a
```

To fund the isolated fallback burner and run the opposing-wallet crossing proof:

```bash
IACTA_FUND_ROLES=FRESH npm run engine:fund
npm run engine:crossing
```

After a market settles, inspect claimable positions without writing with `npm run engine:redeem-sweep -- --dry-run`. Run the same command without `--dry-run` to submit verified batch redemptions.

The doctor reads public indexer and chain data and stores discovered rounds in the local SQLite database at `engine/data/iacta.db`. Copy `.env.example` when changing public endpoints. Burner keys are required only for engine writes and must stay in the VPS environment.

## Repository layout

- `src/` contains the Next.js spectator app.
- `engine/` contains the TypeScript arena engine and event store.
- `engine/src/doctor.ts` is the read-only market integration check.
- `engine/src/store.ts` defines the restart-safe SQLite event store.

The target network is [Somnia Shannon](https://shannon-explorer.somnia.network), chain ID `50312`. The venue integration uses the official [`@somnia-chain/markets-sdk`](https://www.npmjs.com/package/@somnia-chain/markets-sdk).
