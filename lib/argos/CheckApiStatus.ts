
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function checkStatus() {
    const apiKey = process.env.API_SPORTS_KEY;
    const baseUrl = "https://v3.football.api-sports.io";

    try {
        console.log("🔍 Verificando status da chave API...");
        const response = await axios.get(`${baseUrl}/status`, {
            headers: { "x-apisports-key": apiKey }
        });

        console.log("Status da API:", JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        console.error("Erro ao verificar status:", error.message);
    }
}

checkStatus();
