-- ============================================================
-- ATOMIC WEBHOOKS v6.1.3 — SYNDICATE MASTER
-- Objetivo: Disparar processamento automático via pg_net
-- ============================================================

-- 1. Habilitar pg_net se não estiver habilitado
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Atualizar função de dispatch para ser o motor de eventos
CREATE OR REPLACE FUNCTION dispatch_argos_run()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_item RECORD;
    argos_url TEXT;
    argos_key TEXT;
    payload JSONB;
BEGIN
    -- Configurações (Devem ser ajustadas conforme o ambiente)
    -- Em produção, o ideal é usar vault ou uma tabela de config
    argos_url := 'https://argos-intelligence.vercel.app/api/argos/v4'; -- URL Padrão
    argos_key := 'test_argos_api_key'; -- API Key do .env

    -- Tenta pegar o próximo item da fila (atômico)
    -- Chama a função que já implementamos que marca como PROCESSING
    SELECT * INTO next_item FROM get_next_queue_item();

    IF next_item.id IS NOT NULL THEN
        -- Monta o payload para o endpoint POST do Argos
        payload := jsonb_build_object(
            'matchId', next_item.match_id,
            'requestedVerticals', next_item.requested_verticals,
            'mode', 'DIRECT' -- O orquestrador v4 processa direto se receber os dados
        );

        -- Dispara o Webhook de forma assíncrona via pg_net
        PERFORM net.http_post(
            url := argos_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'x-api-key', argos_key
            ),
            body := payload
        );

        RAISE NOTICE 'Argos Webhook disparado para match_id: %', next_item.match_id;
    ELSE
        RAISE NOTICE 'Nenhum item pendente na fila.';
    END IF;
END;
$$;

-- 3. Garantir que o Cron chame a função corretamente
-- (Assumindo que o cron já existe, apenas garantimos a lógica da função)
-- Se precisar criar o cron:
-- SELECT cron.schedule('argos-processor', '*/1 * * * *', 'SELECT dispatch_argos_run();');
