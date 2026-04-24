const BEFORE_UNLOAD_GUARDED_STATES = new Set(["recording", "paused", "stopping"]);

export function shouldWarnBeforeUnload(recorderState) {
  return BEFORE_UNLOAD_GUARDED_STATES.has(recorderState);
}

export function createBeforeUnloadHandler(recorderState) {
  return function handleBeforeUnload(event) {
    if (!shouldWarnBeforeUnload(recorderState)) {
      return undefined;
    }

    event.preventDefault();
    event.returnValue = "";
    return "";
  };
}
