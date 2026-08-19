import { getRedisCacheInstance } from "../../lib/core/RedisCache";
import { ArgosSignal } from "../../lib/core/contracts/SignalContract";

/**
 * Snapshot contract at the canonical execution boundary.
 *
 * The quantitative legacy engine used to own a separate `Signal` type.
 * Snapshots are infrastructure state, so they must consume the canonical
 * ArgosSignal contract instead of recreating or reviving that engine.
 */
export type SnapshotSignal = ArgosSignal;

export interface SignalSnapshot {
    matchId: string;
    timestamp: number;
    signals: SnapshotSignal[];
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

    async shouldReprocess(matchId: string, newSignals: SnapshotSignal[]): Promise<boolean> {
        const oldSnapshot = await this.getSnapshot(matchId);
        if (!oldSnapshot) {
            return true;
        }

        for (const newSig of newSignals) {
            const oldSig = oldSnapshot.signals.find(
                (s) => s.vertical === newSig.vertical && s.market === newSig.market
            );
            if (!oldSig) {
                return true;
            }

            // The canonical contract exposes EV as expectedValue and keeps
            // `ev` as a compatibility alias. Compare the canonical value
            // first, falling back only for legacy persisted snapshots.
            const newEv = newSig.ev ?? newSig.expectedValue;
            const oldEv = oldSig.ev ?? oldSig.expectedValue;
            const newProbability = newSig.adjustedProbability ?? newSig.probability;
            const oldProbability = oldSig.adjustedProbability ?? oldSig.probability;

            if (
                Math.abs(newEv - oldEv) > this.DEVIATION_THRESHOLD ||
                Math.abs(newProbability - oldProbability) > this.DEVIATION_THRESHOLD
            ) {
                return true;
            }
        }

        if (newSignals.length !== oldSnapshot.signals.length) {
            return true;
        }

        return false;
    }
}
