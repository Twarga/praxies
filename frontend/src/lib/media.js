export const DEFAULT_RECORDING_CONSTRAINTS = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: "user",
  },
  audio: true,
};

export const RECORDING_PERMISSION_COPY = {
  denied: "camera access not allowed. enable it in system settings.",
  requesting: "requesting camera and mic access…",
};

export function getRecordingPermissionMessage(permissionState) {
  if (permissionState === "requesting") {
    return RECORDING_PERMISSION_COPY.requesting;
  }

  return RECORDING_PERMISSION_COPY.denied;
}

export function isPermissionDeniedError(error) {
  const errorName = error?.name ?? "";
  return errorName === "NotAllowedError" || errorName === "SecurityError";
}

export async function requestRecordingStream(
  mediaDevices = globalThis.navigator?.mediaDevices,
  constraints = DEFAULT_RECORDING_CONSTRAINTS,
) {
  if (!mediaDevices?.getUserMedia) {
    throw new Error("Camera access not available.");
  }

  return mediaDevices.getUserMedia(constraints);
}

export function stopMediaStream(stream) {
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }
}
