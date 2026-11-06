import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const apiOrigin = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  window.dispatchEvent(new CustomEvent("auth:session-expired"));
}

/**
 * Shared Axios client configured for backend API base URL and auth/session handling.
 *
 * Side effects:
 * - Adds bearer access token from local storage to outgoing requests.
 * - On 401, attempts one silent refresh via `/auth/refresh` before clearing the session.
 */
export const apiClient = axios.create({
  baseURL: apiOrigin,
});

let refreshPromise: Promise<void> | null = null;

async function refreshSession() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) throw new Error("missing refresh token");
  const res = await axios.post<{ token: string; refreshToken: string }>(
    `${apiOrigin}/auth/refresh`,
    { refreshToken },
  );
  localStorage.setItem("token", res.data.token);
  localStorage.setItem("refreshToken", res.data.refreshToken);
  window.dispatchEvent(
    new CustomEvent("auth:tokens-updated", {
      detail: { token: res.data.token, refreshToken: res.data.refreshToken },
    }),
  );
}

type RetryConfig = InternalAxiosRequestConfig & { _authRetry?: boolean };

apiClient.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) {
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const config = error.config as RetryConfig | undefined;

    if (status !== 401 || !config) {
      return Promise.reject(error);
    }

    const url = String(config.url ?? "");
    if (url.includes("/auth/refresh") || url.endsWith("/login")) {
      clearSession();
      return Promise.reject(error);
    }

    if (!localStorage.getItem("refreshToken")) {
      clearSession();
      return Promise.reject(error);
    }

    if (config._authRetry) {
      clearSession();
      return Promise.reject(error);
    }
    config._authRetry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshSession().finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      const newToken = localStorage.getItem("token");
      if (!newToken) {
        clearSession();
        return Promise.reject(error);
      }
      config.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(config);
    } catch {
      clearSession();
      return Promise.reject(error);
    }
  },
);
