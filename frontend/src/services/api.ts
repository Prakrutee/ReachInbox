import axios from "axios";
import type { Email, ScheduleResult, SlackStatus, User } from "../types";

export function getApiBaseUrl(): string {
  const custom = localStorage.getItem("reachinbox_api_base");
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, "");
  }
  return (
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.PROD ? "https://nam-mentor-robust-title.trycloudflare.com" : "")
  );
}

export function setApiBaseUrl(url: string) {
  if (!url || !url.trim()) {
    localStorage.removeItem("reachinbox_api_base");
  } else {
    localStorage.setItem("reachinbox_api_base", url.trim().replace(/\/+$/, ""));
  }
  window.location.reload();
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  return config;
});

export const authApi = {
  me: () => api.get<User>("/api/auth/me").then((r) => r.data),
  logout: () => api.post("/api/auth/logout"),
  googleLogin: () => {
    window.location.href = `${getApiBaseUrl()}/auth/google`;
  },
};

export const emailApi = {
  getScheduled: () => api.get<Email[]>("/api/emails/scheduled").then((r) => r.data),
  getSent: () => api.get<Email[]>("/api/emails/sent").then((r) => r.data),
  search: (q: string) => api.get<Email[]>(`/api/emails/search?q=${encodeURIComponent(q)}`).then((r) => r.data),
  schedule: (formData: FormData) =>
    api.post<ScheduleResult>("/api/emails/schedule", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data),
};

export const slackApi = {
  status: () => api.get<SlackStatus>("/api/slack/status").then((r) => r.data),
  connect: () => { window.location.href = `${getApiBaseUrl()}/auth/slack`; },
  disconnect: () => api.post("/api/slack/disconnect"),
};

export const healthApi = {
  check: () => api.get("/api/health").then((r) => r.data),
};

export const aiApi = {
  getStatus: () =>
    api.get<{ configured: boolean; model: string }>("/api/ai/status").then((r) => r.data),
  generateEmail: (data: {
    topic: string;
    tone?: string;
    audience?: string;
    callToAction?: string;
    senderName?: string;
    recipientName?: string;
  }) =>
    api
      .post<{ success: boolean; data: { subject: string; body: string } }>(
        "/api/ai/generate-email",
        data
      )
      .then((r) => r.data),
  suggestSubjects: (data: { topic?: string; body?: string; count?: number }) =>
    api
      .post<{ success: boolean; data: string[] }>("/api/ai/suggest-subjects", data)
      .then((r) => r.data),
  improveDraft: (data: { body: string; instruction: string }) =>
    api
      .post<{ success: boolean; data: string }>("/api/ai/improve-draft", data)
      .then((r) => r.data),
  cleanRecipients: (rawText: string) =>
    api
      .post<{
        success: boolean;
        data: { valid: Array<{ email: string; name?: string }>; invalid: string[] };
      }>("/api/ai/clean-recipients", { rawText })
      .then((r) => r.data),
};
