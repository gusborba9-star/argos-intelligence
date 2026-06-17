import { getRedisCacheInstance } from "../core/RedisCache";

async function clearSnapshots() {
    const redisCache = getRedisCacheInstance();
    const matchIds = ["1524942", "1524946", "1532210"];

    console.log("Limpando SignalSnapshots do Redis...");
    for (const matchId of matchIds) {
        const key = `snapshot:${matchId}`;
        await redisCache.delete(key);
        console.log(`Snapshot ${key} limpo.`);
    }
    console.log("Limpeza de SignalSnapshots concluída.");
}

clearSnapshots();
