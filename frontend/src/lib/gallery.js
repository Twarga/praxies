const GALLERY_LANGUAGE_FILTERS = ["all", "en", "fr", "es", "tmz"];

const GALLERY_LANGUAGE_LABELS = {
  all: "all",
  en: "en",
  fr: "fr",
  es: "es",
  tmz: "tmz",
};

export function getGalleryLanguageFilters() {
  return GALLERY_LANGUAGE_FILTERS;
}

export function getGalleryLanguageLabel(language) {
  return GALLERY_LANGUAGE_LABELS[language] ?? language;
}

export function filterGallerySessions(sessions, languageFilter) {
  if (!Array.isArray(sessions)) {
    return [];
  }

  if (!languageFilter || languageFilter === "all") {
    return sessions;
  }

  return sessions.filter((session) => session.language === languageFilter);
}
