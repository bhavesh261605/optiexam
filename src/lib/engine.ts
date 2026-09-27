export function evaluate(
  questions: { id: string; correct?: number; marks: number; topic: string }[],
  answers: Record<string, { answer: number | null }>,
) {
  let score = 0,
    correct = 0,
    incorrect = 0,
    unanswered = 0;
  const topics = new Map<
    string,
    { topic: string; correct: number; total: number }
  >();
  for (const q of questions) {
    const topic = topics.get(q.topic) || {
      topic: q.topic,
      correct: 0,
      total: 0,
    };
    topic.total++;
    const answer = answers[q.id]?.answer;
    if (answer === undefined || answer === null) unanswered++;
    else if (answer === q.correct) {
      score += q.marks;
      correct++;
      topic.correct++;
    } else incorrect++;
    topics.set(q.topic, topic);
  }
  return {
    score,
    correct,
    incorrect,
    unanswered,
    maxScore: questions.reduce((sum, q) => sum + q.marks, 0),
    topics: [...topics.values()],
  };
}
export function canWrite(status: string, deadline: number, now = Date.now()) {
  return status === "in_progress" && now < deadline;
}
