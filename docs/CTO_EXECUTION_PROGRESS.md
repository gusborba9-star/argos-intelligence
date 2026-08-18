# ARGOS — CTO EXECUTION PROGRESS

This file is the operational progress ledger. `docs/ARGOS_BLUEPRINT.md` remains the architectural and quantitative source of truth.

## Active cycle
**P0.2 — Canonical Execution Path & Quantitative Provenance**

### Completed and validated
- Asian handicap integer-line PUSH settlement corrected.
- Team-history feature extraction corrected to distinguish home/away orientation.
- Non-conservative probability inflation from learning removed.
- Binary calibration preserves complementarity.
- TypeScript dependency/lockfile mismatch corrected.
- Optional-probability TypeScript narrowing in `ModelFactory` corrected.
- Model probability separated from market-reference probability; market reference no longer directly becomes the model probability through the audited path.
- H2H removed as an arbitrary direct 10% probability blend; retained as contextual data for future calibrated feature use.
- Legacy `ArgosUnifiedEngine` artificial `+2%` probability inflation removed.
- Deployment `2ab2671` reached `Ready` in Production after the latest correction.

### Current execution batch
- Prove the canonical production path from PropLine ingestion to FREE/VIP Telegram publication.
- Trace every active orchestrator and identify legacy/parallel execution paths.
- Audit `ModelFactory`, `FairOddsCalculator`, `OddsValueEngine`, `SignalDistributionEngine`, and their contracts as one quantitative chain.
- Verify that model probability, market implied probability, sharp reference, fair probability, published probability, EV, edge, and Kelly remain semantically distinct.
- Identify dead, duplicate, compatibility-only, and production-critical files before introducing new engines.
- Add provenance/observability where the current chain cannot explain how a published signal was produced.

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
- Every published signal must eventually be reproducible from stored inputs, model version, feature set, timestamp, price snapshot, and decision path.

## Next target
**P0.2-A — Production Path Trace:** establish the exact live path producing the current FREE/VIP Telegram signals, then isolate or retire obsolete paths without changing unrelated working behavior.
