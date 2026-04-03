import { useState } from "react";
import { API_BASE_URL, STORAGE_KEYS } from "@/lib/constants";

function readValidAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(STORAGE_KEYS.authToken);
  if (!token) {
    return null;
  }

  const expiresAt = window.localStorage.getItem(STORAGE_KEYS.authTokenExpiresAt);
  if (!expiresAt) {
    window.localStorage.removeItem(STORAGE_KEYS.authToken);
    return null;
  }

  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    window.localStorage.removeItem(STORAGE_KEYS.authToken);
    window.localStorage.removeItem(STORAGE_KEYS.authTokenExpiresAt);
    return null;
  }

  return token;
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (_error) {
    return {};
  }
}

export function useApiClient() {
  const [activeRequests, setActiveRequests] = useState(0);

  const runWithLoader = async <T,>(
    task: () => Promise<T>,
    showLoader = true
  ): Promise<T> => {
    if (showLoader) {
      setActiveRequests((current) => current + 1);
    }
    try {
      return await task();
    } finally {
      if (showLoader) {
        setActiveRequests((current) => Math.max(0, current - 1));
      }
    }
  };

  const callApi = async <T,>(
    path: string,
    init?: RequestInit,
    showLoader = true
  ): Promise<T> => {
    return runWithLoader(async () => {
      const headers = new Headers(init?.headers || undefined);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const authToken = readValidAuthToken();
      if (authToken && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${authToken}`);
      }

      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers,
      });

      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        if (response.status === 401 && typeof window !== "undefined") {
          window.localStorage.removeItem(STORAGE_KEYS.authToken);
          window.localStorage.removeItem(STORAGE_KEYS.authTokenExpiresAt);
        }
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Request failed"
        );
      }

      return payload as T;
    }, showLoader);
  };

  return {
    activeRequests,
    runWithLoader,
    callApi,
  };
}
