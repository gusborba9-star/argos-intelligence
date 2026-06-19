
import { ArgosUnifiedEngine, MarketVertical } from "../core/ArgosUnifiedEngine";
import { ContextualFactorsEngine } from "../core/ContextualFactorsEngine";
import { SignalSnapshotService, SignalSnapshot } from "./SignalSnapshotService";
import { NotificationService } from "./notifications/NotificationService";
import { DataIngestionService } from "../core/DataIngestionService";
import { DailyIngestionScheduler } from "./ingestion/DailyIngestionScheduler";
import dotenv from "dotenv";

dotenv.config();

console.log(`[ProductionDeepAnalysis] UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? '******' : 'UNDEFINED'}`);
console.log(`[ProductionDeepAnalysis] UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? '******' : 'UNDEFINED'}`);
console.log(`[ProductionDeepAnalysis] NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '******' : 'UNDEFINED'}`);
console.log(`[ProductionDeepAnalysis] SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '******' : 'UNDEFINED'}`);

async function runProductionAnalysis() {
    console.log("=== ARGOS PRODUCTION ENGINE - DEEP ANALYSIS (LIVE API) ===");
    
    const ingestionService = new DataIngestionService();
    const snapshotService = new SignalSnapshotService();
    const notificationService = new NotificationService();
    
    // Jogos reais encontrados na API no momento (Live ou próximos)
    const scheduler = new DailyIngestionScheduler();
    const scheduledResult = await scheduler.scheduleDailyIngestion();

    if (scheduledResult.totalIngested === 0) {
        console.log("\n🛑 O motor está em modo de espera, aguardando alimentação da API. Nenhuma partida encontrada nas ligas principais para as próximas 48h.");
        return;
    }

    // Para este teste, vamos processar os primeiros 3 jogos que foram enfileirados pelo scheduler
    const matchesToProcess = scheduledResult.enqueuedMatchDetails.slice(0, 3); // Pegar os primeiros 3 jogos com detalhes completos
    
    if (matchesToProcess.length === 0) {
        console.log("\n🛑 O motor está em modo de espera, aguardando alimentação da API. Nenhuma partida encontrada nas ligas principais para as próximas 48h.");
        return;
    }

    console.log(`\n🚀 Processando ${matchesToProcess.length} jogos reais identificados na API:\n`);

    for (const match of matchesToProcess) {
        console.log(`--------------------------------------------------`);
        console.log(`ID API: ${match.id} | ${match.league}`);
        console.log(`JOGO: ${match.home} x ${match.away}`);
        console.log(`DATA: ${match.date}`);
        
        try {
            console.log(`[DEBUG] Iniciando ingestão para o jogo ${match.id}`);
            const ingested = await ingestionService.ingest(match.id.toString(), true); // Forçar refresh para a análise detalhada
            console.log(`[DEBUG] Ingestão concluída para o jogo ${match.id}`);
            // Os detalhes do jogo (home, away, league, date) já estão no objeto `match` via scheduler.
            
            // Fatores Contextuais Reais (Baseados nos dados da API e contexto da liga)
            const isWorldCup = match.league.includes("World Cup");
            
            const context = {
                motivationFactor: isWorldCup ? 1.3 : 1.0,
                isLifeOrDeathMatch: isWorldCup,
                keyInjuriesCount: 0, 
                injuryImpactFactor: 1.0,
                startingLineupStrength: 1.0,
                headToHeadWinRate: 0.5,
                homeAdvantageMultiplier: isWorldCup ? 1.0 : 1.1,
                weatherCondition: ingested.externalFactors.weatherCondition.toLowerCase() as any,
                weatherImpactFactor: 1.0,
                humidity: 50,
                recentFormFactor: 1.0,
                consecutiveWins: 0,
                consecutiveLosses: 0,
                pressureFactor: isWorldCup ? 1.25 : 1.0,
                crowdEffect: 1.05,
                expectedEdge: 0
            };

            const multiplier = ContextualFactorsEngine.calculateTotalContextualMultiplier(context);
            
            // Construção do MatchContextInput com todos os mercados
            // Usando dados reais da API onde disponível, e valores padrão/simulados para outros mercados
            // A API Free geralmente não fornece odds em tempo real para todos os mercados, então as odds são simuladas
            const analysisInput = {
                matchId: match.id.toString(),
                winnerMatrix: {
                    home: { label: "Home", probability: (ingested.home.goals + ingested.away.goals > 0 ? ingested.home.goals / (ingested.home.goals + ingested.away.goals) : 0.5) * multiplier, impliedOdds: 1.85 },
                    draw: { label: "Draw", probability: 0.25, impliedOdds: 3.40 },
                    away: { label: "Away", probability: (ingested.home.goals + ingested.away.goals > 0 ? ingested.away.goals / (ingested.home.goals + ingested.away.goals) : 0.5) / multiplier, impliedOdds: 4.20 }
                },
                goalsMatrix: {
                    over15: { label: "Over 1.5", probability: (ingested.home.goals + ingested.away.goals) / 3 * multiplier, impliedOdds: 1.45 },
                    over25: { label: "Over 2.5", probability: (ingested.home.goals + ingested.away.goals) / 4 * multiplier, impliedOdds: 2.10 },
                    under45: { label: "Under 4.5", probability: 1 - ((ingested.home.goals + ingested.away.goals) / 6 * multiplier), impliedOdds: 1.25 }
                },
                goalsHTMatrix: {
                    over05: { label: "HT Over 0.5", probability: (ingested.home.goalsHT + ingested.away.goalsHT) / 1.5 * multiplier, impliedOdds: 1.55 },
                    under15: { label: "HT Under 1.5", probability: 1 - ((ingested.home.goalsHT + ingested.away.goalsHT) / 2.5 * multiplier), impliedOdds: 1.40 }
                },
                cardsMatrix: {
                    over45: { label: "Over 4.5 Cards", probability: (ingested.externalFactors.refereeStrictness * 0.4) * multiplier, impliedOdds: 1.90 },
                    under45: { label: "Under 4.5 Cards", probability: 1 - ((ingested.externalFactors.refereeStrictness * 0.4) * multiplier), impliedOdds: 1.80 } // Exemplo de Under
                },
                cornersMatrix: {
                    over95: { label: "Over 9.5 Corners", probability: 0.55, impliedOdds: 1.85 },
                    under95: { label: "Under 9.5 Corners", probability: 0.45, impliedOdds: 2.00 } // Exemplo de Under
                },
                shotsMatrix: {
                    over105: { label: "Over 10.5 Shots", probability: (ingested.home.shots + ingested.away.shots) / 20 * multiplier, impliedOdds: 2.20 } // Usando dados ingeridos
                },
                shotsOnTargetMatrix: {
                    over55: { label: "Over 5.5 Shots on Target", probability: (ingested.home.shotsOnTarget + ingested.away.shotsOnTarget) / 10 * multiplier, impliedOdds: 2.00 } // Usando dados ingeridos
                },
                foulsMatrix: {
                    over205: { label: "Over 20.5 Fouls", probability: 0.60 * multiplier, impliedOdds: 1.80 } // Simulado
                },
                bttsMatrix: {
                    yes: { label: "BTTS Yes", probability: 0.50 * multiplier, impliedOdds: 1.90 }, // Simulado
                    no: { label: "BTTS No", probability: 0.50 * multiplier, impliedOdds: 1.80 } // Simulado
                },
                tacklesMatrix: {
                    over305: { label: "Over 30.5 Tackles", probability: 0.55 * multiplier, impliedOdds: 1.95 } // Simulado
                },
                handicapMatrix: {
                    homeMinus1: { label: "Home -1 Handicap", probability: 0.35 * multiplier, impliedOdds: 2.50 } // Simulado
                }
            };

            console.log(`[DEBUG] Iniciando análise do ArgosUnifiedEngine para o jogo ${match.id}`);
            const result = ArgosUnifiedEngine.analyze(analysisInput);
            console.log(`[DEBUG] Análise do ArgosUnifiedEngine concluída para o jogo ${match.id}`);
            
            console.log(`Status: PROCESSADO (Fonte: API Football)`);
            console.log(`Sinais Encontrados: ${result.signals_found}`);
            
            const currentSnapshot: SignalSnapshot = {
                matchId: match.id.toString(),
                timestamp: Date.now(),
                signals: result.approved_markets as any // Cast para compatibilidade
            };

            const shouldReprocess = await snapshotService.shouldReprocess(match.id.toString(), currentSnapshot.signals);

            if (shouldReprocess) {
                try {
                    await snapshotService.saveSnapshot(currentSnapshot);
                } catch (snapshotError: any) {
                    console.error(`[ProductionDeepAnalysis] Erro ao salvar SignalSnapshot para ${match.id}:`, snapshotError);
                }
                console.log("SignalSnapshot Salvo/Atualizado no Cache.");

                // Gerar SignalSnapshot completo
                console.log("SignalSnapshot Completo:", JSON.stringify(currentSnapshot.signals.map(s => ({
                    market: s.market,
                    vertical: s.vertical,
                    ev: s.ev,
                    probability: s.adjustedProbability,
                    tier: (s.ev > 0.08 && s.adjustedProbability > 0.6) ? "VIP" : "FREE"
                })), null, 2));

                // Exibir e Notificar sinais VIP e FREE diferenciados (Nexus Intelligence System - NIS)
                console.log("\n--- Sinais VIP (Nexus VIP Channel) ---");
                const vipSignals = currentSnapshot.signals.filter((s: any) => s.ev > 0.08 && s.adjustedProbability > 0.6);
                if (vipSignals.length > 0) {
                    for (const sig of vipSignals) {
                        console.log(`- ${sig.market} | EV: ${(sig.ev * 100).toFixed(2)}% | Prob: ${(sig.adjustedProbability * 100).toFixed(2)}%`);
                        await notificationService.sendToTelegram(sig as any, "WHALE/VIP");
                    }
                } else {
                    console.log("Sem Oportunidade VIP");
                }

                console.log("\n--- Sinais FREE (Argos Free Channel) ---");
                // No Free, focamos em assertividade (WINNER, GOALS Over 1.5/Under 4.5, GOALS_HT)
                const freeSignals = currentSnapshot.signals.filter((s: any) => {
                    const isAllowedVertical = ['WINNER', 'GOALS', 'GOALS_HT'].includes(s.vertical);
                    if (!isAllowedVertical) return false;
                    if (s.vertical === 'GOALS') {
                        return s.market.includes('Over 1.5') || s.market.includes('Under 4.5');
                    }
                    return true;
                });

                if (freeSignals.length > 0) {
                    for (const sig of freeSignals) {
                        console.log(`- ${sig.market} | Prob: ${(sig.adjustedProbability * 100).toFixed(2)}%`);
                        await notificationService.sendToTelegram(sig as any, "FREE");
                    }
                } else {
                    console.log("Sem Sinais FREE");
                }
            } else {
                console.log("SignalSnapshot inalterado. Não há necessidade de reprocessar ou notificar.");
            }

        } catch (error: any) {
            console.error(`⚠️ Falha no processamento para ${match.id}:`, error);
            console.log(`STATUS: Sem dados disponíveis para o jogo ${match.home} x ${match.away} ou erro na API.`);
        }
    }
}

runProductionAnalysis();
