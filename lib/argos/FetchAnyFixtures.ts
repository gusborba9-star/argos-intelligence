import axios from "axios";
import { propLineConfig } from "../core/PropLineConfigManager";

async function fetchFixtures() {
    const apiKey = propLineConfig.getApiKey();
    const baseUrl = propLineConfig.getBaseUrl();
    const date = new Date().toISOString().split('T')[0];

    try {
        console.log(`🔍 Buscando QUALQUER jogo para a data: ${date} na PropLine...`);
        // Na PropLine, buscamos por esporte. Vamos usar soccer_epl como exemplo ou listar esportes primeiro
        const sportKey = "soccer_epl"; // Exemplo, em produção isso seria dinâmico
        const response = await axios.get(`${baseUrl}/sports/${sportKey}/events`, {
            headers: propLineConfig.getHeaders()
        });

        const fixtures = response.data;
        if (!fixtures || fixtures.length === 0) {
            console.log(`⚠️ Nenhum jogo encontrado para ${sportKey}.`);
            return;
        }

        const filteredFixtures = fixtures.filter((f: any) => f.commence_time && f.commence_time.startsWith(date));

        console.log(`✅ Encontrados ${filteredFixtures.length} jogos para hoje em ${sportKey}.`);
        console.log("\nExemplos de jogos encontrados:");
        filteredFixtures.slice(0, 10).forEach((f: any) => {
            console.log(`ID: ${f.id} | ${f.sport_title} | ${f.home_team} x ${f.away_team} | Início: ${f.commence_time}`);
        });
    } catch (error: any) {
        console.error("❌ Erro ao buscar jogos na PropLine:", error.message);
        if (error.response) {
            console.error("Detalhes:", error.response.data);
        }
    }
}

fetchFixtures();
