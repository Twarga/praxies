const API_BASE_URL = "http://127.0.0.1:8000";

export function buildApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export async function apiFetchText(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    headers: {
      Accept: "text/plain, application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const errorPayload = await response.json();
      if (typeof errorPayload?.detail === "string" && errorPayload.detail.trim()) {
        message = errorPayload.detail;
      }
    } catch {
      const responseText = await response.text().catch(() => "");
      if (responseText.trim()) {
        message = responseText.trim();
      } else if (response.statusText) {
        message = response.statusText;
      }
    }

    throw new Error(message);
  }

  return response.text();
}

export async function apiFetchJson(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const errorPayload = await response.json();
      if (typeof errorPayload?.detail === "string" && errorPayload.detail.trim()) {
        message = errorPayload.detail;
      }
    } catch {
      // Fall back to the HTTP status message when the response is not JSON.
      if (response.statusText) {
        message = response.statusText;
      }
    }

    throw new Error(message);
  }

  return response.json();
}
