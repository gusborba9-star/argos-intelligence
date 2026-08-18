# Argos Intelligence — CTO Progress Ledger

> **Fonte operacional de progresso.** Este arquivo registra ciclos executados, validações e decisões do CTO. O código só é considerado concluído após deployment **Ready**.

## Operating Doctrine

- **No-Veto:** o Argos não deve virar uma máquina de recusar mercados. Ele deve medir, ranquear e expor oportunidades; ausência de evidência reduz confiança, não cria bloqueios arbitrários.
- **Independent Probability:** probabilidade do modelo nunca pode ser substituída silenciosamente por fair probability derivada do mercado.
- **Market as Evidence:** Pinnacle/Bet365 e demais preços são referência de mercado, não ground truth do modelo.
- **Temporal Integrity:** nenhum dado futuro pode contaminar uma previsão pré-jogo.
- **Provenance:** cada sinal deve permitir reconstruir dados, versão do motor, horário, mercado, preço e cálculo que o produziram.
- **API Contract Protection:** alterações em PropLine/API-Football exigem preservação explícita dos contratos de request/response e respeito às quotas antes de qualquer refatoração.
- **Validation Gate:** ciclo = analisar → implementar → testar/build → deployment Ready → registrar progresso.

## Completed Cycles

### C-001 — Blueprint Foundation
- [x] Blueprint/roadmap definidos como fonte estrutural de verdade.
- [x] Execução por ciclos, não por correções isoladas.

### C-002 — Type/Build Integrity: Handicap
- [x] Corrigido contrato de seleção de handicap em `ArgosMasterOrchestrator`.
- [x] Introduzido discriminador `kind` para separar seleção padrão de handicap.
- [x] Preservados `side` e `point` para settlement asiático.
- [x] Deployment `fe818bd` validado como **Ready**.

## Current Quantitative Integrity Cycle — C-003

### Objetivo
Eliminar fontes de confiança sem lastro e inconsistências semânticas entre fair price, model probability, EV e confidence antes de aumentar a complexidade do ensemble.

### Findings
- [ ] Auditar confiança atribuída à referência Pinnacle: `0.98` não deve significar 98% de probabilidade de acerto.
- [ ] Separar semanticamente **market-reference confidence** de **model predictive confidence**.
- [ ] Auditar `realValue` para garantir que sua direção matemática corresponda ao conceito documentado.
- [ ] Auditar pesos e duplicidade de bookmakers no consenso.
- [ ] Auditar linhas/points de handicap contra o settlement e contra o payload normalizado.
- [ ] Criar invariantes quantitativos para impedir regressões silenciosas.

### Not Yet Done
- [ ] Não considerar C-003 concluído antes de deployment Ready.
- [ ] Não alterar adaptadores PropLine/API-Football neste ciclo sem auditoria do contrato real.

## Next Cycles

### C-004 — Probability Calibration
- Calibração por liga/mercado.
- Brier score, log loss e reliability curves.
- Shrinkage por tamanho de amostra.
- Separação entre probabilidade bruta, calibrada e publicada.

### C-005 — Market Microstructure
- Consenso multi-book.
- Movimento de preço.
- Divergência sharp/soft.
- CLV observável pós-fechamento.
- Detecção de stale lines sem transformar o sistema em veto global.

### C-006 — Historical Learning Loop
- Registro de cada previsão e resultado.
- Atualização incremental de histórico por time/liga/mercado.
- Feedback somente após settlement oficial.
- Proteção contra leakage.

### C-007 — Model Ensemble
- Poisson/Skellam para gols.
- Monte Carlo para distribuição conjunta.
- Modelos específicos para corners/cards/shots quando houver dados suficientes.
- Ensemble ponderado por performance out-of-sample.
- RAG/IA exclusivamente para contexto externo e interpretação, nunca para inventar probabilidades.

### C-008 — Signal Ranking & Distribution
- Ranking por valor, confiança calibrada, liquidez e estabilidade.
- FREE: exposição controlada de alta probabilidade.
- VIP: oportunidades de valor e mercados adicionais.
- Idempotência, provenance e snapshot do sinal.

### C-009 — API Efficiency
- PropLine como fonte primária.
- API-Football como complemento seletivo.
- Budget accounting diário.
- Cache e deduplicação.
- Nenhuma alteração de contrato sem validação do fornecedor.

### C-010 — Production Quant Audit
- Replay determinístico.
- Backtest walk-forward.
- Paper ledger.
- CLV e ROI por mercado/liga.
- Stress tests.
- Só então considerar claims de assertividade.

## Definition of Done

Um ciclo só pode ser marcado como concluído quando:

1. implementação feita;
2. testes/invariantes executados;
3. build/deployment concluído;
4. deployment reportado como **Ready**;
5. progresso registrado aqui;
6. nenhuma regressão conhecida ficou pendente sem registro.
