# 🗺️ Argos Intelligence: Roadmap Checklist v4.2 → v5.0
**Status Atual:** Auditoria Industrial Multi-Vertical v4.2 Consolidada ✅
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

## 🧠 Fase 2: Cérebro Adaptativo & Feedback Loop (Em Progresso ⚙️)
*Foco: Fazer o Argos aprender com os próprios resultados e reduzir dependência de IA externa.*

- [x] **Expansão Multi-Vertical (v4.1/v4.2)**: Suporte para Gols, Escanteios, Cartões e Finalizações.
- [x] **Orquestrador Industrial (v4.2)**: Processamento paralelo (Promise.all) e persistência em lote (Batch Insert).
- [x] **Feedback Engine**: Implementação do cálculo de precisão (Brier Score) e erro de previsão.
- [x] **Settle API Route**: Endpoint para liquidação de resultados e fechamento do ciclo de aprendizado.
- [x] **Schema de Dados v4.2**: Tabelas e RPCs atualizadas no Supabase para suportar o Ledger de Feedback.
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
> "Com a v4.2, o Argos deixou de ser um script e se tornou uma plataforma de auditoria industrial. O paralelismo e o processamento multi-vertical nos permitem analisar o evento em sua totalidade, enquanto o Feedback Loop garante que nosso diferencial competitivo — o 'Cérebro' — cresça exponencialmente a cada jogo processado."

---
*Última Atualização: 09/06/2026*
