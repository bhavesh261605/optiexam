import { db, transaction } from "./database";
import { promisify } from "node:util";
import {
  randomUUID,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { evaluate, canWrite } from "../engine";
import {
  defaultPreferences,
  type User,
  type Question,
  type Exam,
  type Attempt,
  type Preferences,
  type Answer,
} from "../types";
const deriveKey = promisify(scrypt);
const parse = <T>(row: unknown): T | undefined =>
  row
    ? (JSON.parse(
        (
          row as {
            data: string;
          }
        ).data,
      ) as T)
    : undefined;
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
async function audit(actor: string, event: string, detail: string) {
  await db
    .prepare("INSERT INTO audit(actor,event,detail,at) VALUES(?,?,?,?)")
    .run(actor, event, detail, Date.now());
}
async function saveAttempt(a: Attempt) {
  await db
    .prepare("INSERT OR REPLACE INTO attempts VALUES(?,?,?,?)")
    .run(a.id, a.userId, a.examId, JSON.stringify(a));
}
async function rawAttempt(id: string) {
  return parse<Attempt>(
    await db.prepare("SELECT data FROM attempts WHERE id=?").get(id),
  );
}
function safeAttempt(a: Attempt): Attempt {
  return {
    ...a,
    serverNow: Date.now(),
    questions: a.questions.map(({ correct, ...q }) => q),
  };
}
async function finish(a: Attempt) {
  if (a.status === "evaluated") return a;
  const score = evaluate(a.questions, a.answers);
  a.status = "evaluated";
  a.score = score.score;
  a.maxScore = score.maxScore;
  a.submittedAt = Date.now();
  await saveAttempt(a);
  await audit(a.userId, "EXAM_SUBMITTED", a.title);
  return a;
}
async function ownedAttempt(user: User, id: string) {
  const a = await rawAttempt(id);
  if (!a || (a.userId !== user.id && user.role !== "admin"))
    throw new ApiError("Attempt not found.", 404);
  if (a.status === "in_progress" && a.deadline <= Date.now()) await finish(a);
  return a;
}
const seedQuestions: Omit<Question, "id">[] = [
  {
    prompt:
      "A train travels 180 kilometres in 3 hours. What is its average speed?",
    options: [
      "45 kilometres per hour",
      "60 kilometres per hour",
      "90 kilometres per hour",
      "120 kilometres per hour",
    ],
    correct: 1,
    topic: "Quantitative aptitude",
    marks: 1,
    alternative: "",
  },
  {
    prompt: "What comes next in the sequence: 3, 6, 12, 24?",
    options: ["30", "36", "42", "48"],
    correct: 3,
    topic: "Logical reasoning",
    marks: 1,
    alternative: "",
  },
  {
    prompt: "Choose the word closest in meaning to “resilient”.",
    options: ["Adaptable", "Fragile", "Distant", "Hesitant"],
    correct: 0,
    topic: "Verbal ability",
    marks: 1,
    alternative: "",
  },
  {
    prompt: "A book costs ₹400. After a 25% discount, what is the price?",
    options: ["₹100", "₹250", "₹300", "₹350"],
    correct: 2,
    topic: "Quantitative aptitude",
    marks: 1,
    alternative: "",
  },
  {
    prompt:
      "All roses are flowers. Some flowers are red. Which statement must be true?",
    options: [
      "All roses are red",
      "Some roses are red",
      "All roses are flowers",
      "All flowers are roses",
    ],
    correct: 2,
    topic: "Logical reasoning",
    marks: 1,
    alternative: "",
  },
  {
    prompt: "Which sentence is grammatically correct?",
    options: [
      "She have completed the test.",
      "She has completed the test.",
      "She having completed the test.",
      "She complete the test yesterday.",
    ],
    correct: 1,
    topic: "Verbal ability",
    marks: 1,
    alternative: "",
  },
  {
    prompt:
      "Using the data below, which month had the highest number of books borrowed?",
    options: ["January", "February", "March", "All months were equal"],
    correct: 2,
    topic: "Data interpretation",
    marks: 1,
    alternative:
      "Library borrowing data. January: 40 books. February: 55 books. March: 70 books. These values are the complete text equivalent of the chart.",
  },
  {
    prompt:
      "A class has 12 students who walk to school and 18 who take the bus. What fraction of the class walks?",
    options: ["One fifth", "Two fifths", "Three fifths", "Four fifths"],
    correct: 1,
    topic: "Quantitative aptitude",
    marks: 1,
    alternative: "",
  },
];
let ready: Promise<void> | undefined;
export async function initializeStore() {
  return (ready ??= transaction(async () => {
    await db.exec(`
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,prefs TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,userId TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS questions(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS exams(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,userId TEXT NOT NULL,examId TEXT NOT NULL,data TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS one_attempt_per_exam ON attempts(userId,examId);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,event TEXT NOT NULL,detail TEXT NOT NULL,at INTEGER NOT NULL);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS credentials(userId TEXT PRIMARY KEY REFERENCES users(id), email TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auth_limits(email TEXT PRIMARY KEY, count INTEGER NOT NULL, resetAt INTEGER NOT NULL);`);
    if (!(await db.prepare("SELECT id FROM users LIMIT 1").get()))
      await transaction(async () => {
        for (const u of [
          { id: "candidate-demo", name: "Aarav Sharma", role: "candidate" },
          { id: "candidate-two", name: "Priya Verma", role: "candidate" },
          { id: "admin-demo", name: "Ananya Rao", role: "admin" },
        ])
          await db
            .prepare("INSERT INTO users VALUES(?,?,?,?)")
            .run(u.id, u.name, u.role, JSON.stringify(defaultPreferences));
        await Promise.all(
          seedQuestions.map(
            async (q, i) =>
              await db
                .prepare("INSERT INTO questions VALUES(?,?)")
                .run(`q${i + 1}`, JSON.stringify({ ...q, id: `q${i + 1}` })),
          ),
        );
        for (const e of [
          {
            id: "general-aptitude",
            title: "General Aptitude Assessment",
            description:
              "Quantitative aptitude, logical reasoning, and verbal ability.",
            duration: 20,
            kind: "assigned",
            status: "published",
            questionIds: seedQuestions.map((_, i) => `q${i + 1}`),
            assigned: ["candidate-demo", "candidate-two"],
          },
          {
            id: "reasoning-practice",
            title: "Logical Reasoning",
            description:
              "Build confidence with patterns and logical conclusions.",
            duration: 10,
            kind: "practice",
            status: "published",
            questionIds: ["q2", "q5"],
            assigned: [],
          },
          {
            id: "numerical-mock",
            title: "Numerical Ability Mock",
            description:
              "A short mock test covering numbers and data interpretation.",
            duration: 12,
            kind: "mock",
            status: "published",
            questionIds: ["q1", "q4", "q7", "q8"],
            assigned: [],
          },
        ])
          await db
            .prepare("INSERT INTO exams VALUES(?,?)")
            .run(e.id, JSON.stringify(e));
        await audit(
          "admin-demo",
          "DEMO_INITIALIZED",
          "Accessible sample exams created",
        );
      });
    // Rename only the original demo profiles; preserve custom names and saved attempts.
    for (const [id, previous, name] of [
      ["candidate-demo", "Alex Morgan", "Aarav Sharma"],
      ["candidate-two", "Sam Taylor", "Priya Verma"],
      ["admin-demo", "Jordan Lee", "Ananya Rao"],
    ]) {
      await db
        .prepare("UPDATE users SET name=? WHERE id=? AND name=?")
        .run(name, id, previous);
    }
  })
    .then(() => undefined)
    .catch((error) => {
      ready = undefined;
      throw error;
    }));
}
export async function login(id: string) {
  const user = (await db
    .prepare(
      "SELECT u.id,u.name,u.role,c.email FROM users u LEFT JOIN credentials c ON c.userId=u.id WHERE u.id=?",
    )
    .get(id)) as User | undefined;
  if (!user) throw new ApiError("Unknown demo account.");
  const token = randomBytes(32).toString("hex");
  await db
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(token, id, Date.now() + 86400000);
  await audit(id, "SIGNED_IN", "Local demo session");
  return { token, user };
}
export async function session(token?: string): Promise<User | undefined> {
  if (!token) return;
  return (await db
    .prepare(
      "SELECT u.id,u.name,u.role,c.email FROM users u JOIN sessions s ON s.userId=u.id LEFT JOIN credentials c ON c.userId=u.id WHERE s.token=? AND s.expires>?",
    )
    .get(token, Date.now())) as User | undefined;
}
export async function logout(token: string) {
  await db.prepare("DELETE FROM sessions WHERE token=?").run(token);
}
export async function voiceIdentity(
  identifier: string,
): Promise<string | undefined> {
  const row = (await db
    .prepare(
      "SELECT u.id FROM users u LEFT JOIN credentials c ON c.userId=u.id WHERE u.role='candidate' AND (c.email=? OR u.id=?)",
    )
    .get(identifier, identifier)) as
    | {
        id: string;
      }
    | undefined;
  return row?.id;
}
export async function voiceLogin(id: string, jti: string, expires: number) {
  if ((await voiceIdentity(id)) !== id)
    throw new ApiError("Voice sign-in failed.", 401);
  await db.exec(
    "CREATE TABLE IF NOT EXISTS voice_tokens(jti TEXT PRIMARY KEY, expires INTEGER NOT NULL)",
  );
  return await transaction(async () => {
    await db
      .prepare("DELETE FROM voice_tokens WHERE expires < ?")
      .run(Date.now() / 1000);
    if (await db.prepare("SELECT jti FROM voice_tokens WHERE jti=?").get(jti))
      throw new ApiError("Voice sign-in token was already used.", 401);
    await db.prepare("INSERT INTO voice_tokens VALUES(?,?)").run(jti, expires);
    const result = await login(id);
    await audit(id, "VOICE_SIGNED_IN", "Challenge and speaker match accepted");
    return result;
  });
}
export async function preferences(
  user: User,
  prefs?: Preferences,
): Promise<Preferences> {
  if (prefs)
    await db
      .prepare("UPDATE users SET prefs=? WHERE id=?")
      .run(JSON.stringify(prefs), user.id);
  return JSON.parse(
    (
      (await db.prepare("SELECT prefs FROM users WHERE id=?").get(user.id)) as {
        prefs: string;
      }
    ).prefs,
  );
}
async function allExams() {
  return (await db.prepare("SELECT data FROM exams").all()).map((r) =>
    parse<Exam>(r)!,
  );
}
function allowed(user: User, e: Exam) {
  return (
    user.role === "admin" ||
    (e.status === "published" &&
      (e.kind !== "assigned" || e.assigned.includes(user.id)))
  );
}
async function examsInTransaction(user: User) {
  return await Promise.all(
    (await allExams())
      .filter((e) => allowed(user, e))
      .map(async (e) => {
        const a = parse<Attempt>(
          await db
            .prepare("SELECT data FROM attempts WHERE userId=? AND examId=?")
            .get(user.id, e.id),
        );
        if (a && a.status === "in_progress" && a.deadline <= Date.now())
          await transaction(async () => await finish(a));
        return {
          ...e,
          assigned: user.role === "admin" ? e.assigned : [],
          extraMinutes:
            user.role === "admin"
              ? e.extraMinutes
              : { [user.id]: e.extraMinutes?.[user.id] || 0 },
          questions: e.questionIds.length,
          attempt: a ? safeAttempt(a) : undefined,
        };
      }),
  );
}
export async function start(user: User, examId: string) {
  return await transaction(async () => {
    const e = parse<Exam>(
      await db.prepare("SELECT data FROM exams WHERE id=?").get(examId),
    );
    if (!e || !allowed(user, e)) throw new ApiError("Exam not available.", 404);
    const existing = parse<Attempt>(
      await db
        .prepare("SELECT data FROM attempts WHERE userId=? AND examId=?")
        .get(user.id, e.id),
    );
    if (existing) {
      if (existing.status === "in_progress" && existing.deadline <= Date.now())
        await finish(existing);
      return safeAttempt(existing);
    }
    const qs = await Promise.all(
      e.questionIds.map(async (id) =>
        parse<Question>(
          await db.prepare("SELECT data FROM questions WHERE id=?").get(id),
        )!,
      ),
    );
    if (e.shuffleQuestions)
      for (let i = qs.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
    const extraMinutes = e.extraMinutes?.[user.id] || 0;
    const prefs = await preferences(user);
    const a: Attempt = {
      id: randomUUID(),
      examId,
      userId: user.id,
      title: e.title,
      startedAt: Date.now(),
      deadline: Date.now() + (e.duration + extraMinutes) * 60000,
      baseDuration: e.duration,
      extraMinutes,
      supportContext: {
        contrast: prefs.contrast,
        scale: prefs.scale,
        tts: prefs.tts,
      },
      answerChanges: 0,
      questionSeconds: {},
      reviewHistory: [],
      status: "in_progress",
      questions: qs,
      answers: {},
      score: null,
      maxScore: qs.reduce((s, q) => s + q.marks, 0),
      submittedAt: null,
    };
    await saveAttempt(a);
    await audit(user.id, "EXAM_STARTED", e.title);
    return safeAttempt(a);
  });
}
export async function attempt(user: User, id: string) {
  return await transaction(async () =>
    safeAttempt(await ownedAttempt(user, id)),
  );
}
export async function respond(
  user: User,
  id: string,
  qid: string,
  answer: Answer,
) {
  return await transaction(async () => {
    const a = await ownedAttempt(user, id);
    if (a.userId !== user.id)
      throw new ApiError("Only the candidate can answer.", 403);
    if (!canWrite(a.status, a.deadline))
      return { closed: true, attempt: safeAttempt(a) };
    const q = a.questions.find((q) => q.id === qid);
    if (!q) throw new ApiError("Question not in this exam.");
    if (
      answer.answer !== null &&
      (answer.answer < 0 || answer.answer >= q.options.length)
    )
      throw new ApiError("Invalid option.");
    const previous = a.answers[qid];
    if (previous?.answer != null && previous.answer !== answer.answer)
      a.answerChanges = (a.answerChanges || 0) + 1;
    if (answer.review && !a.reviewHistory?.includes(qid))
      a.reviewHistory = [...(a.reviewHistory || []), qid];
    a.answers[qid] = answer;
    await saveAttempt(a);
    return { savedAt: Date.now() };
  });
}
export async function submit(user: User, id: string) {
  return await transaction(async () => {
    const a = await ownedAttempt(user, id);
    if (a.userId !== user.id)
      throw new ApiError("Only the candidate can submit.", 403);
    return safeAttempt(await finish(a));
  });
}
export async function recordQuestionTime(
  user: User,
  id: string,
  qid: string,
  seconds: number,
) {
  return await transaction(async () => {
    const a = await ownedAttempt(user, id);
    if (a.userId !== user.id)
      throw new ApiError("Only the candidate can record time.", 403);
    if (!canWrite(a.status, a.deadline)) return { closed: true };
    if (!a.questions.some((q) => q.id === qid))
      throw new ApiError("Question not in this exam.");
    const times = a.questionSeconds || {};
    const recorded = Object.values(times).reduce(
      (sum, value) => sum + value,
      0,
    );
    const remaining = Math.max(0, (Date.now() - a.startedAt) / 1000 - recorded);
    a.questionSeconds = {
      ...times,
      [qid]: (times[qid] || 0) + Math.min(seconds, remaining),
    };
    await saveAttempt(a);
    return { saved: true };
  });
}
export async function result(user: User, id: string) {
  return await transaction(async () => {
    const a = await ownedAttempt(user, id);
    if (a.status !== "evaluated")
      throw new ApiError("Submit your exam to see the result.", 409);
    return { ...safeAttempt(a), ...evaluate(a.questions, a.answers) };
  });
}
export async function questions() {
  return (await db.prepare("SELECT data FROM questions").all()).map((r) =>
    parse<Question>(r)!,
  );
}
async function analyticsInTransaction(user: User) {
  const records = (
    await db.prepare("SELECT data FROM attempts WHERE userId=?").all(user.id)
  ).map((r) => parse<Attempt>(r)!);
  for (const a of records)
    if (a.status === "in_progress" && a.deadline <= Date.now())
      await transaction(async () => await finish(a));
  return records
    .filter((a) => a.status === "evaluated")
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0))
    .map((a) => ({ ...safeAttempt(a), ...evaluate(a.questions, a.answers) }));
}
export async function feedback(
  user: User,
  id: string,
  value: {
    navigation: "independent" | "some-help" | "blocked";
    barriers: string[];
  },
) {
  return await transaction(async () => {
    const a = await ownedAttempt(user, id);
    if (a.userId !== user.id)
      throw new ApiError("Only the candidate can share their experience.", 403);
    if (a.status !== "evaluated")
      throw new ApiError(
        "Complete this assessment before sharing feedback.",
        409,
      );
    a.feedback = {
      ...value,
      barriers: [...new Set(value.barriers)],
      savedAt: Date.now(),
    };
    await saveAttempt(a);
    await audit(user.id, "ACCESS_FEEDBACK_SAVED", a.title);
    return a.feedback;
  });
}
export async function putQuestion(
  user: User,
  q: Omit<Question, "id"> & {
    id?: string;
  },
) {
  const question = { ...q, id: q.id || randomUUID() };
  await db
    .prepare("INSERT OR REPLACE INTO questions VALUES(?,?)")
    .run(question.id, JSON.stringify(question));
  await audit(user.id, "QUESTION_SAVED", question.prompt.slice(0, 100));
  return question;
}
export async function putExam(
  user: User,
  e: Omit<Exam, "id"> & {
    id?: string;
  },
) {
  for (const id of e.questionIds) {
    if (!(await db.prepare("SELECT id FROM questions WHERE id=?").get(id)))
      throw new ApiError("One or more questions are unavailable.");
  }
  if (new Set(e.questionIds).size !== e.questionIds.length)
    throw new ApiError("Questions must be unique.");
  for (const id of e.assigned) {
    if (
      !(await db
        .prepare("SELECT id FROM users WHERE id=? AND role='candidate'")
        .get(id))
    )
      throw new ApiError("Choose existing candidate accounts.");
  }
  if (Object.keys(e.extraMinutes || {}).some((id) => !e.assigned.includes(id)))
    throw new ApiError("Extra time must belong to an assigned candidate.");
  const exam = { ...e, id: e.id || randomUUID() };
  await db
    .prepare("INSERT OR REPLACE INTO exams VALUES(?,?)")
    .run(exam.id, JSON.stringify(exam));
  await audit(user.id, "EXAM_SAVED", exam.title);
  return exam;
}
async function adminOverviewInTransaction() {
  const attempts = (await db.prepare("SELECT data FROM attempts").all()).map(
    (r) => parse<Attempt>(r)!,
  );
  for (const a of attempts)
    if (a.status === "in_progress" && a.deadline <= Date.now())
      await transaction(async () => await finish(a));
  return {
    questions: await questions(),
    exams: await allExams(),
    candidates: await db
      .prepare("SELECT id,name,role FROM users WHERE role='candidate'")
      .all(),
    results: attempts.filter((a) => a.status === "evaluated").map(safeAttempt),
    audit: await db
      .prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 100")
      .all(),
  };
}
async function checkAuthLimitInTransaction(email: string) {
  const now = Date.now();
  await db.prepare("DELETE FROM auth_limits WHERE resetAt < ?").run(now);
  const row = (await db
    .prepare("SELECT count FROM auth_limits WHERE email=?")
    .get(email)) as
    | {
        count: number;
      }
    | undefined;
  if (row && row.count >= 10)
    throw new ApiError(
      "Too many attempts. Please try again in 15 minutes.",
      429,
    );
  await db
    .prepare(
      "INSERT INTO auth_limits VALUES(?,1,?) ON CONFLICT(email) DO UPDATE SET count=count+1",
    )
    .run(email, now + 900000);
}
export async function register(name: string, email: string, password: string) {
  await checkAuthLimit(email);
  if (
    await db.prepare("SELECT userId FROM credentials WHERE email=?").get(email)
  )
    throw new ApiError(
      "This email cannot be registered. Try logging in instead.",
      409,
    );
  const salt = randomBytes(16).toString("hex");
  const hash = ((await deriveKey(password, salt, 64)) as Buffer).toString(
    "hex",
  );
  const id = randomUUID();
  await transaction(async () => {
    if (
      await db
        .prepare("SELECT userId FROM credentials WHERE email=?")
        .get(email)
    )
      throw new ApiError(
        "This email cannot be registered. Try logging in instead.",
        409,
      );
    await db
      .prepare("INSERT INTO users VALUES(?,?,?,?)")
      .run(
        id,
        name,
        "candidate",
        JSON.stringify({ ...defaultPreferences, tts: false, setup: true }),
      );
    await db
      .prepare("INSERT INTO credentials VALUES(?,?,?,?)")
      .run(id, email, salt, hash);
  });
  return await login(id);
}
export async function authenticate(email: string, password: string) {
  await checkAuthLimit(email);
  const row = (await db
    .prepare("SELECT userId,salt,hash FROM credentials WHERE email=?")
    .get(email)) as
    | {
        userId: string;
        salt: string;
        hash: string;
      }
    | undefined;
  const actual = (await deriveKey(
    password,
    row?.salt || "optiexam-dummy-salt",
    64,
  )) as Buffer;
  if (!row || !timingSafeEqual(actual, Buffer.from(row.hash, "hex")))
    throw new ApiError("Email or password is incorrect.", 401);
  await db.prepare("DELETE FROM auth_limits WHERE email=?").run(email);
  return await login(row.userId);
}
export async function updateProfile(user: User, name: string): Promise<User> {
  await db.prepare("UPDATE users SET name=? WHERE id=?").run(name, user.id);
  return { ...user, name };
}

export async function exams(user: User) {
  return transaction(() => examsInTransaction(user));
}

export async function analytics(user: User) {
  return transaction(() => analyticsInTransaction(user));
}

export async function adminOverview() {
  return transaction(() => adminOverviewInTransaction());
}

async function checkAuthLimit(email: string) {
  return transaction(() => checkAuthLimitInTransaction(email));
}
