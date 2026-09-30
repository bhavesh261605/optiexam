import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import * as store from "./store";

function sign(payload: object, secret: string) {
  const data = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}

function verify(token: string, secret: string, subject: string) {
  const [header, payload, signature, extra] = token.split(".");
  if (!header || !payload || !signature || extra)
    throw new Error("Invalid voice token");
  const expected = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("Invalid voice token");
  const h = JSON.parse(Buffer.from(header, "base64url").toString());
  const p = JSON.parse(Buffer.from(payload, "base64url").toString());
  const now = Date.now() / 1000;
  if (
    h.alg !== "HS256" ||
    p.sub !== subject ||
    p.iss !== "optiexam-audio" ||
    p.aud !== "optiexam-web" ||
    typeof p.exp !== "number" ||
    p.exp <= now ||
    p.exp > now + 90 ||
    typeof p.iat !== "number" ||
    p.iat > now + 5 ||
    typeof p.jti !== "string" ||
    !Array.isArray(p.amr) ||
    !p.amr.includes("voice")
  )
    throw new Error("Invalid voice token claims");
  return p as { sub: string; jti: string; exp: number };
}

export async function voiceRequest(req: NextRequest, action: string) {
  const secret = process.env.VOICE_JWT_SECRET;
  const base = process.env.VOICE_SERVICE_URL || "http://127.0.0.1:8001";
  if (!secret || secret.length < 32)
    throw new store.ApiError(
      "Voice service is not configured. Use password sign-in; see the audio setup guide.",
      503,
    );
  const service = new URL(base);
  if (
    service.protocol !== "https:" &&
    !["127.0.0.1", "localhost", "[::1]"].includes(service.hostname)
  )
    throw new store.ApiError(
      "Voice service requires HTTPS outside loopback.",
      503,
    );
  if (!["challenge", "enroll", "login", "transcribe"].includes(action))
    throw new store.ApiError("Endpoint not found.", 404);
  if (
    req.method !== "POST" &&
    !(action === "enroll" && req.method === "DELETE")
  )
    throw new store.ApiError("Method not allowed.", 405);
  // Read with a hard bound before parsing multipart to avoid unbounded buffering.
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > (action === "challenge" ? 4096 : 25 * 1024 * 1024)) {
          await reader.cancel();
          throw new store.ApiError(
            "Voice request exceeds the allowed size.",
            413,
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const contentType = req.headers.get("content-type") || "";
  const raw = Buffer.concat(chunks);
  let body: {
    purpose?: string;
    identifier?: string;
    language?: string;
  } | null = null;
  let form: FormData | null = null;
  try {
    if (action === "challenge") body = JSON.parse(raw.toString());
    else if (req.method !== "DELETE")
      form = await new Response(raw, {
        headers: { "Content-Type": contentType },
      }).formData();
  } catch {
    throw new store.ApiError(
      "Malformed voice request. Use JSON for challenges or multipart audio for recordings.",
      400,
    );
  }
  const scope = action === "challenge" ? body?.purpose : action;
  if (!scope || !["enroll", "login", "transcribe"].includes(scope))
    throw new store.ApiError("Invalid voice action.");
  const user = store.session(req.cookies.get("aura_session")?.value);
  let subject: string;
  if (scope === "login") {
    const identifier = String(body?.identifier || form?.get("identifier") || "")
      .trim()
      .toLowerCase();
    if (!identifier || identifier.length > 254)
      throw new store.ApiError("Enter your account email or voice account ID.");
    subject =
      store.voiceIdentity(identifier) ||
      `unknown:${createHash("sha256").update(identifier).digest("hex")}`;
  } else {
    if (!user || user.role !== "candidate")
      throw new store.ApiError(
        "Sign in as a candidate to use this voice feature.",
        401,
      );
    if (scope === "enroll" && !user.email)
      throw new store.ApiError(
        "Create a personal account before enrolling a voice. Shared demo accounts cannot store biometric profiles.",
        403,
      );
    subject = user.id;
  }
  const now = Math.floor(Date.now() / 1000);
  const bridge = sign(
    {
      sub: subject,
      scope,
      iss: "optiexam-web",
      aud: "optiexam-audio",
      iat: now,
      exp: now + 180,
    },
    secret,
  );
  const endpoint =
    action === "transcribe" ? "/api/transcribe" : `/api/auth/${action}`;
  try {
    const response = await fetch(new URL(endpoint, service), {
      method: req.method,
      headers: {
        Authorization: `Bearer ${bridge}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body:
        req.method === "DELETE"
          ? undefined
          : body
            ? JSON.stringify({
                purpose: scope,
                language: body.language || "en",
              })
            : form,
      signal: AbortSignal.timeout(150000),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok)
      throw new store.ApiError(
        typeof data.detail === "string"
          ? data.detail
          : "Audio request was rejected. Check the recording and retry.",
        response.status,
      );
    if (action === "login") {
      const claims = verify(data.access_token, secret, subject);
      const session = store.voiceLogin(claims.sub, claims.jti, claims.exp);
      const result = NextResponse.json(
        { user: session.user },
        { headers: { "Cache-Control": "no-store" } },
      );
      result.cookies.set("aura_session", session.token, {
        httpOnly: true,
        sameSite: "strict",
        secure: req.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 86400,
      });
      return result;
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof store.ApiError) throw error;
    throw new store.ApiError(
      "The voice service is unavailable or timed out. Retry or use password sign-in. Your answer has not been changed.",
      503,
    );
  }
}
