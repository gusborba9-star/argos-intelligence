import { FixtureResponse } from "@/lib/core/DataIngestionService";

export enum ValidationStatus {
  VALIDATED = "VALIDATED",
  REJECTED = "REJECTED",
  FIXTURE_NOT_FOUND = "FIXTURE_NOT_FOUND",
  GAME_ENDED = "GAME_ENDED",
  GAME_TOO_FAR = "GAME_TOO_FAR",
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
  IRRELEVANT_LEAGUE = "IRRELEVANT_LEAGUE",
  DUPLICATE = "DUPLICATE",
  INCONSISTENT_EVENT = "INCONSISTENT_EVENT",
  INVALID_DATE = "INVALID_DATE",
  LEAGUE_NOT_IDENTIFIED = "LEAGUE_NOT_IDENTIFIED",
  TEAMS_NOT_IDENTIFIED = "TEAMS_NOT_IDENTIFIED",
  GAME_STATUS_NOT_ALLOWED = "GAME_STATUS_NOT_ALLOWED",
  CORRUPTED_RECORD = "CORRUPTED_RECORD",
  OUT_OF_OPERATIONAL_WINDOW = "OUT_OF_OPERATIONAL_WINDOW",
}

export interface ValidationResult {
  status: ValidationStatus;
  reason?: string;
}

export class FixtureValidator {
  // Argos v5.1 Syndicate-Level: Janela operacional de 10.000 simulações
  private static OPERATIONAL_WINDOW_MIN_MINUTES = -15; // Permitir jogos que acabaram de começar (LIVE)
  private static OPERATIONAL_WINDOW_MAX_MINUTES = 4320; // Máximo de 72 horas (3 dias)

  public static validate(fixture: FixtureResponse | null, today: Date = new Date()): ValidationResult {
    if (!fixture) {
      return { status: ValidationStatus.FIXTURE_NOT_FOUND, reason: "Fixture is null." };
    }

    if (!fixture.fixture || !fixture.teams || !fixture.league) {
      return { status: ValidationStatus.CORRUPTED_RECORD, reason: "Essential data missing." };
    }

    const fixtureDate = new Date(fixture.fixture.date);
    if (isNaN(fixtureDate.getTime())) {
      return { status: ValidationStatus.INVALID_DATE, reason: `Invalid date: ${fixture.fixture.date}` };
    }

    const timeToKickoffMinutes = (fixtureDate.getTime() - today.getTime()) / (1000 * 60);
    
    // Argos v5.1: Se o jogo já começou há mais de 15 min e não estamos em modo LIVE completo, pulamos.
    if (timeToKickoffMinutes < this.OPERATIONAL_WINDOW_MIN_MINUTES) {
      return { status: ValidationStatus.GAME_ENDED, reason: `Game already in progress or finished.` };
    }
    
    if (timeToKickoffMinutes > this.OPERATIONAL_WINDOW_MAX_MINUTES) {
      return { status: ValidationStatus.GAME_TOO_FAR, reason: `Game outside 72h window.` };
    }

    // 3. Status do jogo permitido (Apenas jogos que ainda não terminaram)
    const allowedStatuses = ["NS", "LIVE", "1H", "HT", "2H", "ET", "P"]; 
    const status = fixture.fixture.status.short;
    if (!allowedStatuses.includes(status)) {
      return { status: ValidationStatus.GAME_STATUS_NOT_ALLOWED, reason: `Status '${status}' not allowed.` };
    }

    // 4. Filtro de Irrelevância (Apenas o que é lixo absoluto)
    const name = fixture.league.name.toLowerCase();
    const isObscure = (
      name.includes("u19") || name.includes("u20") || name.includes("youth") || 
      name.includes("reserve") || name.includes("women") || name.includes("friendly")
    );

    // Se for obscuro e não for elite (pode acontecer em amigáveis de grandes times), rejeitamos.
    const eliteLeagues = [1, 2, 3, 11, 13, 15, 61, 71, 72, 73, 78, 94, 140];
    const isElite = eliteLeagues.includes(fixture.league.id);

    if (isObscure && !isElite) {
      return { status: ValidationStatus.IRRELEVANT_LEAGUE, reason: `League '${fixture.league.name}' is obscure.` };
    }

    return { status: ValidationStatus.VALIDATED };
  }
}
