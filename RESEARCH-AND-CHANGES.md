# SIH 4.0 research and implementation notes

Reviewed September 27, 2026. This review uses public first-party documentation, not hands-on access to Pearson’s licensed examination systems or a formal comparative accessibility audit.

## What the references establish

| Reference | Supported observation | Implemented response |
| --- | --- | --- |
| [Pearson VUE accommodations](https://www.pearsonvue.com/us/en/test-takers/accommodations.html) | Accommodations are individualized by the testing program and can include extra time, breaks, and separate rooms. | Administrators can set candidate-specific extra minutes; instructions show the allowance, and the server snapshots it into the attempt. Break scheduling is not implemented. |
| [Pearson NCLEX accommodations process](https://webhelp.pearsonvue.com/WebHelp/NCLEX/Accommodations_Process.htm) | This program’s delivery software includes approved extra time and adjustable font size/contrast. Administrators follow defined accommodation procedures. This is program-specific evidence. | Display preferences and exam allowances have separate responsibilities. Candidates control presentation; administrators approve time. Existing attempt deadlines cannot be changed by editing the exam. |
| [Perkins: accessible MAP assessments](https://www.perkins.org/resource/accessibility-map-assessments-series-1-introduction/) | Perkins describes an existing accessible assessment ecosystem using familiar assistive tools, text alternatives, and warmup questions. The article is historical and is not evidence of present-day compatibility for every device. | Add an untimed, repeatable Access Lab using the exam’s native answer, review, and confirmation patterns. It creates no exam attempt and has no score. |
| [Perkins: screen-reader reading practice](https://www.perkins.org/resource/reading-efficiently-screen-reader-reading-paragraphs/) | Structured navigation and practice before assessment help students organize and access content. | Provide discoverable navigation practice and keep heading structure and question controls predictable. |
| [Harvard: getting started with NVDA](https://accessibility.huit.harvard.edu/nvda) | Test content order, labels, interactive controls, form feedback, dialogs, and focus without a mouse. NVDA changes how keyboard input works. | Add NVDA-specific guidance and a screen-reader preset that disables competing browser speech and optional letter shortcuts. Continue keyboard and axe regression testing. |
| [NV Access](https://www.nvaccess.org/download/) | NVDA is NV Access’s screen reader, not a Harvard product. | Link to the official download and Harvard’s testing guidance separately. No NVDA integration or certification is claimed. |

## Product positioning

The useful goal is a consistent prepare–practice–examine–reflect workflow in one accessible workspace. The sources do **not** support claiming that accessible assessment ecosystems do not exist, or that SIH 4.0 is uniquely first to provide one. Differentiation and unmet demand remain hypotheses requiring interviews and comparative product testing.

“Standardized” here means the prototype reuses navigation, answer controls, review behavior, preferences, and result presentation across its own workflows. It does not imply an institutional certification or compliance with an assessment interchange standard.

## Working changes

- Refreshed SIH 4.0 identity, navy navigation, clearer text hierarchy, a four-stage journey bar, and a persistent access-preference summary.
- Untimed Access Lab with answer selection, mark-for-review, keyboard confirmation practice, repeat access, and persisted familiarization status.
- Screen-reader preset and guidance for NVDA browse/focus modes, headings, elements lists, and native radio groups.
- Candidate-specific approved extra minutes. The server calculates the deadline; neither client-supplied fields nor later exam edits change an existing deadline.
- Optional server-side question-order randomization. It is performed once at attempt creation and remains stable on reload. Answer option order is unchanged.
- Learning insights from actual completed attempts: subject accuracy, answer coverage, assessment history, and an answer-based practice suggestion.
- Per-result context: elapsed time, allowed time, approved extra minutes, answer changes, cleared review flags, and presentation settings recorded at start.
- Optional self-reported navigation independence and access barriers, saved with the attempt and visible to administrators. Scores do not change.

## Interpretation and boundaries

These metrics are descriptive product feedback, not validated measures of visual impairment. Timing includes time away from the page; it is not active reading time. Initial preferences are not proof that a tool was used. Independent navigation is explicitly self-reported. No clicks, tool settings, reading speeds, or focus changes are converted into misconduct flags.

Answer changes count a change away from an existing nonempty answer, including clearing it. Retrying the same saved value does not add another change. Review resolution counts previously marked questions whose flag is now clear. Older attempts show unavailable counters as a dash rather than pretending the new metrics were recorded.

Randomized order, server-only answer keys, ownership checks, deadline enforcement, locked submissions, and audit events improve attempt integrity. They do not prevent impersonation, outside assistance, or every form of cheating. No webcam, eye tracking, focus lock, clipboard restriction, screen-reader detection, or covert telemetry was added.

Manual NVDA testing and user testing with visually impaired candidates are still required. Supabase/PostgreSQL, production identity, and deployment remain the integration work identified in the README. Local demo sessions are not high-stakes examination authentication.
