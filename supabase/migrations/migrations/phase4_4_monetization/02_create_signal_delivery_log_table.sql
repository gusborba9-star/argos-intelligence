-- Cria a tabela para registrar a entrega de sinais aos usuários
CREATE TABLE IF NOT EXISTS signal_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    signal_id UUID REFERENCES argos_signal_ledger(id) ON DELETE CASCADE NOT NULL, -- Referencia o sinal auditado
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tier_at_delivery TEXT NOT NULL, -- Tier do usuário no momento da entrega
    delivery_method TEXT, -- Ex: 'TELEGRAM', 'DISCORD', 'DASHBOARD'
    -- Adicionar campos para rastrear o status do sinal após a entrega (ex: win/loss)
    -- Isso será atualizado pelo Settle API Route
    settled_status TEXT, -- 'WIN', 'LOSS', 'VOID', 'PENDING'
    settled_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_signal_id UNIQUE (signal_id, user_id) -- Garante que um sinal seja entregue uma vez por usuário
);

-- Adiciona índices para user_id e signal_id para buscas eficientes
CREATE INDEX IF NOT EXISTS idx_signal_delivery_log_user_id ON signal_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_signal_delivery_log_signal_id ON signal_delivery_log(signal_id);

-- Habilita RLS para a tabela signal_delivery_log
ALTER TABLE signal_delivery_log ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Usuários podem ver seus próprios logs de entrega de sinais
CREATE POLICY "Users can view their own signal delivery logs" ON signal_delivery_log FOR SELECT USING (auth.uid() = user_id);
