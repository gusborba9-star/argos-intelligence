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
  private static OPERATIONAL_WINDOW_MIN_MINUTES = 45; // Mínimo de 45 minutos antes do kickoff
  private static OPERATIONAL_WINDOW_MAX_MINUTES = 2880; // Máximo de 48 horas (2 dias) antes do kickoff

  public static validate(fixture: FixtureResponse | null, today: Date = new Date()): ValidationResult {
    if (!fixture) {
      return { status: ValidationStatus.FIXTURE_NOT_FOUND, reason: "Fixture object is null or undefined." };
    }

    if (!fixture.fixture || !fixture.teams || !fixture.league || !fixture.goals) {
      return { status: ValidationStatus.CORRUPTED_RECORD, reason: "Essential fixture data is missing." };
    }

    // 1. Fixture existe na API-Football (já coberto pelo `fixture` ser não-nulo)

    // 2. Data válida e dentro da janela operacional
    const fixtureDate = new Date(fixture.fixture.date);
    if (isNaN(fixtureDate.getTime())) {
      return { status: ValidationStatus.INVALID_DATE, reason: `Invalid fixture date: ${fixture.fixture.date}` };
    }

    const timeToKickoffMinutes = (fixtureDate.getTime() - today.getTime()) / (1000 * 60);
    if (timeToKickoffMinutes < this.OPERATIONAL_WINDOW_MIN_MINUTES) {
      return { status: ValidationStatus.GAME_ENDED, reason: `Game already started or ended. Time to kickoff: ${timeToKickoffMinutes} minutes.` };
    }
    if (timeToKickoffMinutes > this.OPERATIONAL_WINDOW_MAX_MINUTES) {
      return { status: ValidationStatus.GAME_TOO_FAR, reason: `Game is too far in the future. Time to kickoff: ${timeToKickoffMinutes} minutes.` };
    }

    // 3. Liga identificada e relevante
    if (!fixture.league.id || !fixture.league.name) {
      return { status: ValidationStatus.LEAGUE_NOT_IDENTIFIED, reason: "League ID or name is missing." };
    }

    const name = fixture.league.name.toLowerCase();
    if (
      name.includes("u19") ||
      name.includes("u20") ||
      name.includes("u21") ||
      name.includes("u23") ||
      name.includes("women") ||
      name.includes("youth") ||
      name.includes("reserve") ||
      name.includes("friendly") ||
      name.includes("exhibition")
    ) {
      return { status: ValidationStatus.IRRELEVANT_LEAGUE, reason: `League '${fixture.league.name}' is considered obscure or irrelevant.` };
    }

    // 4. Times identificados
    if (!fixture.teams.home || !fixture.teams.home.id || !fixture.teams.home.name ||
        !fixture.teams.away || !fixture.teams.away.id || !fixture.teams.away.name) {
      return { status: ValidationStatus.TEAMS_NOT_IDENTIFIED, reason: "Home or away team ID or name is missing." };
    }

    // 5. Status do jogo permitido (não encerrado, não adiado, etc.)
    const disallowedStatuses = ["FT", "AET", "PEN", "CANC", "POSTP", "INT", "ABAN"]; // Full Time, After Extra Time, Penalties, Cancelled, Postponed, Interrupted, Abandoned
    if (disallowedStatuses.includes(fixture.fixture.status.short)) {
      return { status: ValidationStatus.GAME_STATUS_NOT_ALLOWED, reason: `Game status '${fixture.fixture.status.short}' is not allowed.` };
    }

    // 6. Remover registros corrompidos (já coberto pela verificação inicial de campos essenciais)

    // 7. Remover fixtures inexistentes (já coberto pelo `fixture` ser não-nulo)

    return { status: ValidationStatus.VALIDATED };
  }
}
