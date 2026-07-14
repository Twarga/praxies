export const LANGUAGE_LABELS = {
  en: "english",
  fr: "french",
  es: "spanish",
};

export const VIDEO_QUALITY_OPTIONS = ["480p", "720p", "1080p"];
export const LANGUAGE_OPTIONS = ["en", "fr", "es"];
export const RETENTION_OPTIONS = [7, 14, 30, 60, 90];
export const WHISPER_MODEL_OPTIONS = [];
export const OPENROUTER_MODEL_PRESETS = [];

export function formatRetentionValue(days) {
  return `${days} days, then audio-only`;
}

export function formatBooleanToggle(value) {
  return value ? "on" : "off";
}

export function formatLanguageValue(languageCode) {
  return LANGUAGE_LABELS[languageCode] ?? languageCode;
}
