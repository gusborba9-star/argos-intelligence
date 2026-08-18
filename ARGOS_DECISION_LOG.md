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

## ADR-012 — Argos is not a veto engine

**Status:** Accepted

The quantitative core should analyze available markets rather than silently suppressing them merely because confidence is low. Low-quality, uncertain or anomalous outputs must remain observable in the internal audit/diagnostic layer with explicit reason codes. Publication filters may determine what reaches FREE/VIP, but they must not erase the underlying analytical result. This preserves maximum information, enables learning, and avoids turning the product into a system that primarily says "no signal".

## ADR-013 — Asian handicap settlement semantics are explicit

**Status:** Accepted

For the standard football convention, Home -x and Away +x are treated as opposing sides of the same handicap magnitude. Integer lines contain a PUSH state and therefore their two win probabilities must not be forced to sum to 1. Any future handicap implementation must preserve signed point semantics and settlement state rather than reducing the line to an unsigned magnitude prematurely.
