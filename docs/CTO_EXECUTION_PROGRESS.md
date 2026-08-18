# ARGOS — CTO EXECUTION PROGRESS

This file is the operational progress ledger. `docs/ARGOS_BLUEPRINT.md` remains the architectural and quantitative source of truth.

## Active cycle
**P0.2-B — Quantitative Chain Integrity & Provenance**

### Completed and validated
- [x] Asian handicap integer-line PUSH settlement corrected.
- [x] Team-history feature extraction corrected to distinguish home/away orientation.
- [x] Non-conservative probability inflation from learning removed.
- [x] Binary calibration preserves complementarity.
- [x] TypeScript dependency/lockfile mismatch corrected.
- [x] Optional-probability TypeScript narrowing in `ModelFactory` corrected.
- [x] Model probability separated from market-reference probability; market reference no longer directly becomes the model probability through the audited path.
- [x] H2H removed as an arbitrary direct 10% probability blend; retained as contextual data for future calibrated feature use.
- [x] Legacy `ArgosUnifiedEngine` artificial `+2%` probability inflation removed.
- [x] Signal distribution idempotency strengthened to include market line in the deduplication identity.
- [x] Signal provenance semantics strengthened so a market fair probability cannot silently substitute for an independent model probability.
- [x] Analysis horizon restricted to 48 hours.
- [x] Stale queued matches are prevented from reaching the analysis worker.
- [x] Quantitative CI gate and statistical invariant suite established.
- [x] `FeatureEngine` preserves separate team attack (`goals`) and defensive concession (`goalsAgainst`) rates.
- [x] Sparse samples shrink both attack and defence toward the league-neutral prior.
- [x] Master orchestration no longer feeds a team's raw scoring average directly into the match scoring model.
- [x] Expected home scoring combines home attack with away defensive concession.
- [x] Expected away scoring combines away attack with home defensive concession.
- [x] RAG motivation/context no longer applies an arbitrary `+/-5%` probability-driving model bias.
- [x] Online learning requires at least 50 resolved observations before changing model probabilities.
- [x] Online calibration uses explicit prior shrinkage and a bounded logit adjustment.
- [x] Dynamic FREE/VIP thresholds are no longer silently mutated by empirical bias.
- [x] Deterministic feature-scoring invariants are covered by the quantitative test suite.

### Validation evidence
- [x] Quantitative test suite passed and deployment reported `Ready` for the implementation batch.
- [x] Opponent-aware scoring implementation reached `Ready` (`d8807e6`).
- [x] Quantitative invariant suite reached `Ready` (`a989f48`).
- [x] Calibration-cycle documentation reached `Ready` (`7e1b53c`).
- [x] Validation-state ledger update reached `Ready` (`5216a25`).

### Cycle status
**✓ COMPLETED AND VALIDATED**

The cycle is closed. The next cycle must not assume that model quality is solved merely because the build is green. Quantitative authority now requires out-of-sample evidence and replayability.

### Next P0.2-B work
- [ ] Complete provenance replay coverage across every published signal.
- [ ] [ ] Verify all legacy/compatibility callers cannot bypass the canonical orchestrator.
- [ ] Complete walk-forward calibration metrics (Brier, Log Loss and reliability/calibration error) by league and vertical.
- [ ] Validate the live Argos signal ledger against model probability, market price and settlement outcomes.
- [ ] Audit all remaining market-specific probability engines, especially corners/cards, for the same attack/defence and calibration discipline.

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
**P0.2-B — Provenance Replay & Walk-Forward Calibration**
