// ============================================
// FILE: components/pages/CustomersPage.jsx
// Removed: Add Customer button, edit (✏) button.
// Fixed: wallet balance display, city instead of zone.
// ============================================

import React, { useState } from 'react';
import { useCustomers } from '../../hooks/useCustomers';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { SearchInput } from '../ui/SearchInput';
import { Select } from '../ui/Select';
import { Pagination } from '../ui/Pagination';
import { StatusBadge } from '../ui/StatusBadge';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'inactive', label: 'Inactive' },
];

export function CustomersPage() {
  const {
    customers, loading, error, page, totalPages, totalCount,
    filters, minWalletBalance, updateFilters, goToPage, refresh,
  } = useCustomers();

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [tab, setTab] = useState('info');

  useDataRefresh(refresh, 60000, true);

  if (loading && customers.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="card" style={{ margin: '20px', padding: '20px', color: 'var(--red)' }}>Error: {error}</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Customers</div>
        <div className="page-sub">{totalCount} total customers</div>
      </div>

      <div className="search-filter">
        <SearchInput
          placeholder="Search name or phone..."
          value={filters.search}
          onChange={value => updateFilters({ search: value })}
        />
        <Select
          value={filters.status}
          onChange={value => updateFilters({ status: value })}
          options={STATUSES}
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>City</th>
                <th>Active Subs</th>
                <th>Wallet Balance</th>
                <th>Bottles Pending</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-4)' }}>No customers found</td></tr>
              ) : customers.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--text)' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 1 }}>{c.phone}</div>
                  </td>
                  <td><span style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.city}</span></td>
                  <td><span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>{c.activeSubscriptions}</span></td>
                  <td>
                    <span
                      className={`badge ${c.wallet < 0 ? 'badge-red' : c.wallet < minWalletBalance ? 'badge-yellow' : 'badge-green'}`}
                      style={{ fontFamily: "'DM Mono',monospace" }}
                    >
                      ₹{c.wallet.toLocaleString()}
                    </span>
                  </td>
                  <td><span style={{ fontSize: 12, color: 'var(--text-3)' }}>🍶 {c.bottles_pending} pending</span></td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    <Button size="sm" onClick={() => { setSelectedCustomer(c); setTab('info'); }}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
      </div>

      {selectedCustomer && (
        <Drawer title={`Customer — ${selectedCustomer.name}`} onClose={() => setSelectedCustomer(null)}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 14, background: 'var(--bg)', borderRadius: 8 }}>
            <div className="driver-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
              {selectedCustomer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedCustomer.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{selectedCustomer.phone}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 2 }}>{selectedCustomer.city}</div>
            </div>
            <div style={{ marginLeft: 'auto' }}><StatusBadge status={selectedCustomer.status} /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Wallet', val: `₹${selectedCustomer.wallet.toLocaleString()}`, color: selectedCustomer.wallet < 0 ? 'var(--red)' : 'var(--green)' },
              { label: 'Active Subs', val: selectedCustomer.activeSubscriptions },
              { label: 'Bottles Out', val: selectedCustomer.bottles_pending },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'DM Mono',monospace", color: s.color || 'var(--text)' }}>{s.val}</div>
              </div>
            ))}
          </div>

          <div className="tabs">
            {['info', 'wallet', 'assets'].map(t => (
              <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </div>
            ))}
          </div>

          {tab === 'info' && (
            <div style={{ marginTop: 12 }}>
              {[
                { label: 'Email', val: selectedCustomer.email || '—' },
                { label: 'Joined', val: selectedCustomer.joined || '—' },
                { label: 'Total Subscriptions', val: selectedCustomer.totalOrders },
              ].map(r => (
                <div key={r.label} className="stat-row">
                  <div className="stat-label">{r.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.val}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'wallet' && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                background: selectedCustomer.wallet < 0 ? 'var(--red-bg)' : 'var(--green-bg)',
                borderRadius: 8, padding: 14, textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: selectedCustomer.wallet < 0 ? '#991B1B' : '#15803D', marginBottom: 4 }}>Current Balance</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: selectedCustomer.wallet < 0 ? 'var(--red)' : 'var(--green)' }}>
                  ₹{selectedCustomer.wallet.toLocaleString()}
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
                Low balance threshold: ₹{minWalletBalance}
              </div>
            </div>
          )}

          {tab === 'assets' && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Bottles Pending Return</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: selectedCustomer.bottles_pending > 3 ? 'var(--red)' : 'var(--yellow)' }}>
                  🍶 {selectedCustomer.bottles_pending}
                </div>
              </div>
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
}
