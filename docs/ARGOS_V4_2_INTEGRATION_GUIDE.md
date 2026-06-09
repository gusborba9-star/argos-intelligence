# 🚀 Argos Intelligence v4.2: Guia de Integração do Orchestrator Industrial

Este guia detalha como interagir com o **ArgosOrchestratorV4** na sua versão industrial (v4.2), que agora suporta auditoria de mercado massiva e multi-vertical através de payloads dinâmicos, otimizado para deploy na Vercel.

---

## 🎯 Endpoint da API

O endpoint principal para a auditoria de mercado é:

`POST /api/argos/v4`

Este endpoint é um Next.js Route Handler que encapsula toda a lógica do Orchestrator, RAG, Regime Engine, Model Factory e Signal Classifier.

---

## 📥 Estrutura do Payload de Entrada (AuditPayload)

Para solicitar uma auditoria, você deve enviar um objeto `AuditPayload` no corpo da requisição POST. Este payload é flexível e permite especificar quais verticais de mercado devem ser analisadas para um determinado `matchId`.

```typescript
export interface AuditPayload {
  matchId: string;
  leagueId?: string;
  requestedVerticals: (
    'WINNER' | 'GOALS' | 'CORNERS' | 'CARDS' | 'SHOTS' | 'BTTS' | 'HANDICAP'
  )[];
  externalFactors: {
    refereeStrictness: number; // 0.8 (permissivo) -> 1.2 (rigoroso)
    weatherCondition: 'CLEAR' | 'RAIN' | 'EXTREME_HEAT';
    motivationLevel: 'NORMAL' | 'HIGH' | 'LOW'; // Final, Rebaixamento, Amistoso
    isDerby: boolean;
  };
  baseMetrics: {
    home: {
      goals?: number; // Média de gols esperados
      corners?: number; // Média de escanteios esperados
      cards?: number; // Média de cartões esperados
      shots?: number; // Média de finalizações esperadas
      // ... outras métricas base
    };
    away: {
      goals?: number;
      corners?: number;
      cards?: number;
      shots?: number;
      // ... outras métricas base
    };
  };
}
```

### Detalhes dos Campos:

*   `matchId` (obrigatório): Identificador único da partida.
*   `leagueId` (opcional): Identificador da liga, útil para contexto do RAG.
*   `requestedVerticals` (obrigatório): Um array de strings especificando quais verticais de mercado o Argos deve auditar. As opções incluem: `'WINNER'`, `'GOALS'`, `'CORNERS'`, `'CARDS'`, `'SHOTS'`, `'BTTS'`, `'HANDICAP'`.
*   `externalFactors` (obrigatório): Objeto contendo fatores externos que influenciam o `RegimeEngineV4`. Estes fatores são cruciais para ajustar o `variance_multiplier` e `model_bias`.
    *   `refereeStrictness`: Rigidez do árbitro (ex: 0.8 para permissivo, 1.2 para rigoroso).
    *   `weatherCondition`: Condição climática (ex: `'RAIN'`, `'CLEAR'`).
    *   `motivationLevel`: Nível de motivação das equipes (ex: `'HIGH'` para final, `'LOW'` para amistoso).
    *   `isDerby`: Booleano indicando se é um clássico local.
*   `baseMetrics` (obrigatório): Objeto com as métricas base (médias esperadas) para o time da casa (`home`) e visitante (`away`) para cada vertical. Estas métricas alimentam o `ModelFactory`.

---

## ⚡ Exemplo de Requisição (Node.js / JavaScript)

```javascript
const auditPayload = {
  matchId: "match_12345",
  leagueId: "brazilian_serie_a",
  requestedVerticals: ["WINNER", "GOALS", "CORNERS", "CARDS"],
  externalFactors: {
    refereeStrictness: 1.1, // Árbitro ligeiramente rigoroso
    weatherCondition: "CLEAR",
    motivationLevel: "HIGH", // Jogo decisivo
    isDerby: true
  },
  baseMetrics: {
    home: {
      goals: 1.8, // Gols esperados para o time da casa
      corners: 6.5, // Escanteios esperados para o time da casa
      cards: 2.0, // Cartões esperados para o time da casa
    },
    away: {
      goals: 1.2, // Gols esperados para o time visitante
      corners: 4.0, // Escanteios esperados para o time visitante
      cards: 2.5, // Cartões esperados para o time visitante
    },
  },
};

async function runArgosAudit() {
  try {
    const response = await fetch("https://seu-dominio.vercel.app/api/argos/v4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(auditPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erro na auditoria: ${errorData.error}`);
    }

    const result = await response.json();
    console.log("Auditoria Argos concluída:", result);
  } catch (error) {
    console.error("Erro ao executar auditoria:", error);
  }
}

runArgosAudit();
```

---

## 📤 Estrutura da Resposta

A API retornará um objeto JSON com o status da auditoria, o regime de mercado detectado, os sinais classificados e o tempo de execução.

```typescript
interface AuditResult {
  status: "SUCCESS" | "FAILED";
  matchId: string;
  regime?: string; // Regime de mercado detectado
  signalsFound?: number; // Número de sinais classificados (VALUE ou VALIDATION)
  executionTimeMs: number;
  signals?: ClassifiedSignal[]; // Array de sinais classificados
  error?: string;
}
```

---

## 💡 Otimização e Performance (Next.js / Vercel)

*   **Paralelismo**: O `ArgosOrchestratorV4` utiliza `Promise.all` para executar as simulações de Monte Carlo para diferentes verticais em paralelo, otimizando o tempo de execução.
*   **Persistência em Lote**: Todos os sinais classificados são inseridos no Supabase em uma única operação de batch, minimizando as chamadas de I/O e latência.
*   **Modularidade**: A arquitetura permite adicionar novas verticais ou fatores externos com impacto mínimo no core do sistema.

Com este orquestrador industrial, o Argos está pronto para processar um volume massivo de dados e gerar insights acionáveis para todas as verticais de mercado que você desejar.

---
*Autor: Manus AI (CTO Engenheiro Sênior de Software)*
*Versão: v4.2*
*Data: 09/06/2026*
