import { DataIngestionService, IngestedData, AdjustedMetrics, ExternalFactors } from "@/lib/core/DataIngestionService";

export class DataIngestionServiceMock extends DataIngestionService {
  constructor() {
    super();
    console.log("[DataIngestionServiceMock] Usando DataIngestionService Mock.");
  }

  async ingest(matchId: string, refresh: boolean = false): Promise<IngestedData> {
    // Simula uma resposta de ingestão de dados (RAW)
    const mockFixture: any = {
      fixture: { id: parseInt(matchId), date: new Date().toISOString() },
      league: { id: 123, name: "Mock League" },
      teams: { home: { name: "Home" }, away: { name: "Away" } },
      goals: { home: 1, away: 0 },
      score: { halftime: { home: 0, away: 0 } }
    };

    const externalFactors: ExternalFactors = {
      refereeStrictness: 1.0,
      weatherCondition: "CLEAR",
      motivationLevel: "NORMAL",
      isDerby: false,
      expectedEdge: 0,
    };

    return {
      matchId,
      leagueId: "123",
      homeHistory: [mockFixture],
      awayHistory: [mockFixture],
      externalFactors,
      fixture: mockFixture
    };
  }

  // Mockar outros métodos se necessário
  public getPriorityLeagues(): any[] {
    return [{ id: 123, name: "Mock League" }];
  }

  protected async getTeamHistory(teamId: number, limit: number, refresh: boolean = false): Promise<any[]> {
    return []; // Retorna histórico vazio para o mock
  }
}
