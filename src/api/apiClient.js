// src/api/apiClient.js
import axios from "axios";
import { TokenManager, clearAuth } from "../utils/storage";

const API_ORIGIN =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
  "https://backend-h5g5.onrender.com";

export const API_BASE = `${API_ORIGIN}/api`;

// Main API instance
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  withCredentials: true,
});

// ---------- header helpers (Axios v1 safe) ----------
const setHeader = (headers, key, value) => {
  if (!headers) return;
  if (typeof headers.set === "function") headers.set(key, value);
  else headers[key] = value;
};

const deleteHeader = (headers, key) => {
  if (!headers) return;
  if (typeof headers.delete === "function") headers.delete(key);
  else delete headers[key];
};

const isFormData = (v) =>
  typeof FormData !== "undefined" && v instanceof FormData;

const isAuthRoute = (url = "") => {
  // url might be relative (/auth/login) or absolute; keep it simple:
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/register") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/logout")
  );
};

// ---------- request interceptor ----------
api.interceptors.request.use(
  (config) => {
    const token = TokenManager.get?.();

    config.headers = config.headers || {};

    // Attach bearer token (if exists)
    if (token) setHeader(config.headers, "Authorization", `Bearer ${token}`);

    // Let browser set multipart boundary
    if (isFormData(config.data)) deleteHeader(config.headers, "Content-Type");

    return config;
  },
  (error) => Promise.reject(error)
);

// ---------- refresh logic (single-flight + queue) ----------
let refreshPromise = null;
let waitQueue = [];

const flushQueue = (err, newToken) => {
  waitQueue.forEach(({ resolve, reject }) => {
    if (err) reject(err);
    else resolve(newToken);
  });
  waitQueue = [];
};

async function requestRefreshToken() {
  // Preferred: cookie-based refresh (server sets/reads refresh cookie)
  const res = await axios.post(
    `${API_BASE}/auth/refresh`,
    {},
    { withCredentials: true, timeout: 30000 }
  );

  const accessToken =
    res.data?.accessToken ||
    res.data?.token ||
    res.data?.data?.accessToken ||
    null;

  const refreshToken =
    res.data?.refreshToken || res.data?.data?.refreshToken || null;

  if (!accessToken) throw new Error("REFRESH_NO_ACCESS_TOKEN");

  return { accessToken, refreshToken };
}

// ---------- response interceptor (401 -> refresh -> retry) ----------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config;

    // True network error / CORS / DNS / timeout (no response)
    if (!error?.response) {
      return Promise.reject({
        success: false,
        code: "NETWORK_ERROR",
        message: error?.message || "Network error (possible CORS issue)",
      });
    }

    const { status, data } = error.response;

    // If it’s an auth route, never try refresh (prevents loops)
    if (original?.url && isAuthRoute(original.url)) {
      return Promise.reject({
        success: false,
        status,
        code: data?.code || `HTTP_${status}`,
        message: data?.message || "Authentication request failed",
        errors: data?.errors,
      });
    }

    // Try refresh on 401 once
    if (status === 401 && original && !original._retry) {
      original._retry = true;

      // If refresh already running, queue this request
      if (refreshPromise) {
        try {
          const newToken = await new Promise((resolve, reject) => {
            waitQueue.push({ resolve, reject });
          });

          original.headers = original.headers || {};
          setHeader(original.headers, "Authorization", `Bearer ${newToken}`);
          return api.request(original);
        } catch (e) {
          return Promise.reject(e);
        }
      }

      refreshPromise = (async () => {
        const { accessToken, refreshToken } = await requestRefreshToken();

        TokenManager.set?.(accessToken);
        if (refreshToken && TokenManager.setRefresh) {
          TokenManager.setRefresh(refreshToken);
        }

        return accessToken;
      })();

      try {
        const newAccessToken = await refreshPromise;
        flushQueue(null, newAccessToken);

        original.headers = original.headers || {};
        setHeader(original.headers, "Authorization", `Bearer ${newAccessToken}`);

        return api.request(original);
      } catch (refreshErr) {
        flushQueue(refreshErr, null);

        clearAuth?.();
        window.dispatchEvent(new CustomEvent("auth:logout"));

        return Promise.reject({
          success: false,
          code: "TOKEN_EXPIRED",
          message: "Session expired. Please login again.",
        });
      } finally {
        refreshPromise = null;
      }
    }

    // Normal non-401 errors
    return Promise.reject({
      success: false,
      status,
      code: data?.code || `HTTP_${status}`,
      message: data?.message || "Request failed",
      errors: data?.errors,
    });
  }
);

// Optional helper: consistent “payload unwrap” without changing interceptor return
export const unwrap = (axiosResponse) => axiosResponse?.data;

export default api;
