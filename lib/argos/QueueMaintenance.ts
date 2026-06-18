import { getSupabaseClient } from "../core/SupabaseClient";

async function runMaintenance() {
  const supabase = getSupabaseClient();
  console.log("[QueueMaintenance] Iniciando verificação da fila...");

  const { data: queuedItems, error } = await supabase
    .from("argos_batch_queue")
    .select("id, match_id, status")
    .eq("match_id", "1524942");

  if (error) {
    console.error("[QueueMaintenance] Erro ao buscar fila:", error.message);
    return;
  }

  console.log(`[QueueMaintenance] Encontrados ${queuedItems?.length || 0} itens na fila.`);
  
  for (const item of queuedItems || []) {
    console.log(`- Item ID: ${item.id}, Match ID: ${item.match_id}, Status: ${item.status}`);
    if (item.match_id === "1524942") {
      console.log(`[QueueMaintenance] Removendo ID problemático: ${item.match_id}`);
      await supabase.from("argos_batch_queue").delete().eq("id", item.id);
    }
  }
}

runMaintenance();
