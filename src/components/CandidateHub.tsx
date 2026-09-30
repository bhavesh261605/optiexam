"use client";
import Link from "next/link";
import { BookOpen, Target, Trophy, Flame } from "lucide-react";
import type { Exam, User, Result } from "@/lib/types";
import { useLanguage } from "./language";
export function milestoneStats(exams: Exam[], now = new Date()) {
  const day = (time: number) => new Date(time).toLocaleDateString("en-CA");
  const completed = exams.filter((e) => e.attempt?.submittedAt);
  const today = completed.filter(
    (e) => day(e.attempt!.submittedAt!) === day(now.getTime()),
  );
  const days = new Set(completed.map((e) => day(e.attempt!.submittedAt!)));
  let streak = 0;
  const cursor = new Date(now);
  if (!days.has(day(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(day(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    streak,
    practiced: today.filter((e) => e.kind === "practice").length,
    mocks: today.filter((e) => e.kind === "mock").length,
  };
}
export function CandidateHub({ user, exams, results = [] }: { user: User; exams: Exam[]; results?: Result[] }) {
  const hi = useLanguage().language === "hi";
  const stats = milestoneStats(exams);
  const topics = new Map<string, { correct: number; total: number }>();
  for (const result of results) for (const topic of result.topics) {
    const previous = topics.get(topic.topic) || { correct: 0, total: 0 };
    topics.set(topic.topic, { correct: previous.correct + topic.correct, total: previous.total + topic.total });
  }
  const mastered = [...topics.values()].filter(topic => topic.total >= 3 && topic.correct / topic.total >= .8).length;
  const hour = new Date().getHours();
  const greeting = hi
    ? hour < 12
      ? "सुप्रभात"
      : hour < 17
        ? "नमस्कार"
        : "शुभ संध्या"
    : hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening";
  return (
    <div className="candidate-hub">
      <section className="candidate-welcome" aria-labelledby="candidate-title">
        <div>
          <span className="hub-eyebrow">
            {hi ? "उम्मीदवार विश्लेषण" : "Candidate Analytics"}
          </span>
          <h1 id="candidate-title" tabIndex={-1}>
            {greeting}, {user.name.split(" ")[0]}!
          </h1>
          <p>
            {hi
              ? "नियमित अभ्यास जारी रखें — हर दिन परीक्षा की तैयारी बेहतर होती है।"
              : "Keep up the consistency — your daily practice builds exam readiness."}
          </p>
        </div>
        <div className="hub-streak">
          <Flame aria-hidden="true" />
          <strong>
            {stats.streak} {hi ? "दिन" : "Days"}
          </strong>
          <span>{hi ? "लगातार सक्रिय" : "Active Streak"}</span>
        </div>
      </section>
      <section aria-labelledby="milestones-title">
        <h2 id="milestones-title">
          {hi ? "आज की उपलब्धियाँ" : "Today's Milestones"}
        </h2>
        <dl className="hub-grid">
          <div>
            <dd>{mastered}</dd>
            <dt>{hi ? "पूरे किए अध्याय" : "Chapters Mastered"}</dt>
            <small>
              {hi
                ? "विषय में कम से कम 3 प्रश्नों पर 80% सही"
                : "Topic mastery: ≥80% across at least 3 questions"}
            </small>
          </div>
          <div>
            <dd>{stats.practiced}</dd>
            <dt>{hi ? "आज किया अभ्यास" : "Practiced Today"}</dt>
          </div>
          <div>
            <dd>{stats.mocks}</dd>
            <dt>{hi ? "मॉक प्रयास" : "Mocks Attempted"}</dt>
          </div>
        </dl>
        <p className="hub-note">
          {hi
            ? "हर परीक्षा के उपलब्ध नवीनतम जमा प्रयास पर आधारित।"
            : "Based on the latest recorded submission for each exam."}
        </p>
      </section>
      <section aria-labelledby="action-hub-title">
        <h2 id="action-hub-title">{hi ? "कार्य केंद्र" : "Action Hub"}</h2>
        <div className="hub-grid hub-actions">
          <Link href="/access-lab">
            <BookOpen aria-hidden="true" />
            <strong>{hi ? "सीखें" : "Learn"}</strong>
            <kbd>Alt+Shift+L</kbd>
          </Link>
          <Link href="/practice">
            <Target aria-hidden="true" />
            <strong>{hi ? "अभ्यास" : "Practice"}</strong>
            <kbd>Alt+Shift+P</kbd>
          </Link>
          <Link href="/exams">
            <Trophy aria-hidden="true" />
            <strong>{hi ? "परीक्षा दें" : "Perform"}</strong>
            <kbd>Alt+Shift+M</kbd>
          </Link>
        </div>
      </section>
    </div>
  );
}
