# ARGOS — CTO EXECUTION PROGRESS

This file is the operational progress ledger. `docs/ARGOS_BLUEPRINT.md` remains the architectural and quantitative source of truth.

## Active cycle
**P0.2-C — Canonical Execution Boundary & Legacy Bypass Elimination**

### Completed and validated
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

## P0.2-C — Canonical Execution Boundary & Legacy Bypass Elimination

### Batch implemented — validation pending
- [x] Audited canonical production entrypoints: `/api/argos/v6` and `/api/argos/v6/worker` both execute `ArgosMasterOrchestrator`.
- [x] Removed the obsolete `ArgosUnifiedEngine` that exposed an independent legacy quantitative path with ranking/exposure behavior disconnected from the canonical orchestrator.
- [x] Removed the obsolete `DeepAnalysisTest` harness that depended on the legacy engine and synthetic contextual multipliers.
- [x] Removed the obsolete `ProductionDeepAnalysis` script that duplicated production orchestration responsibilities and contained unused legacy-engine imports.
- [x] Identified the legacy `ContextualFactorsEngine` as non-canonical because it converted contextual inputs directly into a multiplicative probability adjustment; it is no longer referenced by the production path.
- [x] Canonical worker path remains explicitly bound to `ArgosMasterOrchestrator`.
- [x] Canonical API path remains explicitly bound to `ArgosMasterOrchestrator`.

### Quantitative boundary now enforced by architecture
- [x] External context is evidence, not an arbitrary probability multiplier.
- [x] Production probability generation remains centralized in the calibrated quantitative chain.
- [x] Legacy synthetic probability paths cannot silently compete with the canonical production engine.
- [x] Telegram/distribution remains downstream of the canonical orchestration path rather than an independent prediction engine.

### Validation gate — OPEN
1. [ ] `pnpm run test:quant` passes on the branch.
2. [ ] `pnpm exec tsc --noEmit` passes.
3. [ ] `pnpm run build` passes.
4. [ ] Vercel deployment for this branch reaches `Ready`.
5. [ ] Production/API smoke test confirms `/api/argos/v6` and `/api/argos/v6/worker` resolve only through the canonical orchestrator.
6. [ ] No repository references remain to the removed legacy engine/test/script.
7. [ ] Only after all gates above: mark this cycle **✓ COMPLETED AND VALIDATED**.

### Next blocks after closure
- [ ] Walk-forward calibration metrics: Brier, Log Loss, reliability/calibration error and calibration slope/intercept by league and vertical.
- [ ] Live signal ledger validation against model probability, executable price and settlement outcomes.
- [ ] Specialist probability-engine audit, beginning with corners and cards.
- [ ] Market-selection breadth audit so goals/BTTS/handicap do not dominate merely because their legacy engines are more mature.
- [ ] Data freshness and re-analysis policy audit for the 48-hour horizon.

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

## Next target
**P0.2-C — Canonical Execution Boundary & Legacy Bypass Elimination — validation gate open**
