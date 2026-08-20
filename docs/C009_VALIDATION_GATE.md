# C-009 — Count-Stat Distribution Integrity

## Validation Gate

C-009 is considered closed only when all repository validation gates pass:

- Production build
- Quantitative invariant suite
- Count-stat deterministic execution
- Regime-bound seed invariants
- Runtime propagation of regime
- Real payload ingestion boundary validation
- No regression in canonical market registry

## Execution Contract

`team evidence → opponent-aware features → count-stat means → RAG regime → regime-bound deterministic seed → Gamma-Poisson simulation → vertical OOS calibration → canonical probability → market evidence → value chain → reliability → publication`

## Integrity Requirements

1. Count-stat simulation is deterministic for an identical seed and quantitative regime.
2. Changing the quantitative regime changes the execution seed.
3. Over/Under probabilities remain complementary and bounded.
4. Gamma-Poisson overdispersion changes distributional shape without changing the mean contract.
5. Missing count-stat evidence is never replaced with synthetic observations.
6. The canonical 48-hour ingestion horizon and freshness boundary remain fail-closed.
7. The orchestrator propagates the complete regime and deterministic count-stat seed into execution.
8. The canonical market registry remains authoritative for vertical resolution.

This document is a validation artifact only; it does not alter the quantitative execution path.
