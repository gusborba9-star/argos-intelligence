-- ARGOS v6.5.0 — SIGNAL PROVENANCE / REPLAY FOUNDATION
-- Immutable-enough snapshot metadata for reproducing every published analysis.
-- This migration is additive and safe for existing signals.

ALTER TABLE IF EXISTS argos_signal_ledger
  ADD COLUMN IF NOT EXISTS model_version TEXT,
  ADD COLUMN IF NOT EXISTS analysis_timestamp TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS odds_timestamp TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS provenance_hash TEXT,
  ADD COLUMN IF NOT EXISTS provenance_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS model_probability NUMERIC,
  ADD COLUMN IF NOT EXISTS market_implied_probability NUMERIC,
  ADD COLUMN IF NOT EXISTS fair_odd NUMERIC,
  ADD COLUMN IF NOT EXISTS executable_odd NUMERIC;

CREATE INDEX IF NOT EXISTS argos_signal_ledger_provenance_hash_idx
  ON argos_signal_ledger (provenance_hash);

CREATE INDEX IF NOT EXISTS argos_signal_ledger_analysis_timestamp_idx
  ON argos_signal_ledger (analysis_timestamp);

COMMENT ON COLUMN argos_signal_ledger.provenance_snapshot IS
  'Immutable analysis inputs/decision metadata required to reproduce the published signal.';
COMMENT ON COLUMN argos_signal_ledger.provenance_hash IS
  'SHA-256 canonical hash of provenance_snapshot and model/data identifiers.';
COMMENT ON COLUMN argos_signal_ledger.model_probability IS
  'Independent quantitative model probability used for the published decision.';
COMMENT ON COLUMN argos_signal_ledger.market_implied_probability IS
  'Probability implied by the executable/reference market price; never a substitute for model probability.';
