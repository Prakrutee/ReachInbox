import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import { authApi } from "./services/api";
import type { User } from "./types";

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    // Check local storage for demo user
    const saved = localStorage.getItem("reachinbox_demo_user");
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me()
      .then(setUser)
      .catch(() => {
        // If not authenticated via OAuth, check if we have demo session
        const saved = localStorage.getItem("reachinbox_demo_user");
        if (saved) {
          try { setUser(JSON.parse(saved)); } catch {}
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDemoLogin = () => {
    const demoUser: User = {
      id: "demo-founder-1",
      email: "founder@reachinbox.ai",
      displayName: "Demo Founder",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox",
    };
    localStorage.setItem("reachinbox_demo_user", JSON.stringify(demoUser));
    setUser(demoUser);
  };

  const handleLogout = async () => {
    localStorage.removeItem("reachinbox_demo_user");
    setUser(null);
    try { await authApi.logout(); } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 font-medium">Loading ReachInbox...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <LoginPage onDemoLogin={handleDemoLogin} />}
        />
        <Route
          path="/"
          element={
            user ? (
              <DashboardPage
                user={user}
                setUser={(u) => {
                  if (!u) handleLogout();
                  else setUser(u);
                }}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
