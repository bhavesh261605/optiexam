import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as store from "@/lib/server/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const prefsSchema = z.object({
  contrast: z.boolean(),
  scale: z.number().min(100).max(200),
  tts: z.boolean(),
  rate: z.number().min(0.5).max(2),
  reducedMotion: z.boolean(),
  shortcuts: z.boolean(),
  setup: z.boolean(),
  orientationCompleted: z.boolean().optional(),
});
const questionSchema = z
  .object({
    id: z.string().optional(),
    prompt: z.string().trim().min(5).max(3000),
    options: z.array(z.string().trim().min(1).max(1000)).length(4),
    correct: z.number().int().min(0).max(3),
    topic: z.string().trim().min(1).max(100),
    marks: z.number().int().min(1).max(100),
    alternative: z.string().max(3000),
  })
  .refine(
    (q) => new Set(q.options).size === 4,
    "Answer options must be distinct.",
  );
const examSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3).max(150),
  description: z.string().max(2000),
  duration: z.number().int().min(1).max(180),
  kind: z.enum(["assigned", "mock", "practice"]),
  status: z.enum(["draft", "published"]),
  questionIds: z.array(z.string()).min(1).max(100),
  assigned: z.array(z.enum(["candidate-demo", "candidate-two"])),
  extraMinutes: z
    .partialRecord(
      z.enum(["candidate-demo", "candidate-two"]),
      z.number().int().min(0).max(180),
    )
    .optional(),
  shuffleQuestions: z.boolean().optional(),
});
async function handle(req: NextRequest) {
  try {
    const path = req.nextUrl.pathname.slice(5).split("/").filter(Boolean);
    const method = req.method;
    if (method !== "GET") {
      const origin = req.headers.get("origin");
      if (origin && new URL(origin).host !== req.headers.get("host"))
        throw new store.ApiError(
          "This request came from a different origin.",
          403,
        );
    }
    const token = req.cookies.get("aura_session")?.value;
    if (path[0] === "login" && method === "POST") {
      if (process.env.VERCEL)
        throw new store.ApiError(
          "Demo sign-in is disabled on Vercel. Connect production authentication first.",
          403,
        );
      const body = z
        .object({
          id: z.enum(["candidate-demo", "candidate-two", "admin-demo"]),
        })
        .parse(await req.json());
      const { token, user } = store.login(body.id);
      const response = NextResponse.json({ user });
      response.cookies.set("aura_session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: req.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 86400,
      });
      return response;
    }
    if (path[0] === "logout" && method === "POST") {
      if (token) store.logout(token);
      const res = NextResponse.json({ ok: true });
      res.cookies.delete("aura_session");
      return res;
    }
    const user = store.session(token);
    if (path[0] === "me" && method === "GET")
      return NextResponse.json({
        user: user || null,
        preferences: user ? store.preferences(user) : null,
      });
    if (!user) throw new store.ApiError("Please sign in to continue.", 401);
    let data: unknown;
    if (path[0] === "preferences" && (method === "GET" || method === "PUT"))
      data = store.preferences(
        user,
        method === "PUT" ? prefsSchema.parse(await req.json()) : undefined,
      );
    else if (path[0] === "exams" && method === "GET") data = store.exams(user);
    else if (path[0] === "analytics" && method === "GET")
      data = store.analytics(user);
    else if (path[0] === "attempts" && path.length === 1 && method === "POST") {
      if (user.role !== "candidate")
        throw new store.ApiError(
          "Sign in as a candidate to take an exam.",
          403,
        );
      data = store.start(
        user,
        z.object({ examId: z.string() }).parse(await req.json()).examId,
      );
    } else if (path[0] === "attempts" && path[1]) {
      if (method === "GET" && path.length === 2)
        data = store.attempt(user, path[1]);
      else if (method === "PUT" && path[2] === "responses" && path[3])
        data = store.respond(
          user,
          path[1],
          path[3],
          z
            .object({
              answer: z.number().int().nullable(),
              review: z.boolean(),
            })
            .parse(await req.json()),
        );
      else if (method === "POST" && path[2] === "submit")
        data = store.submit(user, path[1]);
      else if (method === "GET" && path[2] === "result")
        data = store.result(user, path[1]);
      else if (method === "PUT" && path[2] === "feedback")
        data = store.feedback(
          user,
          path[1],
          z
            .object({
              navigation: z.enum(["independent", "some-help", "blocked"]),
              barriers: z
                .array(
                  z.enum([
                    "navigation",
                    "audio",
                    "question-content",
                    "saving",
                    "time",
                  ]),
                )
                .max(5),
            })
            .parse(await req.json()),
        );
      else throw new store.ApiError("Endpoint not found.", 404);
    } else if (path[0] === "admin") {
      if (user.role !== "admin")
        throw new store.ApiError("Administrator access is required.", 403);
      if (method === "GET" && path.length === 1) data = store.adminOverview();
      else if (method === "POST" && path[1] === "questions")
        data = store.putQuestion(user, questionSchema.parse(await req.json()));
      else if (method === "POST" && path[1] === "exams")
        data = store.putExam(user, examSchema.parse(await req.json()));
      else throw new store.ApiError("Endpoint not found.", 404);
    } else throw new store.ApiError("Endpoint not found.", 404);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join(" ") },
        { status: 400 },
      );
    if (error instanceof store.ApiError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(error);
    return NextResponse.json(
      { error: "The server could not complete the request. Please retry." },
      { status: 500 },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
