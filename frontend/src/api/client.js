export async function apiFetchJson(path, options = {}) {
  const response = await fetch(path, {
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
