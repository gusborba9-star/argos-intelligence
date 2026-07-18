-- ============================================================
-- ARGOS v6.0.0 — SYNDICATE MASTER PERFECT FLOW
-- Autor: Manus (CTO Senior Engineer)
-- Data: 2026-07-15
-- ============================================================

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. TABELA DE PARTIDAS (MASTER)
CREATE TABLE IF NOT EXISTS argos_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_fixture_id BIGINT UNIQUE NOT NULL,
    external_provider TEXT NOT NULL DEFAULT 'PROPLINE',
    match_id TEXT NOT NULL, -- UUID gerado pelo Worker
    league_id INTEGER NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    kickoff_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'SCHEDULED',
    raw_data JSONB, -- Payload completo PropLine
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON argos_matches (kickoff_at);
CREATE INDEX IF NOT EXISTS idx_matches_match_id ON argos_matches (match_id);

-- 3. FILA DE PROCESSAMENTO (BATCH QUEUE)
CREATE TABLE IF NOT EXISTS argos_batch_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id TEXT NOT NULL,
    market_family TEXT DEFAULT 'ALL_MARKETS',
    unique_key TEXT UNIQUE NOT NULL,
    requested_verticals TEXT[],
    raw_data JSONB,
    status TEXT DEFAULT 'QUEUED', -- QUEUED, PROCESSING, COMPLETED, FAILED
    priority INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. LEDGER DE SINAIS (HISTÓRICO E PERFORMANCE)
CREATE TABLE IF NOT EXISTS argos_signal_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id TEXT NOT NULL,
    league_id INTEGER,
    vertical TEXT NOT NULL,
    selection TEXT NOT NULL,
    line DECIMAL,
    odd DECIMAL NOT NULL,
    fair_odd DECIMAL,
    probability DECIMAL,
    expected_value DECIMAL,
    edge_percent DECIMAL,
    kelly_criterion DECIMAL,
    tier TEXT DEFAULT 'VIP', -- FREE, VIP
    rating_label TEXT,
    is_correct BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CONTEXTO RAG (VECTORS)
CREATE TABLE IF NOT EXISTS argos_rag_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    metadata JSONB,
    embedding VECTOR(1536), -- Compatível com OpenAI text-embedding-3-small
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. FUNÇÃO ATÔMICA PARA CONSUMO DE FILA
CREATE OR REPLACE FUNCTION get_next_queue_item()
RETURNS SETOF argos_batch_queue AS $$
DECLARE
    next_item_id UUID;
BEGIN
    SELECT id INTO next_item_id
    FROM argos_batch_queue
    WHERE status = 'QUEUED'
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

-- 7. TRIGGER PARA LIMPEZA AUTOMÁTICA (OPCIONAL)
-- Pode ser feito via Cron no Worker, mas manter o banco limpo é essencial.
