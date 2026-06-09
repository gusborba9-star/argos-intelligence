# 🗺️ Argos Intelligence: Roadmap Checklist v4.0 → v5.0
**Status Atual:** Arquitetura Base v4.0 Consolidada
**Objetivo:** Auditor de Mercado Auto-Suficiente, Lucrativo e Escalável.

---

## 🏗️ Fase 1: Fundação & Infraestrutura (Concluído ✅)
*Foco: Estabilizar o motor e garantir deploy serverless.*

- [x] **Arquitetura v4.0 Consolidada**: Migração para Route Handlers Next.js (Vercel).
- [x] **Core Matemático**: Implementação de Poisson/Elo isolados de ruído.
- [x] **Monte Carlo Engine**: Simulação de 1.500 iterações para dispersão de variância.
- [x] **RAG Context Engine**: Integração inicial com Supabase (pgvector) e Gemini Flash.
- [x] **Regime Engine**: Classificação tripla de sinais (Value, Validation, Noise).
- [x] **Repositório GitHub**: Organização de diretórios e correção de imports.

---

## 🧠 Fase 2: Cérebro Adaptativo & Feedback Loop (Próximo Passo 🚀)
*Foco: Fazer o Argos aprender com os próprios resultados e reduzir dependência de IA externa.*

- [ ] **Ledger de Resultados (Ground Truth)**: Implementar worker que busca o resultado real do jogo após 24h.
- [ ] **Feedback Loop Automatizado**: Script que compara `probabilidade_argos` vs `resultado_real` e armazena o erro no Supabase.
- [ ] **Auto-Tuning de Regimes**: Ajustar o `variance_multiplier` com base no histórico de acertos de cada liga/regime.
- [ ] **Base de Conhecimento Local**: Migrar gradualmente o conhecimento do Gemini para embeddings locais (RAG) de alta densidade.
- [ ] **Redução de Custo de IA**: Implementar cache semântico (se um jogo similar já foi analisado, reutilizar o RegimeProfile).

---

## 📊 Fase 3: Auditoria de Mercado & Inteligência de Dados
*Foco: Transformar o Argos em um Auditor que detecta anomalias de odds em tempo real.*

- [ ] **Market Scanner Batch**: Integração total com API Football (100 jogos/dia no plano free).
- [ ] **Detecção de "Smart Money"**: Monitorar movimentações bruscas de odds (comportamento expressivo de última hora).
- [ ] **Normalização de Odds**: Implementar conversor de odds de múltiplas casas para encontrar o "Preço Justo" global.
- [ ] **Veto de Liquidez**: Descartar mercados com baixo volume onde a odd é volátil demais para ser confiável.

---

## 💰 Fase 4: Monetização & Entrega de Valor
*Foco: Estruturar os planos e a entrega automatizada para os usuários.*

- [ ] **Sistema de Tiers (Planos)**:
    - [ ] **Plano Free**: Apenas Sinais de "Validation" (Alta probabilidade, EV neutro).
    - [ ] **Plano Pro**: Sinais de "Value" (Desajuste de mercado) + Auditoria Completa.
    - [ ] **Plano Whale/VIP**: Sinais de última hora + Gestão de Banca sugerida (Kelly Criterion).
- [ ] **Dashboard de Transparência**: Página pública com o histórico de assertividade (Track Record) do Argos.
- [ ] **Bot de Entrega (Telegram/Discord)**: Automação para enviar as oportunidades de acordo com o plano do usuário.

---

## 🛡️ Fase 5: Auto-Suficiência (Argos v5.0)
*Foco: Independência total e dominância estatística.*

- [ ] **Model Factory Proprietário**: Treinar modelos de regressão locais que substituem a lógica de Poisson em ligas específicas.
- [ ] **Auto-Scaling de Análise**: Sistema que prioriza jogos com maior potencial de lucro para otimizar custos de processamento.
- [ ] **Argos Ledger Public API**: Permitir que outros sistemas consultem a "Auditoria de Mercado" do Argos.

---

### 📝 Notas do CTO:
> "O Argos não é apenas um bot de apostas; é uma infraestrutura de dados. Nosso diferencial é o **Ledger de Feedback**. Quanto mais jogos processamos, mais o motor entende o 'ruído' do mercado e mais precisas se tornam as simulações de Monte Carlo."

---
*Atualizado em: 09/06/2026*
