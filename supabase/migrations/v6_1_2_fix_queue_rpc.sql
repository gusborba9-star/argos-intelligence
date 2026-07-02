-- ============================================================
-- FIX: get_next_queue_item RPC v6.1.2
-- Objetivo: Garantir que itens atualizados sejam re-processados
-- e que a fila não fique travada por status antigos.
-- ============================================================

CREATE OR REPLACE FUNCTION get_next_queue_item()
RETURNS SETOF argos_batch_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE argos_batch_queue
  SET 
    status = 'PROCESSING',
    updated_at = NOW()
  WHERE id = (
    SELECT id
    FROM argos_batch_queue
    WHERE 
      status IN ('QUEUED', 'VALIDATED') -- Apenas itens aguardando
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY 
      priority DESC, 
      updated_at ASC -- Prioriza os que foram atualizados há mais tempo
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- LIMPEZA DE SEGURANÇA: Reinicia itens travados em 'PROCESSING' há mais de 30 min
UPDATE argos_batch_queue 
SET status = 'QUEUED' 
WHERE status = 'PROCESSING' 
AND updated_at < NOW() - INTERVAL '30 minutes';
