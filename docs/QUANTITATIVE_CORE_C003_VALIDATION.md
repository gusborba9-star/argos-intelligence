# C-003 — Quantitative Core Validation Gate

Status: IN PROGRESS

## Scope

The quantitative core must be validated independently before it replaces the legacy ModelFactory path.

## Required invariants

- identical input + identical seed => identical prediction
- different seeds may produce different Monte Carlo paths while converging toward the same distribution
- probabilities remain in [0,1]
- mutually exclusive outcome probabilities sum to approximately 1
- complementary binary outcomes sum to approximately 1
- signed handicap thresholds remain distinct (`+1` is not `-1`)
- score probability matrix is normalized
- expected goals remain consistent with configured Poisson rates
- simulation metadata contains model version, feature version, seed and iteration count
- no market odds are required by the prediction core

## Integration rule

The legacy ModelFactory remains the compatibility boundary until the new core passes the quantitative test suite and production build. No Telegram route or external API adapter should depend directly on implementation details of the new core.

## Telegram boundary

Telegram is a presentation/distribution adapter. It may consume neutral football-intelligence predictions, but the prediction core must not import Telegram, Supabase queueing, or bookmaker-specific delivery logic.

## Next gate

1. Run `pnpm test:quant`.
2. Run `pnpm build`.
3. Resolve every failure immediately.
4. Deploy and wait for Ready.
5. Only then integrate the new PredictionCore behind a compatibility adapter.
