import { NextResponse } from "next/server";
import { PropLineIngestionWorker } from "@/lib/workers/PropLineIngestionWorker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headersObj = Object.fromEntries(request.headers.entries());

  console.log("RAW HEADERS RECEBIDOS:", headersObj);

  const auth = request.headers.get("x-argos-key");

  return NextResponse.json({
    debug: true,
    received_headers: headersObj,
    auth_header: auth,
    env_key_exists: !!process.env.ARGOS_API_KEY,
  });
}
