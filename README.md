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

The doctor reads public indexer and chain data and stores discovered rounds in the local SQLite database at `engine/data/iacta.db`. Copy `.env.example` when changing public endpoints. Burner keys are required only for engine writes and must stay in the VPS environment.

## Repository layout

- `src/` contains the Next.js spectator app.
- `engine/` contains the TypeScript arena engine and event store.
- `engine/src/doctor.ts` is the read-only market integration check.
- `engine/src/store.ts` defines the restart-safe SQLite event store.

The target network is [Somnia Shannon](https://shannon-explorer.somnia.network), chain ID `50312`. The venue integration uses the official [`@somnia-chain/markets-sdk`](https://www.npmjs.com/package/@somnia-chain/markets-sdk).
