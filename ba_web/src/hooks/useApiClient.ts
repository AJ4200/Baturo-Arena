import { useState } from "react";
import { API_BASE_URL } from "@/lib/constants";

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
      const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Request failed");
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
