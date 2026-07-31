import { NextResponse } from "next/server";
import { DataIngestionService } from "@/lib/core/DataIngestionService";

export async function GET(req: Request) {
  const key = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key");
  if (key !== process.env.ARGOS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const service = new DataIngestionService();
  const sports = await service.getActiveSports();
  const soccer = sports.filter((s: any) =>
    (s.group || "").toLowerCase().includes("soccer") ||
    (s.key || "").toLowerCase().includes("soccer")
  );
  return NextResponse.json({ count: soccer.length, sports: soccer.map((s: any) => ({ key: s.key, title: s.title, group: s.group })) });
}
