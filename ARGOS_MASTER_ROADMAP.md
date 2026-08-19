# ARGOS INTELLIGENCE — MASTER ROADMAP

**Version:** 1.5.0
**Status:** Canonical execution roadmap / source of truth
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
- [x] Verify fair-odds semantic separation: model fair vs market reference
- [x] Verify market-odd selection
- [x] Verify EV calculation uses canonical model probability
- [x] Verify Kelly calculation uses canonical model probability
- [x] Verify handicap semantics and signed lines
- [x] Verify calibration/shrinkage chain has an explicit OOS gate
- [x] Verify publication payload does not recalculate or overwrite quantitative values
- [ ] Identify remaining probability inflation sources
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
- [ ] Automatic rolling historical update validation

## Phase 3 — Quant Core
- [ ] Team strength model
- [ ] Attack/defence strength
- [ ] Home advantage
- [x] Opponent-aware scoring features
- [x] Recency weighting foundation
- [ ] Regression to mean evaluation
- [x] Missing-data policy: no synthetic count-stat evidence
- [x] Poisson/Gamma-Poisson baseline
- [ ] Dixon-Coles evaluation
- [x] Alternative count-stat execution foundation
- [ ] Monte Carlo distribution validation across every supported vertical
- [x] Deterministic quantitative core foundation
- [x] Quantitative invariant test gate
- [x] Canonical probability → model fair odd → EV → Kelly chain

## Phase 4 — Ensemble & Uncertainty
- [ ] Model registry
- [ ] Model agreement metrics
- [ ] Ensemble weighting
- [x] Evidence-based prediction reliability foundation
- [ ] Uncertainty engine
- [ ] Data-quality confidence
- [ ] Sample-size confidence
- [ ] Probability clipping policy based on evidence, not arbitrary ceilings
- [ ] Assertiveness reliability score by market/league/regime

## Phase 5 — Market Intelligence
- [ ] Opening/current price snapshots
- [ ] Market consensus
- [ ] Sharp reference
- [ ] Price dispersion
- [ ] Line movement
- [ ] Closing price capture
- [ ] CLV ledger
- [ ] Market-state features
- [x] Dynamic market coverage discovery
- [x] Every discovered market mapped to a canonical vertical
- [ ] Every supported vertical receives evidence-backed probability generation
- [x] Unsupported markets are observable but never fabricated

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
- [x] Calibration transform foundation
- [x] Out-of-sample calibration promotion gate
- [x] Brier Score
- [x] Log Loss
- [ ] Calibration curves/buckets
- [ ] Immutable Prediction Ledger
- [ ] Automatic settlement
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
- [x] FREE publication path preserved
- [x] VIP publication path preserved
- [ ] Telegram reliability audit
- [x] Duplicate-signal prevention
- [x] Signal versioning/provenance foundation
- [ ] Public performance reporting
- [ ] Telegram explanatory presentation redesign

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

## Market universe — canonical target
The Argos execution layer must be capable of evaluating every market for which the data contract supplies genuine evidence. Current canonical verticals:
- [x] WINNER
- [x] HANDICAP
- [x] GOALS
- [x] GOALS_HT contract
- [x] BTTS
- [x] CORNERS
- [x] CARDS
- [x] SHOTS evidence/model foundation
- [x] SHOTS_ON_TARGET evidence/model foundation
- [x] FOULS evidence/model foundation
- [x] TACKLES evidence/model foundation
- [x] SAVES evidence/model foundation
- [ ] Additional PropLine/API-Football markets discovered in production

**Integrity rule:** market availability is not evidence availability. A market may be normalized and visible to the audit layer without being modeled or published until sufficient real observations exist.

**No synthetic fallback rule:** missing historical statistics must never be replaced by arbitrary league averages merely to produce a signal.

## Priority order
1. Probability correctness / inflation elimination
2. Data provenance and integrity
3. Calibration
4. Prediction ledger and settlement
5. Market/CLV intelligence
6. Multi-market coverage with evidence
7. Uncertainty / assertiveness reliability
8. Controlled learning
9. RAG/MCP enrichment
10. Distribution optimization

**Rule:** More markets or more signals never outrank correctness of the existing core.

## Current execution state — 2026-08-19

### C-003 — Quantitative Core Validation Foundation ✓
- [x] Deterministic PredictionCore foundation
- [x] Statistical invariant suite
- [x] CI quantitative gate configured with pnpm frozen lockfile
- [x] Canonical value-chain contract implemented
- [x] Model fair odd separated from market-reference fair odd
- [x] EV and Kelly explicitly derived from canonical model probability
- [x] Telegram presentation preserves canonical quantitative values
- [x] Quantitative consistency tests added

### C-004 — Probability Calibration & Reliability ✓
- [x] Full logistic calibration transform implemented
- [x] Slope and intercept are both applied
- [x] OOS promotion gate protects against in-sample overfitting
- [x] Brier and Log Loss validation
- [x] Binary calibration observation contract
- [x] Quantitative calibration invariants
- [x] Weak-training calibration promotion hardened
- [x] Latest validated deployment: `f73de90`

### C-005 — Multi-Market Evidence Coverage ✓
- [x] Canonical MarketVertical universe reviewed
- [x] Dynamic market-line discovery preserved
- [x] Evidence-backed count-stat feature engine created
- [x] Opponent-aware count-stat feature extraction
- [x] Missing count-stat evidence cannot silently become synthetic data
- [x] Orchestrator expanded to canonical count-stat verticals
- [x] Existing PropLine/API-Football call contracts left untouched in this cycle
- [x] Quantitative tests added for count-stat evidence extraction
- [x] Typecheck + production build validated
- [x] Quantitative test gate validated
- [x] Real-market coverage validation gate passed
- [x] Latest validated deployment: `dd6aacb`

### C-006 — Quantitative Execution Boundary & Market Calibration ✓
- [x] 24h maturity horizon enforced at discovery/queue/orchestrator boundaries
- [x] Stale queued matches rejected again immediately before execution
- [x] Handicap signed settlement preserved
- [x] Handicap push probability preserved as an immutable third state
- [x] Handicap calibration isolated from generic binary calibration
- [x] Handicap calibration uses conditional win/loss mass, preserving push
- [x] Canonical vertical registry remains broader than the executable model set
- [x] Unsupported markets remain observable rather than receiving fabricated probabilities
- [x] Probability/fair-odd/EV chain boundary reinforced
- [x] Vercel validation completed

### C-007 — Calibration Robustness ✓
- [x] Minimum training support gate
- [x] Positive/negative class balance gate
- [x] Probability dispersion gate
- [x] OOS validation retained
- [x] Brier and Log Loss promotion checks retained
- [x] Latest validated deployment: `f73de90`

### C-008 — Evidence Reliability & Probability/Confidence Separation ✓
- [x] Evidence reliability engine created
- [x] Reliability explicitly separated from model probability
- [x] Opportunity contract extended with evidence metadata
- [x] Ledger confidence no longer aliases model probability
- [x] Reliability components persisted inside immutable provenance snapshot
- [x] Production validation completed
- [x] Latest validated implementation: `de3e170`, `baa4552`, `771c901`

### C-009 — Count-Stat Distribution Integrity 🔄 ACTIVE
- [x] Count-stat Monte Carlo made deterministic and seedable
- [x] Count-stat over/under complementarity preserved
- [x] Count-stat simulation supports Gamma-Poisson overdispersion
- [x] Invalid count-stat inputs rejected
- [x] Quantitative tests/invariants for determinism, bounds, complementarity and overdispersion
- [x] Runtime regime variance multiplier propagated from RAG regime into every count-stat execution
- [x] Count-stat executions use stable match/vertical seeds for reproducibility
- [x] Count-stat verticals use the canonical OOS calibration engine
- [x] Calibration fallback remains identity until sufficient historical support exists
- [x] Corners/cards/shots/shots-on-target/fouls/tackles/saves share the same evidence → distribution → calibration boundary
- [ ] Validate production build
- [ ] Validate quantitative gate
- [ ] Validate real-market payloads
- [ ] Close C-009 only after every gate is Ready

### C-009 exit condition
Every supported count-stat vertical uses a real team-specific evidence path, an explicit regime-aware distribution model, deterministic reproducibility, complementary probabilities, and the canonical conservative OOS calibration gate before publication. A market can be discovered without being publishable.

**Current implementation commits:**
- `aad9570` — apply regime-capable overdispersion to count-stat Monte Carlo
- `312e0d0` — lock count-stat Monte Carlo invariants
- `ccefd28` — add OOS learning boundary for count-stat distributions
- `2775fb7` — expose stable count-stat execution seed
- `4d510cf` — propagate regime and OOS calibration through orchestrator

## Non-negotiable engineering rules
- Never fabricate probability to fill a market.
- Never let market price become model probability.
- Never let reliability become probability.
- Never calibrate on future observations.
- Never train on a prediction that has not been correctly settled.
- Never publish stale-match analysis outside the maturity boundary.
- Preserve FREE/VIP and Telegram as distribution interfaces while keeping quantitative truth canonical.
- Do not alter PropLine/API-Football request contracts without verifying their exact input/output contract.
- Prefer a smaller number of highly defensible predictions over broad unsupported coverage.
