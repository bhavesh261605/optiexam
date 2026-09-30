import { z } from "zod";
const schema = z.object({ text: z.string().trim().min(1).max(500), language: z.enum(["hi", "en"]) });
const requests = new Map<string, { count: number; until: number }>();
export async function sarvamSpeech(req: Request, userId: string) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) return Response.json({ error: "Speech service is not configured." }, { status: 503 });
  const body = schema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Enter 1–500 characters and select Hindi or English." }, { status: 400 });
  const now = Date.now();
  for (const [id, item] of requests) if (item.until < now) requests.delete(id);
  const limit = requests.get(userId) || { count: 0, until: now + 60000 };
  if (limit.count >= 30) return Response.json({ error: "Please wait a minute before requesting more speech." }, { status: 429 });
  limit.count++; requests.set(userId, limit);
  try {
    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST", headers: { "Content-Type": "application/json", "api-subscription-key": key },
      body: JSON.stringify({ inputs: [body.data.text], target_language_code: body.data.language === "hi" ? "hi-IN" : "en-IN", speaker: "ritu", model: "bulbul:v3" }),
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(45000)]), cache: "no-store",
    });
    if (!response.ok) return Response.json({ error: `Speech service rejected the request (${response.status}). Check the server key and Sarvam account access.` }, { status: 502 });
    const data = await response.json();
    if (!Array.isArray(data.audios) || !data.audios.length || data.audios.some((audio: unknown) => typeof audio !== "string" || !audio || !/^[A-Za-z0-9+/=\r\n]+$/.test(audio))) return Response.json({ error: "Speech service returned invalid audio." }, { status: 502 });
    return Response.json({ audios: data.audios }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Speech service could not be reached. Please try again." }, { status: 502 });
  }
}
