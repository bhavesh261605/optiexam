"use client";
import { useLanguage } from "./language";
import { useEffect, useState } from "react";
import { ExamControls } from "./ExamControls";
import { AccessibleChart, AccessibleEquation } from "./AccessibleContent";
import { PageHeading } from "./shared";

export function AudioPractice({
  userId,
  audioEnabled,
}: {
  userId: string;
  audioEnabled: boolean;
}) {
  const { t } = useLanguage();
  const key = `optiexam-audio-practice-${userId}`;
  const [answer, setAnswer] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState("");
  useEffect(() => {
    try {
      setAnswer(localStorage.getItem(key) || "");
    } catch {}
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, answer);
      setSaved("Practice draft saved in this browser.");
    } catch {
      setSaved(
        "Draft cannot be saved in this browser. Keep a copy before leaving.",
      );
    }
  }, [answer, key, loaded]);
  return (
    <>
      <PageHeading
        eyebrow={t("UNTIMED PRACTICE")}
        title={t("Audio and accessible content lab")}
      >
        {t(
          " Try dictation, equation reading and detailed chart alternatives. This practice does not use an exam attempt. ",
        )}
      </PageHeading>
      <p>
        {t(
          " Explain how the number of books read changed from January to March. Include the total and a comparison. ",
        )}
      </p>
      <AccessibleChart
        title={t("Books read")}
        description={t(
          "Books read increased each month. The table lists each month and its count.",
        )}
        columns={["Month", "Books read"]}
        rows={[
          ["January", 40],
          ["February", 55],
          ["March", 70],
        ]}
      />
      <AccessibleEquation
        description={t(
          "One half equals zero point five. The fraction has numerator one and denominator two.",
        )}
        equation={{
          tag: "mrow",
          children: [
            {
              tag: "mfrac",
              children: [
                { tag: "mn", text: "1" },
                { tag: "mn", text: "2" },
              ],
            },
            { tag: "mo", text: "=" },
            { tag: "mn", text: "0.5" },
          ],
        }}
      />
      <ExamControls
        text={t(
          "Explain how the number of books read changed from January to March. January: 40 books. February: 55 books. March: 70 books. Include the total and a comparison.",
        )}
        value={answer}
        onChange={setAnswer}
        enabled={audioEnabled}
      />
      <p role="status">{t(saved)}</p>
      <p>
        {t("Your draft stays in this browser. It is not submitted or graded.")}
      </p>
    </>
  );
}
