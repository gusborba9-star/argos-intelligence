-- ============================================================
-- ARGOS v6.0.0 — MASTER SQL BLUEPRINT (COMPLETE RESET)
-- Autor: Manus AI (CTO Senior Engineer)
-- Objetivo: Reconstrução total do banco para Sincronia Perfeita
-- ============================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. LIMPEZA DE VERSÕES ANTERIORES (OPCIONAL - USE COM CAUTELA)
-- DROP TABLE IF EXISTS argos_matches CASCADE;
-- DROP TABLE IF EXISTS argos_batch_queue CASCADE;
-- DROP TABLE IF EXISTS argos_signal_ledger CASCADE;
-- DROP TABLE IF EXISTS argos_rag_context CASCADE;

-- 3. TABELA: LIGAS E GOVERNANÇA
CREATE TABLE IF NOT EXISTS argos_leagues (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT,
    tier INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    operational_density INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA: PARTIDAS (SINGLE-PASS DATA LAKE)
CREATE TABLE IF NOT EXISTS argos_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id TEXT UNIQUE NOT NULL, -- UUID gerado pelo Worker
    external_fixture_id BIGINT UNIQUE NOT NULL,
    external_provider TEXT NOT NULL DEFAULT 'PROPLINE',
    league_id INTEGER REFERENCES argos_leagues(id),
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    kickoff_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'SCHEDULED',
    raw_data JSONB, -- Payload completo com bookmakers e mercados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_matches_kickoff ON argos_matches (kickoff_at);
CREATE INDEX idx_matches_status ON argos_matches (status);

-- 5. TABELA: FILA DE PROCESSAMENTO ATÔMICA
CREATE TABLE IF NOT EXISTS argos_batch_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id TEXT REFERENCES argos_matches(match_id) ON DELETE CASCADE,
    unique_key TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'QUEUED', -- QUEUED, PROCESSING, COMPLETED, FAILED
    priority INTEGER DEFAULT 0,
    raw_data JSONB, -- Cópia do payload para processamento rápido
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_queue_status_priority ON argos_batch_queue (status, priority DESC, created_at ASC);

-- 6. TABELA: LEDGER DE SINAIS (CENTRAL DE INTELIGÊNCIA)
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
    rating_label TEXT, -- ELITE, VALUE, MARGINAL
    analysis_summary TEXT,
    is_correct BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ledger_tier ON argos_signal_ledger (tier);
CREATE INDEX idx_ledger_match_id ON argos_signal_ledger (match_id);

-- 7. TABELA: RAG CONTEXT (VECTOR SEARCH)
CREATE TABLE IF NOT EXISTS argos_rag_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id TEXT,
    content TEXT NOT NULL,
    fact_type TEXT, -- injury, weather, motivation, news
    metadata JSONB,
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. TABELA: FILA DE NOTIFICAÇÕES (TELEGRAM/HTTP)
CREATE TABLE IF NOT EXISTS argos_http_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    method TEXT DEFAULT 'POST',
    headers JSONB,
    body JSONB,
    status TEXT DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_http_queue_status ON argos_http_queue (status);

-- 9. FUNÇÃO: CONSUMO DE FILA (ATOMIC SKIP LOCKED)
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

-- 10. FUNÇÃO: BUSCA SEMÂNTICA RAG
CREATE OR REPLACE FUNCTION match_context_search(
    query_embedding VECTOR(1536),
    match_id_filter TEXT,
    similarity_threshold FLOAT,
    match_count INT
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    fact_type TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        arc.id,
        arc.content,
        arc.fact_type,
        1 - (arc.embedding <=> query_embedding) AS similarity
    FROM argos_rag_context arc
    WHERE (match_id_filter IS NULL OR arc.match_id = match_id_filter)
      AND 1 - (arc.embedding <=> query_embedding) > similarity_threshold
    ORDER BY arc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- 11. CRON JOB: LIMPEZA DE FILA (OPCIONAL VIA PG_CRON)
-- Requer extensão pg_cron ativada no Supabase
-- SELECT cron.schedule('0 * * * *', $$DELETE FROM argos_batch_queue WHERE status IN ('COMPLETED', 'FAILED') AND updated_at < NOW() - INTERVAL '24 hours'$$);

-- 12. DADOS INICIAIS: LIGAS ELITE
INSERT INTO argos_leagues (id, name, country, tier, operational_density) VALUES
(1, 'FIFA World Cup', 'World', 1, 100),
(2, 'UEFA Champions League', 'Europe', 1, 95),
(39, 'Premier League', 'England', 1, 90),
(61, 'Ligue 1', 'France', 1, 85),
(71, 'Brasileirão Série A', 'Brazil', 1, 80),
(78, 'Bundesliga', 'Germany', 1, 85),
(135, 'Serie A', 'Italy', 1, 85),
(140, 'La Liga', 'Spain', 1, 85)
ON CONFLICT (id) DO UPDATE SET operational_density = EXCLUDED.operational_density;
