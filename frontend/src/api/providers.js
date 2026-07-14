import { apiFetchJson } from "./client.js";

export function listProviders() {
  return apiFetchJson("/api/providers");
}

export function getProvider(providerId) {
  return apiFetchJson(`/api/providers/${encodeURIComponent(providerId)}`);
}

export function listConnections() {
  return apiFetchJson("/api/providers/connections");
}

export function createConnection(payload) {
  return apiFetchJson("/api/providers/connections", {
    method: "POST",
    body: payload,
  });
}

export function updateConnection(connectionId, payload) {
  return apiFetchJson(`/api/providers/connections/${encodeURIComponent(connectionId)}`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteConnection(connectionId) {
  return apiFetchJson(`/api/providers/connections/${encodeURIComponent(connectionId)}`, {
    method: "DELETE",
  });
}

export function getConnectionModels(connectionId) {
  return apiFetchJson(`/api/providers/connections/${encodeURIComponent(connectionId)}/models`);
}

export function refreshConnectionModels(connectionId) {
  return apiFetchJson(`/api/providers/connections/${encodeURIComponent(connectionId)}/refresh-models`, {
    method: "POST",
  });
}

export function testConnectionModel(connectionId, modelId) {
  return apiFetchJson(`/api/providers/connections/${encodeURIComponent(connectionId)}/test`, {
    method: "POST",
    body: modelId ? { model_id: modelId } : undefined,
  });
}
