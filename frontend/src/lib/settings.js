export const LANGUAGE_LABELS = {
  en: "english",
  fr: "french",
  es: "spanish",
  tmz: "tamazight",
};

export const VIDEO_QUALITY_OPTIONS = ["480p", "720p", "1080p"];
export const LANGUAGE_OPTIONS = ["en", "fr", "es", "tmz"];
export const RETENTION_OPTIONS = [7, 14, 30, 60, 90];
export const WHISPER_MODEL_OPTIONS = [
  "tiny",
  "base",
  "small",
  "medium",
  "large-v3",
  "large-v3-turbo",
];
export const OPENROUTER_MODEL_PRESETS = [
  "google/gemini-2.5-flash-lite",
  "openai/gpt-4.1-mini",
  "anthropic/claude-3.7-sonnet",
];

export function formatRetentionValue(days) {
  return `${days} days, then audio-only`;
}

export function formatBooleanToggle(value) {
  return value ? "on" : "off";
}

export function formatLanguageValue(languageCode) {
  return LANGUAGE_LABELS[languageCode] ?? languageCode;
}
