import { useState, useEffect, useCallback } from "react";
import { emailApi, authApi, slackApi } from "../services/api";
import type { Email, User, SlackStatus } from "../types";
import EmailTable from "../components/EmailTable";
import ComposeModal from "../components/ComposeModal";

interface Props { user: User; setUser: (u: User | null) => void; }

export default function DashboardPage({ user, setUser }: Props) {
  const [tab, setTab] = useState<"scheduled" | "sent">("scheduled");
  const [scheduled, setScheduled] = useState<Email[]>([]);
  const [sent, setSent] = useState<Email[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Email[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [slack, setSlack] = useState<SlackStatus | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sent_] = await Promise.all([emailApi.getScheduled(), emailApi.getSent()]);
      setScheduled(s);
      setSent(sent_);
    } catch (err) {
      console.error("Failed to fetch emails:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    slackApi.status().then(setSlack).catch(() => {});
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await emailApi.search(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const stats = {
    scheduled: scheduled.length,
    sent: sent.filter((e) => e.status === "sent").length,
    failed: sent.filter((e) => e.status === "failed").length,
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="glass border-b border-white/10 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-brand-400 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">ReachInbox.ai</span>
          </div>
          <div className="flex items-center gap-4">
            {slack && (
              <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${slack.connected ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-gray-800 text-gray-500 border-gray-700"}`}>
                <div className={`w-2 h-2 rounded-full ${slack.connected ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
                {slack.connected ? `Slack: ${slack.team_name}` : "Slack: Not connected"}
              </div>
            )}
            <a href="/admin/queues" target="_blank" rel="noreferrer" className="text-xs font-medium text-gray-400 hover:text-brand-400 transition-colors">
              Bull Board
            </a>
            <div className="flex items-center gap-3">
              {user.avatar && (
                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full ring-2 ring-brand-500/50" />
              )}
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-white">{user.name}</div>
                <div className="text-xs text-gray-400">{user.email}</div>
              </div>
              <button id="logout-btn" onClick={handleLogout} className="btn-secondary text-xs py-1.5 px-3">Logout</button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Scheduled", value: stats.scheduled, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "Sent", value: stats.sent, color: "text-green-400", bg: "bg-green-500/10" },
            { label: "Failed", value: stats.failed, color: "text-red-400", bg: "bg-red-500/10" },
          ].map((s) => (
            <div key={s.label} className={`card ${s.bg} border-white/5`}>
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-sm text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs + Compose button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 p-1 bg-gray-900 rounded-xl border border-white/5">
            {(["scheduled", "sent"] as const).map((t) => (
              <button
                key={t}
                id={`tab-${t}`}
                onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize ${
                  tab === t
                    ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t} {t === "scheduled" ? `(${stats.scheduled})` : `(${stats.sent + stats.failed})`}
              </button>
            ))}
          </div>
          <button id="compose-btn" onClick={() => setShowCompose(true)} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Compose New Email
          </button>
        </div>

        {/* Search (sent tab) */}
        {tab === "sent" && (
          <div className="mb-4 relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="search-input"
              type="text"
              className="input pl-11"
              placeholder="Search sent emails (via Elasticsearch)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        {/* Email table */}
        <div className="card p-0 overflow-hidden">
          {tab === "scheduled" && (
            <EmailTable
              emails={scheduled}
              loading={loading}
              emptyMessage="No scheduled emails"
            />
          )}
          {tab === "sent" && (
            <EmailTable
              emails={searchQuery ? (searchResults as Email[]) : sent}
              loading={loading || searchLoading}
              emptyMessage={searchQuery ? "No results found" : "No sent emails yet"}
            />
          )}
        </div>
      </main>

      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onScheduled={() => { fetchData(); }}
        />
      )}
    </div>
  );
}
