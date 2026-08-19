# ARGOS — CTO EXECUTION PROGRESS

This file is the operational progress ledger. `docs/ARGOS_BLUEPRINT.md` remains the architectural and quantitative source of truth.

## Active cycle
**P1.1 — Out-of-Sample Calibration Integrity**

### P0.2-C — Canonical Execution Boundary & Legacy Bypass Elimination — ✓ COMPLETED AND VALIDATED
- [x] Asian handicap integer-line PUSH settlement corrected.
- [x] Team-history feature extraction corrected to distinguish home/away orientation.
- [x] Non-conservative probability inflation from learning removed.
- [x] Binary calibration preserves complementarity.
- [x] TypeScript dependency/lockfile mismatch corrected.
- [x] Optional-probability TypeScript narrowing in `ModelFactory` corrected.
- [x] Model probability separated from market-reference probability.
- [x] H2H removed as an arbitrary direct 10% probability blend.
- [x] Legacy artificial probability inflation removed.
- [x] Signal distribution idempotency strengthened to include market line.
- [x] Signal provenance semantics strengthened.
- [x] Analysis horizon restricted to 48 hours.
- [x] Stale queued matches are prevented from reaching the analysis worker.
- [x] Quantitative CI gate and statistical invariant suite established.
- [x] Opponent-aware scoring features implemented and validated.
- [x] Sparse samples shrink attack and defence toward league-neutral priors.
- [x] Arbitrary RAG probability-driving bias removed.
- [x] Online learning/calibration constrained by minimum sample, prior shrinkage and bounded adjustment.
- [x] Immutable signal provenance schema, snapshotting, deterministic hashing and replay verification implemented.
- [x] Provenance quantitative invariants implemented and validated.
- [x] Provenance replay cycle validated through Ready deployments and accepted validation.
- [x] Signal snapshots migrated from the removed quantitative engine to the canonical `ArgosSignal` contract; deployment `d62ff5c` validated Ready.
- [x] Canonical production entrypoints audited and bound to `ArgosMasterOrchestrator`.
- [x] Obsolete quantitative execution/harness bypasses removed.
- [x] `MarketVertical` extracted into a pure canonical domain contract.
- [x] Historical `ArgosUnifiedEngine.ts` reduced to compatibility-only contract re-export.
- [x] Canonical quantitative boundary validated by accepted Ready deployment `a1b0679`.

## P1.1 — Out-of-Sample Calibration Integrity
### Implementation batch
- [x] Replaced raw historical average prediction-vs-outcome bias with a time-split calibration fit.
- [x] Calibration training and validation windows are temporally separated.
- [x] Calibration promotion is gated by out-of-sample Brier performance.
- [x] Calibration adjustment is bounded to a conservative logit intercept.
- [x] Calibration remains isolated from EV calculation and market-reference construction.
- [ ] Add pure calibration-math invariant tests.
- [ ] Validate `pnpm run test:quant`.
- [ ] Validate `pnpm exec tsc --noEmit`.
- [ ] Validate `pnpm run build`.
- [ ] Validate Vercel deployment reaches `Ready`.
- [ ] Validate real-data signal probabilities after calibration change.
- [ ] Mark P1.1 ✓ only after every gate passes.

### Following P1.1 blocks
- [ ] Specialist probability engine for corners with league/team sample controls.
- [ ] Specialist probability engine for cards with referee/team/context features.
- [ ] Market breadth and dominance audit across goals, BTTS, handicap, corners and cards.
- [ ] Fair-price / EV / CLV measurement integrity.
- [ ] Settlement expansion with verified PropLine outcome/stat contracts.
- [ ] Walk-forward league/vertical calibration reports.
- [ ] Drift detection and champion/challenger model governance.
- [ ] Opportunity ranking across matches and markets.

## Operating protocol
```text
CYCLE START
→ repository/path audit
→ batch related fixes
→ quantitative tests
→ typecheck/build
→ deployment
→ READY
→ real-data validation
→ update this ledger
→ next cycle
```

No-veto principle: internal analysis is broad and observations are retained. Publication policies may rank/filter outputs but do not erase research evidence.

## Quantitative doctrine
- No artificial probability uplift.
- No arbitrary contextual percentage blends.
- No circular model→market→model contamination.
- Binary probability families must remain complementary.
- Multiclass probabilities must conserve total probability.
- EV must be computed from an explicitly identified probability and an explicitly identified executable price.
- Fair price and market price must remain separate objects.
- A fair-price reference derived from the market cannot be labeled as independent model probability.
- Every published signal must eventually be reproducible from stored inputs, model version, feature set, timestamp, price snapshot, and decision path.
- Publication filters may select/rank evidence but must not silently alter the underlying quantitative result.
- Contextual/RAG evidence may modify features only through calibrated, auditable model components.
- Calibration must be trained on past observations and promoted only from a temporally separated validation set.
