# ARGOS — CTO EXECUTION PROGRESS

This file is the operational progress ledger. `docs/ARGOS_BLUEPRINT.md` remains the architectural and quantitative source of truth.

## Active cycle
**P0.2-B — Quantitative Chain Integrity & Provenance**

### Completed and validated before current batch
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
- Analysis horizon restricted to 48 hours.
- Stale queued matches are prevented from reaching the analysis worker.
- Quantitative CI gate and statistical invariant suite established.

### Current batch completed
**Quantitative calibration + expected-scoring integrity**

- `FeatureEngine` now preserves separate team attack (`goals`) and defensive concession (`goalsAgainst`) rates.
- Sparse samples continue to shrink both attack and defence toward the league-neutral prior instead of allowing one fixture to define the latent rate.
- Master orchestration no longer feeds a team's raw scoring average directly into the match Poisson/Gamma-Poisson model.
- Expected home scoring now combines home attack with away defensive concession.
- Expected away scoring now combines away attack with home defensive concession.
- RAG motivation/context no longer applies an arbitrary `+/-5%` probability-driving model bias. External context remains evidence until a calibrated feature transformation exists.
- Online learning now requires at least 50 resolved observations before changing model probabilities.
- Online calibration is shrunk toward zero using an explicit prior sample and capped at a very small logit adjustment; small samples cannot manufacture confidence.
- Dynamic FREE/VIP thresholds are no longer silently mutated by empirical bias.
- Deterministic feature-scoring invariants added to the quantitative test suite.

### Quantitative integrity doctrine now enforced
- A team's scoring rate is not its opponent-adjusted expected match rate.
- Attack and defence are separate latent signals.
- Sparse evidence must shrink toward a neutral prior.
- External-context retrieval must not become an arbitrary probability multiplier.
- Learning requires resolved evidence and conservative shrinkage.
- Model probability remains distinct from market reference probability.
- EV is downstream of the model probability and executable market price; it is never used to manufacture the probability upstream.
- A large EV number is treated as a model-validation question, not as evidence that the signal is automatically strong.

### Required validation gate
The branch must pass, in order:
1. quantitative test suite;
2. TypeScript/Next.js build;
3. Vercel deployment reaching `Ready`;
4. real-data inspection of newly generated signals;
5. roadmap update only after the above are successful.

### Remaining P0.2-B work
- Complete provenance replay coverage across every published signal.
- Verify all legacy/compatibility callers cannot bypass the canonical orchestrator.
- Complete walk-forward calibration metrics (Brier, Log Loss and reliability/calibration error) by league and vertical.
- Validate the live Argos signal ledger against model probability, market price and settlement outcomes.
- Audit all remaining market-specific probability engines, especially corners/cards, for the same attack/defence and calibration discipline.

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
**P0.2-B — Quantitative Chain Integrity:** complete provenance replay and walk-forward calibration before expanding predictive complexity.
