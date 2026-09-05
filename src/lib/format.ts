const QUOTE_DECIMALS = 6;
const QUOTE_ONE = 10 ** QUOTE_DECIMALS;

function toNumber(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

/** Collateral amount. The venue quote has 6 decimals, so raw units are micro-collateral. */
export function formatUnits(raw: string, fractionDigits = 6): string {
  const value = toNumber(raw) / QUOTE_ONE;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Binary contract price in 0..1, stored with quote decimals. */
export function formatPrice(raw: string, fractionDigits = 4): string {
  const value = toNumber(raw) / QUOTE_ONE;
  return value.toFixed(fractionDigits);
}

/** Share quantity, stored in base units. */
export function formatQuantity(raw: string): string {
  return toNumber(raw).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function signedUnits(raw: string): string {
  const value = toNumber(raw) / QUOTE_ONE;
  const formatted = formatUnits(raw);
  return value > 0 ? `+${formatted}` : formatted;
}

export function isNegative(raw: string): boolean {
  return toNumber(raw) < 0;
}

/** HH:MM:SS UTC from an ISO timestamp. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "--:--:--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toISOString().slice(11, 19);
}

/** YYYY-MM-DD from an ISO timestamp. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return `${formatDate(iso)} ${formatTime(iso)} UTC`;
}

export function formatWindow(tradingStart: number, expiry: number): string {
  const start = new Date(tradingStart * 1000);
  const end = new Date(expiry * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
  return `${formatDate(start.toISOString())} ${start.toISOString().slice(11, 19)} – ${end
    .toISOString()
    .slice(11, 19)} UTC`;
}

export function formatCountdown(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "--:--";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function shortHash(hash: string | null | undefined): string {
  if (!hash) return "-";
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function shortMarketId(marketId: string): string {
  if (marketId.length <= 10) return marketId;
  return `0x…${marketId.slice(-6)}`;
}

export { QUOTE_DECIMALS, QUOTE_ONE };
