import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID, randomBytes, randomInt } from "node:crypto";
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

const dbPath = resolve(
  /* turbopackIgnore: true */ process.env.AURA_DB_PATH || "./data/aura.sqlite",
);
mkdirSync(dirname(dbPath), { recursive: true });
const globalDb = globalThis as unknown as { auraDb?: DatabaseSync };
const db = globalDb.auraDb ?? new DatabaseSync(dbPath);
globalDb.auraDb = db;
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,prefs TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,userId TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS questions(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS exams(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,userId TEXT NOT NULL,examId TEXT NOT NULL,data TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS one_attempt_per_exam ON attempts(userId,examId);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,event TEXT NOT NULL,detail TEXT NOT NULL,at INTEGER NOT NULL);`);
const parse = <T>(row: unknown): T | undefined =>
  row ? (JSON.parse((row as { data: string }).data) as T) : undefined;
function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function audit(actor: string, event: string, detail: string) {
  db.prepare("INSERT INTO audit(actor,event,detail,at) VALUES(?,?,?,?)").run(
    actor,
    event,
    detail,
    Date.now(),
  );
}
function saveAttempt(a: Attempt) {
  db.prepare("INSERT OR REPLACE INTO attempts VALUES(?,?,?,?)").run(
    a.id,
    a.userId,
    a.examId,
    JSON.stringify(a),
  );
}
function rawAttempt(id: string) {
  return parse<Attempt>(
    db.prepare("SELECT data FROM attempts WHERE id=?").get(id),
  );
}
function safeAttempt(a: Attempt): Attempt {
  return {
    ...a,
    serverNow: Date.now(),
    questions: a.questions.map(({ correct, ...q }) => q),
  };
}
function finish(a: Attempt) {
  if (a.status === "evaluated") return a;
  const score = evaluate(a.questions, a.answers);
  a.status = "evaluated";
  a.score = score.score;
  a.maxScore = score.maxScore;
  a.submittedAt = Date.now();
  saveAttempt(a);
  audit(a.userId, "EXAM_SUBMITTED", a.title);
  return a;
}
function ownedAttempt(user: User, id: string) {
  const a = rawAttempt(id);
  if (!a || (a.userId !== user.id && user.role !== "admin"))
    throw new ApiError("Attempt not found.", 404);
  if (a.status === "in_progress" && a.deadline <= Date.now()) finish(a);
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
if (!db.prepare("SELECT id FROM users LIMIT 1").get())
  transaction(() => {
    for (const u of [
      { id: "candidate-demo", name: "Aarav Sharma", role: "candidate" },
      { id: "candidate-two", name: "Priya Verma", role: "candidate" },
      { id: "admin-demo", name: "Ananya Rao", role: "admin" },
    ])
      db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(
        u.id,
        u.name,
        u.role,
        JSON.stringify(defaultPreferences),
      );
    seedQuestions.forEach((q, i) =>
      db
        .prepare("INSERT INTO questions VALUES(?,?)")
        .run(`q${i + 1}`, JSON.stringify({ ...q, id: `q${i + 1}` })),
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
        description: "Build confidence with patterns and logical conclusions.",
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
      db.prepare("INSERT INTO exams VALUES(?,?)").run(e.id, JSON.stringify(e));
    audit("admin-demo", "DEMO_INITIALIZED", "Accessible sample exams created");
  });
// Rename only the original demo profiles; preserve custom names and saved attempts.
for (const [id, previous, name] of [
  ["candidate-demo", "Alex Morgan", "Aarav Sharma"],
  ["candidate-two", "Sam Taylor", "Priya Verma"],
  ["admin-demo", "Jordan Lee", "Ananya Rao"],
]) {
  db.prepare("UPDATE users SET name=? WHERE id=? AND name=?").run(
    name,
    id,
    previous,
  );
}
export function login(id: string) {
  const user = db
    .prepare("SELECT id,name,role FROM users WHERE id=?")
    .get(id) as User | undefined;
  if (!user) throw new ApiError("Unknown demo account.");
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    token,
    id,
    Date.now() + 86400000,
  );
  audit(id, "SIGNED_IN", "Local demo session");
  return { token, user };
}
export function session(token?: string): User | undefined {
  if (!token) return;
  return db
    .prepare(
      "SELECT u.id,u.name,u.role FROM users u JOIN sessions s ON s.userId=u.id WHERE s.token=? AND s.expires>?",
    )
    .get(token, Date.now()) as User | undefined;
}
export function logout(token: string) {
  db.prepare("DELETE FROM sessions WHERE token=?").run(token);
}
export function preferences(user: User, prefs?: Preferences): Preferences {
  if (prefs)
    db.prepare("UPDATE users SET prefs=? WHERE id=?").run(
      JSON.stringify(prefs),
      user.id,
    );
  return JSON.parse(
    (
      db.prepare("SELECT prefs FROM users WHERE id=?").get(user.id) as {
        prefs: string;
      }
    ).prefs,
  );
}
function allExams() {
  return db
    .prepare("SELECT data FROM exams")
    .all()
    .map((r) => parse<Exam>(r)!);
}
function allowed(user: User, e: Exam) {
  return (
    user.role === "admin" ||
    (e.status === "published" &&
      (e.kind !== "assigned" || e.assigned.includes(user.id)))
  );
}
export function exams(user: User) {
  return allExams()
    .filter((e) => allowed(user, e))
    .map((e) => {
      const a = parse<Attempt>(
        db
          .prepare("SELECT data FROM attempts WHERE userId=? AND examId=?")
          .get(user.id, e.id),
      );
      if (a && a.status === "in_progress" && a.deadline <= Date.now())
        transaction(() => finish(a));
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
    });
}
export function start(user: User, examId: string) {
  return transaction(() => {
    const e = parse<Exam>(
      db.prepare("SELECT data FROM exams WHERE id=?").get(examId),
    );
    if (!e || !allowed(user, e)) throw new ApiError("Exam not available.", 404);
    const existing = parse<Attempt>(
      db
        .prepare("SELECT data FROM attempts WHERE userId=? AND examId=?")
        .get(user.id, e.id),
    );
    if (existing) {
      if (existing.status === "in_progress" && existing.deadline <= Date.now())
        finish(existing);
      return safeAttempt(existing);
    }
    const qs = e.questionIds.map((id) =>
      parse<Question>(
        db.prepare("SELECT data FROM questions WHERE id=?").get(id),
      )!,
    );
    if (e.shuffleQuestions)
      for (let i = qs.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
    const extraMinutes = e.extraMinutes?.[user.id] || 0;
    const prefs = preferences(user);
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
      reviewHistory: [],
      status: "in_progress",
      questions: qs,
      answers: {},
      score: null,
      maxScore: qs.reduce((s, q) => s + q.marks, 0),
      submittedAt: null,
    };
    saveAttempt(a);
    audit(user.id, "EXAM_STARTED", e.title);
    return safeAttempt(a);
  });
}
export function attempt(user: User, id: string) {
  return transaction(() => safeAttempt(ownedAttempt(user, id)));
}
export function respond(user: User, id: string, qid: string, answer: Answer) {
  return transaction(() => {
    const a = ownedAttempt(user, id);
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
    saveAttempt(a);
    return { savedAt: Date.now() };
  });
}
export function submit(user: User, id: string) {
  return transaction(() => {
    const a = ownedAttempt(user, id);
    if (a.userId !== user.id)
      throw new ApiError("Only the candidate can submit.", 403);
    return safeAttempt(finish(a));
  });
}
export function result(user: User, id: string) {
  return transaction(() => {
    const a = ownedAttempt(user, id);
    if (a.status !== "evaluated")
      throw new ApiError("Submit your exam to see the result.", 409);
    return { ...safeAttempt(a), ...evaluate(a.questions, a.answers) };
  });
}
export function questions() {
  return db
    .prepare("SELECT data FROM questions")
    .all()
    .map((r) => parse<Question>(r)!);
}
export function analytics(user: User) {
  const records = db
    .prepare("SELECT data FROM attempts WHERE userId=?")
    .all(user.id)
    .map((r) => parse<Attempt>(r)!);
  for (const a of records)
    if (a.status === "in_progress" && a.deadline <= Date.now())
      transaction(() => finish(a));
  return records
    .filter((a) => a.status === "evaluated")
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0))
    .map((a) => ({ ...safeAttempt(a), ...evaluate(a.questions, a.answers) }));
}
export function feedback(
  user: User,
  id: string,
  value: {
    navigation: "independent" | "some-help" | "blocked";
    barriers: string[];
  },
) {
  return transaction(() => {
    const a = ownedAttempt(user, id);
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
    saveAttempt(a);
    audit(user.id, "ACCESS_FEEDBACK_SAVED", a.title);
    return a.feedback;
  });
}
export function putQuestion(
  user: User,
  q: Omit<Question, "id"> & { id?: string },
) {
  const question = { ...q, id: q.id || randomUUID() };
  db.prepare("INSERT OR REPLACE INTO questions VALUES(?,?)").run(
    question.id,
    JSON.stringify(question),
  );
  audit(user.id, "QUESTION_SAVED", question.prompt.slice(0, 100));
  return question;
}
export function putExam(user: User, e: Omit<Exam, "id"> & { id?: string }) {
  if (
    e.questionIds.some(
      (id) => !db.prepare("SELECT id FROM questions WHERE id=?").get(id),
    )
  )
    throw new ApiError("One or more questions are unavailable.");
  if (new Set(e.questionIds).size !== e.questionIds.length)
    throw new ApiError("Questions must be unique.");
  const exam = { ...e, id: e.id || randomUUID() };
  db.prepare("INSERT OR REPLACE INTO exams VALUES(?,?)").run(
    exam.id,
    JSON.stringify(exam),
  );
  audit(user.id, "EXAM_SAVED", exam.title);
  return exam;
}
export function adminOverview() {
  const attempts = db
    .prepare("SELECT data FROM attempts")
    .all()
    .map((r) => parse<Attempt>(r)!);
  for (const a of attempts)
    if (a.status === "in_progress" && a.deadline <= Date.now())
      transaction(() => finish(a));
  return {
    questions: questions(),
    exams: allExams(),
    candidates: db
      .prepare("SELECT id,name,role FROM users WHERE role='candidate'")
      .all(),
    results: attempts.filter((a) => a.status === "evaluated").map(safeAttempt),
    audit: db.prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 100").all(),
  };
}
