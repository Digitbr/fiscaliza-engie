import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const TOKEN_VERSION = 1;

type TokenPurpose = "access" | "refresh";

type TokenPayload = {
  version: number;
  purpose: TokenPurpose;
  sub: string;
  email: string;
  exp: number;
};

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function authSecret() {
  return process.env.AUTH_SECRET
    ?? process.env.NEXTAUTH_SECRET
    ?? process.env.JWT_SECRET
    ?? "fiscaliza-engie-local-dev-secret-change-me";
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [algorithm, salt, hash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function signPayload(payload: TokenPayload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", authSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function createAuthTokens(user: { id: string; email: string }) {
  const now = Math.floor(Date.now() / 1000);
  return {
    accessToken: signPayload({
      version: TOKEN_VERSION,
      purpose: "access",
      sub: user.id,
      email: user.email,
      exp: now + 60 * 60 * 8
    }),
    refreshToken: signPayload({
      version: TOKEN_VERSION,
      purpose: "refresh",
      sub: user.id,
      email: user.email,
      exp: now + 60 * 60 * 24 * 30
    }),
    expiresAt: now + 60 * 60 * 8
  };
}

export function verifyAuthToken(token: string, purpose: TokenPurpose) {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", authSecret()).update(body).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(body)) as TokenPayload;
  if (payload.version !== TOKEN_VERSION || payload.purpose !== purpose || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}
