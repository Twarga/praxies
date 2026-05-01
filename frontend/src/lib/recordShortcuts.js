const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isEditableTarget(target) {
  if (!target) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return EDITABLE_TAGS.has(target.tagName);
}

export function getRecordShortcutAction({
  event,
  permissionState,
  recorderState,
  showDiscardConfirm = false,
}) {
  if (isEditableTarget(event.target)) {
    return null;
  }

  const normalizedKey = event.key?.toLowerCase();

  if (event.code === "Space") {
    if (recorderState === "idle" && permissionState !== "requesting") {
      return "start";
    }

    if (recorderState === "recording") {
      return "pause";
    }

    if (recorderState === "paused") {
      return "resume";
    }
  }

  if (normalizedKey === "s" && (recorderState === "recording" || recorderState === "paused")) {
    return "stop";
  }

  if (normalizedKey === "enter" && recorderState === "stopped") {
    return "save-full";
  }

  if (normalizedKey === "d" && recorderState === "stopped") {
    return "discard";
  }

  if (normalizedKey === "escape") {
    if (recorderState === "idle") {
      return "back";
    }

    if (recorderState === "stopped") {
      return showDiscardConfirm ? "cancel-discard" : "back";
    }
  }

  return null;
}
