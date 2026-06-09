# 📚 Argos Intelligence v4.3: Guia de Uso Avançado e Auto-Tuning

Este documento detalha as mais recentes capacidades do motor Argos v4.3, que agora inclui uma gama ainda mais ampla de mercados e um motor de auto-ajuste (Auto-Tuning Engine) para aprendizado autônomo.

---

## 🚀 Novas Verticais de Mercado Expandidas

O Argos v4.3 aprofunda sua capacidade de análise, adicionando suporte para:

*   **Ambas Marcam (BTTS)**: Avalia a probabilidade de ambas as equipes marcarem gols na partida.
*   **Finalizações (SHOTS)**: Previsão do total de finalizações no jogo, refletindo a intensidade ofensiva.
*   **Handicaps (HANDICAP)**: Análise de handicaps asiáticos ou europeus, ajustando as probabilidades para nivelar a disputa.

### Como Funciona a Modelagem (ArgosOrchestratorV4.ts)

O `ArgosOrchestratorV4` foi atualizado para incluir a lógica de simulação para essas novas verticais dentro do método `processVertical`:

*   **BTTS**: Utiliza as médias de gols esperados de cada equipe para calcular a probabilidade de ambas marcarem, com base na distribuição de Poisson.
*   **SHOTS**: Simula o total de finalizações usando a distribuição de Poisson, com base nas métricas de finalizações esperadas.
*   **HANDICAP**: Adapta a simulação de gols para refletir o handicap aplicado, calculando a probabilidade de vitória com o ajuste.

**Exemplo de `AuditPayload` com Novas Verticais:**

```typescript
const auditPayload = {
  matchId: "match_67890",
  leagueId: "premier_league",
  requestedVerticals: ["WINNER", "GOALS", "CORNERS", "CARDS", "BTTS", "SHOTS", "HANDICAP"],
  externalFactors: {
    refereeStrictness: 1.0, // Árbitro neutro
    weatherCondition: "CLEAR",
    motivationLevel: "NORMAL",
    isDerby: false
  },
  baseMetrics: {
    home: {
      goals: 1.5,
      corners: 6.0,
      cards: 1.8,
      shots: 15.0,
    },
    away: {
      goals: 1.0,
      corners: 4.5,
      cards: 2.2,
      shots: 10.0,
    },
  },
};
```

---

## 🧠 Auto-Tuning Engine: Aprendizado Autônomo

O **Auto-Tuning Engine** (`lib/core/AutoTuningEngine.ts`) é o coração do aprendizado autônomo do Argos. Ele analisa o histórico de performance do motor para ajustar dinamicamente os parâmetros, tornando o Argos mais preciso ao longo do tempo.

### Como Funciona:

1.  **Coleta de Histórico**: O `AutoTuningEngine` consulta o `argos_signal_ledger` no Supabase, buscando os últimos 50 sinais liquidados para uma `leagueId` e `regime` específicos.
2.  **Cálculo de Performance**: Utiliza o `brier_score` (para precisão probabilística) e `is_correct` (para acurácia da previsão principal) para avaliar o desempenho histórico.
3.  **Ajuste de Parâmetros**: Com base nessa análise, sugere um `suggestedVarianceMultiplier` e `confidenceAdjustment`.
    *   Se o `brier_score` for alto (muitos erros), a variância é aumentada para tornar o modelo mais conservador.
    *   Se a acurácia for alta, a variância pode ser reduzida, indicando maior confiança.

### Endpoint da API para Auto-Tuning

Você pode consultar as sugestões de ajuste do Auto-Tuning Engine através do novo endpoint:

`GET /api/argos/v4/tune?leagueId={ID_DA_LIGA}&regime={REGIME}`

**Exemplo de Requisição:**

```javascript
async function getTuningSuggestions(leagueId, regime) {
  try {
    const response = await fetch(`https://seu-dominio.vercel.app/api/argos/v4/tune?leagueId=${leagueId}&regime=${regime}`);
    if (!response.ok) {
      throw new Error(`Erro ao buscar ajustes: ${response.statusText}`);
    }
    const result = await response.json();
    console.log("Sugestões de Auto-Tuning:", result);
    // Exemplo de como usar: aplicar result.suggestedVarianceMultiplier no próximo runAudit
  } catch (error) {
    console.error("Erro no Auto-Tuning:", error);
  }
}

getTuningSuggestions("brazilian_serie_a", "NORMAL");
```

**Resposta Esperada (`TuningResult`):**

```typescript
export interface TuningResult {
  leagueId: string;
  regime: string;
  suggestedVarianceMultiplier: number; // Multiplicador de variância sugerido para o ModelFactory
  confidenceAdjustment: number; // Ajuste na confiança do regime
}
```

---

## 🎯 Otimização Contínua para Assertividade e Lucratividade

Com a v4.3, o Argos se torna um sistema de aprendizado contínuo. O `AutoTuningEngine` permite que o motor se adapte às nuances de cada liga e regime de mercado ao longo do tempo, sem a necessidade de intervenção manual constante. Isso é crucial para manter a assertividade e a lucratividade a longo prazo.

### 📝 Próximos Passos Sugeridos para o Uso:

1.  **Integração do Auto-Tuning no Orchestrator**: O próximo passo lógico é integrar as sugestões do `AutoTuningEngine` diretamente no `ArgosOrchestratorV4`. Antes de cada `runAudit`, o Orchestrator pode consultar o endpoint `/tune` e aplicar o `suggestedVarianceMultiplier` e `confidenceAdjustment` ao `RegimeProfile` antes de passá-lo para o `ModelFactory`.
2.  **Monitoramento e Validação**: Continue monitorando o desempenho do Argos e valide a eficácia dos ajustes automáticos.

Com estas funcionalidades, o Argos está cada vez mais próximo de ser um sistema verdadeiramente auto-suficiente e um diferencial competitivo inigualável.

---
*Autor: Manus AI (CTO Engenheiro Sênior de Software)*
*Versão: v4.3*
*Data: 09/06/2026*
