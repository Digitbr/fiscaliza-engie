import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(toJsonSafe(data), init);
}

export function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") {
    if ("toJSON" in value && typeof value.toJSON === "function") {
      return toJsonSafe(value.toJSON());
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)])
    );
  }
  return value;
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return json(
      { error: "Dados inválidos.", issues: error.issues },
      { status: 400 }
    );
  }
  if (error instanceof UnauthorizedError) {
    return json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return json({ error: error.message }, { status: 403 });
  }

  console.error(error);
  return json({ error: "Erro interno do servidor." }, { status: 500 });
}
