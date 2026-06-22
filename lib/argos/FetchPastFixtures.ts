import axios from "axios";
import { propLineConfig } from "../core/PropLineConfigManager";

async function fetchPastFixtures() {
    const apiKey = propLineConfig.getApiKey();
    const baseUrl = propLineConfig.getBaseUrl();
    
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    try {
        console.log(`🔍 Buscando jogos de ontem (${yesterday}) na PropLine para validar API...`);
        // Na PropLine v1, o histórico pode ser acessado via /events/{id}/history ou filtrando eventos passados
        // Para simplificar o teste, vamos listar eventos de um esporte e filtrar por data
        const sportKey = "soccer_epl";
        const response = await axios.get(`${baseUrl}/sports/${sportKey}/events`, {
            headers: propLineConfig.getHeaders()
        });

        const fixtures = response.data;
        if (!fixtures || fixtures.length === 0) {
            console.log(`⚠️ Nenhum jogo encontrado para ${sportKey}.`);
            return;
        }

        const filteredFixtures = fixtures.filter((f: any) => f.commence_time && f.commence_time.startsWith(yesterday));

        console.log(`✅ Encontrados ${filteredFixtures.length} jogos para ontem em ${sportKey}.`);
        filteredFixtures.slice(0, 5).forEach((f: any) => {
            console.log(`ID: ${f.id} | ${f.sport_title} | ${f.home_team} x ${f.away_team} | Início: ${f.commence_time}`);
        });
    } catch (error: any) {
        console.error("❌ Erro ao buscar jogos de ontem na PropLine:", error.message);
        if (error.response) {
            console.error("Detalhes:", error.response.data);
        }
    }
}

fetchPastFixtures();
