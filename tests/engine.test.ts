import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, canWrite } from "../src/lib/engine.ts";
test("scoring preserves zero-index options, weights, and unanswered counts", () => {
  const questions = [
    { id: "a", correct: 0, marks: 2, topic: "Math" },
    { id: "b", correct: 1, marks: 3, topic: "Math" },
    { id: "c", correct: 2, marks: 1, topic: "Verbal" },
  ];
  const result = evaluate(questions, { a: { answer: 0 }, b: { answer: 0 } });
  assert.deepEqual(result, {
    score: 2,
    correct: 1,
    incorrect: 1,
    unanswered: 1,
    maxScore: 6,
    topics: [
      { topic: "Math", correct: 1, total: 2 },
      { topic: "Verbal", correct: 0, total: 1 },
    ],
  });
});
test("cleared answers score as unanswered", () => {
  assert.equal(
    evaluate([{ id: "a", correct: 0, marks: 1, topic: "Math" }], {
      a: { answer: null },
    }).unanswered,
    1,
  );
});
test("deadline boundary excludes late writes and submitted attempts", () => {
  assert.equal(canWrite("in_progress", 100, 99), true);
  assert.equal(canWrite("in_progress", 100, 100), false);
  assert.equal(canWrite("evaluated", 100, 99), false);
});
