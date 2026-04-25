const GALLERY_LANGUAGE_FILTERS = ["all", "en", "fr", "es"];

const GALLERY_LANGUAGE_LABELS = {
  all: "all",
  en: "en",
  fr: "fr",
  es: "es",
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

export function formatGallerySessionMeta(createdAt, language) {
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  })
    .format(new Date(createdAt))
    .replace(",", "")
    .toLowerCase();

  return `${dateLabel} · ${language}`;
}

export function formatGalleryDurationPill(durationSeconds) {
  const totalMinutes = Math.max(1, Math.round((durationSeconds ?? 0) / 60));
  return `${totalMinutes}m`;
}

export function getGallerySessionStatus(session) {
  if (!session) {
    return null;
  }

  if (session.status === "failed") {
    return "failed · retry?";
  }

  if (session.status === "needs_attention") {
    return "needs attention";
  }

  if (session.status === "transcribing") {
    return "transcribing…";
  }

  if (session.status !== "ready" && session.status !== "done" && session.status !== "saved" && !session.read) {
    return "unread";
  }

  if (!session.read) {
    return "unread";
  }

  return null;
}

export function getGalleryEmptyState(languageFilter, hasAnySessions) {
  if (hasAnySessions) {
    if (!languageFilter || languageFilter === "all") {
      return null;
    }

    const languageNames = {
      en: "english",
      fr: "french",
      es: "spanish",
    };

    return `no ${languageNames[languageFilter] ?? languageFilter} sessions yet.`;
  }

  return "no sessions yet. go record one.";
}
