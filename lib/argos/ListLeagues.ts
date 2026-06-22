import axios from "axios";
import { propLineConfig } from "../core/PropLineConfigManager";

async function listLeagues() {
    const apiKey = propLineConfig.getApiKey();
    const baseUrl = propLineConfig.getBaseUrl();

    try {
        console.log("🔍 Buscando esportes/ligas ativas na PropLine...");
        const response = await axios.get(`${baseUrl}/sports`, {
            headers: propLineConfig.getHeaders()
        });

        const sports = response.data;
        console.log(`Encontrados ${sports.length} esportes/ligas ativos.`);
        
        sports.slice(0, 15).forEach((s: any) => {
            console.log(`Key: ${s.key} | Título: ${s.title} | Grupo: ${s.group}`);
        });
    } catch (error: any) {
        console.error("❌ Erro ao buscar esportes na PropLine:", error.message);
        if (error.response) {
            console.error("Detalhes:", error.response.data);
        }
    }
}

listLeagues();
