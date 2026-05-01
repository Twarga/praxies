export function getRailRecordSlotState(index) {
  const latestSession = index?.sessions?.[0];
  if (!latestSession) {
    return {
      kind: "record",
      label: "record",
      sessionId: null,
      clickable: true,
    };
  }

  if (latestSession.status === "transcribing" || latestSession.status === "queued") {
    return {
      kind: "status",
      label: "transcribing · …",
      sessionId: latestSession.id,
      clickable: false,
    };
  }

  if (latestSession.status === "analyzing") {
    return {
      kind: "status",
      label: "analyzing · …",
      sessionId: latestSession.id,
      clickable: false,
    };
  }

  if (latestSession.status === "ready" || latestSession.status === "done") {
    return {
      kind: "record",
      label: "record",
      sessionId: null,
      clickable: true,
    };
  }

  if (latestSession.status === "needs_attention" || latestSession.status === "failed") {
    return {
      kind: "record",
      label: "record",
      sessionId: null,
      clickable: true,
    };
  }

  return {
    kind: "record",
    label: "record",
    sessionId: null,
    clickable: true,
  };
}
