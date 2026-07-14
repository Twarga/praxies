# Praxis 30-Day Dogfood Runbook

This runbook starts only after the first real baseline journal. Do not create a
synthetic baseline: the trial is intended to measure normal daily use.

## Day 0 release checklist

- Install the current AppImage through `scripts/install.sh`.
- Run `scripts/install.sh --check` and record the installed version.
- Choose the journal folder and confirm it remains local.
- Complete onboarding, including microphone/camera and diagnostics checks.
- Connect or import the AI provider that will be used during the trial.
- Install and activate the intended transcription model.
- Record a genuine two-minute journal describing the 30-day objective.
- Confirm the session reaches `ready`, its report is understandable, and its
  first goal and exercise appear in Practice.
- Complete the post-report check-in. This is the baseline dogfood entry.
- Export the first weekly-summary JSON and keep it with trial notes.

## Daily loop, days 1-30

1. Open Today and read the current goal and exercise.
2. Record one normal journal; do not manufacture content for testing.
3. Wait for processing or record any recovery/error behavior.
4. Read the report and seek at least one evidence timestamp.
5. Complete the suggested exercise and the short report check-in.
6. Write friction in the check-in immediately, using concrete wording.

Missing one day is data, not a reason to restart. Note why it was missed.

## Weekly review, days 7, 14, 21, and 28

- Open Settings → Diagnostics → 30-day trial feedback.
- Export the local weekly summary.
- Review processing failures, report clarity, correction accuracy, practice
  follow-through, and repeated friction notes.
- Fix release-blocking defects, but log the version change and do not rewrite
  historical entries.

## Day 30 acceptance record

Record the following in the final summary:

- sessions attempted, ready, failed, and recovered;
- median recording and processing duration;
- report-understandable, correction-accurate, and will-practice ratios;
- goal completion rate and active days;
- repeated friction themes and the three highest-impact changes;
- whether any recording, transcript, report, or credential left local storage
  unexpectedly;
- exact Praxis version(s), provider/model labels, transcription model, Linux
  distribution, display server, and hardware profile.

The trial is complete only when 30 calendar days have elapsed and this record
is backed by the local `_dogfood/entries.jsonl` file and exported summaries.
