import { connection } from "next/server";
import { getHealth } from "@/server/health";

/** Liveness and readiness probe for Cloud Run and uptime checks. Always rendered per request. */
export async function GET() {
  await connection();
  const { httpStatus, payload } = getHealth(process.env);
  return Response.json(payload, { status: httpStatus, headers: { "Cache-Control": "no-store, max-age=0" } });
}
