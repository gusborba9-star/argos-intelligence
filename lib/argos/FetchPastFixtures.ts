
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function fetchPastFixtures() {
    const apiKey = process.env.API_SPORTS_KEY;
    const baseUrl = "https://v3.football.api-sports.io";
    
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    try {
        console.log(`🔍 Buscando jogos de ontem (${yesterday}) para validar API...`);
        const response = await axios.get(`${baseUrl}/fixtures?date=${yesterday}`, {
            headers: { "x-apisports-key": apiKey }
        });

        const fixtures = response.data.response;
        if (!fixtures || fixtures.length === 0) {
            console.log("⚠️ Nenhum jogo encontrado para ontem.");
            return;
        }

        console.log(`✅ Encontrados ${fixtures.length} jogos para ontem.`);
        fixtures.slice(0, 5).forEach((f: any) => {
            console.log(`ID: ${f.fixture.id} | ${f.league.name} | ${f.teams.home.name} x ${f.teams.away.name}`);
        });
    } catch (error: any) {
        console.error("Erro ao buscar jogos de ontem:", error.message);
    }
}

fetchPastFixtures();
