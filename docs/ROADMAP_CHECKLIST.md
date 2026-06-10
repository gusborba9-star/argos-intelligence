# 🗺️ Argos Intelligence: Roadmap Checklist v4.5 → v5.0
**Status Atual:** Auditoria de Mercado & Vigilância (Fase 3) Concluída ✅
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

## 🧠 Fase 2: Cérebro Adaptativo & Feedback Loop (Concluído ✅)
*Foco: Fazer o Argos aprender com os próprios resultados e reduzir dependência de IA externa.*

- [x] **Expansão Multi-Vertical (v4.1/v4.2)**: Suporte para Gols, Escanteios, Cartões e Finalizações.
- [x] **Orquestrador Industrial (v4.2)**: Processamento paralelo (Promise.all) e persistência em lote (Batch Insert).
- [x] **Feedback Engine**: Implementação do cálculo de precisão (Brier Score) e erro de previsão.
- [x] **Settle API Route**: Endpoint para liquidação de resultados e fechamento do ciclo de aprendizado.
- [x] **Schema de Dados v4.2**: Tabelas e RPCs atualizadas no Supabase para suportar o Ledger de Feedback.
- [x] **Auto-Tuning de Regimes**: Ajustar o `variance_multiplier` com base no histórico de acertos de cada liga/regime.
- [x] **Base de Conhecimento Local**: Migrar gradualmente o conhecimento do Gemini para embeddings locais (RAG) de alta densidade.
- [x] **Redução de Custo de IA**: Implementar cache semântico (se um jogo similar já foi analisado, reutilizar o RegimeProfile).
- [x] **DataIngestionService (v4.5)**: Extração automática de dados com decaimento exponencial e médias móveis (xG/xGA).
- [x] **Orquestrador Zero-Touch (v4.5)**: `runZeroTouchAudit` para automação completa a partir de um `matchId`.
- [x] **Fila de Processamento em Lote (v4.5)**: `BatchQueueService` e rotas de API para processamento assíncrono e escalável.

---

## 📊 Fase 3: Auditoria de Mercado & Inteligência de Dados (Concluído ✅)
*Foco: Transformar o Argos em um Auditor que detecta anomalias de odds em tempo real.*

- [x] **AnomalyDetectionService (v4.5.3)**: Comparação em tempo real entre probabilidades do modelo e odds de mercado.
- [x] **Lógica de Vigilância**: Alertas baseados em Brier Score projetado e discrepância de odds (>10%).
- [x] **Segurança de API**: Implementação de `x-api-key` para proteção de rotas críticas de auditoria.
- [x] **Teste de Estresse (v4.5.4)**: Validação de 50 requisições simultâneas (100% sucesso, latência média 1.16s).
- [x] **Refatoração de Resposta**: Orquestrador agora retorna confirmação limpa (`matchId` + `status`) após persistência.

---

## 💰 Fase 4: Monetização & Entrega de Valor (Próximo Passo 🚀)
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
> "O Argos v4.5 atingiu a maturidade de **Market Vigilante**. Com a implementação do `AnomalyDetectionService` e o sucesso absoluto nos testes de estresse (50 requisições simultâneas com latência de 1.1s), provamos que a arquitetura serverless + Supabase é resiliente e ultra-veloz. O sistema agora não apenas calcula, mas audita o mercado em tempo real, identificando anomalias de precificação com precisão matemática. Próximo passo: transformar essa inteligência em um produto escalável (Fase 4)."

---
*Última Atualização: 10/06/2026*
