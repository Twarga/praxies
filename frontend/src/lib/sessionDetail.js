const SESSION_LANGUAGE_NAMES = {
  en: "english",
  fr: "french",
  es: "spanish",
};

export function formatSessionDetailDate(createdAt) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(new Date(createdAt));

  return parts
    .filter((part) => part.type !== "literal")
    .map((part) => part.value.toLowerCase())
    .join(" ");
}

export function formatSessionDetailDuration(durationSeconds) {
  const totalMinutes = Math.max(1, Math.round((durationSeconds ?? 0) / 60));
  return `${totalMinutes} min`;
}

export function formatSessionDetailTimestamp(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds ?? 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function formatTranscriptSegmentTimestamp(totalSeconds) {
  return `[${formatSessionDetailTimestamp(totalSeconds)}]`;
}

export function isTranscriptSegmentActive(segment, currentPlaybackTime) {
  if (!segment) {
    return false;
  }

  const startSeconds = Number(segment.start_seconds ?? 0);
  const endSeconds = Number(segment.end_seconds ?? startSeconds);
  const playbackTime = Number(currentPlaybackTime ?? 0);
  const upperBound = endSeconds > startSeconds ? endSeconds : Number.POSITIVE_INFINITY;

  return playbackTime >= startSeconds && playbackTime < upperBound;
}

export function formatSessionDetailLanguage(language) {
  return SESSION_LANGUAGE_NAMES[language] ?? language;
}

export function getSessionDetailStatusTone(status) {
  if (status === "failed") {
    return "error";
  }

  return "accent";
}

export function shouldMarkSessionRead(activeTab, session) {
  if (activeTab !== "analysis") {
    return false;
  }

  if (!session?.analysis) {
    return false;
  }

  return session?.meta?.read === false;
}
