export const DEFAULT_RECORDING_CONSTRAINTS = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: "user",
  },
  audio: true,
};

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
