-- SCRIPT DE CORREÇÃO: CRIAR FUNÇÃO RPC PARA O ARGOS v5.0
-- RODE ESTE SCRIPT NO SQL EDITOR DO SEU SUPABASE

-- 1. Garantir que a tabela tenha os campos corretos (se necessário)
ALTER TABLE IF EXISTS argos_batch_queue 
ADD COLUMN IF NOT EXISTS market_family TEXT NOT NULL DEFAULT 'ALL_MARKETS',
ADD COLUMN IF NOT EXISTS unique_key TEXT;

-- 2. Criar ou atualizar a função RPC get_next_queue_item
-- Esta função garante que apenas um worker processe cada jogo por vez (Lock Atômico)
CREATE OR REPLACE FUNCTION get_next_queue_item()
RETURNS SETOF argos_batch_queue AS $$
DECLARE
    next_item_id UUID;
BEGIN
    -- 1. Localizar o próximo item na fila (QUEUED ou VALIDATED)
    -- Prioriza Ligas de Elite (Priority alta) e ordem de chegada
    SELECT id INTO next_item_id
    FROM argos_batch_queue
    WHERE status IN ('QUEUED', 'VALIDATED')
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED; -- LOCK DE LINHA INDUSTRIAL: Impede duplicidade de processamento

    -- 2. Se encontrar, marcar como PROCESSING e retornar os dados
    IF next_item_id IS NOT NULL THEN
        RETURN QUERY
        UPDATE argos_batch_queue
        SET status = 'PROCESSING', updated_at = NOW()
        WHERE id = next_item_id
        RETURNING *;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Garantir índices de performance
CREATE INDEX IF NOT EXISTS argos_batch_queue_status_priority_idx ON argos_batch_queue (status, priority);
CREATE UNIQUE INDEX IF NOT EXISTS argos_batch_queue_unique_key_idx ON argos_batch_queue (unique_key);
