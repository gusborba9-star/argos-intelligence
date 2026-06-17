
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function findLive() {
    const apiKey = process.env.API_SPORTS_KEY;
    const baseUrl = "https://v3.football.api-sports.io";

    try {
        console.log("🔍 Buscando jogos AO VIVO (live) para encontrar IDs válidos...");
        const response = await axios.get(`${baseUrl}/fixtures?live=all`, {
            headers: { "x-apisports-key": apiKey }
        });

        const fixtures = response.data.response;
        if (!fixtures || fixtures.length === 0) {
            console.log("⚠️ Nenhum jogo ao vivo no momento.");
            
            console.log("🔍 Buscando jogos para os próximos 7 dias...");
            for (let i = 0; i < 7; i++) {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const dateStr = date.toISOString().split('T')[0];
                console.log(`Testando data: ${dateStr}`);
                const res = await axios.get(`${baseUrl}/fixtures?date=${dateStr}`, {
                    headers: { "x-apisports-key": apiKey }
                });
                if (res.data.response && res.data.response.length > 0) {
                    console.log(`✅ Encontrados ${res.data.response.length} jogos em ${dateStr}`);
                    res.data.response.slice(0, 5).forEach((f: any) => {
                        console.log(`ID: ${f.fixture.id} | ${f.league.name} | ${f.teams.home.name} x ${f.teams.away.name}`);
                    });
                    break;
                }
            }
        } else {
            console.log(`✅ Encontrados ${fixtures.length} jogos ao vivo.`);
            fixtures.slice(0, 5).forEach((f: any) => {
                console.log(`ID: ${f.fixture.id} | ${f.league.name} | ${f.teams.home.name} x ${f.teams.away.name}`);
            });
        }
    } catch (error: any) {
        console.error("Erro:", error.message);
    }
}

findLive();
