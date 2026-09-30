"use client";
import { useLanguage } from "./language";
import type { Result } from "@/lib/types";

export function AnalyticsDashboard({ results }: { results: Result[] }) {
  const { t } = useLanguage();
  return (
    <section className="panel section" aria-labelledby="linear-analytics-title">
      <h2 id="linear-analytics-title">{t("Assessment data as tables")}</h2>
      <p>
        {t(
          " Compare your own attempts. Time includes reading, reviewing and interruptions; it is not a measure of disability or ability. ",
        )}
      </p>
      {!results.length ? (
        <p>{t("No completed assessments yet.")}</p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <caption>{t("Scores and elapsed time per assessment")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("Assessment")}</th>
                  <th scope="col">{t("Score")}</th>
                  <th scope="col">{t("Correct")}</th>
                  <th scope="col">{t("Unanswered")}</th>
                  <th scope="col">{t("Elapsed minutes")}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id}>
                    <th scope="row">{t(result.title)}</th>
                    <td>
                      {t(result.score)} {t(" / ")}
                      {t(result.maxScore)}
                    </td>
                    <td>{t(result.correct)}</td>
                    <td>{t(result.unanswered)}</td>
                    <td>
                      {t(
                        result.submittedAt === null
                          ? "Not available"
                          : Math.max(
                              0,
                              (result.submittedAt - result.startedAt) / 60000,
                            ).toFixed(1),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {results.map((result) => (
            <div className="table-wrap" key={result.id}>
              <table>
                <caption>
                  {t(result.title)} {t(" — question review and time")}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t("Question")}</th>
                    <th scope="col">{t("Topic")}</th>
                    <th scope="col">{t("Response")}</th>
                    <th scope="col">{t("Marked for review")}</th>
                    <th scope="col">{t("Time on question")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.questions.map((question, index) => (
                    <tr key={question.id}>
                      <th scope="row">
                        {t(index + 1)}
                        {t(". ")}
                        {t(question.prompt)}
                      </th>
                      <td>{t(question.topic)}</td>
                      <td>
                        {t(
                          result.answers[question.id]?.answer == null
                            ? "Unanswered"
                            : question.options[
                                result.answers[question.id].answer!
                              ],
                        )}
                      </td>
                      <td>
                        {t(result.answers[question.id]?.review ? "Yes" : "No")}
                      </td>
                      <td>
                        {t(
                          result.questionSeconds
                            ? `${Math.round(result.questionSeconds[question.id] || 0)} seconds (approximate)`
                            : "Not recorded",
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p>
            {t(
              " Question time is approximate, reported by the browser while the page is visible and focused. Interruptions, connectivity loss and the final few seconds may be missing. Historical attempts show Not recorded. It never changes your score. ",
            )}
          </p>
        </>
      )}
    </section>
  );
}
