
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function fetchFixtures() {
    const apiKey = process.env.API_SPORTS_KEY;
    const baseUrl = "https://v3.football.api-sports.io";
    const date = new Date().toISOString().split('T')[0];

    try {
        console.log(`🔍 Buscando QUALQUER jogo para a data: ${date}...`);
        const response = await axios.get(`${baseUrl}/fixtures?date=${date}`, {
            headers: { "x-apisports-key": apiKey }
        });

        const fixtures = response.data.response;
        if (!fixtures || fixtures.length === 0) {
            console.log("⚠️ Nenhum jogo encontrado para hoje.");
            return;
        }

        console.log(`✅ Encontrados ${fixtures.length} jogos no total.`);
        console.log("\nExemplos de jogos encontrados:");
        fixtures.slice(0, 10).forEach((f: any) => {
            console.log(`ID: ${f.fixture.id} | ${f.league.name} (${f.league.country}) | ${f.teams.home.name} x ${f.teams.away.name}`);
        });
    } catch (error: any) {
        console.error("Erro ao buscar jogos:", error.message);
    }
}

fetchFixtures();
