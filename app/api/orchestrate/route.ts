import { NextResponse } from "next/server";
import { ArgosUnifiedEngine } from "@/lib/ArgosUnifiedEngine";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(req: Request) {
  const body = await req.json();
  const result = ArgosUnifiedEngine.analyze(body);

  return NextResponse.json(result);
}
