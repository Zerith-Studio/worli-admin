// ============================================
// FILE: App.jsx
// Main App Component - Admin Dashboard
// ============================================

import React, { useState, useMemo } from "react"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { LoginPage } from "./components/LoginPage"
import {
  DashboardPage,
  CustomersPage,
  SubscriptionsPage,
  OrdersPage,
  DeliverySchedulePage,
  DemandForecastPage,
  RoutesPage,
  DriversPage,
  WalletPage,
  AssetTrackingPage,
  SettingsPage,
} from "./components/pages"
import { Button } from "./components/ui/Button"
import { NAV_ITEMS, GROUP_LABELS, PAGE_TITLES } from "./constants"
import "./styles/index.css"

function AppContent() {
  const [currentPage, setCurrentPage] = useState("dashboard")
  const { user, isAdmin, loading, logout } = useAuth()

  // Calculate badge counts for nav items
  const navItemsWithBadges = useMemo(() => {
    // In a real app, these would come from actual data
    // For now, we'll keep it simple
    return NAV_ITEMS.map((item) => ({
      ...item,
      badge: item.key === "orders" ? 3 : 0, // Mock badge for failed orders
    }))
  }, [])

  // Group nav items
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

  // Render current page
  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage onNav={setCurrentPage} />
      case "customers":
        return <CustomersPage />
      case "subscriptions":
        return <SubscriptionsPage />
      case "orders":
        return <OrdersPage />
      case "schedule":
        return <DeliverySchedulePage />
      case "forecast":
        return <DemandForecastPage />
      case "routes":
        return <RoutesPage />
      case "drivers":
        return <DriversPage />
      case "wallet":
        return <WalletPage />
      case "assets":
        return <AssetTrackingPage />
      case "settings":
        return <SettingsPage />
      default:
        return <DashboardPage onNav={setCurrentPage} />
    }
  }

  // If auth is still checking, show loading state
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

  // If not logged in, show login page
  if (!user) {
    return <LoginPage />
  }

  // If logged in but not admin, show access denied
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
    <div className="app">
      {/* Sidebar */}
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
                className={`nav-item ${currentPage === item.key ? "active" : ""}`}
                onClick={() => setCurrentPage(item.key)}
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
      </div>

      {/* Main Content Area */}
      <div className="main-area">
        {/* Top Bar */}
        <div className="topbar">
          <div>
            <div className="topbar-title">
              {PAGE_TITLES[currentPage] || "Dashboard"}
            </div>
          </div>
          <div className="topbar-right">
            <div className="topbar-search">
              <span style={{ color: "var(--text-4)", fontSize: 12 }}>🔍</span>
              <input placeholder="Quick search..." />
            </div>
            <div className="icon-btn" title="Notifications">
              🔔
              <div className="notif-dot" />
            </div>
            <div
              className="avatar"
              title={user?.phone || "Admin"}
              onClick={logout}
              style={{ cursor: "pointer" }}
            >
              {user?.phone?.slice(-2) || "AD"}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="content">{renderPage()}</div>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
