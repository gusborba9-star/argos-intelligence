import { FixtureResponse } from "@/lib/core/DataIngestionService";

// ============================================================
// ARGOS VALIDATION v6.0.0 — SYNDICATE MASTER EDITION
// Regras de Ouro:
// 1. Somente Futebol
// 2. Somente Futuros (NS)
// 3. Janela máxima: 96 horas
// 4. Jogos relevantes (remove lixo, mantém liquidez)
// ============================================================

export enum ValidationStatus {
  VALIDATED = "VALIDATED",
  REJECTED = "REJECTED",
  FIXTURE_NOT_FOUND = "FIXTURE_NOT_FOUND",
  GAME_ENDED = "GAME_ENDED",
  GAME_IN_PROGRESS = "GAME_IN_PROGRESS",
  GAME_TOO_FAR = "GAME_TOO_FAR",
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
  IRRELEVANT_LEAGUE = "IRRELEVANT_LEAGUE",
  INVALID_DATE = "INVALID_DATE",
  GAME_STATUS_NOT_ALLOWED = "GAME_STATUS_NOT_ALLOWED",
  CORRUPTED_RECORD = "CORRUPTED_RECORD",
}

export interface ValidationResult {
  status: ValidationStatus;
  reason?: string;
}

export class FixtureValidator {
  // Syndicate Master: Janela de 96 horas (4 dias)
  private static OPERATIONAL_WINDOW_MAX_MINUTES = 5760; 

  public static validate(fixture: FixtureResponse | null, today: Date = new Date()): ValidationResult {
    if (!fixture) {
      return { status: ValidationStatus.FIXTURE_NOT_FOUND, reason: "Fixture is null." };
    }

    if (!fixture.fixture || !fixture.teams || !fixture.league) {
      return { status: ValidationStatus.CORRUPTED_RECORD, reason: "Essential data missing." };
    }

    // 1. REGRA MASTER: Somente Futuros (NS - Not Started)
    // O Argos v6.0.0 Syndicate Master foca em análise pré-live exaustiva.
    const status = fixture.fixture.status.short;
    if (status !== "NS") {
      return { 
        status: status === "FT" || status === "AET" || status === "PEN" ? ValidationStatus.GAME_ENDED : ValidationStatus.GAME_IN_PROGRESS, 
        reason: `Game status is '${status}'. Only 'NS' (Not Started) is allowed for Syndicate Master Audit.` 
      };
    }

    const fixtureDate = new Date(fixture.fixture.date);
    if (isNaN(fixtureDate.getTime())) {
      return { status: ValidationStatus.INVALID_DATE, reason: `Invalid date: ${fixture.fixture.date}` };
    }

    const timeToKickoffMinutes = (fixtureDate.getTime() - today.getTime()) / (1000 * 60);
    
    // 2. REGRA MASTER: Janela de 96 horas
    if (timeToKickoffMinutes < 0) {
      return { status: ValidationStatus.GAME_IN_PROGRESS, reason: `Game already started.` };
    }
    
    if (timeToKickoffMinutes > this.OPERATIONAL_WINDOW_MAX_MINUTES) {
      return { status: ValidationStatus.GAME_TOO_FAR, reason: `Game outside 96h window.` };
    }

    // 3. REGRA MASTER: Somente Futebol
    // (Assumindo que o DataIngestionService já filtra por soccer, mas validamos aqui por segurança)
    const leagueName = fixture.league.name.toLowerCase();
    const isSoccer = !leagueName.includes("basketball") && !leagueName.includes("nba") && !leagueName.includes("tennis");
    if (!isSoccer) {
      return { status: ValidationStatus.IRRELEVANT_LEAGUE, reason: "Non-soccer sport detected." };
    }

    // 4. Filtro de Relevância / Liquidez
    // Removemos competições de base (U19, U20, Youth) e amistosos irrelevantes.
    const isObscure = (
      leagueName.includes("u19") || leagueName.includes("u20") || leagueName.includes("youth") || 
      leagueName.includes("reserve") || leagueName.includes("friendly")
    );

    // Ligas de Elite (IDs conhecidos do API-Football que possuem alta liquidez)
    const eliteLeagues = [1, 2, 3, 11, 13, 15, 61, 71, 72, 73, 78, 94, 140];
    const isElite = eliteLeagues.includes(fixture.league.id);

    // Se for obscuro e não for elite (ex: amigável internacional de seleções), rejeitamos.
    if (isObscure && !isElite) {
      return { status: ValidationStatus.IRRELEVANT_LEAGUE, reason: `League '${fixture.league.name}' lacks sufficient liquidity/relevance.` };
    }

    return { status: ValidationStatus.VALIDATED };
  }
}
