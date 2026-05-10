// ============================================
// FILE: App.jsx
// Main App Component - Admin Dashboard
// ============================================

import React, { useMemo, useEffect } from "react"
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { LoginPage } from "./components/LoginPage"
import {
  DashboardPage,
  CustomersPage,
  SubscriptionsPage,
  OrdersPage,
  DeliverySchedulePage,
  DemandForecastPage,
  HubsPage,
  RoutesPage,
  DriversPage,
  WalletPage,
  AssetTrackingPage,
  SettingsPage,
} from "./components/pages"
import { Button } from "./components/ui/Button"
import { NAV_ITEMS, GROUP_LABELS } from "./constants"
import { useBadgeCounts } from "./hooks/useBadgeCounts"
import "./styles/index.css"

function MainLayout({ groupedNav, logout }) {
  const location = useLocation()
  const navigate = useNavigate()
  const currentPath = location.pathname.substring(1) || "dashboard"

  useEffect(() => {
    console.log(`[App] Route changed to: ${location.pathname}`)
  }, [location])

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">M</div>
          <div>
            <div className="logo-text">MilkRide</div>
            <div className="logo-sub">Ops Console</div>
          </div>
        </div>
        <div className="nav-section">
          {groupedNav.map((item) => {
            if (item.type === "label") {
              return (
                <div key={item.key} className="nav-label">
                  {item.label}
                </div>
              )
            }
            return (
              <div
                key={item.key}
                className={`nav-item ${currentPath === item.key ? "active" : ""}`}
                onClick={() =>
                  navigate(`/${item.key === "dashboard" ? "" : item.key}`)
                }
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.badge > 0 && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </div>
            )
          })}
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">A</div>
            <div className="user-info">
              <div className="user-name">Admin</div>
              <div className="user-role">Operations</div>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={logout}
            style={{ width: "100%", marginTop: 12 }}
          >
            Logout
          </Button>
        </div>
      </div>

      <div className="main">
        <div className="content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/schedule" element={<DeliverySchedulePage />} />
            <Route path="/forecast" element={<DemandForecastPage />} />
            <Route path="/hubs" element={<HubsPage />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/drivers" element={<DriversPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/assets" element={<AssetTrackingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function AppContent() {
  const { user, isAdmin, loading, logout } = useAuth()
  const { failedOrdersToday } = useBadgeCounts()

  const navItemsWithBadges = useMemo(
    () =>
      NAV_ITEMS.map((item) => ({
        ...item,
        badge: item.key === "orders" ? failedOrdersToday : 0,
      })),
    [failedOrdersToday],
  )

  const groupedNav = useMemo(() => {
    let prevGroup = null
    const items = []
    navItemsWithBadges.forEach((item) => {
      const label = GROUP_LABELS[item.group]
      if (item.group !== prevGroup && label) {
        items.push({ type: "label", key: `g-${item.group}`, label })
      }
      prevGroup = item.group
      items.push({ type: "item", ...item })
    })
    return items
  }, [navItemsWithBadges])

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
        }}
      >
        <div
          style={{ color: "var(--text-3)", fontFamily: "'DM Mono', monospace" }}
        >
          Loading Operations Console...
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (!isAdmin) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-title" style={{ color: "var(--red)" }}>
            Access Denied
          </div>
          <div className="login-subtitle">
            You do not have admin privileges. Please contact your administrator.
          </div>
          <Button variant="primary" onClick={logout} style={{ width: "100%" }}>
            Logout
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <MainLayout groupedNav={groupedNav} logout={logout} />
    </Router>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
