import { ArgosUnifiedEngine, MarketVertical } from "../core/ArgosUnifiedEngine";
import { ContextualFactorsEngine } from "../core/ContextualFactorsEngine";
import { SignalSnapshotService, SignalSnapshot } from "./SignalSnapshotService";
import { NotificationService } from "./notifications/NotificationService";
import { DataIngestionService } from "../core/DataIngestionService";
import { FeatureEngine } from "../core/FeatureEngine";
import { DailyIngestionScheduler } from "./ingestion/DailyIngestionScheduler";
import dotenv from "dotenv";

dotenv.config();

async function runProductionAnalysis() {
    console.log("=== ARGOS PRODUCTION ENGINE - DEEP ANALYSIS (v5.3) ===");
    
    const ingestionService = new DataIngestionService();
    const snapshotService = new SignalSnapshotService();
    const notificationService = new NotificationService();
    
    const scheduler = new DailyIngestionScheduler();
    const scheduledResult = await scheduler.scheduleDailyIngestion();

    if (scheduledResult.totalProcessed === 0) {
        console.log("\n🛑 O motor está em modo de espera, aguardando alimentação da API.");
        return;
    }

    console.log(`\n🚀 Ciclo de Ingestão concluído. Status: ${scheduledResult.status}`);
}

runProductionAnalysis();
