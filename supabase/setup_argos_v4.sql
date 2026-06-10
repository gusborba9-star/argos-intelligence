-- ============================================================
-- ARGOS v4.0 — SUPABASE SCHEMA SETUP & MIGRATION
-- Este script configura as tabelas e funções necessárias para o Argos v4.0,
-- incluindo o RAG Context Engine e o Feedback Loop.
-- ============================================================

-- 1. Habilitar extensão pgvector (se ainda não estiver habilitada)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabela: argos_context_facts (para o RAG Context Engine)
-- Armazena fatos externos com seus embeddings para busca de similaridade.
CREATE TABLE IF NOT EXISTS argos_context_facts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- Dimensão do embedding do Gemini
    fact_type TEXT NOT NULL, -- 'injury', 'weather', 'motivation', 'historical', 'news'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índice para busca eficiente de embeddings
CREATE INDEX IF NOT EXISTS argos_context_facts_embedding_idx ON argos_context_facts USING ivfflat (embedding vector_l2_ops);

-- 3. Tabela: argos_signal_ledger (para armazenar sinais e feedback)
-- Armazena os sinais gerados pelo Argos e os resultados reais para o Feedback Loop.
CREATE TABLE IF NOT EXISTS argos_signal_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id TEXT NOT NULL,
    league_id TEXT,
    signal_type TEXT NOT NULL, -- 'VALUE', 'VALIDATION', 'NOISE'
    vertical TEXT NOT NULL, -- 'WINNER', 'OVER_UNDER', 'BTTS'
    market TEXT NOT NULL, -- 'HOME_WIN', 'OVER_2_5_GOALS', 'YES'
    probability DOUBLE PRECISION NOT NULL, -- Probabilidade prevista pelo modelo
    expected_value DOUBLE PRECISION NOT NULL, -- Valor esperado
    regime TEXT NOT NULL, -- Regime de mercado no momento da análise
    confidence DOUBLE PRECISION NOT NULL, -- Confiança do Regime Engine
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Campos para o Feedback Loop (novos ou atualizados)
    actual_home_goals INTEGER, -- Gols reais do time da casa
    actual_away_goals INTEGER, -- Gols reais do time visitante
    is_correct BOOLEAN, -- Se a previsão principal foi correta
    brier_score DOUBLE PRECISION, -- Brier Score da previsão
    prediction_error DOUBLE PRECISION, -- Erro de previsão
    settled_at TIMESTAMP WITH TIME ZONE -- Quando o resultado foi liquidado
);

-- Criar índice para busca rápida por match_id
CREATE INDEX IF NOT EXISTS argos_signal_ledger_match_id_idx ON argos_signal_ledger (match_id);

-- 4. Função RPC: match_context_search (para RAG Context Engine)
-- Busca fatos contextuais relevantes para um dado match_id e embedding de query.
CREATE OR REPLACE FUNCTION match_context_search(
    query_embedding VECTOR(1536),
    match_id_filter TEXT,
    similarity_threshold FLOAT,
    match_count INT
)
RETURNS TABLE (
    id UUID,
    match_id TEXT,
    content TEXT,
    embedding VECTOR(1536),
    fact_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        acs.id,
        acs.match_id,
        acs.content,
        acs.embedding,
        acs.fact_type,
        acs.created_at,
        (acs.embedding <#> query_embedding) * -1 AS similarity
    FROM
        argos_context_facts acs
    WHERE
        acs.match_id = match_id_filter
        AND (acs.embedding <#> query_embedding) * -1 > similarity_threshold
    ORDER BY
        similarity DESC
    LIMIT match_count;
END;
$$;

-- 5. Função RPC: search_context_facts (para RAG Context Engine - busca genérica)
-- Busca fatos contextuais similares a uma query, sem filtro de match_id.
CREATE OR REPLACE FUNCTION search_context_facts(
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT,
    match_count INT
)
RETURNS TABLE (
    id UUID,
    match_id TEXT,
    content TEXT,
    embedding VECTOR(1536),
    fact_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        acs.id,
        acs.match_id,
        acs.content,
        acs.embedding,
        acs.fact_type,
        acs.created_at,
        (acs.embedding <#> query_embedding) * -1 AS similarity
    FROM
        argos_context_facts acs
    WHERE
        (acs.embedding <#> query_embedding) * -1 > similarity_threshold
    ORDER BY
        similarity DESC
    LIMIT match_count;
END;
$$;

-- 6. Tabela: argos_batch_queue (para Processamento em Lote v4.5)
CREATE TABLE IF NOT EXISTS argos_batch_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id TEXT NOT NULL,
    requested_verticals TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, PROCESSING, COMPLETED, FAILED
    priority INTEGER DEFAULT 1,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexação para busca rápida por status e prioridade
CREATE INDEX IF NOT EXISTS argos_batch_queue_status_priority_idx ON argos_batch_queue (status, priority);

-- Fim do script de configuração do Argos v4.5
