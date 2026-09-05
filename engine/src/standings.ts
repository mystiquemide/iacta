import type { FillRecord, RedemptionRecord } from "./store.js";

export interface StandingRow {
  agentId: string;
  /** Raw collateral units. Every component is backed by a stored tx hash. */
  score: string;
  redeemedProceeds: string;
  sellProceeds: string;
  buyCosts: string;
  redemptionTxHashes: string[];
  fillTxHashes: string[];
}

interface MutableStanding {
  redeemedProceeds: bigint;
  sellProceeds: bigint;
  buyCosts: bigint;
  redemptionTxHashes: string[];
  fillTxHashes: string[];
}

function requireTxHash(value: string, kind: string): string {
  if (!value.trim()) throw new Error(`${kind} transaction hash is required for standings`);
  return value;
}

function amount(value: string, kind: string): bigint {
  let parsed: bigint;
  try {
    parsed = BigInt(value);
  } catch {
    throw new Error(`${kind} amount is not an integer`);
  }
  if (parsed < 0n) throw new Error(`${kind} amount cannot be negative`);
  return parsed;
}

function appendUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function outcomePrice(fill: FillRecord, quoteOne: bigint): bigint {
  const price = amount(fill.price, "fill price");
  if (price > quoteOne) throw new Error("fill price exceeds the binary quote scale");
  return fill.side.endsWith("_NO") ? quoteOne - price : price;
}

export function computeStandings(
  agentIds: readonly string[],
  fills: readonly FillRecord[],
  redemptions: readonly RedemptionRecord[],
  quoteOneByMarket: ReadonlyMap<string, bigint>,
): StandingRow[] {
  const ledger = new Map<string, MutableStanding>();
  const get = (agentId: string): MutableStanding => {
    const existing = ledger.get(agentId);
    if (existing) return existing;
    const created: MutableStanding = {
      redeemedProceeds: 0n,
      sellProceeds: 0n,
      buyCosts: 0n,
      redemptionTxHashes: [],
      fillTxHashes: [],
    };
    ledger.set(agentId, created);
    return created;
  };

  for (const agentId of agentIds) get(agentId);

  for (const fill of fills) {
    const txHash = requireTxHash(fill.txHash, "fill");
    const quoteOne = quoteOneByMarket.get(fill.marketId.toLowerCase());
    if (quoteOne === undefined || quoteOne <= 0n) {
      throw new Error(`missing quote scale for market ${fill.marketId}`);
    }
    const quantity = amount(fill.quantity, "fill quantity");
    if (quantity <= 0n) throw new Error("fill quantity must be positive");
    const value = (outcomePrice(fill, quoteOne) * quantity) / quoteOne;
    const row = get(fill.agentId);
    appendUnique(row.fillTxHashes, txHash);
    switch (fill.side) {
      case "BUY_YES":
      case "BUY_NO":
        row.buyCosts += value;
        break;
      case "SELL_YES":
      case "SELL_NO":
        row.sellProceeds += value;
        break;
      default:
        throw new Error(`unsupported fill side ${fill.side}`);
    }
  }

  for (const redemption of redemptions) {
    const txHash = requireTxHash(redemption.txHash, "redemption");
    const row = get(redemption.agentId);
    row.redeemedProceeds += amount(redemption.proceeds, "redemption proceeds");
    appendUnique(row.redemptionTxHashes, txHash);
  }

  return [...ledger.entries()]
    .map(([agentId, row]) => ({
      agentId,
      score: (row.redeemedProceeds + row.sellProceeds - row.buyCosts).toString(),
      redeemedProceeds: row.redeemedProceeds.toString(),
      sellProceeds: row.sellProceeds.toString(),
      buyCosts: row.buyCosts.toString(),
      redemptionTxHashes: row.redemptionTxHashes,
      fillTxHashes: row.fillTxHashes,
    }))
    .sort((left, right) => {
      const scoreDelta = BigInt(right.score) - BigInt(left.score);
      return scoreDelta === 0n ? left.agentId.localeCompare(right.agentId) : scoreDelta > 0n ? 1 : -1;
    });
}
