import { authApi } from "../services/api";

interface Props {
  onDemoLogin?: () => void;
}

export default function LoginPage({ onDemoLogin }: Props) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="glass rounded-3xl p-10 shadow-2xl shadow-black/50 animate-slide-up border border-white/10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-700 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/30">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">ReachInbox.ai</h1>
              <p className="text-xs text-brand-400 font-medium">Smart Email Outreach &bull; Groq AI</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
          <p className="text-gray-400 mb-8">Sign in to manage your email campaigns with AI-powered scheduling.</p>

          <button
            id="google-login-btn"
            onClick={() => authApi.googleLogin()}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-3 px-6 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl active:scale-98 mb-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {onDemoLogin && (
            <button
              id="demo-login-btn"
              type="button"
              onClick={onDemoLogin}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600/20 via-brand-600/20 to-purple-600/20 hover:from-purple-600/30 hover:to-brand-600/30 border border-purple-500/30 text-purple-200 font-medium py-3 px-6 rounded-xl transition-all duration-200 active:scale-98"
            >
              <span>⚡ Explore Demo Mode (Instant Access)</span>
            </button>
          )}

          <div className="border-t border-white/10 pt-6 mt-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { icon: "⚡", label: "Groq AI Engine" },
                { icon: "⏱️", label: "BullMQ Scheduler" },
                { icon: "🛡️", label: "Rate Limiting" },
              ].map((f) => (
                <div key={f.label} className="flex flex-col items-center gap-1">
                  <span className="text-xl">{f.icon}</span>
                  <span className="text-[11px] text-gray-400 font-medium">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          BullMQ delayed jobs scheduler &bull; No cron &bull; Real-time rate throttling
        </p>
      </div>
    </div>
  );
}
