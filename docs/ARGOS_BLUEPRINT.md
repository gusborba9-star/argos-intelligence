# ARGOS — BLUEPRINT / SOURCE OF TRUTH

## 1. Mission

Argos is a football intelligence and market-analysis platform. It is not a bookmaker and does not execute bets. Its job is to ingest market/data feeds, estimate probabilities and fair prices, identify statistically defensible opportunities, rank them, explain the evidence, record the prediction, settle the outcome, and learn from the result.

The product principle is **analysis first, publication second**. The system must not become a veto engine: low-confidence or non-value observations remain available internally for audit/research even when they are not published to FREE/VIP.

## 2. Data hierarchy

1. PropLine — primary source for fixtures, markets, prices and sharp/reference market information within the available quota.
2. API-Football — complementary source only for information not reliably available from PropLine (for example H2H, injuries/news/lineups where applicable), with strict quota budgeting.
3. Argos historical store — canonical historical dataset for teams, leagues, market outcomes and model performance.
4. RAG/context layer — external/contextual facts; it informs features and explanations but must not silently override deterministic quantitative calculations.

## 3. Canonical pipeline

RAW INGESTION
→ NORMALIZATION
→ DATA QUALITY / PROVENANCE
→ HISTORICAL FEATURES
→ MARKET FEATURES
→ CONTEXT/RAG
→ QUANT MODELS / ENSEMBLE
→ CALIBRATION
→ FAIR PROBABILITY / FAIR ODDS
→ VALUE / EDGE / CLV ESTIMATION
→ OPPORTUNITY RANKING
→ FREE/VIP PRESENTATION
→ SIGNAL LEDGER
→ SETTLEMENT
→ PERFORMANCE / CALIBRATION DATA
→ CONTROLLED LEARNING

## 4. Quantitative principles

- Never invent a probability when the model lacks the required data.
- Never call a market fair price a model-derived fair price unless its provenance is explicit.
- Model probability, market-implied probability, sharp-reference probability and published probability are separate fields.
- EV must be computed from the declared probability and the executable market price, not from the same fair price used to derive the probability.
- Asian handicap must explicitly represent win / push / loss states for integer and quarter lines.
- Binary markets must preserve probability complementarity.
- Multiclass markets must preserve probability mass.
- Calibration is evidence-based and out-of-sample; learning cannot directly amplify predictions merely because a previous model was wrong.
- Every published signal must be reproducible from an immutable analysis snapshot.
- Every signal must have a model version, data timestamp, odds timestamp and provenance.

## 5. Modeling stack

### Core
- Team attack/defence strength
- Home advantage
- League baseline
- Recency weighting
- Strength of schedule
- Goal distribution with explicit overdispersion
- Monte Carlo simulation
- Market consensus / sharp reference
- Ensemble/ranking layer

### Specialist markets
- Goals / BTTS / 1X2 / handicap
- Corners
- Cards
- Shots / shots on target when sufficient historical coverage exists

A specialist market must have a specialist probability model. A goals model must not be reused as a proxy for corners/cards/shots.

### Context
RAG/AI is reserved primarily for external/contextual factors such as injuries, confirmed lineups, weather, motivation, schedule congestion, relevant news and qualitative anomalies. Context is converted into explicit, bounded features with provenance rather than arbitrary probability overrides.

## 6. Learning system

Learning is separated from inference. The production model generates predictions without modifying itself during the same prediction cycle. Results are settled later and enter the learning dataset.

Required controls:
- minimum sample size
- time-based train/validation split
- out-of-sample calibration
- league/market segmentation
- probability-bin calibration monitoring
- Brier score
- log loss
- calibration error
- ROI/EV diagnostics
- CLV tracking where closing prices exist
- drift detection

## 7. Publication model

FREE is a discovery layer: a small number of high-probability, understandable analyses.

VIP is the value/intelligence layer: broader market coverage, positive expected value candidates, deeper evidence, rankings, CLV tracking and historical performance.

Publication thresholds are ranking policies, not data deletion policies.

## 8. No-veto rule

The internal engine should scan broadly and preserve observations. Suppression is reserved for data corruption, impossible market states, expired fixtures, missing required model inputs, or explicit publication policy. A weak signal is still useful research data; it should not be silently erased.

## 9. Reliability gates

Every production change follows:

INVESTIGATE → IMPLEMENT → TYPECHECK → BUILD → TEST → DEPLOY → READY → REAL-DATA VALIDATION → ONLY THEN NEXT CHANGE.

No production merge is considered complete from source-code inspection alone.

## 10. Strategic roadmap

### P0 — Integrity
- Remove probability inflation and non-conservative calibration.
- Validate every probability family and market settlement.
- Add provenance and immutable analysis snapshots.
- Audit active execution path versus legacy engines.

### P1 — Quant Core
- Build canonical team/league strength features.
- Replace heuristic goal distribution with a calibrated count model.
- Specialist models for corners/cards/shots.
- Market consensus and sharp-price engine with explicit provenance.
- Proper fair-odds and EV pipeline.

### P2 — Calibration & Learning
- Time-split backtesting.
- Reliability curves and calibration metrics.
- Controlled champion/challenger models.
- Drift and regime monitoring.
- Automatic post-match settlement.

### P3 — Syndicate Intelligence
- Opportunity ranking across all matches/markets.
- CLV measurement.
- Liquidity/price-quality scoring where data actually supports it.
- Portfolio correlation and exposure analytics for research/reporting.

### P4 — Product Authority
- Transparent signal history.
- Public/VIP performance dashboards.
- Per-league and per-market statistics.
- Reproducible analysis reports.
- Audit trail for every published prediction.

## 11. Definition of success

Argos does not claim superiority because it produces many signals. It earns authority by demonstrating that its probabilities are calibrated, its value calculations are reproducible, its historical results are auditable, and its performance survives out-of-sample testing.
