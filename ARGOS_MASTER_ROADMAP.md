# ARGOS INTELLIGENCE — MASTER ROADMAP

**Version:** 1.0.0
**Status:** Canonical execution roadmap
**Baseline:** Existing production Argos v6.x

## Phase 0 — Governance & Baseline

- [x] Create Master Blueprint
- [x] Create Master Roadmap
- [ ] Create/maintain Decision Log
- [ ] Record current production baseline
- [ ] Inventory orchestration, model, ingestion, ledger and distribution paths
- [ ] Freeze architectural changes until forensic baseline is understood

## Phase 1 — Forensic Quant Audit

**Priority: CRITICAL**

- [ ] Trace a real FREE signal end-to-end
- [ ] Trace a real VIP signal end-to-end
- [ ] Verify raw PropLine payload
- [ ] Verify normalization
- [ ] Verify feature inputs
- [ ] Verify historical sample selection
- [ ] Verify model probability generation
- [ ] Verify Monte Carlo probability mapping
- [ ] Verify fair-odds calculation
- [ ] Verify market-odd selection
- [ ] Verify EV calculation
- [ ] Verify handicap semantics and signed lines
- [ ] Verify calibration/shrinkage logic
- [ ] Verify publication gates
- [ ] Identify probability inflation sources
- [ ] Quantify each discrepancy rather than patching symptoms

**Exit criterion:** Every published probability must have a traceable mathematical path and known data provenance.

## Phase 2 — Data Foundation

- [ ] Canonical data contracts
- [ ] Source provenance
- [ ] Snapshot identifiers
- [ ] Freshness/TTL
- [ ] Data quality scoring
- [ ] PropLine request budget manager
- [ ] API-Football request budget manager
- [ ] Cache/deduplication audit
- [ ] Historical data integrity audit
- [ ] Settled-match ingestion validation

## Phase 3 — Quant Core

- [ ] Team strength model
- [ ] Attack/defence strength
- [ ] Home advantage
- [ ] Opponent-strength adjustment
- [ ] Recency weighting
- [ ] Regression to mean
- [ ] Missing-data policy
- [ ] Poisson baseline
- [ ] Dixon-Coles evaluation
- [ ] Alternative count models where justified
- [ ] Monte Carlo distribution validation

## Phase 4 — Ensemble & Uncertainty

- [ ] Model registry
- [ ] Model agreement metrics
- [ ] Ensemble weighting
- [ ] Uncertainty engine
- [ ] Data-quality confidence
- [ ] Sample-size confidence
- [ ] Probability clipping policy based on evidence, not arbitrary ceilings

## Phase 5 — Market Intelligence

- [ ] Opening/current price snapshots
- [ ] Market consensus
- [ ] Sharp reference
- [ ] Price dispersion
- [ ] Line movement
- [ ] Closing price capture
- [ ] CLV ledger
- [ ] Market-state features

## Phase 6 — Context Intelligence

- [ ] RAG freshness/provenance
- [ ] Injury context
- [ ] Lineup context
- [ ] Weather
- [ ] Motivation/competition context
- [ ] MCP integrations only where measurable value exists

## Phase 7 — Defense Layer

- [ ] Poison Engine
- [ ] Input anomaly detection
- [ ] Probability anomaly detection
- [ ] Market anomaly detection
- [ ] Context contradiction detection
- [ ] Publication quarantine
- [ ] Explainable anomaly ledger

## Phase 8 — Calibration & Evaluation

- [ ] Immutable Prediction Ledger
- [ ] Automatic settlement
- [ ] Brier Score
- [ ] Log Loss
- [ ] Calibration curves/buckets
- [ ] CLV
- [ ] ROI
- [ ] Drawdown
- [ ] League/market segmentation
- [ ] Sample-size reporting

## Phase 9 — Learning

- [ ] Walk-forward backtesting
- [ ] Champion/Challenger framework
- [ ] Model registry/versioning
- [ ] Drift detection
- [ ] Controlled retraining
- [ ] Regression tests for model changes

## Phase 10 — Distribution

- [ ] FREE publication gate
- [ ] VIP publication gate
- [ ] Telegram reliability audit
- [ ] Duplicate-signal prevention
- [ ] Signal versioning
- [ ] Public performance reporting

## Phase 11 — Shadow Production

- [ ] Run new engine beside current engine
- [ ] No automatic publication from challenger
- [ ] Minimum 1,000+ out-of-sample predictions before major production claims
- [ ] Compare calibration, Log Loss, Brier, CLV and stability

## Phase 12 — Production Promotion

- [ ] Promote only a demonstrably superior Champion
- [ ] Keep rollback path
- [ ] Preserve previous model versions
- [ ] Monitor drift and publication anomalies continuously

## Priority order

1. Probability inflation / correctness
2. Data provenance and integrity
3. Calibration
4. Prediction ledger and settlement
5. Market/CLV intelligence
6. Uncertainty
7. Controlled learning
8. RAG/MCP enrichment
9. Distribution optimization
10. Additional markets

**Rule:** More markets or more signals never outrank correctness of the existing core.

## Current status

**Phase 0:** Foundation created.

**Phase 1:** Next execution target. No model rewrite should precede the forensic audit of the live path.
