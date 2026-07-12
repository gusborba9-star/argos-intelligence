# ============================================================
# ARGOS v7.0 — VERCEL BUILD CONFIGURATION
# NÃO EDITE vercel.json — Configure tudo via Vercel Dashboard
# ============================================================

## 🎯 VERCEL DASHBOARD SETTINGS (Obrigatório)

### 1. Build & Development
```
Project Settings → Build & Development Settings

Build Command:           npm run build
Output Directory:        .next
Install Command:         npm install --prefer-offline --no-audit
Node.js Version:         18.x (ou superior)
Function Timeouts:       60 seconds (máximo)
Memory:                  3008 MB (máximo)
```

### 2. Environment Variables (Production)
```
Project Settings → Environment Variables

Adicionar TODAS as variáveis abaixo em:
  ✓ Production
  ✓ Preview  
  ✓ Development

NEXT_PUBLIC_SUPABASE_URL=https://mhdwqskmkyhtpwusgikc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZHdxc2tta3lodHB3dXNnaWtjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ2OTcwMywiZXhwIjoyMDk1MDQ1NzAzfQ.fX_4FvMwGeUMxRxDuTCd31VsBCHGfLxUi1C-Pmwlvb0
PROPLINE_API_KEY=4a4b3e858981530cfd0033227758a860
TELEGRAM_BOT_TOKEN=8700765166:AAGE2K_inKiWKdj5vIaZm8SmsQuiY7Byi1M
TELEGRAM_FREE_CHANNEL_ID=-1004447462304
TELEGRAM_CHAT_ID=-1004452972435
GOOGLE_API_KEY=your_google_gemini_api_key_here
ARGOS_API_KEY=argos_production_secret_key_2026
```

### 3. Git Settings
```
Project Settings → Git → Deploy on Push
  ✓ Deploy on Push: Enabled
  ✓ Production Branch: main
  ✓ Preview Deployments: All branches except main
```

## 📋 CHECKLIST PRÉ-DEPLOY

```bash
# 1. Verificar build local
npm run build
# ✓ Esperado: "compiled successfully"

# 2. Verificar tipos
npm run type-check
# ✓ Esperado: Sem erros TypeScript

# 3. Verificar lint
npm run lint
# ✓ Esperado: Sem erros

# 4. Fazer commit
git add .
git commit -m "🚀 ARGOS v7.0 - Production Ready"
git push origin fix/argos-production-ready-v7

# 5. Criar PR
# GitHub → Pull Requests → New PR
# Base: main ← Compare: fix/argos-production-ready-v7

# 6. Merge
git checkout main
git pull
git merge fix/argos-production-ready-v7
git push origin main

# ✓ Vercel irá fazer deploy automaticamente!
```

## ✅ VERIFICAÇÃO PÓS-DEPLOY

```bash
# Vercel URL
https://argos-intelligence-lake.vercel.app

# Logs
vercel logs argos-intelligence --tail

# Health Check
curl -I https://argos-intelligence-lake.vercel.app
# ✓ Esperado: HTTP 200
```

## ⚠️ ERROS COMUNS

| Erro | Solução |
|------|----------|
| Build fails: "module not found" | `npm install` local, depois push |
| "env not found in vercel.json" | NÃO edite vercel.json, use Dashboard |
| Timeout 60s | Cheque queries Supabase lentas |
| "Unauthorized" no API | Verifique SUPABASE_SERVICE_ROLE_KEY |

---

**Status**: ✅ PRODUCTION READY  
**Arquivo**: Configuração apenas via Vercel Dashboard  
**Próximo**: Execute supabase/migrations/001_argos_v7_schema.sql
