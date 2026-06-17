import { DataIngestionService, IngestedData, AdjustedMetrics, ExternalFactors } from "@/lib/core/DataIngestionService";

export class DataIngestionServiceMock extends DataIngestionService {
  constructor() {
    super();
    console.log("[DataIngestionServiceMock] Usando DataIngestionService Mock.");
  }

  async ingest(matchId: string, refresh: boolean = false): Promise<IngestedData> {
    // Simula uma resposta de ingestão de dados
        const homeMetrics: AdjustedMetrics = {
      goals: 1.5,
      goalsHT: 0.5, // Adicionado
      corners: 6,
      cards: 2,
      shots: 12,
      shotsOnTarget: 5,
    };

    const awayMetrics: AdjustedMetrics = {
      goals: 1.0,
      goalsHT: 0.3, // Adicionado
      corners: 4,
      cards: 1,
      shots: 10,
      shotsOnTarget: 4,
    };


    const externalFactors: ExternalFactors = {
      refereeStrictness: 1.0,
      weatherCondition: "CLEAR",
      motivationLevel: "NORMAL",
      isDerby: false,
    };

    return {
      matchId,
      leagueId: "123", // ID de liga mock
      home: homeMetrics,
      away: awayMetrics,
      externalFactors,
    };
  }

  // Mockar outros métodos se necessário
  public getPriorityLeagues(): { id: number; name: string }[] {
    return [{ id: 123, name: "Mock League" }];
  }

  protected async getTeamHistory(teamId: number, limit: number, refresh: boolean = false): Promise<any[]> {
    return []; // Retorna histórico vazio para o mock
  }
}
