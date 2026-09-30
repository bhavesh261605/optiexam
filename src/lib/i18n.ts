import hindi from "./hi.json";
import learning from "./hi-learning.json";
export type Language = "en" | "hi";
const messages: Record<string, string> = { ...hindi, ...learning };

export function translate(text: string, language: Language): string {
  if (language !== "hi" || !text.trim()) return text;
  const key = text.trim().replace(/\s+/g, " ");
  let value = messages[key];
  if (!value) {
    value = key
      .replace(/^(.+) · Candidate$/, "$1 · उम्मीदवार")
      .replace(/^QUESTION (\d+) OF (\d+)$/, "प्रश्न $1, कुल $2")
      .replace(/^Question (\d+) of (\d+)\./, "प्रश्न $1, कुल $2।")
      .replace(
        /^Question (\d+), (answered|unanswered)(, marked for review)?$/,
        (_, n, answered, review) =>
          `प्रश्न ${n}, ${answered === "answered" ? "उत्तर दिया गया" : "अनुत्तरित"}${review ? ", समीक्षा के लिए चिह्नित" : ""}`,
      )
      .replace(/^(\d+) answered$/, "$1 उत्तर दिए गए")
      .replace(
        /^(\d+) minutes (\d+) seconds remaining$/,
        "$1 मिनट $2 सेकंड शेष",
      )
      .replace(
        /^Time remaining: (\d+) minutes (\d+) seconds\.$/,
        "शेष समय: $1 मिनट $2 सेकंड।",
      )
      .replace(/^Record sample (\d+) of 3$/, "3 में से नमूना $1 रिकॉर्ड करें")
      .replace(/^Record sign-in phrase$/, "साइन इन वाक्यांश रिकॉर्ड करें")
      .replace(
        /^Sample (\d+) recorded\. Read the next phrase and record sample (\d+)\.$/,
        "नमूना $1 रिकॉर्ड किया गया। अगला वाक्यांश पढ़ें और नमूना $2 रिकॉर्ड करें।",
      );
  }
  return value ? text.replace(text.trim(), value) : text;
}

export function speechText(text: string, language: Language): string {
  if (language !== "hi") return text;
  // Only authored catalogue entries are translated; never translate candidate answers.
  return Object.keys(messages)
    .filter((key) => key.length > 12)
    .sort((a, b) => b.length - a.length)
    .reduce(
      (value, key) => value.split(key).join(messages[key]),
      translate(text, language),
    );
}

export function configureVoice(
  utterance: SpeechSynthesisUtterance,
  language: Language,
) {
  utterance.lang = language === "hi" ? "hi-IN" : "en-IN";
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find(
      (item) => item.lang.toLowerCase() === utterance.lang.toLowerCase(),
    ) ||
    voices.find(
      (item) => item.lang.toLowerCase().split(/[-_]/)[0] === language,
    );
  if (voice) utterance.voice = voice;
  if (language === "hi" && voices.length && !voice)
    throw new Error(
      "इस डिवाइस पर हिंदी आवाज़ उपलब्ध नहीं है। अपने ब्राउज़र या सिस्टम में हिंदी आवाज़ जोड़ें। पाठ और कीबोर्ड उपलब्ध हैं।",
    );
}
