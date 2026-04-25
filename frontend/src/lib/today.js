export function formatTodayDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(value);

  const weekday = parts.find((part) => part.type === "weekday")?.value?.toLowerCase() ?? "";
  const day = parts.find((part) => part.type === "day")?.value?.toLowerCase() ?? "";
  const month = parts.find((part) => part.type === "month")?.value?.toLowerCase() ?? "";
  const year = parts.find((part) => part.type === "year")?.value?.toLowerCase() ?? "";
  return `${weekday} · ${day} ${month} ${year}`;
}

export function isSameLocalDay(dateValue, target = new Date()) {
  const left = new Date(dateValue);
  return (
    left.getFullYear() === target.getFullYear() &&
    left.getMonth() === target.getMonth() &&
    left.getDate() === target.getDate()
  );
}

export function getTodaySessionCount(sessions, target = new Date()) {
  return (sessions ?? []).filter((session) => isSameLocalDay(session.created_at, target)).length;
}

export function getTodayStatusLine(sessions, target = new Date()) {
  const todayCount = getTodaySessionCount(sessions, target);
  if (todayCount === 0) {
    return "you haven't recorded today yet.";
  }

  if (todayCount === 1) {
    return "you recorded 1 session today.";
  }

  return `you recorded ${todayCount} sessions today.`;
}
