-- ============================================================
-- ARGOS v6.0.0 — SYNDICATE MASTER MIGRATION
-- Executa no SQL Editor do Supabase antes do deploy.
-- Adiciona colunas faltantes identificadas na auditoria técnica.
-- ============================================================

-- 1. Tabela argos_matches (usada pelo getCachedMatchData e saveMatchToDatabase)
-- Criada aqui pois não existia no schema original (setup_argos_v4.sql)
CREATE TABLE IF NOT EXISTS argos_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_fixture_id BIGINT UNIQUE NOT NULL,
    external_provider TEXT NOT NULL DEFAULT 'PROPLINE',
    match_id TEXT NOT NULL,
    league_id INTEGER,
    sport_key TEXT DEFAULT 'soccer',
    home_team TEXT,
    away_team TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'NS',
    raw_data JSONB,  -- Payload completo para Single-Pass (getCachedMatchData)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS argos_matches_match_id_idx ON argos_matches (match_id);
CREATE INDEX IF NOT EXISTS argos_matches_start_time_idx ON argos_matches (start_time);
CREATE INDEX IF NOT EXISTS argos_matches_status_idx ON argos_matches (status);

-- 2. Adicionar colunas faltantes na argos_batch_queue
-- raw_data: payload completo para Single-Pass (zero re-fetch)
-- expires_at: expiração automática de itens
-- user_id: rastreabilidade por usuário
ALTER TABLE IF EXISTS argos_batch_queue
    ADD COLUMN IF NOT EXISTS raw_data JSONB,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS user_id UUID;

-- 3. Adicionar coluna tier na argos_signal_ledger (FREE/VIP)
ALTER TABLE IF EXISTS argos_signal_ledger
    ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'VIP';

-- 4. Atualizar função get_next_queue_item para incluir raw_data e expires_at
-- Garante que itens expirados não sejam consumidos
CREATE OR REPLACE FUNCTION get_next_queue_item()
RETURNS SETOF argos_batch_queue AS $$
DECLARE
    next_item_id UUID;
BEGIN
    -- Localiza o próximo item QUEUED ou VALIDATED, não expirado
    SELECT id INTO next_item_id
    FROM argos_batch_queue
    WHERE status IN ('QUEUED', 'VALIDATED')
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF next_item_id IS NOT NULL THEN
        RETURN QUERY
        UPDATE argos_batch_queue
        SET status = 'PROCESSING', updated_at = NOW()
        WHERE id = next_item_id
        RETURNING *;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Índices adicionais para performance
CREATE INDEX IF NOT EXISTS argos_batch_queue_expires_at_idx ON argos_batch_queue (expires_at);
CREATE INDEX IF NOT EXISTS argos_batch_queue_priority_created_idx ON argos_batch_queue (priority DESC, created_at ASC);

-- 6. Garantir unique_key com índice único (se não existir)
CREATE UNIQUE INDEX IF NOT EXISTS argos_batch_queue_unique_key_idx ON argos_batch_queue (unique_key);

-- ============================================================
-- FIM DA MIGRATION v6.0.0
-- ============================================================
