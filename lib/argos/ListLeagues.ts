
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function listLeagues() {
    const apiKey = process.env.API_SPORTS_KEY;
    const baseUrl = "https://v3.football.api-sports.io";

    try {
        console.log("🔍 Buscando ligas ativas na API Football...");
        const response = await axios.get(`${baseUrl}/leagues?current=true`, {
            headers: { "x-apisports-key": apiKey }
        });

        const leagues = response.data.response;
        console.log(`Encontradas ${leagues.length} ligas ativas.`);
        
        // Filtrar algumas ligas importantes para ver se estão ativas
        const priorityNames = ["Serie A", "Serie B", "World Cup", "Euro", "Copa America"];
        leagues.forEach((l: any) => {
            if (priorityNames.some(name => l.league.name.includes(name))) {
                console.log(`ID: ${l.league.id} | Nome: ${l.league.name} | País: ${l.country.name}`);
            }
        });
    } catch (error: any) {
        console.error("Erro ao buscar ligas:", error.message);
    }
}

listLeagues();
