import axios from "axios";
import { propLineConfig } from "../core/PropLineConfigManager";

async function findLive() {
    const apiKey = propLineConfig.getApiKey();
    const baseUrl = propLineConfig.getBaseUrl();

    try {
        console.log("🔍 Buscando jogos AO VIVO (live) na PropLine...");
        // Na PropLine v1, jogos ao vivo podem ser filtrados via status ou endpoint específico
        const sportKey = "soccer_epl";
        const response = await axios.get(`${baseUrl}/sports/${sportKey}/events`, {
            headers: propLineConfig.getHeaders()
        });

        const fixtures = response.data;
        if (!fixtures || fixtures.length === 0) {
            console.log(`⚠️ Nenhum jogo encontrado para ${sportKey}.`);
            return;
        }

        // Simulação de filtro live (PropLine v1 retorna todos os eventos, filtramos pelo tempo ou status se disponível)
        const now = new Date();
        const liveFixtures = fixtures.filter((f: any) => {
            const commence = new Date(f.commence_time);
            // Jogo começou há menos de 2 horas e não terminou (simplificação)
            return commence <= now && (now.getTime() - commence.getTime()) < 120 * 60 * 1000;
        });

        if (liveFixtures.length === 0) {
            console.log("⚠️ Nenhum jogo ao vivo detectado no momento.");
            console.log("Exibindo próximos jogos:");
            fixtures.slice(0, 5).forEach((f: any) => {
                console.log(`ID: ${f.id} | ${f.home_team} x ${f.away_team} | Início: ${f.commence_time}`);
            });
        } else {
            console.log(`✅ Encontrados ${liveFixtures.length} jogos ao vivo.`);
            liveFixtures.slice(0, 5).forEach((f: any) => {
                console.log(`ID: ${f.id} | ${f.home_team} x ${f.away_team} | Início: ${f.commence_time}`);
            });
        }
    } catch (error: any) {
        console.error("❌ Erro na PropLine:", error.message);
        if (error.response) {
            console.error("Detalhes:", error.response.data);
        }
    }
}

findLive();
