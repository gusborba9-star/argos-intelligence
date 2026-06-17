
import { getRedisCacheInstance } from "../../lib/core/RedisCache";
import { Signal } from "../../lib/core/ArgosUnifiedEngine";

export interface SignalSnapshot {
    matchId: string;
    timestamp: number;
    signals: Signal[];
}

export class SignalSnapshotService {
    private readonly SNAPSHOT_CACHE_TTL = 3600; // 1 hora
    private readonly DEVIATION_THRESHOLD = 0.03; // 3% de desvio

    constructor() {}

    private getSnapshotKey(matchId: string): string {
        return `snapshot:${matchId}`;
    }

    async getSnapshot(matchId: string): Promise<SignalSnapshot | null> {
        return getRedisCacheInstance().get<SignalSnapshot>(this.getSnapshotKey(matchId));
    }

    async saveSnapshot(snapshot: SignalSnapshot): Promise<void> {
        await getRedisCacheInstance().set(this.getSnapshotKey(snapshot.matchId), snapshot, this.SNAPSHOT_CACHE_TTL);
    }

    async shouldReprocess(matchId: string, newSignals: Signal[]): Promise<boolean> {
        const oldSnapshot = await this.getSnapshot(matchId);
        if (!oldSnapshot) {
            return true; // Reprocessar se não houver snapshot anterior
        }

        // Comparar sinais para desvio > 3%
        for (const newSig of newSignals) {
            const oldSig = oldSnapshot.signals.find(s => s.vertical === newSig.vertical && s.market === newSig.market);
            if (!oldSig) {
                return true; // Novo sinal encontrado
            }
            // Comparar EV e AdjustedProbability
            if (Math.abs(newSig.ev - oldSig.ev) > this.DEVIATION_THRESHOLD ||
                Math.abs(newSig.adjustedProbability - oldSig.adjustedProbability) > this.DEVIATION_THRESHOLD) {
                return true; // Desvio significativo, reprocessar
            }
        }
        // Se o número de sinais mudou, reprocessar
        if (newSignals.length !== oldSnapshot.signals.length) {
            return true;
        }

        return false; // Não há necessidade de reprocessar
    }
}
