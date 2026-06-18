import { performance } from "node:perf_hooks";
import { apiError, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({
      status: "ok",
      database: "connected",
      latencyMs: Math.round(performance.now() - startedAt),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const response = apiError(error);
    return json(
      {
        status: "error",
        database: "unavailable",
        latencyMs: Math.round(performance.now() - startedAt),
        timestamp: new Date().toISOString()
      },
      { status: response.status }
    );
  }
}
