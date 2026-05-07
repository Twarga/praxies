# T179 Partial Calibration Notes

Date: 2026-05-07

## Scope

This is a partial calibration pass using the copied journal data in:

`/home/twarga/Documents/praxis/TwargaJournal`

It does not complete T179 because the available data does not cover English, French, and Spanish with fresh v2 coaching analyses.

## Available Data

- 21 sessions total.
- 20 English sessions.
- 1 Spanish session, but it is `video_only`.
- 0 French sessions.
- 18 English transcripts.
- 15 English analyses.
- Existing analyses are all schema v1.
- Existing analyses do not contain the new `coaching_report`, `scorecard`, or `language_coach` fields.

## Observations From Existing English Sessions

Most copied sessions are short development/test recordings rather than full reflective journal entries. Common transcript types:

- App recording tests.
- UI status updates.
- Subtitle/export tests.
- Very short sign-offs such as "Thank you."
- One longer English session about streaks, sleep, planning, LibrePilot, RAG, and language fluency.

The old v1 reports correctly noticed repeated problems, but often read like compact critique cards:

- "No substantive content."
- "Brief, functional test log."
- "A rambling, unfocused session."
- "Weak conclusions."
- "Plan without ship."

Those observations are useful, but the report style is not yet the desired product experience. The new v2 report should explain the lesson, show moments, and assign practice.

## Prompt Calibration Change Made

The analysis prompt now explicitly handles short or technical-test sessions:

- It must say plainly when there is not enough real journal material.
- It must not invent emotional depth.
- It should teach how to make the next recording analyzable.
- It should push the user toward one topic, at least two minutes of speech, one concrete example, and one closing action.

This matters because many real copied sessions are app-test recordings. Without this instruction, a strong model may over-coach thin content and produce fake depth.

## Expected Good Output For These Sessions

For short test sessions, a good v2 report should say:

- This was mostly a technical test, not a full journal entry.
- The useful lesson is to separate app testing from reflection practice.
- Next session goal: speak for two minutes on one concrete topic.
- Practice assignment: answer one direct question, give one example, end with one action.

For the longer `2026-05-02_en_take-2` session, a good v2 report should identify:

- Topic drift across streaks, sleep, business planning, LibrePilot, RAG, and English self-assessment.
- The strongest coaching opportunity: choose one subject and return to it at the end.
- Language gap: overuse of vague intensifiers such as "a lot", "very", "like", and repeated phrasing.
- Next practice: explain one technical idea, such as RAG, in one clean sentence, then one example.

## What Still Blocks Full T179

To complete T179 honestly:

- Generate fresh v2 analyses for at least 10 real recordings.
- Include English, French, and Spanish.
- Confirm the report prose stays in the session language.
- Confirm the output is readable, not just small bullet summaries.
- Confirm each report gives a specific practice assignment.
- Tune the prompt again from those real v2 outputs.

## Recommended Recording Set

- 4 English reflective sessions.
- 3 French reflective sessions.
- 3 Spanish reflective sessions.

Each should be at least two minutes and should follow this shape:

1. State one topic.
2. Give one concrete example.
3. Explain why it matters.
4. End with one next action.

