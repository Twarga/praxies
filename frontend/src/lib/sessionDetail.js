const SESSION_LANGUAGE_NAMES = {
  en: "english",
  fr: "french",
  es: "spanish",
  tmz: "tamazight",
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

export function formatSessionDetailLanguage(language) {
  return SESSION_LANGUAGE_NAMES[language] ?? language;
}

export function getSessionDetailStatusTone(status) {
  if (status === "failed") {
    return "error";
  }

  return "accent";
}
