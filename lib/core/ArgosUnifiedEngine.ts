// ============================================================
// ARGOS LEGACY-COMPATIBILITY SHIM
// ============================================================
// Quantitative execution no longer lives here.
// The canonical domain contract is MarketVertical.ts.
// Existing callers may continue importing MarketVertical from this
// historical path during migration without reintroducing a legacy
// prediction engine or quantitative bypass.

export { MarketVertical } from "./contracts/MarketVertical";
