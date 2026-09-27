export type Role = "candidate" | "admin";
export type User = { id: string; name: string; email?: string; role: Role };
export type Preferences = {
  contrast: boolean;
  scale: number;
  tts: boolean;
  rate: number;
  reducedMotion: boolean;
  shortcuts: boolean;
  setup: boolean;
  orientationCompleted?: boolean;
};
export const defaultPreferences: Preferences = {
  contrast: false,
  scale: 100,
  tts: true,
  rate: 1,
  reducedMotion: false,
  shortcuts: false,
  setup: false,
};
export type Question = {
  id: string;
  prompt: string;
  options: string[];
  topic: string;
  marks: number;
  alternative: string;
  correct?: number;
};
export type Exam = {
  id: string;
  title: string;
  description: string;
  duration: number;
  kind: "assigned" | "mock" | "practice";
  status: "draft" | "published";
  questionIds: string[];
  assigned: string[];
  questions?: number;
  attempt?: Attempt;
  extraMinutes?: Record<string, number>;
  shuffleQuestions?: boolean;
};
export type Answer = { answer: number | null; review: boolean };
export type Attempt = {
  id: string;
  examId: string;
  userId: string;
  title: string;
  startedAt: number;
  deadline: number;
  status: "in_progress" | "evaluated";
  questions: Question[];
  answers: Record<string, Answer>;
  score: number | null;
  maxScore: number;
  submittedAt: number | null;
  serverNow?: number;
  baseDuration?: number;
  extraMinutes?: number;
  supportContext?: { contrast: boolean; scale: number; tts: boolean };
  answerChanges?: number;
  reviewHistory?: string[];
  feedback?: {
    navigation: "independent" | "some-help" | "blocked";
    barriers: string[];
    savedAt: number;
  };
};
export type Result = Attempt & {
  correct: number;
  incorrect: number;
  unanswered: number;
  topics: { topic: string; correct: number; total: number }[];
};
export type Audit = {
  id: number;
  actor: string;
  event: string;
  detail: string;
  at: number;
};
