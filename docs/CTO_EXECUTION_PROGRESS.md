# ARGOS — CTO EXECUTION PROGRESS

This file is the operational progress ledger. `docs/ARGOS_BLUEPRINT.md` remains the architectural and quantitative source of truth.

## Active cycle
**P0.2-B — Provenance Replay & Walk-Forward Calibration**

### Previously completed and validated
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

### Current batch IMPLEMENTED — validation pending
**Immutable signal provenance + replay**

- [x] Added additive `argos_signal_ledger` provenance schema: model version, analysis/odds timestamps, model probability, market-implied probability, fair odd, executable odd, immutable snapshot and SHA-256 hash.
- [x] Applied the provenance schema migration to the connected production Supabase project and verified all nine columns exist.
- [x] Centralized deterministic provenance hashing in `lib/argos/provenance/SignalProvenance.ts`.
- [x] Signal distribution now persists a provenance snapshot/hash alongside every newly recorded published signal.
- [x] Added protected `replay-signal` audit endpoint that verifies the stored snapshot against its hash without recalculating the prediction.
- [x] Added quantitative invariants for deterministic hashing and mutation detection.

### Validation gate — NOT YET CLOSED
1. [ ] `pnpm run test:quant` passes on the branch.
2. [ ] `pnpm exec tsc --noEmit` passes.
3. [ ] `pnpm run build` passes.
4. [ ] Vercel deployment for this branch reaches `Ready`.
5. [ ] Real-data replay of at least one newly generated signal returns `PROVENANCE_VERIFIED`.
6. [ ] Only after all five gates above: mark the cycle **✓ COMPLETED AND VALIDATED**.

The database migration itself has been applied and structurally verified. Code/build validation is intentionally not fabricated: the available Vercel integration currently returns `403 Not authorized` for deployment inspection, so the branch must produce a real Ready deployment before this ledger is closed.

### Next blocks after closure
- [ ] Verify all legacy/compatibility callers cannot bypass the canonical orchestrator.
- [ ] Walk-forward calibration metrics: Brier, Log Loss and reliability/calibration error by league and vertical.
- [ ] Validate the live signal ledger against model probability, executable price and settlement outcomes.
- [ ] Audit specialist probability engines, especially corners/cards, under the same quantitative discipline.

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

## Next target
**P0.2-B — Provenance Replay & Walk-Forward Calibration — validation gate open**
