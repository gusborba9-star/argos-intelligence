import axios from "axios";
import { propLineConfig } from "../core/PropLineConfigManager";

async function checkStatus() {
    const apiKey = propLineConfig.getApiKey();
    const baseUrl = propLineConfig.getBaseUrl();

    try {
        console.log("🔍 Verificando status da chave API PropLine...");
        // PropLine v1 não tem endpoint /status direto, vamos testar listando esportes ou similar
        const response = await axios.get(`${baseUrl}/sports`, {
            headers: propLineConfig.getHeaders()
        });

        if (response.status === 200) {
            console.log("✅ API PropLine ONLINE e Chave Válida.");
            console.log("Esportes disponíveis:", response.data.length);
        } else {
            console.log("⚠️ Resposta inesperada da API:", response.status);
        }
    } catch (error: any) {
        console.error("❌ Erro ao verificar status da PropLine:", error.message);
        if (error.response) {
            console.error("Detalhes:", error.response.data);
        }
    }
}

checkStatus();
