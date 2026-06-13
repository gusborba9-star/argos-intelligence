-- Cria a tabela para gerenciar os tiers de assinatura dos usuários
CREATE TABLE IF NOT EXISTS user_tiers (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    tier_level TEXT NOT NULL DEFAULT 'FREE', -- FREE, PRO, WHALE/VIP
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    stripe_customer_id TEXT, -- ID do cliente no Stripe, se aplicável
    stripe_subscription_id TEXT, -- ID da assinatura no Stripe, se aplicável
    CONSTRAINT valid_tier_level CHECK (tier_level IN ('FREE', 'PRO', 'WHALE/VIP'))
);

-- Adiciona um índice para stripe_customer_id para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_user_tiers_stripe_customer_id ON user_tiers(stripe_customer_id);

-- Habilita RLS (Row Level Security) para a tabela user_tiers
ALTER TABLE user_tiers ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Usuários podem ver e atualizar seu próprio tier
CREATE POLICY "Users can view their own tier" ON user_tiers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own tier" ON user_tiers FOR UPDATE USING (auth.uid() = user_id);

-- Admins podem gerenciar todos os tiers (assumindo um role 'admin' ou similar)
-- Para simplificar, vamos permitir que o serviço de backend (com service_role_key) insira/atualize
-- Em um ambiente real, teríamos políticas mais granulares para admins.
