// ============================================
// FILE: components/pages/CustomersPage.jsx
// Customers Page Component
// ============================================

import React, { useState } from 'react';
import { useCustomers } from '../../hooks/useCustomers';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { SearchInput } from '../ui/SearchInput';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Pagination } from '../ui/Pagination';
import { StatusBadge } from '../ui/StatusBadge';
import { Drawer } from '../ui/Drawer';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { formatDate } from '../../utils/formatters';

const ZONES = [
  { value: 'all', label: 'All Zones' },
  { value: 'Bangalore', label: 'Bangalore' },
  { value: 'Mumbai', label: 'Mumbai' },
  { value: 'Delhi', label: 'Delhi' },
];

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'paused', label: 'Paused' },
];

export function CustomersPage() {
  const {
    customers,
    loading,
    error,
    page,
    totalPages,
    totalCount,
    filters,
    updateFilters,
    goToPage,
    refresh,
  } = useCustomers();

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useDataRefresh(refresh, 60000, true);

  if (loading && customers.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>
        Error loading customers: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div className="page-title">Customers</div>
          <div className="page-sub">{totalCount} customers found</div>
        </div>
        <Button variant="primary">+ Add Customer</Button>
      </div>

      <div className="search-filter">
        <SearchInput
          placeholder="Search name or phone..."
          value={filters.search}
          onChange={(value) => updateFilters({ search: value })}
        />
        <Select
          value={filters.zone}
          onChange={(value) => updateFilters({ zone: value })}
          options={ZONES}
        />
        <Select
          value={filters.status}
          onChange={(value) => updateFilters({ status: value })}
          options={STATUSES}
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Zone</th>
                <th>Subscriptions</th>
                <th>Wallet</th>
                <th>Bottles</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: "var(--text)" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 1 }}>{c.phone}</div>
                  </td>
                  <td><span style={{ fontSize: 12, color: "var(--text-3)" }}>{c.zone}</span></td>
                  <td>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>
                      {c.activeSubscriptions}
                    </span>
                  </td>
                  <td>
                    <span 
                      className={`badge ${c.wallet < 0 ? 'badge-red' : c.wallet < 200 ? 'badge-yellow' : 'badge-green'}`}
                      style={{fontFamily:"'DM Mono',monospace"}}
                    >
                      ₹{c.wallet.toLocaleString()}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>🍶 {c.bottles_pending} pending</span>
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Button size="sm" onClick={() => setSelectedCustomer(c)}>View</Button>
                      <Button size="sm" style={{ color: "var(--text-3)" }}>✏</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
      </div>

      {selectedCustomer && (
        <CustomerProfile customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}

function CustomerProfile({ customer, onClose }) {
  const [tab, setTab] = useState("subscriptions");

  return (
    <Drawer
      title={`Customer — ${customer.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" size="sm">Pause Account</Button>
          <Button variant="primary" size="sm">Edit Profile</Button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 16, padding: 14, background: "var(--bg)", borderRadius: 8 }}>
        <div className="driver-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
          {customer.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{customer.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{customer.phone}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-4)", marginTop: 2 }}>{customer.zone}</div>
        </div>
        <div style={{ marginLeft: "auto" }}><StatusBadge status={customer.status} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Wallet", val: `₹${customer.wallet.toLocaleString()}`, color: customer.wallet < 0 ? "var(--red)" : "var(--green)" },
          { label: "Total Orders", val: customer.totalOrders },
          { label: "Bottles Out", val: customer.bottles_pending },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'DM Mono',monospace", color: s.color || "var(--text)" }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {["subscriptions","orders","wallet","assets","notes"].map(t => (
          <div 
            key={t} 
            className={`tab ${tab === t ? "active" : ""}`} 
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      {tab === "subscriptions" && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-title">View subscriptions in detail</div>
          <div>Go to Subscriptions page to manage this customer's subscriptions</div>
        </div>
      )}

      {tab === "orders" && (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <div className="empty-title">View order history</div>
          <div>Go to Orders page to see full order details</div>
        </div>
      )}

      {tab === "wallet" && (
        <div>
          <div style={{ 
            background: customer.wallet < 0 ? "var(--red-bg)" : "var(--green-bg)", 
            borderRadius: 8, 
            padding: 14, 
            textAlign: "center", 
            marginBottom: 14 
          }}>
            <div style={{ 
              fontSize: 11, 
              color: customer.wallet < 0 ? "#991B1B" : "#15803D", 
              marginBottom: 4 
            }}>
              Current Balance
            </div>
            <div style={{ 
              fontSize: 28, 
              fontWeight: 700, 
              fontFamily: "'DM Mono',monospace", 
              color: customer.wallet < 0 ? "var(--red)" : "var(--green)" 
            }}>
              ₹{customer.wallet.toLocaleString()}
            </div>
          </div>
          <Button variant="primary" style={{ width: '100%' }}>Add Credit</Button>
        </div>
      )}

      {tab === "assets" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Issued", val: customer.bottles_issued || 0, color: "var(--blue)" },
              { label: "Returned", val: customer.bottles_returned || 0, color: "var(--green)" },
              { label: "Pending", val: customer.bottles_pending, color: customer.bottles_pending > 3 ? "var(--red)" : "var(--yellow)" },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Bottles {s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: s.color }}>🍶 {s.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "notes" && (
        <div>
          <div className="form-group">
            <label className="form-label">Add Note</label>
            <textarea 
              className="form-input" 
              style={{ height: 80, paddingTop: 8, resize: "vertical" }} 
              placeholder="Enter note about this customer..." 
            />
          </div>
          <Button variant="primary" size="sm">Save Note</Button>
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-3)" }}>No previous notes</div>
        </div>
      )}
    </Drawer>
  );
}
