// ============================================
// FILE: components/ui/UserDetailDrawer.jsx
// SINGLE SOURCE OF TRUTH for showing customer information.
// Given a userId, fetches and displays EVERYTHING about the customer:
//   - every column of the users row
//   - wallet + transactions
//   - subscriptions
//   - orders
//   - addresses
//   - support tickets
//   - bottles / bottle returns (assets)
//   - referrals
//   - preferences
// Used everywhere via <UserNameLink/> and on the Customers page.
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Drawer } from './Drawer';
import { StatusBadge } from './StatusBadge';
import { LoadingSpinner } from './LoadingSpinner';

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function Row({ label, value }) {
  return (
    <div className="stat-row" style={{ alignItems: 'flex-start' }}>
      <div className="stat-label" style={{ minWidth: 130 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, textAlign: 'right', wordBreak: 'break-word', maxWidth: 320 }}>{value ?? '—'}</div>
    </div>
  );
}

function SectionTitle({ children, count }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', margin: '4px 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>
      {children}{typeof count === 'number' ? ` (${count})` : ''}
    </div>
  );
}

function MiniTable({ columns, rows, empty, renderRow }) {
  if (!rows || rows.length === 0) {
    return <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-4)', fontSize: 12.5 }}>{empty}</div>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {columns.map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-3)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{rows.map(renderRow)}</tbody>
    </table>
  );
}

export function UserDetailDrawer({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: user },
        { data: wallet },
        { data: transactions },
        { data: subscriptions },
        { data: orders },
        { count: totalOrders },
        { data: addresses },
        { data: tickets },
        { data: bottleReturns },
        { data: referralsMade },
        { data: referralReceived },
        { data: preferences },
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(25),
        supabase.from('subscriptions').select('*, products(name)').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('orders').select('id, order_number, delivery_date, status, quantity, amount, products(name)').eq('user_id', userId).order('delivery_date', { ascending: false }).limit(25),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false }),
        supabase.from('support_tickets').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('bottle_returns').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(25),
        supabase.from('referrals').select('*').eq('referrer_id', userId).order('created_at', { ascending: false }),
        supabase.from('referrals').select('*').eq('referee_id', userId).maybeSingle(),
        supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
      ]);

      const activeSubs = (subscriptions || []).filter(s => s.status === 'active').length;
      const pendingReturns = (bottleReturns || []).filter(b => ['pending', 'requested'].includes(b.status)).length;

      setData({
        user, wallet, transactions: transactions || [], subscriptions: subscriptions || [],
        orders: orders || [], totalOrders: totalOrders || 0, addresses: addresses || [],
        tickets: tickets || [], bottleReturns: bottleReturns || [],
        referralsMade: referralsMade || [], referralReceived: referralReceived || null,
        preferences: preferences || null,
        activeSubs, pendingReturns,
      });
    } catch (err) {
      console.error('Error fetching customer details:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (userId) fetchAll(); }, [userId, fetchAll]);

  if (!userId) return null;

  const u = data?.user;
  const w = data?.wallet;

  const TABS = ['profile', 'wallet', 'subscriptions', 'orders', 'addresses', 'bottles', 'support', 'referrals'];

  return (
    <Drawer wide title={loading ? 'Loading…' : `Customer — ${u?.full_name || 'Unknown'}`} onClose={onClose}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>
      ) : !u ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>User not found</div>
      ) : (
        <>
          {/* Header */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 14, background: 'var(--bg)', borderRadius: 8 }}>
            <div className="driver-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
              {u.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{u.full_name || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{u.phone_number}</div>
              {u.email && <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 2 }}>{u.email}</div>}
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <StatusBadge status={u.is_active !== false ? 'active' : 'inactive'} />
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Wallet', val: money(w?.balance), color: (w?.balance || 0) < 0 ? 'var(--red)' : 'var(--green)' },
              { label: 'Active Subs', val: data.activeSubs },
              { label: 'Orders', val: data.totalOrders },
              { label: 'Bottles Out', val: u.bottles_pending || 0 },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'DM Mono',monospace", color: s.color || 'var(--text)' }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </div>
            ))}
          </div>

          {/* PROFILE — every users column + preferences */}
          {tab === 'profile' && (
            <div style={{ marginTop: 12 }}>
              <Row label="User ID" value={<span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{u.id}</span>} />
              <Row label="Full Name" value={u.full_name || '—'} />
              <Row label="Phone" value={u.phone_number || '—'} />
              <Row label="Email" value={u.email || '—'} />
              <Row label="Referral Code" value={u.referral_code || '—'} />
              <Row label="Referred By" value={u.referred_by || '—'} />
              <Row label="Free Sample Claimed" value={u.claimed_free_sample ? 'Yes ✓' : 'No'} />
              <Row label="Bottles Pending" value={u.bottles_pending ?? 0} />
              <Row label="Account Active" value={u.is_active !== false ? 'Yes' : 'No (blocked)'} />
              <Row label="Push Token" value={u.expo_push_token ? 'Registered ✓' : 'Not registered'} />
              <Row label="Joined" value={fmtDateTime(u.created_at)} />
              <Row label="Updated" value={fmtDateTime(u.updated_at)} />

              <div style={{ marginTop: 16 }}>
                <SectionTitle>Preferences</SectionTitle>
                {data.preferences ? (
                  <>
                    <Row label="Language" value={data.preferences.language} />
                    <Row label="Theme" value={data.preferences.theme} />
                    <Row label="Notifications" value={data.preferences.notifications_enabled ? 'On' : 'Off'} />
                    <Row label="Push" value={data.preferences.push_notifications ? 'On' : 'Off'} />
                    <Row label="SMS" value={data.preferences.sms_notifications ? 'On' : 'Off'} />
                    <Row label="Email" value={data.preferences.email_notifications ? 'On' : 'Off'} />
                  </>
                ) : (
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', padding: 8 }}>No preferences set.</div>
                )}
              </div>
            </div>
          )}

          {/* WALLET — wallet row + transactions */}
          {tab === 'wallet' && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                background: (w?.balance || 0) < 0 ? 'var(--red-bg)' : 'var(--green-bg)',
                borderRadius: 8, padding: 14, textAlign: 'center', marginBottom: 12,
              }}>
                <div style={{ fontSize: 11, color: (w?.balance || 0) < 0 ? '#991B1B' : '#15803D', marginBottom: 4 }}>Current Balance</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: (w?.balance || 0) < 0 ? 'var(--red)' : 'var(--green)' }}>
                  {money(w?.balance)}
                </div>
              </div>
              {w ? (
                <>
                  <Row label="Reserved Balance" value={money(w.reserved_balance)} />
                  <Row label="Low Balance Threshold" value={money(w.low_balance_threshold)} />
                  <Row label="AutoPay Enabled" value={w.auto_recharge_enabled ? 'Yes' : 'No'} />
                  {w.auto_recharge_enabled && <>
                    <Row label="Recharge Amount" value={money(w.auto_recharge_amount)} />
                    <Row label="Trigger Amount" value={money(w.auto_recharge_trigger_amount)} />
                    <Row label="Razorpay Token" value={w.razorpay_token_id ? 'Active' : 'Pending'} />
                    <Row label="Last AutoPay Charge" value={fmtDateTime(w.last_autopay_charge_at)} />
                  </>}
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', padding: 8 }}>No wallet record.</div>
              )}

              <div style={{ marginTop: 16 }}>
                <SectionTitle count={data.transactions.length}>Recent Transactions</SectionTitle>
                <MiniTable
                  columns={['Date', 'Type', 'Amount', 'Status']}
                  rows={data.transactions}
                  empty="No transactions"
                  renderRow={(t) => (
                    <tr key={t.id}>
                      <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{fmtDate(t.created_at)}</td>
                      <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{t.type}</td>
                      <td style={{ padding: '6px 8px', fontSize: 11.5, fontFamily: "'DM Mono',monospace", color: t.type === 'debit' ? 'var(--red)' : 'var(--green)' }}>{money(t.amount)}</td>
                      <td style={{ padding: '6px 8px' }}><StatusBadge status={t.status} /></td>
                    </tr>
                  )}
                />
              </div>
            </div>
          )}

          {/* SUBSCRIPTIONS */}
          {tab === 'subscriptions' && (
            <div style={{ marginTop: 12 }}>
              <MiniTable
                columns={['Product', 'Freq', 'Qty', 'Status', 'Start', 'End']}
                rows={data.subscriptions}
                empty="No subscriptions"
                renderRow={(s) => (
                  <tr key={s.id}>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{s.products?.name || '—'}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{s.frequency}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{s.quantity}</td>
                    <td style={{ padding: '6px 8px' }}><StatusBadge status={s.status} /></td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{fmtDate(s.start_date)}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{fmtDate(s.end_date)}</td>
                  </tr>
                )}
              />
            </div>
          )}

          {/* ORDERS */}
          {tab === 'orders' && (
            <div style={{ marginTop: 12 }}>
              <MiniTable
                columns={['Order', 'Date', 'Product', 'Qty', 'Amount', 'Status']}
                rows={data.orders}
                empty="No orders"
                renderRow={(o) => (
                  <tr key={o.id}>
                    <td style={{ padding: '6px 8px', fontSize: 11, fontFamily: "'DM Mono',monospace", color: 'var(--text-3)' }}>{o.order_number}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{fmtDate(o.delivery_date)}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{o.products?.name || '—'}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{o.quantity}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5, fontFamily: "'DM Mono',monospace" }}>{money(o.amount)}</td>
                    <td style={{ padding: '6px 8px' }}><StatusBadge status={o.status} /></td>
                  </tr>
                )}
              />
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-4)', textAlign: 'center' }}>
                Showing latest {data.orders.length} of {data.totalOrders} total orders
              </div>
            </div>
          )}

          {/* ADDRESSES */}
          {tab === 'addresses' && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.addresses.length === 0 ? (
                <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-4)', fontSize: 12.5 }}>No addresses</div>
              ) : data.addresses.map(a => (
                <div key={a.id} style={{ background: 'var(--bg)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{a.name || 'Address'}</span>
                    {a.is_default && <span style={{ fontSize: 10.5, color: 'var(--green)', background: 'var(--green-bg)', padding: '1px 6px', borderRadius: 4 }}>Default</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {[a.address_line1, a.address_line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(', ')}
                  </div>
                  {a.delivery_instructions && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 4 }}>📝 {a.delivery_instructions}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* BOTTLES / ASSETS */}
          {tab === 'bottles' && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Bottles Pending Return</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: (u.bottles_pending || 0) > 3 ? 'var(--red)' : 'var(--yellow)' }}>
                    🍶 {u.bottles_pending || 0}
                  </div>
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Pending Pickups</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{data.pendingReturns}</div>
                </div>
              </div>
              <SectionTitle count={data.bottleReturns.length}>Bottle Returns</SectionTitle>
              <MiniTable
                columns={['Date', 'Qty', 'Status', 'Collected']}
                rows={data.bottleReturns}
                empty="No bottle returns"
                renderRow={(b) => (
                  <tr key={b.id}>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{fmtDate(b.return_date || b.created_at)}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{b.quantity}</td>
                    <td style={{ padding: '6px 8px' }}><StatusBadge status={b.status} /></td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{fmtDate(b.collected_at)}</td>
                  </tr>
                )}
              />
            </div>
          )}

          {/* SUPPORT TICKETS */}
          {tab === 'support' && (
            <div style={{ marginTop: 12 }}>
              <MiniTable
                columns={['Ticket', 'Subject', 'Priority', 'Status', 'Created']}
                rows={data.tickets}
                empty="No support tickets"
                renderRow={(t) => (
                  <tr key={t.id}>
                    <td style={{ padding: '6px 8px', fontSize: 11, fontFamily: "'DM Mono',monospace", color: 'var(--text-3)' }}>{t.ticket_number}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{t.subject}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{t.priority}</td>
                    <td style={{ padding: '6px 8px' }}><StatusBadge status={t.status} /></td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{fmtDate(t.created_at)}</td>
                  </tr>
                )}
              />
            </div>
          )}

          {/* REFERRALS */}
          {tab === 'referrals' && (
            <div style={{ marginTop: 12 }}>
              <SectionTitle>Referred By</SectionTitle>
              {data.referralReceived ? (
                <>
                  <Row label="Referrer" value={<span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{data.referralReceived.referrer_id}</span>} />
                  <Row label="Status" value={data.referralReceived.status} />
                  <Row label="Reward (to referee)" value={money(data.referralReceived.referee_reward_amount)} />
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', padding: 8 }}>Not referred by anyone.</div>
              )}

              <div style={{ marginTop: 16 }}>
                <SectionTitle count={data.referralsMade.length}>Referrals Made</SectionTitle>
                <MiniTable
                  columns={['Referee', 'Status', 'Reward', 'Date']}
                  rows={data.referralsMade}
                  empty="No referrals made"
                  renderRow={(r) => (
                    <tr key={r.id}>
                      <td style={{ padding: '6px 8px', fontSize: 11, fontFamily: "'DM Mono',monospace", color: 'var(--text-3)' }}>{r.referee_id?.slice(0, 8)}…</td>
                      <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{r.status}</td>
                      <td style={{ padding: '6px 8px', fontSize: 11.5, fontFamily: "'DM Mono',monospace" }}>{money(r.referrer_reward_amount)}</td>
                      <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{fmtDate(r.created_at)}</td>
                    </tr>
                  )}
                />
              </div>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
