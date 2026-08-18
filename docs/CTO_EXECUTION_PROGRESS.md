# ARGOS — CTO EXECUTION PROGRESS

This file is the operational progress ledger. `docs/ARGOS_BLUEPRINT.md` remains the architectural and quantitative source of truth.

## Active cycle
**P0 — Quantitative Integrity & Execution-Path Audit**

### Completed and validated
- Asian handicap integer-line PUSH settlement corrected.
- Team-history feature extraction corrected to distinguish home/away orientation.
- Non-conservative probability inflation from learning removed.
- Binary calibration preserves complementarity.
- TypeScript dependency/lockfile mismatch corrected.
- Deployment `74e9f3a` reached `Ready` after the previous correction cycle.

### Current execution batch
- Fix optional-probability TypeScript failure in `ModelFactory` by narrowing `baseOver` before arithmetic.
- Audit probability-family invariants.
- Audit active production execution path and legacy engines.
- Audit fair-price/market-price separation and circularity.
- Audit signal contracts and publication path.
- Identify dead/duplicate code before adding new engines.

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

## Next target after current batch
**P0.2 — Canonical execution path:** prove exactly which code produces the live FREE/VIP Telegram signals and retire or isolate legacy paths before expanding the quant core.
