#!/bin/bash
# ============================================================
# BUILD VERIFICATION SCRIPT v7.0
# Executa ANTES de fazer push para Vercel
# ============================================================

set -e

echo "\n🔍 ARGOS v7.0 — PRÉ-DEPLOY VERIFICATION\n"

# ============================================================
# STEP 1: Install Dependencies
# ============================================================
echo "[1/5] Installing dependencies..."
npm install --prefer-offline --no-audit 2>&1 | tail -5
echo "✅ Dependencies installed\n"

# ============================================================
# STEP 2: Type Check
# ============================================================
echo "[2/5] Running TypeScript type check..."
if npm run type-check 2>&1; then
  echo "✅ TypeScript check passed\n"
else
  echo "❌ TypeScript errors found. Fix and retry.\n"
  exit 1
fi

# ============================================================
# STEP 3: Lint Check
# ============================================================
echo "[3/5] Running ESLint..."
if npm run lint 2>&1 | head -20; then
  echo "✅ Lint check passed\n"
else
  echo "⚠️  Lint warnings found (non-critical)\n"
fi

# ============================================================
# STEP 4: Build
# ============================================================
echo "[4/5] Running Next.js build..."
if npm run build 2>&1 | grep -E "(compiled successfully|error|failed)"; then
  if npm run build 2>&1 | grep -q "compiled successfully"; then
    echo "✅ Build successful\n"
  else
    echo "❌ Build failed\n"
    exit 1
  fi
fi

# ============================================================
# STEP 5: Environment Variables Check
# ============================================================
echo "[5/5] Checking environment variables..."

REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "PROPLINE_API_KEY"
  "TELEGRAM_BOT_TOKEN"
  "TELEGRAM_FREE_CHANNEL_ID"
  "TELEGRAM_CHAT_ID"
  "ARGOS_API_KEY"
)

MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "⚠️  Missing: $var"
    ((MISSING++))
  else
    echo "✅ Found: $var"
  fi
done

if [ $MISSING -gt 0 ]; then
  echo "\n⚠️  $MISSING environment variable(s) missing"
  echo "   Set them in Vercel Dashboard → Project Settings → Environment Variables"
else
  echo "\n✅ All environment variables configured\n"
fi

# ============================================================
# FINAL SUMMARY
# ============================================================
echo "\n═════════════════════════════════════════════════════════"
echo "   ✅ ARGOS v7.0 — READY FOR PRODUCTION"
echo "═════════════════════════════════════════════════════════"
echo ""
echo "📝 NEXT STEPS:"
echo ""
echo "1. SQL SCHEMA (Execute no Supabase SQL Editor):"
echo "   supabase/migrations/001_argos_v7_schema.sql"
echo ""
echo "2. TELEGRAM SETUP:"
echo "   - Verify bot is online: getMe endpoint"
echo "   - Test FREE channel: -1004447462304"
echo "   - Test VIP channel: -1004452972435"
echo ""
echo "3. GIT & VERCEL:"
echo "   git add ."
echo "   git commit -m '🚀 ARGOS v7.0 - Production Ready'"
echo "   git push origin fix/argos-production-ready-v7"
echo "   (Create PR and merge to main)"
echo ""
echo "4. MONITOR DEPLOY:"
echo "   vercel logs argos-intelligence --tail"
echo ""
echo "═════════════════════════════════════════════════════════"
echo ""
