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

export function formatGalleryMonthLabel(createdAt) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  })
    .format(new Date(createdAt))
    .toLowerCase();
}

export function groupGallerySessionsByMonth(sessions) {
  const groups = [];
  const monthIndex = new Map();

  for (const session of sessions ?? []) {
    const monthKey = formatGalleryMonthLabel(session.created_at);
    if (!monthIndex.has(monthKey)) {
      const nextGroup = { label: monthKey, sessions: [] };
      monthIndex.set(monthKey, nextGroup);
      groups.push(nextGroup);
    }

    monthIndex.get(monthKey).sessions.push(session);
  }

  return groups;
}
