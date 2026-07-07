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
import { throwFunctionError } from '../../lib/function-errors';
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
  const [products, setProducts] = useState([]);

  // Create Order state
  const [orderForm, setOrderForm] = useState({ product_id: '', address_id: '', delivery_date: '', quantity: '1', amount: '0' });
  const [orderState, setOrderState] = useState({ loading: false, error: null, success: null });

  // Create Subscription state
  const [subForm, setSubForm] = useState({ product_id: '', address_id: '', frequency: 'daily', quantity: '1', start_date: '', duration_months: '1', interval_days: '2', custom_quantities: { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 } });
  const [subState, setSubState] = useState({ loading: false, error: null, success: null });

  // Create Address state
  const [addressForm, setAddressForm] = useState({ name: 'Home', address_line1: '', address_line2: '', floor_number: '', landmark: '', city: '', state: '', pincode: '', delivery_instructions: '', latitude: '', longitude: '' });
  const [addressState, setAddressState] = useState({ loading: false, error: null, success: null });

  // Wallet adjust state
  const [walletForm, setWalletForm] = useState({ new_balance: '', create_txn: true, note: '' });
  const [walletState, setWalletState] = useState({ loading: false, error: null, success: null });
  const [showWalletForm, setShowWalletForm] = useState(false);

  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showSubForm, setShowSubForm] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);

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

  // Fetch products for create forms
  useEffect(() => {
    supabase.from('products').select('id, name, price').eq('is_active', true).then(({ data }) => {
      if (data) setProducts(data);
    });
  }, []);

  const handleCreateOrder = async () => {
    if (!orderForm.product_id || !orderForm.address_id || !orderForm.delivery_date) {
      setOrderState({ loading: false, error: 'Product, address and delivery date are required.', success: null }); return;
    }
    setOrderState({ loading: true, error: null, success: null });
    try {
      const orderNum = `ADM-${Date.now().toString(36).toUpperCase()}`;
      const payload = {
        order_number: orderNum,
        user_id: userId,
        product_id: orderForm.product_id,
        address_id: orderForm.address_id,
        delivery_date: orderForm.delivery_date,
        quantity: parseInt(orderForm.quantity) || 1,
        amount: parseFloat(orderForm.amount) || 0,
        status: 'scheduled',
      };
      
      const res = await supabase.functions.invoke('admin-db-action', {
        body: { action: 'insert', table: 'orders', payload }
      });
      if (res.error) await throwFunctionError(res.error, res.data);
      if (res.data?.error) await throwFunctionError(null, res.data);
      
      setOrderState({ loading: false, error: null, success: `Order ${orderNum} created!` });
      fetchAll();
    } catch (err) { setOrderState({ loading: false, error: err.message, success: null }); }
  };

  const handleCreateSubscription = async () => {
    if (!subForm.product_id || !subForm.address_id || !subForm.start_date) {
      setSubState({ loading: false, error: 'Product, address and start date are required.', success: null }); return;
    }
    setSubState({ loading: true, error: null, success: null });
    try {
      // Create via the reserve-balance RPC so wallet funds are reserved and
      // delivery orders are pre-generated (same path as the consumer app).
      // This also derives end_date, so no more 400 from the missing column.
      const params = {
        p_user_id: userId,
        p_product_id: subForm.product_id,
        p_address_id: subForm.address_id,
        p_frequency: subForm.frequency,
        p_duration_months: parseInt(subForm.duration_months) || 1,
        p_start_date: subForm.start_date,
        p_quantity: parseInt(subForm.quantity) || 1,
        p_interval_days: subForm.frequency === 'on_interval' ? (parseInt(subForm.interval_days) || 2) : null,
        p_custom_quantities: subForm.frequency === 'custom' ? subForm.custom_quantities : null,
      };

      const res = await supabase.functions.invoke('admin-db-action', {
        body: { action: 'rpc', fn: 'rpc_create_subscription', params }
      });
      if (res.error) await throwFunctionError(res.error, res.data);
      if (res.data?.error) {
        const d = res.data.data;
        if (d?.error === 'INSUFFICIENT_FUNDS') {
          throw new Error(`Insufficient wallet balance. Short by ₹${Number(d.shortfall || 0).toFixed(2)}. Top up the wallet first.`);
        }
        await throwFunctionError(null, res.data);
      }

      setSubState({ loading: false, error: null, success: 'Subscription created successfully!' });
      setTimeout(() => setShowSubForm(false), 1500);
      fetchAll();
    } catch (err) { setSubState({ loading: false, error: err.message, success: null }); }
  };

  const handleAdjustWallet = async () => {
    const newBal = parseFloat(walletForm.new_balance);
    if (isNaN(newBal) || newBal < 0) {
      setWalletState({ loading: false, error: 'Enter a valid non-negative balance.', success: null }); return;
    }
    setWalletState({ loading: true, error: null, success: null });
    try {
      const res = await supabase.functions.invoke('admin-db-action', {
        body: {
          action: 'rpc', fn: 'rpc_admin_adjust_wallet',
          params: { p_user_id: userId, p_new_balance: newBal, p_create_txn: walletForm.create_txn, p_note: walletForm.note || null },
        },
      });
      if (res.error) await throwFunctionError(res.error, res.data);
      if (res.data?.error) await throwFunctionError(null, res.data);
      setWalletState({ loading: false, error: null, success: `Balance updated to ${money(newBal)}.` });
      setWalletForm({ new_balance: '', create_txn: true, note: '' });
      setTimeout(() => setShowWalletForm(false), 1200);
      fetchAll();
    } catch (err) { setWalletState({ loading: false, error: err.message, success: null }); }
  };

  const handleCreateAddress = async () => {
    if (!addressForm.address_line1 || !addressForm.city || !addressForm.pincode || !addressForm.floor_number) {
      setAddressState({ loading: false, error: 'Floor, Address Line 1, City, and Pincode are required.', success: null }); return;
    }
    setAddressState({ loading: true, error: null, success: null });
    try {
      const payload = {
        user_id: userId,
        name: addressForm.name || 'Home',
        address_line1: addressForm.address_line1,
        address_line2: addressForm.address_line2,
        floor_number: addressForm.floor_number,
        landmark: addressForm.landmark,
        city: addressForm.city,
        state: addressForm.state,
        pincode: addressForm.pincode,
        delivery_instructions: addressForm.delivery_instructions,
        latitude: addressForm.latitude ? parseFloat(addressForm.latitude) : null,
        longitude: addressForm.longitude ? parseFloat(addressForm.longitude) : null,
        is_default: data?.addresses?.length === 0, // make default if it's the first one
      };

      const res = await supabase.functions.invoke('admin-db-action', {
        body: { action: 'insert', table: 'addresses', payload }
      });
      if (res.error) await throwFunctionError(res.error, res.data);
      if (res.data?.error) await throwFunctionError(null, res.data);

      setAddressState({ loading: false, error: null, success: 'Address created!' });
      setAddressForm({ name: 'Home', address_line1: '', address_line2: '', floor_number: '', landmark: '', city: '', state: '', pincode: '', delivery_instructions: '', latitude: '', longitude: '' });
      setTimeout(() => setShowAddressForm(false), 1500);
      fetchAll();
    } catch (err) { setAddressState({ loading: false, error: err.message, success: null }); }
  };

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
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                  Reserved {money(w?.reserved_balance)} · Available {money((w?.balance || 0) - (w?.reserved_balance || 0))}
                </div>
              </div>

              {/* Adjust balance */}
              <div style={{ marginBottom: 12 }}>
                <button onClick={() => setShowWalletForm(!showWalletForm)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  {showWalletForm ? 'Cancel' : '✎ Adjust Balance'}
                </button>
                {showWalletForm && (
                  <div style={{ marginTop: 10, padding: 12, background: 'var(--bg)', borderRadius: 8, display: 'grid', gap: 8 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-3)' }}>New balance (₹)</label>
                    <input type="number" min="0" step="0.01" value={walletForm.new_balance}
                      onChange={(e) => setWalletForm(f => ({ ...f, new_balance: e.target.value }))}
                      placeholder={`Current: ${money(w?.balance)}`}
                      style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 13 }} />
                    <input type="text" value={walletForm.note}
                      onChange={(e) => setWalletForm(f => ({ ...f, note: e.target.value }))}
                      placeholder="Note (optional, shown in transaction)"
                      style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 13 }} />
                    <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={walletForm.create_txn}
                        onChange={(e) => setWalletForm(f => ({ ...f, create_txn: e.target.checked }))} />
                      Record as a transaction (credit/debit) in history
                    </label>
                    {walletState.error && <div style={{ fontSize: 11.5, color: 'var(--red)' }}>{walletState.error}</div>}
                    {walletState.success && <div style={{ fontSize: 11.5, color: 'var(--green)' }}>{walletState.success}</div>}
                    <button onClick={handleAdjustWallet} disabled={walletState.loading}
                      style={{ fontSize: 12, padding: '6px 12px', borderRadius: 4, background: 'var(--green)', color: '#fff', border: 'none', cursor: 'pointer', justifySelf: 'start' }}>
                      {walletState.loading ? 'Saving…' : 'Save Balance'}
                    </button>
                  </div>
                )}
              </div>

              {w ? (
                <>
                  <Row label="Reserved Balance" value={money(w.reserved_balance)} />
                  <Row label="Available Balance" value={money((w.balance || 0) - (w.reserved_balance || 0))} />
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <SectionTitle count={data.subscriptions.length}>Subscriptions</SectionTitle>
                <button onClick={() => setShowSubForm(!showSubForm)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  {showSubForm ? 'Cancel' : '+ New Subscription'}
                </button>
              </div>

              {showSubForm && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Product *</label>
                      <select className="form-select" value={subForm.product_id} onChange={e => setSubForm(p => ({ ...p, product_id: e.target.value }))}>
                        <option value="">— Select Product —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} (₹{p.price}/unit)</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Address *</label>
                      <select className="form-select" value={subForm.address_id} onChange={e => setSubForm(p => ({ ...p, address_id: e.target.value }))}>
                        <option value="">— Select Address —</option>
                        {(data?.addresses || []).map(a => <option key={a.id} value={a.id}>{a.name} — {a.address_line1}, {a.city}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Frequency</label>
                      <select className="form-select" value={subForm.frequency} onChange={e => setSubForm(p => ({ ...p, frequency: e.target.value }))}>
                        <option value="daily">Daily</option>
                        <option value="on_interval">On Interval</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    {subForm.frequency === 'on_interval' && (
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Repeat Once In</label>
                        <select className="form-select" value={subForm.interval_days} onChange={e => setSubForm(p => ({ ...p, interval_days: e.target.value }))}>
                          <option value="2">2 Days</option>
                          <option value="3">3 Days</option>
                          <option value="4">4 Days</option>
                        </select>
                      </div>
                    )}
                    {subForm.frequency !== 'custom' && (
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Quantity</label>
                        <input type="number" min="1" className="form-input" value={subForm.quantity} onChange={e => setSubForm(p => ({ ...p, quantity: e.target.value }))} />
                      </div>
                    )}
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Duration (months, blank = open)</label>
                      <input type="number" min="1" className="form-input" value={subForm.duration_months} onChange={e => setSubForm(p => ({ ...p, duration_months: e.target.value }))} />
                    </div>
                  </div>

                  {subForm.frequency === 'custom' && (
                    <div className="form-group">
                      <label className="form-label">Custom Quantities (Per Day)</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--blue-bg)', padding: '6px 8px', borderRadius: 6, flex: 1, minWidth: 40 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4, fontWeight: 600 }}>{day}</span>
                            <input
                              type="number" min="0" style={{ width: '100%', textAlign: 'center', padding: '4px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}
                              value={subForm.custom_quantities[String(idx)]}
                              onChange={e => setSubForm(p => ({ ...p, custom_quantities: { ...p.custom_quantities, [String(idx)]: parseInt(e.target.value) || 0 } }))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input type="date" className="form-input" style={{ maxWidth: 200 }} value={subForm.start_date} onChange={e => setSubForm(p => ({ ...p, start_date: e.target.value }))} />
                  </div>
                  {subState.error && <div style={{ padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 12 }}>{subState.error}</div>}
                  {subState.success && <div style={{ padding: '8px 12px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 6, fontSize: 12 }}>✓ {subState.success}</div>}
                  <button
                    style={{ alignSelf: 'flex-start', padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: subState.loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: subState.loading ? 0.7 : 1 }}
                    onClick={handleCreateSubscription} disabled={subState.loading}
                  >
                    {subState.loading ? 'Creating...' : 'Create Subscription'}
                  </button>
                </div>
              )}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <SectionTitle>Orders</SectionTitle>
                <button onClick={() => setShowOrderForm(!showOrderForm)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  {showOrderForm ? 'Cancel' : '+ New Order'}
                </button>
              </div>

              {showOrderForm && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Product *</label>
                      <select className="form-select" value={orderForm.product_id} onChange={e => setOrderForm(p => ({ ...p, product_id: e.target.value }))}>
                        <option value="">— Select Product —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Address *</label>
                      <select className="form-select" value={orderForm.address_id} onChange={e => setOrderForm(p => ({ ...p, address_id: e.target.value }))}>
                        <option value="">— Select Address —</option>
                        {(data?.addresses || []).map(a => <option key={a.id} value={a.id}>{a.name} — {a.address_line1}, {a.city}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Delivery Date *</label>
                      <input type="date" className="form-input" value={orderForm.delivery_date} onChange={e => setOrderForm(p => ({ ...p, delivery_date: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Quantity</label>
                      <input type="number" min="1" className="form-input" value={orderForm.quantity} onChange={e => setOrderForm(p => ({ ...p, quantity: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Amount (₹)</label>
                      <input type="number" min="0" className="form-input" value={orderForm.amount} onChange={e => setOrderForm(p => ({ ...p, amount: e.target.value }))} />
                    </div>
                  </div>
                  {orderState.error && <div style={{ padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 12 }}>{orderState.error}</div>}
                  {orderState.success && <div style={{ padding: '8px 12px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 6, fontSize: 12 }}>✓ {orderState.success}</div>}
                  <button
                    style={{ alignSelf: 'flex-start', padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: orderState.loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: orderState.loading ? 0.7 : 1 }}
                    onClick={handleCreateOrder} disabled={orderState.loading}
                  >
                    {orderState.loading ? 'Creating...' : 'Create Order'}
                  </button>
                </div>
              )}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <SectionTitle count={data.addresses.length}>Addresses</SectionTitle>
                <button onClick={() => setShowAddressForm(!showAddressForm)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  {showAddressForm ? 'Cancel' : '+ New Address'}
                </button>
              </div>

              {showAddressForm && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Type (e.g., Home, Work)</label>
                      <input className="form-input" value={addressForm.name} onChange={e => setAddressForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">City *</label>
                      <input className="form-input" value={addressForm.city} onChange={e => setAddressForm(p => ({ ...p, city: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Pincode *</label>
                      <input className="form-input" value={addressForm.pincode} onChange={e => setAddressForm(p => ({ ...p, pincode: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div className="form-group" style={{ flex: 2 }}>
                      <label className="form-label">Address Line 1 (House No, Building) *</label>
                      <input className="form-input" value={addressForm.address_line1} onChange={e => setAddressForm(p => ({ ...p, address_line1: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Landmark</label>
                      <input className="form-input" value={addressForm.landmark} onChange={e => setAddressForm(p => ({ ...p, landmark: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address Line 2 (Area, Street)</label>
                    <input className="form-input" value={addressForm.address_line2} onChange={e => setAddressForm(p => ({ ...p, address_line2: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Floor *</label>
                    <input className="form-input" placeholder="e.g. Ground, 2nd Floor" value={addressForm.floor_number} onChange={e => setAddressForm(p => ({ ...p, floor_number: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Delivery Instructions</label>
                    <input className="form-input" placeholder="e.g. Leave at door, don't ring bell" value={addressForm.delivery_instructions} onChange={e => setAddressForm(p => ({ ...p, delivery_instructions: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Latitude (optional)</label>
                      <input className="form-input" type="number" step="any" placeholder="e.g. 19.0760" value={addressForm.latitude} onChange={e => setAddressForm(p => ({ ...p, latitude: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Longitude (optional)</label>
                      <input className="form-input" type="number" step="any" placeholder="e.g. 72.8777" value={addressForm.longitude} onChange={e => setAddressForm(p => ({ ...p, longitude: e.target.value }))} />
                    </div>
                  </div>
                  {addressState.error && <div style={{ padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 12 }}>{addressState.error}</div>}
                  {addressState.success && <div style={{ padding: '8px 12px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 6, fontSize: 12 }}>✓ {addressState.success}</div>}
                  <button
                    style={{ alignSelf: 'flex-start', padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: addressState.loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: addressState.loading ? 0.7 : 1 }}
                    onClick={handleCreateAddress} disabled={addressState.loading}
                  >
                    {addressState.loading ? 'Creating...' : 'Create Address'}
                  </button>
                </div>
              )}
              {data.addresses.length === 0 ? (
                <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-4)', fontSize: 12.5 }}>No addresses</div>
              ) : data.addresses.map(a => (
                <div key={a.id} style={{ background: 'var(--bg)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{a.name || 'Address'}</span>
                    {a.is_default && <span style={{ fontSize: 10.5, color: 'var(--green)', background: 'var(--green-bg)', padding: '1px 6px', borderRadius: 4 }}>Default</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {[a.address_line1, a.address_line2, a.floor_number && `Floor: ${a.floor_number}`, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(', ')}
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
