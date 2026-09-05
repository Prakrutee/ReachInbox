import React, { useState, useRef, useEffect } from "react";
import { emailApi, aiApi } from "../services/api";
import type { ScheduleResult } from "../types";

interface Props {
  onClose: () => void;
  onScheduled: () => void;
}

const TONES = [
  { id: "professional", label: "Professional" },
  { id: "friendly", label: "Friendly" },
  { id: "persuasive", label: "Persuasive" },
  { id: "follow-up", label: "Follow-up" },
  { id: "direct", label: "Direct & Punchy" },
];

const QUICK_POLISH_OPTIONS = [
  { id: "Make it more concise and punchy", label: "Make Concise" },
  { id: "Make it more persuasive with a clear CTA", label: "More Persuasive" },
  { id: "Add gentle urgency without sounding spammy", label: "Add Urgency" },
  { id: "Enhance professional B2B tone", label: "Professional Polish" },
];

function parseRecipients(text: string): { valid: number; invalid: number; total: number } {
  const lines = text.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let valid = 0;
  let invalid = 0;
  for (const item of lines) {
    const candidate = item.replace(/^.*<([^>]+)>.*$/, "$1").trim();
    if (emailRegex.test(candidate)) {
      valid++;
    } else {
      invalid++;
    }
  }
  return { valid, invalid, total: lines.length };
}

export default function ComposeModal({ onClose, onScheduled }: Props) {
  const [activeTab, setActiveTab] = useState<"compose" | "ai">("compose");
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [startAt, setStartAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [delayMs, setDelayMs] = useState(2000);
  const [file, setFile] = useState<File | null>(null);
  const [recipientText, setRecipientText] = useState("");
  const [preview, setPreview] = useState<{ valid: number; invalid: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScheduleResult | null>(null);

  // AI Assistant States
  const [aiTopic, setAiTopic] = useState("");
  const [aiTone, setAiTone] = useState("professional");
  const [aiAudience, setAiAudience] = useState("");
  const [aiCta, setAiCta] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [polishLoading, setPolishLoading] = useState(false);
  const [cleanLoading, setCleanLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    aiApi
      .getStatus()
      .then((res) => setAiAvailable(res.configured))
      .catch(() => setAiAvailable(false));
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) {
      const text = await f.text();
      const p = parseRecipients(text);
      setPreview(p);
    }
  };

  const handleTextChange = (t: string) => {
    setRecipientText(t);
    if (t.trim()) {
      const p = parseRecipients(t);
      setPreview(p);
    } else {
      setPreview(null);
    }
  };

  // AI Generation
  const handleGenerateCampaign = async () => {
    if (!aiTopic.trim()) {
      setAiError("Please enter a campaign topic or objective");
      return;
    }
    setAiError("");
    setAiLoading(true);
    try {
      const res = await aiApi.generateEmail({
        topic: aiTopic,
        tone: aiTone,
        audience: aiAudience || undefined,
        callToAction: aiCta || undefined,
        senderName: sender || undefined,
      });
      if (res.success && res.data) {
        setSubject(res.data.subject);
        setBody(res.data.body);
        setActiveTab("compose");
      }
    } catch (err: any) {
      setAiError(err?.response?.data?.error || "AI generation failed. Please check GROQ API key.");
    } finally {
      setAiLoading(false);
    }
  };

  // AI Subject Suggestions
  const handleSuggestSubjects = async () => {
    setSuggestLoading(true);
    try {
      const res = await aiApi.suggestSubjects({
        topic: subject || aiTopic || "Product outreach",
        body: body || undefined,
        count: 3,
      });
      if (res.success && Array.isArray(res.data)) {
        setSubjectSuggestions(res.data);
      }
    } catch (err: any) {
      console.error("Failed to suggest subjects:", err);
    } finally {
      setSuggestLoading(false);
    }
  };

  // AI Polish
  const handlePolishDraft = async (instruction: string) => {
    if (!body.trim()) return;
    setPolishLoading(true);
    try {
      const res = await aiApi.improveDraft({ body, instruction });
      if (res.success && res.data) {
        setBody(res.data);
      }
    } catch (err: any) {
      console.error("Failed to improve draft:", err);
    } finally {
      setPolishLoading(false);
    }
  };

  // AI Clean Recipients
  const handleCleanRecipients = async () => {
    if (!recipientText.trim()) return;
    setCleanLoading(true);
    try {
      const res = await aiApi.cleanRecipients(recipientText);
      if (res.success && res.data) {
        const cleanedEmails = res.data.valid.map((v) =>
          v.name ? `"${v.name}" <${v.email}>` : v.email
        );
        const newText = cleanedEmails.join("\n");
        setRecipientText(newText);
        setPreview(parseRecipients(newText));
      }
    } catch (err: any) {
      console.error("Failed to clean recipients:", err);
    } finally {
      setCleanLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("subject", subject);
      fd.append("body", body);
      fd.append("sender", sender);
      fd.append("startAt", new Date(startAt).toISOString());
      fd.append("delayBetweenMs", String(delayMs));
      if (file) {
        fd.append("file", file);
      } else {
        fd.append("recipients", recipientText);
      }
      const res = await emailApi.schedule(fd);
      setResult(res);
      onScheduled();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to schedule emails");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="glass rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl shadow-black/60 animate-slide-up border border-white/10">
        {/* Header */}
        <div className="sticky top-0 glass rounded-t-3xl flex items-center justify-between px-8 py-5 border-b border-white/10 z-10">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Compose Campaign</h2>
                {aiAvailable && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-500/20 to-brand-500/20 text-purple-300 border border-purple-500/30">
                    Groq AI Powered
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400">Schedule emails via BullMQ delayed jobs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-8 pt-4 pb-0 flex border-b border-white/5 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("compose")}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === "compose"
                ? "text-brand-400 border-b-2 border-brand-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Campaign Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`pb-3 text-sm font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "ai"
                ? "text-purple-400 border-b-2 border-purple-400"
                : "text-gray-400 hover:text-purple-300"
            }`}
          >
            <span>✨ AI Email Generator</span>
            <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 text-[10px] rounded-md font-mono border border-purple-500/30">
              FAST
            </span>
          </button>
        </div>

        {result ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Campaign Scheduled!</h3>
            <p className="text-gray-400 mb-6">Your emails have been queued in BullMQ delayed scheduler.</p>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="card text-center bg-brand-950/20 border-brand-500/20">
                <div className="text-3xl font-bold text-brand-400">{result.scheduled}</div>
                <div className="text-sm text-gray-400 mt-1">Scheduled</div>
              </div>
              <div className="card text-center">
                <div className="text-3xl font-bold text-gray-400">{result.skipped}</div>
                <div className="text-sm text-gray-400 mt-1">Skipped</div>
              </div>
              <div className="card text-center">
                <div className="text-3xl font-bold text-gray-300">{result.total}</div>
                <div className="text-sm text-gray-400 mt-1">Total</div>
              </div>
            </div>
            <button onClick={onClose} className="btn-primary">Close</button>
          </div>
        ) : activeTab === "ai" ? (
          /* AI Generator Tab */
          <div className="p-8 space-y-5">
            <div className="bg-gradient-to-r from-purple-900/30 via-brand-900/20 to-transparent p-5 rounded-2xl border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2 text-purple-300 font-semibold text-sm">
                <span>⚡ Powered by Groq Ultra-Fast Inference</span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Describe what you want to achieve. Groq will craft a compelling subject line and high-converting copy in seconds.
              </p>
            </div>

            {aiError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
                {aiError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                What is the email about? (Objective / Value Prop) *
              </label>
              <textarea
                className="input min-h-[90px] resize-y text-sm"
                placeholder="e.g., Pitching ReachInbox to B2B founders: cold email automation with BullMQ, rate limiting, and zero spam."
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tone</label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAiTone(t.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      aiTone === t.id
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400"
                        : "bg-white/5 text-gray-300 hover:bg-white/10 border border-white/5"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Target Audience (optional)</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="e.g., VP of Sales, Seed Founders"
                  value={aiAudience}
                  onChange={(e) => setAiAudience(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Call to Action (optional)</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="e.g., 10-min demo call"
                  value={aiCta}
                  onChange={(e) => setAiCta(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("compose")}
                className="btn-secondary flex-1"
              >
                Back to Editor
              </button>
              <button
                type="button"
                onClick={handleGenerateCampaign}
                disabled={aiLoading}
                className="flex-1 px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-brand-600 hover:from-purple-500 hover:to-brand-500 shadow-lg shadow-purple-600/25 transition-all flex items-center justify-center gap-2"
              >
                {aiLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating with Groq...
                  </>
                ) : (
                  <>
                    <span>✨ Generate & Apply to Campaign</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Main Compose Form */
          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">From (Sender Email)</label>
              <input
                id="sender-input"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Subject</label>
                <button
                  type="button"
                  onClick={handleSuggestSubjects}
                  disabled={suggestLoading}
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                >
                  {suggestLoading ? (
                    <span className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                  ) : (
                    <span>⚡ AI Suggest 3 Subject Lines</span>
                  )}
                </button>
              </div>
              <input
                id="subject-input"
                type="text"
                className="input"
                placeholder="Your email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
              {subjectSuggestions.length > 0 && (
                <div className="mt-2 p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl space-y-1.5">
                  <div className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider">
                    Click to apply:
                  </div>
                  {subjectSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSubject(s)}
                      className="block w-full text-left text-xs text-gray-200 hover:text-white hover:bg-purple-500/20 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      • {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Body</label>
                {body.trim() && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">AI Polish:</span>
                    {QUICK_POLISH_OPTIONS.slice(0, 2).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handlePolishDraft(opt.id)}
                        disabled={polishLoading}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <textarea
                id="body-input"
                className="input min-h-[140px] resize-y"
                placeholder="Write your email body here or use the AI Generator above..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
              {polishLoading && (
                <div className="flex items-center gap-2 mt-1 text-xs text-purple-400">
                  <span className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                  Rewriting draft with Groq AI...
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Recipients</label>
                {!file && recipientText.trim() && (
                  <button
                    type="button"
                    onClick={handleCleanRecipients}
                    disabled={cleanLoading}
                    className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                  >
                    {cleanLoading ? (
                      <span className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                    ) : (
                      <span>🪄 AI Clean & Fix Typos</span>
                    )}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <div
                  className="border-2 border-dashed border-gray-700 rounded-xl p-4 text-center cursor-pointer hover:border-brand-500/50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {file ? (
                    <p className="text-green-400 font-medium">{file.name}</p>
                  ) : (
                    <p className="text-gray-500">Drop a CSV/TXT file or click to browse</p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">Supports bare email list or CSV with "email" column</p>
                </div>
                {!file && (
                  <textarea
                    id="recipients-textarea"
                    className="input min-h-[80px] resize-y text-sm"
                    placeholder="Or paste emails here, one per line or comma-separated"
                    value={recipientText}
                    onChange={(e) => handleTextChange(e.target.value)}
                  />
                )}
                {preview && (
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-400">{preview.valid} valid</span>
                    <span className="text-red-400">{preview.invalid} invalid</span>
                    <span className="text-gray-400">{preview.total} total</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Start Time</label>
                <input
                  id="start-time-input"
                  type="datetime-local"
                  className="input"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Delay Between Emails (ms)</label>
                <input
                  id="delay-input"
                  type="number"
                  className="input"
                  min={0}
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button id="schedule-btn" type="submit" className="btn-primary flex-1" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Scheduling...
                  </span>
                ) : (
                  "Schedule Campaign"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
