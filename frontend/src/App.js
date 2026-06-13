import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Plans from "./pages/Plans";
import PlanDetail from "./pages/PlanDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Staff from "./pages/Staff";
import MyPlan from "./pages/MyPlan";
import Performance from "./pages/Performance";
import Profile from "./pages/Profile";
import AdminPerformance from "./pages/AdminPerformance";
import Announcements from "./pages/Announcements";
import Campaigns from "./pages/Campaigns";
import Tasks from "./pages/Tasks";
import Reports from "./pages/Reports";
import Fleet from "./pages/Fleet";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ErrorBoundary from "./components/ErrorBoundary";
import NotificationBell from "./components/NotificationBell";
import "./App.css";

/* ═══════════════════════════════════════════
   MOBILE BOTTOM NAVIGATION
   ═══════════════════════════════════════════ */
function BottomNav({ user, isAdmin, onLogout }) {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = () => setMoreOpen(false);

  // Ikonlar (sidebar'dakiyle ayni SVG'ler)
  const ICONS = {
    dashboard: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
    ),
    customers: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    ),
    plans: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
    ),
    performance: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    ),
    staff: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
    ),
    reports: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
    ),
    fleet: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
    ),
    announcements: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>
    ),
    campaigns: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 13"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
    ),
    tasks: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    ),
    more: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
    ),
    profile: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    ),
    logout: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    ),
  };

  // Ana 4 madde + Diger (admin) / Tum maddeler (sales_rep)
  const adminMain = [
    { to: "/", end: true, label: "Gösterge", icon: ICONS.dashboard },
    { to: "/customers", label: "Müşteri", icon: ICONS.customers },
    { to: "/plans", label: "Plan", icon: ICONS.plans },
    { to: "/performance", label: "Performans", icon: ICONS.performance },
  ];
  const adminMore = [
    { to: "/staff", label: "Personel Yönetimi", icon: ICONS.staff },
    { to: "/reports", label: "Raporlar", icon: ICONS.reports },
    { to: "/fleet", label: "Filo Yönetimi", icon: ICONS.fleet },
    { to: "/announcements", label: "Duyurular", icon: ICONS.announcements },
    { to: "/campaigns", label: "Kampanyalar", icon: ICONS.campaigns },
    { to: "/tasks", label: "Görevler", icon: ICONS.tasks },
  ];
  const repMain = [
    { to: "/", end: true, label: "Performans", icon: ICONS.performance },
    { to: "/my-plan", label: "Planım", icon: ICONS.plans },
    { to: "/announcements", label: "Duyurular", icon: ICONS.announcements },
    { to: "/campaigns", label: "Kampanyalar", icon: ICONS.campaigns },
  ];

  const mainItems = isAdmin ? adminMain : repMain;

  return (
    <>
      <nav className="bottom-nav" aria-label="Mobil Navigasyon">
        {mainItems.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? "active" : "")}>
            {it.icon}
            <span>{it.label}</span>
          </NavLink>
        ))}
        {isAdmin && (
          <button type="button" onClick={() => setMoreOpen(true)} aria-label="Diğer menü">
            {ICONS.more}
            <span>Diğer</span>
          </button>
        )}
        {!isAdmin && (
          <button type="button" onClick={() => setMoreOpen(true)} aria-label="Diğer menü">
            {ICONS.more}
            <span>Diğer</span>
          </button>
        )}
      </nav>

      {moreOpen && (
        <div className="bottom-sheet-overlay" onClick={closeMore}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <div className="bottom-sheet-user">
              <div className="bottom-sheet-user-info" onClick={() => { closeMore(); navigate("/profile"); }}>
                <div className="bottom-sheet-avatar">{user?.full_name?.charAt(0) || "U"}</div>
                <div>
                  <div className="bottom-sheet-user-name">{user?.full_name}</div>
                  <div className="bottom-sheet-user-role">{isAdmin ? "Yönetici" : "Satış Temsilcisi"}</div>
                </div>
              </div>
              <NotificationBell />
            </div>

            {isAdmin && (
              <>
                <div className="bottom-sheet-section">Diğer Menü</div>
                {adminMore.map((it) => (
                  <NavLink key={it.to} to={it.to} end={it.end} onClick={closeMore} className={({ isActive }) => (isActive ? "active" : "")}>
                    {it.icon}
                    <span>{it.label}</span>
                  </NavLink>
                ))}
              </>
            )}

            <div className="bottom-sheet-section">Hesap</div>
            <button type="button" className="bottom-sheet-link" onClick={() => { closeMore(); navigate("/profile"); }}>
              {ICONS.profile}
              <span>Profil Ayarları</span>
            </button>
            <button type="button" className="bottom-sheet-link bottom-sheet-logout" onClick={() => { closeMore(); onLogout(); }}>
              {ICONS.logout}
              <span>Çıkış Yap</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ProtectedLayout({ user, onLogout, children }) {
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "1");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    onLogout();
    navigate("/login");
  };

  const closeSidebar = () => setSidebarOpen(false);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebarCollapsed", next ? "1" : "0");
      return next;
    });
  };

  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""}`}>
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? "✕" : "☰"}
      </button>
      {/* Masaüstü: menüyü aç/kapat (tam ekran) */}
      <button className="sidebar-toggle" onClick={toggleCollapsed} title={collapsed ? "Menüyü aç" : "Menüyü kapat"}>
        {collapsed ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        )}
      </button>
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}
      <nav className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="logo">
          <div className="logo-icon">SS</div>
          <h2>Saha Satış</h2>
        </div>
        <div className="sidebar-section">Ana Menü</div>
        <ul>
          {isAdmin && (
            <>
              <li>
                <NavLink to="/" end onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></span>
                  Gösterge Paneli
                </NavLink>
              </li>
              <li>
                <NavLink to="/customers" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
                  Müşteri Yönetimi
                </NavLink>
              </li>
              <li>
                <NavLink to="/plans" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg></span>
                  Plan Yönetimi
                </NavLink>
              </li>
              <li>
                <NavLink to="/staff" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg></span>
                  Personel Yönetimi
                </NavLink>
              </li>
              <li>
                <NavLink to="/performance" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
                  Performans Takibi
                </NavLink>
              </li>
              <li>
                <NavLink to="/reports" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
                  Raporlar
                </NavLink>
              </li>
              <li>
                <NavLink to="/fleet" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></span>
                  Filo Yönetimi
                </NavLink>
              </li>
              <li>
                <NavLink to="/announcements" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg></span>
                  Duyurular
                </NavLink>
              </li>
              <li>
                <NavLink to="/campaigns" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 13"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg></span>
                  Kampanyalar
                </NavLink>
              </li>
              <li>
                <NavLink to="/tasks" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>
                  Görevler
                </NavLink>
              </li>
            </>
          )}
          {!isAdmin && (
            <>
              <li>
                <NavLink to="/" end onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
                  Performans Paneli
                </NavLink>
              </li>
              <li>
                <NavLink to="/my-plan" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg></span>
                  Benim Planım
                </NavLink>
              </li>
              <li>
                <NavLink to="/announcements" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg></span>
                  Duyurular
                </NavLink>
              </li>
              <li>
                <NavLink to="/campaigns" onClick={closeSidebar}>
                  <span className="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 13"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg></span>
                  Kampanyalar
                </NavLink>
              </li>
            </>
          )}
        </ul>
        <div className="sidebar-user">
          <div className="sidebar-user-info" onClick={() => navigate("/profile")} style={{ cursor: "pointer" }} title="Profil Ayarları">
            <div className="sidebar-user-avatar">{user?.full_name?.charAt(0) || "U"}</div>
            <div className="sidebar-user-details">
              <div className="sidebar-user-name">{user?.full_name}</div>
              <div className="sidebar-user-role">{isAdmin ? "Yönetici" : "Satış Temsilcisi"}</div>
            </div>
          </div>
          <NotificationBell />
          <button className="sidebar-logout" onClick={handleLogout} title="Çıkış Yap">⏻</button>
        </div>
        <div className="sidebar-footer">v1.0 — Karar Destek Sistemi</div>
      </nav>
      <main className="content">{children}</main>
      <BottomNav user={user} isAdmin={isAdmin} onLogout={handleLogout} />
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    }
  }, [user]);

  useEffect(() => {
    const checkAuth = () => {
      const saved = localStorage.getItem("user");
      if (!saved && user) setUser(null);
    };
    window.addEventListener("storage", checkAuth);
    const interval = setInterval(checkAuth, 1000);
    return () => {
      window.removeEventListener("storage", checkAuth);
      clearInterval(interval);
    };
  }, [user]);

  const isLoggedIn = !!user;
  const isAdmin = user?.role === "admin";

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isLoggedIn ? <Navigate to="/" /> : <Login onLogin={setUser} />} />
        <Route path="/register" element={isLoggedIn ? <Navigate to="/" /> : <Register onLogin={setUser} />} />
        <Route path="/forgot-password" element={isLoggedIn ? <Navigate to="/" /> : <ForgotPassword />} />
        <Route path="/reset-password" element={isLoggedIn ? <Navigate to="/" /> : <ResetPassword />} />
        <Route
          path="/*"
          element={
            isLoggedIn ? (
              <ProtectedLayout user={user} onLogout={() => setUser(null)}>
                <ErrorBoundary>
                <Routes>
                  <Route path="/profile" element={<Profile user={user} onUserUpdate={setUser} />} />
                  {isAdmin && (
                    <>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/plans" element={<Plans />} />
                      <Route path="/plans/:id" element={<PlanDetail />} />
                      <Route path="/staff" element={<Staff />} />
                      <Route path="/performance" element={<AdminPerformance />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/fleet" element={<Fleet />} />
                      <Route path="/announcements" element={<Announcements />} />
                      <Route path="/campaigns" element={<Campaigns />} />
                      <Route path="/tasks" element={<Tasks />} />
                    </>
                  )}
                  {!isAdmin && (
                    <>
                      <Route path="/" element={<Performance />} />
                      <Route path="/my-plan" element={<MyPlan />} />
                      <Route path="/announcements" element={<Announcements />} />
                      <Route path="/campaigns" element={<Campaigns />} />
                    </>
                  )}
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
                </ErrorBoundary>
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
