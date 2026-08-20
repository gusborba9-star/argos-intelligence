# Argos Intelligence

**Status:** Canonical engineering baseline under active quantitative validation  
**Scope:** Global football quantitative intelligence

Argos is a quantitative sports-intelligence platform. It does not operate as a bookmaker. Its core product is the quality, traceability, calibration and long-term evidence of its analysis.

## Engineering principles

- Probabilities originate from deterministic/statistical models and validated calibration layers; LLMs provide context, not arbitrary probabilities.
- PropLine is the primary market/data source; complementary sources are used only where they add measurable evidence.
- Market availability is not evidence availability. Unsupported or weakly evidenced markets remain observable internally but are not fabricated into predictions.
- Model probability, model fair price, market reference price, executable odd, EV and Kelly remain separate quantitative concepts.
- Probability and reliability/confidence are separate dimensions.
- Publication is gated by data freshness, evidence quality, quantitative validity and anomaly controls.
- The production engine remains the Champion until a challenger demonstrates superior out-of-sample performance.
- Telegram FREE/VIP output is preserved as a distribution layer and must not alter canonical quantitative values.

## Canonical execution path

```text
Market/data ingestion
        ↓
Canonical normalization + provenance
        ↓
Evidence/features + opponent-aware statistics
        ↓
Context/regime enrichment
        ↓
Deterministic quantitative simulation
        ↓
Vertical/line-specific calibration
        ↓
Canonical model probability
        ↓
Model fair price + market reference + executable odd
        ↓
EV / edge / Kelly
        ↓
Evidence reliability + anomaly/publication gates
        ↓
Prediction ledger / distribution
        ↓
Telegram FREE / VIP
```

## Current quantitative boundary

The active roadmap is the source of truth for implementation status. C-009 currently governs count-stat distribution integrity, including deterministic regime-bound simulation, overdispersion, OOS calibration and runtime propagation. It is not considered closed until production build, quantitative CI and applicable real-payload validation all pass.

C-009 execution boundary:

```text
team evidence → opponent-aware features → count-stat means → regime
→ regime-bound deterministic seed → Gamma-Poisson simulation
→ vertical OOS calibration → canonical probability → market evidence
→ value chain → reliability → publication
```

## Canonical engineering documents

- `ARGOS_MASTER_BLUEPRINT.md` — architecture and non-negotiable principles.
- `ARGOS_MASTER_ROADMAP.md` — execution roadmap and cycle gates.
- `ARGOS_DECISION_LOG.md` — durable engineering decisions.

Historical audit reports are intentionally not maintained as competing sources of truth. Current implementation state must be established from code, tests, deployments and the canonical documents above.

## Development gate

The production build must execute the quantitative test gate before the Next.js build. A cycle is not Ready merely because TypeScript compiles: quantitative tests, applicable runtime/payload validation and deployment status must agree.

```bash
pnpm test:quant
pnpm run build
```

## Quality target

Argos is optimized for evidence quality and measurable predictive performance rather than signal volume. The long-term target is a robust, auditable quantitative intelligence platform capable of institutional-grade analysis, with performance demonstrated through out-of-sample calibration, Brier Score, Log Loss, CLV, stability and settlement evidence.
