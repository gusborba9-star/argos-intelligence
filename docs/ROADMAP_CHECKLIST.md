# 🗺️ Argos Intelligence — CTO Roadmap & Source of Truth

**Status:** Foundation / production signal pipeline operational; quantitative hardening in progress.

> Este roadmap é a fonte estrutural. O `docs/CTO_PROGRESS_LEDGER.md` é o registro operacional dos ciclos. Nenhuma capacidade é considerada comprovada apenas porque existe no código: precisa de validação, replay/backtest e métricas out-of-sample.

## North Star

Construir um motor de inteligência pré-jogo para futebol global comparável em disciplina quantitativa a operações profissionais de análise de mercado: probabilidades independentes, fair prices auditáveis, valor esperado, microestrutura de mercado, contexto externo, aprendizado histórico e distribuição escalável.

**Princípio:** potência sem falsa precisão. O Argos deve procurar oportunidades; não deve fabricar confiança para aumentar volume.

---

## Fases 1–6 — Fundação & Interface

- [x] Next.js / Route Handlers
- [x] Supabase / persistência
- [x] Monte Carlo base
- [x] RAG contextual
- [x] Interface e distribuição FREE/VIP

## Fases 7–10 — Infraestrutura Existente

- [x] Tipagem e estabilidade de pipeline
- [x] Monte Carlo de alta iteração
- [x] Cache / otimização operacional
- [x] Anti-fragility / telemetria
- [x] Quota optimization
- [x] Prioridade de ligas
- [x] Idempotência e provenance de distribuição
- [x] Contrato discriminado de handicap + settlement
- [x] Correção de inflação artificial no engine legado

> **Nota:** itens históricos acima representam capacidades implementadas, não garantia de assertividade. Métricas de performance devem ser comprovadas por dados out-of-sample.

---

# Fase 11 — Quantitative Integrity & Calibration 🔥 ATUAL

### C-003 — Fair Price / EV Integrity

- [ ] Separar definitivamente `modelProbability`, `marketConsensusProbability` e `fairProbability`.
- [ ] Eliminar qualquer semântica de "confidence" que possa ser interpretada como probabilidade de acerto.
- [ ] Validar direção matemática de `realValue`.
- [ ] Auditar pesos e duplicidade de bookmakers.
- [ ] Auditar handicap `point`, `side`, linha normalizada e settlement.
- [ ] Criar invariantes quantitativos para EV, fair odds, probability e Kelly.
- [ ] Replay determinístico dos casos de sinais inflados já observados.

### C-004 — Probability Calibration

- [ ] Calibração por liga.
- [ ] Calibração por vertical/mercado.
- [ ] Brier Score.
- [ ] Log Loss.
- [ ] Reliability curve.
- [ ] Shrinkage por tamanho de amostra.
- [ ] Separar probabilidade bruta → calibrada → publicada.

### C-005 — Market Microstructure

- [ ] Pinnacle como referência sharp, sem tratá-la como verdade absoluta.
- [ ] Consenso ponderado multi-book.
- [ ] Divergência sharp/soft como feature, não veto automático.
- [ ] Detecção de preço stale.
- [ ] Movimento de linha e preço.
- [ ] Registro de snapshot para CLV.
- [ ] CLV observado após fechamento.

### C-006 — Model Ensemble

- [ ] Poisson/Skellam para gols.
- [ ] Monte Carlo para distribuição conjunta.
- [ ] Modelos específicos para corners/cards/shots conforme qualidade dos dados.
- [ ] Ensemble ponderado por performance out-of-sample.
- [ ] Detecção de desacordo entre modelos.
- [ ] Peso adaptativo baseado em calibração, não em heurística fixa.

### C-007 — RAG / External Intelligence

- [ ] Lesões e suspensões.
- [ ] Escalações prováveis/oficiais.
- [ ] Clima.
- [ ] Motivação/contexto competitivo.
- [ ] Notícias relevantes.
- [ ] H2H somente como feature de baixo peso quando estatisticamente justificável.
- [ ] RAG nunca cria uma probabilidade numérica sem modelo quantitativo explícito.

### C-008 — Historical Learning Loop

- [ ] Registrar previsão + snapshot de dados + resultado oficial.
- [ ] Atualização incremental de histórico por time/liga/mercado.
- [ ] Aprendizado somente depois do settlement.
- [ ] Proteção contra data leakage.
- [ ] Versionamento de modelo e feature set.
- [ ] Monitoramento de drift.

### C-009 — Signal Ranking & Portfolio

- [ ] Ranking multiobjetivo: EV + calibração + estabilidade + liquidez + CLV potencial.
- [ ] FREE: seleção pública de alta probabilidade sem confundir probabilidade com valor.
- [ ] VIP: oportunidades de valor e cobertura ampliada de mercados.
- [ ] Limites de correlação entre sinais.
- [ ] Exposição agregada por partida/mercado.
- [ ] Idempotência e provenance completos.

### C-010 — API Efficiency & Data Integrity

- [ ] PropLine como fonte primária para dados cobertos pelo contrato.
- [ ] API-Football apenas para lacunas justificadas.
- [ ] Budget diário explícito: PropLine ≤ quota contratada; API-Football ≤ 100/dia conforme plano atual.
- [ ] Cache e deduplicação por partida/linha/horário.
- [ ] Não alterar adaptadores sem validar request/response reais.
- [ ] Falhas de fornecedor não podem virar probabilidades inventadas.

### C-011 — Production Quant Audit

- [ ] Replay determinístico.
- [ ] Walk-forward backtest.
- [ ] Paper ledger.
- [ ] ROI por mercado/liga.
- [ ] CLV por mercado/liga.
- [ ] Brier/Log Loss por mercado/liga.
- [ ] Stress tests.
- [ ] Análise de drawdown e correlação.
- [ ] Auditoria FREE vs VIP.

### C-012 — Autonomous Learning

- [ ] AutoTuning condicionado a evidência out-of-sample.
- [ ] Drift detection.
- [ ] Model rollback.
- [ ] Champion/challenger models.
- [ ] Recalibração automática somente após janela estatística mínima.

---

# Fase 12 — Escala Global

Só iniciar depois da Fase 11 produzir evidência quantitativa suficiente.

- [ ] Expansão controlada para novas ligas.
- [ ] Mais mercados.
- [ ] Redis/distributed cache quando economicamente justificável.
- [ ] Otimização serverless.
- [ ] Observabilidade operacional.
- [ ] Escala de usuários sem multiplicar custo de inferência por usuário.

---

## Definition of Done

Cada ciclo segue obrigatoriamente:

**Analisar → Implementar → Testar → Build → Deployment Ready → Atualizar Ledger/Roadmap → Próximo ciclo.**

Nenhum ciclo é marcado como concluído enquanto o deployment não estiver **Ready**.

---

*Última atualização: 18/08/2026 — CTO Quantitative Integrity Program*
