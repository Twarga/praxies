const READY_SOUND_FREQUENCY = 880;
const READY_SOUND_DURATION_SECONDS = 0.12;

const RECORDING_PROFILES = {
  "480p": {
    width: 854,
    height: 480,
    frameRate: 30,
    videoBitsPerSecond: 6_000_000,
  },
  "720p": {
    width: 1280,
    height: 720,
    frameRate: 60,
    videoBitsPerSecond: 12_000_000,
  },
  "1080p": {
    width: 1920,
    height: 1080,
    frameRate: 60,
    videoBitsPerSecond: 20_000_000,
  },
};

export const DEFAULT_RECORDING_QUALITY = "720p";

export const RECORDING_PERMISSION_COPY = {
  denied: "camera or microphone access not allowed. enable it in system settings.",
  idle: "press start to open your camera and microphone.",
  requesting: "requesting camera and microphone access…",
};

function buildCameraConstraints(videoQuality = DEFAULT_RECORDING_QUALITY) {
  const profile = getRecordingProfile(videoQuality);

  return {
    video: {
      aspectRatio: { ideal: profile.width / profile.height },
      facingMode: "user",
      width: { ideal: profile.width, max: profile.width },
      height: { ideal: profile.height, max: profile.height },
      frameRate: { ideal: profile.frameRate, max: profile.frameRate },
    },
    audio: {
      autoGainControl: true,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  };
}

export function getRecordingPermissionMessage(permissionState) {
  if (permissionState === "requesting") {
    return RECORDING_PERMISSION_COPY.requesting;
  }

  if (permissionState === "denied") {
    return RECORDING_PERMISSION_COPY.denied;
  }

  return RECORDING_PERMISSION_COPY.idle;
}

export function getRecordingProfile(videoQuality = DEFAULT_RECORDING_QUALITY) {
  return RECORDING_PROFILES[videoQuality] ?? RECORDING_PROFILES[DEFAULT_RECORDING_QUALITY];
}

export function isPermissionDeniedError(error) {
  const errorName = error?.name ?? "";
  return errorName === "NotAllowedError" || errorName === "SecurityError";
}

export async function playReadySound() {
  const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startTime = context.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(READY_SOUND_FREQUENCY, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.08, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime + READY_SOUND_DURATION_SECONDS,
  );

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + READY_SOUND_DURATION_SECONDS);

  await new Promise((resolve) => {
    oscillator.onended = () => resolve();
  });

  await context.close();
}

export async function requestRecordingStream(
  mediaDevices = globalThis.navigator?.mediaDevices,
  { videoQuality = DEFAULT_RECORDING_QUALITY } = {},
) {
  if (!mediaDevices?.getUserMedia) {
    throw new Error("Camera capture is not available.");
  }

  const stream = await mediaDevices.getUserMedia(buildCameraConstraints(videoQuality));

  for (const track of stream.getVideoTracks()) {
    try {
      track.contentHint = "motion";
    } catch {}
  }

  for (const track of stream.getAudioTracks()) {
    try {
      track.contentHint = "speech";
    } catch {}
  }

  return stream;
}

export function stopMediaStream(stream) {
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }
}
