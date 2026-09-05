export type BuySide = "BUY_YES" | "BUY_NO";

export interface VenueMarket {
  venueId?: string | null;
}

export function chooseVenue(markets: readonly VenueMarket[], preferred?: string): string | undefined {
  if (preferred) return preferred;
  const counts = new Map<string, number>();
  for (const market of markets) {
    if (market.venueId) counts.set(market.venueId, (counts.get(market.venueId) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

export function collateralRequired(
  side: BuySide,
  quoteOne: bigint,
  price: bigint,
  quantity: bigint,
): bigint {
  const outcomePrice = side === "BUY_NO" ? quoteOne - price : price;
  return (outcomePrice * quantity + quoteOne - 1n) / quoteOne;
}
