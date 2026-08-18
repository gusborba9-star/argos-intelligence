# ARGOS INTELLIGENCE — DECISION LOG

This file records durable engineering decisions. It is not a generic changelog.

## ADR-001 — Quantitative core over LLM-generated probabilities

**Status:** Accepted

Probabilities must originate from deterministic/statistical models and validated ensembles. LLMs are reserved primarily for external context extraction/normalization and human-readable analysis.

## ADR-002 — PropLine is the primary market/data source

**Status:** Accepted

PropLine has the larger operational request budget and supplies the principal market information. API-Football is complementary and budget-constrained.

## ADR-003 — Monte Carlo is a simulation layer

**Status:** Accepted

Monte Carlo is not considered evidence of model quality by itself. Its input distributions must be validated independently.

## ADR-004 — RAG is context, not probability

**Status:** Accepted

RAG can enrich injuries, news, weather, motivation, lineups and other external context. It must not directly invent or arbitrarily override quantitative probabilities.

## ADR-005 — MCP is capability-driven

**Status:** Accepted

MCP is introduced only when it provides measurable gains in data access, validation, enrichment or operational efficiency.

## ADR-006 — Existing production engine remains the baseline

**Status:** Accepted

The current Argos production path is preserved as the baseline/Champion until a replacement demonstrates superior out-of-sample performance.

## ADR-007 — Prediction Ledger is mandatory for long-term learning

**Status:** Accepted

Every important prediction must be recoverable with its model, data and market context so the system can measure calibration, CLV and performance after settlement.

## ADR-008 — Probability and confidence are separate

**Status:** Accepted

A 72% model probability does not automatically mean high confidence. Data quality, sample size, model agreement and uncertainty must be represented separately.

## ADR-009 — Publication is a gated operation

**Status:** Accepted

A model output is not automatically a public signal. Data quality, plausibility, anomaly/poison checks and publication criteria must pass before distribution.

## ADR-010 — Optimize for evidence, not signal volume

**Status:** Accepted

Additional markets and additional signals are subordinate to calibration, correctness, stability and measurable long-term edge.

## ADR-011 — Repository secrets must never be committed

**Status:** Accepted

Environment files containing credentials are deployment/local configuration, not source code. They must be ignored and removed from version control. Any credential that has been exposed in repository history must be treated as compromised and rotated through its provider.
