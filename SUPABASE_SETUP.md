# ARGOS v7.0 — SUPABASE SETUP CHECKLIST

## 📋 PRÉ-DEPLOY (SQL Schema)

### Step 1: Abrir Supabase SQL Editor

```
1. Acesse: https://app.supabase.com
2. Selecione o projeto: mhdwqskmkyhtpwusgikc
3. Left Sidebar → SQL Editor
4. Clique: "+ New Query"
```

### Step 2: Copiar & Executar Schema

```
1. Abra: supabase/migrations/001_argos_v7_schema.sql
2. Copie TODO o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique: "Run" (ou Ctrl+Enter)
5. Aguarde 2-3 segundos
```

### Step 3: Verificar Execução

```sql
-- Copie e execute ESTAS queries para confirmar:

-- Verificar tabelas criadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'argos_%'
ORDER BY table_name;
-- ✅ Esperado: 7 linhas (argos_matches, argos_signal_ledger, ...)

-- Verificar índices
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' AND tablename LIKE 'argos_%'
ORDER BY indexname;
-- ✅ Esperado: 15+ linhas

-- Verificar funções
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;
-- ✅ Esperado: 5 linhas (cleanup_expired_queue_items, dispatch_signal_to_telegram, ...)

-- Verificar configurações de modelo
SELECT COUNT(*) FROM argos_model_config;
-- ✅ Esperado: 5 (ligas pré-cadastradas)
```

### Step 4: Testar Inserção

```sql
-- Testar inserção de match de teste
INSERT INTO argos_matches (
  external_fixture_id, 
  match_id, 
  league_id, 
  home_team, 
  away_team, 
  start_time
) VALUES (
  999999, 
  'test_match_001', 
  1,
  'Test Home', 
  'Test Away',
  NOW() + INTERVAL '1 day'
);
-- ✅ Esperado: 1 row inserted

-- Verificar se inseriu
SELECT * FROM argos_matches WHERE match_id = 'test_match_001';
-- ✅ Esperado: 1 resultado
```

### Step 5: Testar Funções

```sql
-- Testar get_queue_statistics
SELECT * FROM get_queue_statistics();
-- ✅ Esperado: 1 row com contagens de fila

-- Testar dispatch para telegram
SELECT * FROM dispatch_signal_to_telegram(
  jsonb_build_object(
    'signal_id', 'test_signal_001',
    'tier', 'FREE',
    'matchName', 'Test vs Test',
    'leagueName', 'Test League',
    'vertical', 'WINNER',
    'selection', 'Home Win',
    'odd', 2.5,
    'fairOdd', 2.0,
    'expectedValue', 0.15,
    'probability', 0.60,
    'kellyCriterion', 0.10,
    'analysisSummary', 'Test signal'
  )
);
-- ✅ Esperado: success = true

-- Verificar HTTP queue
SELECT COUNT(*) FROM argos_http_queue WHERE status = 'PENDING';
-- ✅ Esperado: 1 (a mensagem foi enfileirada)
```

## ⚠️ TROUBLESHOOTING

### Erro: "relation does not exist"
```sql
-- Problema: Schema não foi executado completamente
-- Solução: Reexecute o arquivo SQL completo do início
```

### Erro: "permission denied"
```sql
-- Problema: Usuário sem permissão
-- Solução: Use a conexão com role "service_role"
-- Verifique em: Supabase → Settings → Database → Users
```

### Erro: "unique violation"
```sql
-- Problema: Dados duplicados no teste
-- Solução: Execute: DELETE FROM argos_matches WHERE match_id LIKE 'test_%';
-- Depois reinsira
```

## 🔄 PRÓXIMOS PASSOS

1. ✅ SQL Schema executado
2. ⏳ Vercel build em produção
3. ⏳ Edge Function (Cron Worker)
4. ⏳ Telegram Bot validado
5. ⏳ Primeira ingestão de dados

---

**Status**: ✅ SCHEMA READY  
**Data**: 2026-07-12  
**Próximo**: VERCEL_CONFIG.md
