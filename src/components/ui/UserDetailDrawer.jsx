// ============================================
// FILE: components/ui/UserDetailDrawer.jsx
// Reusable drawer that fetches and displays full user details
// when given a userId. Used via UserNameLink on all admin pages.
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Drawer } from './Drawer';
import { StatusBadge } from './StatusBadge';
import { LoadingSpinner } from './LoadingSpinner';

export function UserDetailDrawer({ userId, onClose }) {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [stats, setStats] = useState({ activeSubs: 0, totalOrders: 0, pendingReturns: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  const fetchUserDetails = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch user, wallet, subs count, orders count, returns count in parallel
      const [
        { data: userData },
        { data: walletData },
        { count: activeSubs },
        { count: totalOrders },
        { count: pendingReturns },
        { data: ordersData },
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('bottle_returns').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['pending', 'requested']),
        supabase.from('orders').select('id, order_number, delivery_date, status, quantity, amount, products(name)').eq('user_id', userId).order('delivery_date', { ascending: false }).limit(5),
      ]);

      setUser(userData);
      setWallet(walletData);
      setStats({
        activeSubs: activeSubs || 0,
        totalOrders: totalOrders || 0,
        pendingReturns: pendingReturns || 0,
      });
      setRecentOrders(ordersData || []);
    } catch (err) {
      console.error('Error fetching user details:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchUserDetails();
  }, [userId, fetchUserDetails]);

  if (!userId) return null;

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

  return (
    <Drawer title={loading ? 'Loading...' : `Customer — ${user?.full_name || 'Unknown'}`} onClose={onClose}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>
      ) : !user ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>User not found</div>
      ) : (
        <>
          {/* Profile Header */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 14, background: 'var(--bg)', borderRadius: 8 }}>
            <div className="driver-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
              {user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{user.full_name || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{user.phone_number}</div>
              {user.email && <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 2 }}>{user.email}</div>}
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <StatusBadge status={user.is_active !== false ? 'active' : 'inactive'} />
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Wallet', val: `₹${wallet?.balance?.toLocaleString() || '0'}`, color: (wallet?.balance || 0) < 0 ? 'var(--red)' : 'var(--green)' },
              { label: 'Active Subs', val: stats.activeSubs },
              { label: 'Bottles Out', val: user.bottles_pending || 0 },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'DM Mono',monospace", color: s.color || 'var(--text)' }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="tabs">
            {['overview', 'orders', 'wallet'].map(t => (
              <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </div>
            ))}
          </div>

          {tab === 'overview' && (
            <div style={{ marginTop: 12 }}>
              {[
                { label: 'Phone', val: user.phone_number || '—' },
                { label: 'Email', val: user.email || '—' },
                { label: 'Joined', val: fmtDate(user.created_at) },
                { label: 'Referred By', val: user.referred_by || '—' },
                { label: 'Trial Sample Claimed', val: user.claimed_free_sample ? 'Yes ✓' : 'No' },
                { label: 'Total Orders', val: stats.totalOrders },
                { label: 'Pending Returns', val: stats.pendingReturns },
              ].map(r => (
                <div key={r.label} className="stat-row">
                  <div className="stat-label">{r.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.val}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'orders' && (
            <div style={{ marginTop: 12 }}>
              {recentOrders.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-4)' }}>No orders yet</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Order', 'Date', 'Product', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-3)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map(o => (
                      <tr key={o.id}>
                        <td style={{ padding: '6px 8px', fontSize: 11.5, fontFamily: "'DM Mono',monospace", color: 'var(--text-3)' }}>{o.order_number}</td>
                        <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{fmtDate(o.delivery_date)}</td>
                        <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{o.products?.name || '—'}</td>
                        <td style={{ padding: '6px 8px' }}><StatusBadge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-4)', textAlign: 'center' }}>
                Showing last 5 orders · {stats.totalOrders} total
              </div>
            </div>
          )}

          {tab === 'wallet' && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                background: (wallet?.balance || 0) < 0 ? 'var(--red-bg)' : 'var(--green-bg)',
                borderRadius: 8, padding: 14, textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: (wallet?.balance || 0) < 0 ? '#991B1B' : '#15803D', marginBottom: 4 }}>Current Balance</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: (wallet?.balance || 0) < 0 ? 'var(--red)' : 'var(--green)' }}>
                  ₹{wallet?.balance?.toLocaleString() || '0'}
                </div>
              </div>
              {wallet?.reserved_balance > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--yellow)' }}>
                  Reserved: ₹{wallet.reserved_balance.toLocaleString()} (held for upcoming orders)
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
