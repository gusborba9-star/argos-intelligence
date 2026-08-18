# ARGOS INTELLIGENCE — MASTER BLUEPRINT

**Version:** 1.0.0
**Status:** Canonical engineering source of truth
**Owner:** Argos CTO direction
**Scope:** Global football quantitative intelligence

## 1. Mission

Argos is a quantitative football-intelligence system. It is not a bookmaker and does not accept bets. Its product is the quality of its probabilistic analysis, market intelligence, opportunity ranking, auditability and long-term evidence.

Core principle:

> Argos must measure whether it is accurate; it must never merely look accurate.

Every published prediction must be reproducible from a versioned data snapshot, feature set, model version and market snapshot.

## 2. Canonical pipeline

```text
DATA SOURCES
  -> DATA QUALITY / PROVENANCE
  -> HISTORICAL + CURRENT FEATURES
  -> MATCH STATE
  -> QUANT MODELS
  -> ENSEMBLE
  -> POISSON / DISTRIBUTION MODELS
  -> MONTE CARLO SIMULATION
  -> MARKET INTELLIGENCE
  -> CONTEXT (RAG/MCP)
  -> CALIBRATION
  -> UNCERTAINTY
  -> POISON / ANOMALY GATES
  -> FAIR PRICE / VALUE
  -> OPPORTUNITY RANKING
  -> PREDICTION LEDGER
  -> FREE / VIP DISTRIBUTION
  -> SETTLEMENT
  -> BRIER / LOG LOSS / CLV / ROI / DRIFT
  -> CONTROLLED LEARNING
  -> MODEL EVALUATION
```

The loop must close: every completed match becomes evaluation data for future versions.

## 3. Data strategy

### PropLine — primary operational source

Target budget: up to 1,000 requests/day.

Use for available fixtures, markets, prices, bookmaker/sharp references and market updates. Requests must be cached, deduplicated and budget-aware.

### API-Football — secondary enrichment source

Target budget: 100 requests/day.

Use only when PropLine cannot provide the required information. Priority: injuries, lineups, H2H or other genuinely missing context. Never spend a request duplicating data already available and fresh elsewhere.

### Historical database

Existing historical league/team data is the bootstrap dataset. Every settled match should feed the historical/evaluation layer after validation. Learning must be versioned and controlled; a single result must never blindly mutate production model parameters.

## 4. Data contracts and provenance

Every important feature/prediction should retain, directly or indirectly:

- source;
- source timestamp;
- ingestion timestamp;
- freshness/TTL;
- data-quality state;
- model version;
- feature version;
- market snapshot identifier;
- context snapshot identifier.

Stale or contradictory data must reduce confidence or block publication rather than silently becoming a feature.

## 5. Match State Engine

A match is represented as a state, not merely two team names. The state should eventually include:

- team strength;
- attack/defence strength;
- home advantage;
- opponent strength;
- recent form and long-term form;
- home/away splits;
- schedule density and rest;
- injuries/suspensions;
- expected lineup;
- competition importance/motivation;
- weather where material;
- market state and movement;
- data quality;
- model uncertainty.

## 6. Feature Engine

Features must avoid naive averaging. Required principles:

- recency weighting without destroying long-term signal;
- home/away separation;
- opponent-strength adjustment;
- regression toward the mean;
- minimum-sample controls;
- explicit missing-data handling;
- no synthetic defaults presented as real evidence.

## 7. Quantitative model layer

### Goals

Poisson is a core model, not the universal answer. Candidate models include Poisson, Dixon-Coles, bivariate Poisson, Negative Binomial, zero-inflated approaches and hierarchical/Bayesian models where justified by out-of-sample evidence.

### Monte Carlo

Monte Carlo is a simulation mechanism, not proof of model quality. Simulation count does not compensate for a bad probability distribution. The distribution supplied to the simulator is therefore a first-class validation target.

### Ensemble

Future models should be combined through a controlled ensemble. Candidate models can include independent statistical models and market-informed references. Ensemble weights must be learned/validated out-of-sample, not chosen merely because they produce attractive signals.

## 8. Market Intelligence

Market data is information, not absolute truth. Argos should preserve:

- opening price where available;
- current price;
- best available price;
- market consensus;
- sharp reference;
- line movement;
- price dispersion;
- market agreement/disagreement;
- closing price when available.

CLV is a first-class evaluation metric. The system must record the price at prediction time and compare it with the eventual closing market.

## 9. RAG and MCP

### RAG

RAG is for external context, not for inventing probabilities. Useful context includes injuries, lineup information, news, weather, motivation, competition context and relevant historical facts.

Each context item should have source, timestamp, relevance and freshness. Expired context must not silently influence current predictions.

### MCP

MCP is allowed where it materially improves structured access to external tools/data, validation or context acquisition. It is not a required dependency merely for architectural fashion. Every MCP integration must have a measurable operational purpose.

## 10. Poison / defense layer

The Poison Engine is a publication-defense system. It should detect:

- malformed or corrupted data;
- impossible market/price combinations;
- stale snapshots;
- anomalous model outputs;
- contradictory external context;
- suspicious probability/price divergence;
- publication-state inconsistencies.

A detected anomaly should be quarantined/audited rather than automatically corrected into a signal.

## 11. Calibration and uncertainty

Probability and confidence are different quantities.

Argos must eventually answer:

> When Argos says 70%, how often do comparable events actually occur?

Calibration should be measured by probability buckets and proper scoring rules, primarily Brier Score and Log Loss. Uncertainty should incorporate data quality, model disagreement, sample size and contextual instability.

## 12. Prediction Ledger

Predictions are immutable analytical records. At minimum:

- prediction id;
- match id;
- market/selection/line;
- probability;
- fair probability/price;
- market price;
- model version;
- feature version;
- data snapshot;
- context snapshot;
- uncertainty;
- data quality;
- model agreement;
- creation timestamp;
- kickoff timestamp;
- settlement result;
- closing price;
- CLV;
- scoring metrics.

The ledger is the scientific accounting book of Argos.

## 13. Value and ranking

Value is evaluated only after probability quality is addressed.

```text
validated probability -> fair price -> market price -> value -> ranking
```

Ranking must eventually incorporate more than raw EV: probability, edge, uncertainty, data quality, liquidity, model agreement, market stability and demonstrated historical performance.

## 14. Distribution

The computation is match-centric, not user-centric. A prediction can be generated once and distributed to many users/channels with near-zero marginal inference cost.

### FREE

Few, high-probability, well-calibrated opportunities with strong data quality and low uncertainty. FREE is a product acquisition layer, not the full research output.

### VIP

Broader market coverage and validated value opportunities, with quantitative context and historical reporting.

Neither channel should communicate certainty or guaranteed outcomes.

## 15. Learning architecture

Learning must be controlled.

### Champion / Challenger

The production model is Champion. New candidates are Challengers. A Challenger replaces the Champion only after statistically meaningful out-of-sample improvement.

### Walk-forward validation

Historical evaluation must respect time ordering. Training information must never leak from future matches into past predictions.

### Drift detection

Argos should monitor changes in data distributions, market behavior and predictive performance. Drift can trigger recalibration or model review; it must not silently rewrite the production model.

## 16. Cost and operational constraints

The initial architecture remains intentionally lean: Next.js/Vercel, Supabase/Postgres, PropLine, API-Football, Telegram and existing model infrastructure. Complexity is added only when it improves accuracy, reliability, observability or cost efficiency.

API budgets are hard constraints. Every external request should be budget-aware and preferably cacheable.

## 17. Engineering rules

No significant change enters production because it merely "looks better".

Every change must answer:

1. What problem exists?
2. What evidence demonstrates it?
3. What hypothesis is being tested?
4. Which metric should improve?
5. What regression risk exists?
6. How will it be validated?
7. How will it be rolled back?

The existing production Argos remains the baseline until a replacement demonstrates superiority.

## 18. Non-goals

Argos will not become:

- a bookmaker;
- a betting wallet;
- an unnecessarily distributed microservice architecture;
- an LLM-driven probability generator;
- a system that treats one successful streak as proof of edge;
- a system that publishes every model output.

## 19. Definition of excellence

The target is not maximum signal volume. The target is measurable, durable predictive quality with controlled uncertainty and positive evidence across large out-of-sample samples.

Primary long-term evidence:

- calibration;
- Brier Score;
- Log Loss;
- CLV;
- ROI after realistic price assumptions;
- drawdown;
- stability across leagues/markets/time;
- model drift;
- sample size.

This document is the canonical technical direction for Argos Intelligence. New architectural decisions must either comply with it or explicitly amend it through the Decision Log.
