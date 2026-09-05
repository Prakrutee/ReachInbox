export interface Email {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  sender: string;
  scheduled_at: string;
  sent_at: string | null;
  status: "scheduled" | "processing" | "sent" | "failed";
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  google_id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface ScheduleFormData {
  subject: string;
  body: string;
  sender: string;
  startAt: string;
  delayBetweenMs: number;
  maxPerHour: number;
  file?: File | null;
}

export interface ScheduleResult {
  scheduled: number;
  skipped: number;
  total: number;
  invalid: string[];
}

export interface SlackStatus {
  connected: boolean;
  team_name?: string;
  channel?: string;
}
