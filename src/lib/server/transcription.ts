import { db, transaction } from "./database";

export async function transcribe(req: Request, userId: string) {
  if (req.method !== "POST")
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  const key = process.env.SARVAM_API_KEY;
  if (!key)
    return Response.json(
      { error: "Dictation is not configured." },
      { status: 503 },
    );
  const accepted = await transaction(async () => {
    await db.exec(
      "CREATE TABLE IF NOT EXISTS speech_limits(id TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL)",
    );
    const id = `dictation:${userId}`;
    const now = Date.now();
    await db.prepare("DELETE FROM speech_limits WHERE until < ?").run(now);
    const limit = await db
      .prepare("SELECT count FROM speech_limits WHERE id=?")
      .get(id);
    if (Number(limit?.count || 0) >= 10) return false;
    await db
      .prepare(
        "INSERT INTO speech_limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=speech_limits.count+1",
      )
      .run(id, now + 60000);
    return true;
  });
  if (!accepted)
    return Response.json(
      { error: "Please wait a minute before dictating again." },
      { status: 429 },
    );
  // Stay below Vercel's request limit, including multipart overhead.
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 4 * 1024 * 1024) {
          await reader.cancel();
          return Response.json(
            { error: "Recording is too large. Dictate a shorter passage." },
            { status: 413 },
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  let input: FormData;
  try {
    input = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": req.headers.get("content-type") || "" },
    }).formData();
  } catch {
    return Response.json(
      { error: "Upload an audio recording." },
      { status: 400 },
    );
  }
  const file = input.get("file");
  const language = input.get("language");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    !["en", "hi"].includes(String(language)) ||
    !/^audio\/(webm|ogg|wav|x-wav|mp4)(;|$)/.test(file.type)
  )
    return Response.json(
      { error: "Use a supported audio recording and select English or Hindi." },
      { status: 400 },
    );
  const form = new FormData();
  form.set("file", file);
  form.set("model", "saaras:v3");
  form.set("mode", "transcribe");
  form.set("language_code", language === "hi" ? "hi-IN" : "en-IN");
  try {
    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": key },
      body: form,
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(45000)]),
    });
    if (!response.ok)
      return Response.json(
        {
          error:
            "Dictation service is unavailable. Please try again or type your answer.",
        },
        { status: 502 },
      );
    const result = await response.json();
    if (typeof result.transcript !== "string")
      throw new Error("Invalid transcript");
    return Response.json(
      { text: result.transcript },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Dictation could not finish. Please try again." },
      { status: 502 },
    );
  }
}
