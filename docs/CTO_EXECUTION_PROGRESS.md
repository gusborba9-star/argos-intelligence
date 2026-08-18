# ARGOS — CTO EXECUTION PROGRESS

This file is the operational progress ledger. `docs/ARGOS_BLUEPRINT.md` remains the architectural and quantitative source of truth.

## Active cycle
**P0.2-B — Quantitative Chain Integrity & Provenance**

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
- Signal distribution idempotency strengthened to include market line in the deduplication identity.
- Signal provenance semantics strengthened so a market fair probability cannot silently substitute for an independent model probability.
- Deployment `2ab2671` reached `Ready` in Production after the latest validated correction.
- Deployment `0e527ee` reached `Ready` in Preview after the latest distribution/provenance correction.

### P0.2-A production path findings
- The live v6 API route invokes `ArgosMasterOrchestrator`.
- The v6 worker also invokes `ArgosMasterOrchestrator`, confirming the master orchestrator as the canonical analysis entry point for those paths.
- `SignalDistributionEngine` is the current FREE/VIP distribution boundary and invokes `TelegramDispatcher`.
- Distribution persists signals into `argos_signal_ledger`, creating the primary post-publication audit trail.
- Duplicate prevention is performed before Telegram dispatch using match + vertical + selection + line + tier.
- The repository still contains legacy/compatibility engines and multiple historical analysis components; these remain under classification and must not be assumed dead until all call sites are traced.

### Current execution batch
- Complete quantitative-chain audit from raw PropLine market payload through model probability, fair probability, executable market price, EV, edge and Kelly.
- Verify whether `FairOddsCalculator` is a true independent fair-price estimator or a market-reference transformation; enforce explicit provenance accordingly.
- Trace every caller of `ArgosMasterOrchestrator`, `ArgosUnifiedEngine`, `MarketDiscoveryEngine`, `SignalDistributionEngine`, and competing analysis services.
- Add immutable signal provenance sufficient to reproduce every published signal from input snapshot + model/version + feature snapshot + market price snapshot + decision timestamp.
- Audit publication semantics so FREE/VIP are presentation/ranking layers rather than quantitative mutations.
- Add deterministic invariants for probability ranges, multiclass conservation, binary complementarity, EV identity, fair-price identity, and Kelly bounds.
- Only after the chain is mathematically clean, proceed to model-power improvements (Poisson/Monte Carlo/ensemble/RAG/external-context features).

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
**P0.2-B — Quantitative Chain Integrity:** audit and harden the complete probability → fair price → executable price → EV → Kelly chain before adding further predictive complexity.
