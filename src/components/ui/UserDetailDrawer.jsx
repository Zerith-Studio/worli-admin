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

/** Rows loaded per step for the open-ended history lists (transactions, orders, returns). */
const HISTORY_PAGE = 25;
const INITIAL_LIMITS = {
  transactions: HISTORY_PAGE,
  orders: HISTORY_PAGE,
  bottleReturns: HISTORY_PAGE,
};

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

/**
 * Grows one of the history lists. Rendered only when there is more to show —
 * these lists were previously capped at 25 with no indication that anything was
 * missing, which on a wallet or delivery history is the kind of omission that
 * makes an admin distrust the whole screen.
 */
function LoadMore({ shown, total, onClick, loading, label }) {
  if (shown >= total) return null;
  return (
    <div style={{ marginTop: 8, textAlign: 'center' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 6,
          padding: '6px 14px', fontSize: 11.5, cursor: loading ? 'default' : 'pointer',
          color: 'var(--text-2)',
        }}
      >
        {loading ? 'Loading…' : `Load more ${label} (${shown} of ${total})`}
      </button>
    </div>
  );
}
const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const positiveInt = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const fmtDuration = (sub) => {
  if (sub?.duration_months && sub?.duration_days) return `${sub.duration_months}mo / ${sub.duration_days} days`;
  if (sub?.duration_days) return `${sub.duration_days} days`;
  if (sub?.duration_months) return `${sub.duration_months}mo`;
  return '—';
};

// Mirrors the consumer app's edit cutoff: edits take effect from the next
// deliverable date. Cutoff is 19:00 IST — past it, the soonest editable date is
// two days out, otherwise tomorrow. If the sub's own start is still in the
// future, that later date wins. Returns a YYYY-MM-DD string.
const getEffectiveDate = (originalStartDate) => {
  const nowIST = new Date(Date.now() + 5.5 * 3600 * 1000);
  const base = new Date(nowIST);
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + (nowIST.getUTCHours() >= 19 ? 2 : 1));
  const cutoff = base.toISOString().slice(0, 10);
  return originalStartDate && originalStartDate > cutoff ? originalStartDate : cutoff;
};

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

export function UserDetailDrawer({ userId, onClose, onUserUpdated }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');
  const [products, setProducts] = useState([]);
  const [subscriptionProducts, setSubscriptionProducts] = useState([]);

  // Profile edit state
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', phone_number: '', email: '', is_active: true });
  const [profileState, setProfileState] = useState({ loading: false, error: null, success: null });

  // Create Order state
  const [orderForm, setOrderForm] = useState({ product_id: '', address_id: '', delivery_date: '', quantity: '1', amount: '0' });
  const [orderState, setOrderState] = useState({ loading: false, error: null, success: null });

  // Create Subscription state
  const [subForm, setSubForm] = useState({ product_id: '', address_id: '', frequency: 'daily', quantity: '1', start_date: '', duration_mode: 'months', duration_months: '1', duration_days: '30', interval_days: '2', custom_quantities: { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 } });
  const [subState, setSubState] = useState({ loading: false, error: null, success: null });

  // Edit Subscription state (mirrors the consumer edit + admin duration-in-days)
  const [editSub, setEditSub] = useState(null);       // the subscription being edited
  const [editForm, setEditForm] = useState(null);     // prefilled form values
  const [editState, setEditState] = useState({ loading: false, error: null, success: null });

  // Per-row actions on existing subs/orders: cancel + inline single-order qty edit.
  const [rowBusyId, setRowBusyId] = useState(null);   // id of the sub/order mid-action
  const [rowError, setRowError] = useState(null);     // error surfaced above the table
  const [editOrderId, setEditOrderId] = useState(null); // order whose qty is being edited inline
  const [editOrderQty, setEditOrderQty] = useState('1');

  // Create Address state
  const [addressForm, setAddressForm] = useState({ name: 'Home', address_line1: '', address_line2: '', floor_number: '', landmark: '', city: '', state: '', pincode: '', delivery_instructions: '', latitude: '', longitude: '' });
  const [addressState, setAddressState] = useState({ loading: false, error: null, success: null });

  // Wallet adjust state
  const [walletForm, setWalletForm] = useState({ new_balance: '', new_reserved: '', create_txn: true, note: '' });
  const [walletState, setWalletState] = useState({ loading: false, error: null, success: null });
  const [showWalletForm, setShowWalletForm] = useState(false);

  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showSubForm, setShowSubForm] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);

  // How many rows of each open-ended history list are loaded. "Load more" grows
  // the window rather than paging, which suits a narrow scrolling drawer and
  // keeps the history as one continuous list.
  const [limits, setLimits] = useState(INITIAL_LIMITS);
  const loadMore = (key) =>
    setLimits((l) => ({ ...l, [key]: l[key] + HISTORY_PAGE }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: user },
        { data: wallet },
        { data: transactions, count: totalTransactions },
        { data: subscriptions },
        { data: orders, count: totalOrders },
        { data: addresses },
        { data: tickets },
        { data: bottleReturns, count: totalBottleReturns },
        { count: pendingReturns },
        { data: referralsMade },
        { data: referralReceived },
        { data: preferences },
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
        // The three history lists below grow forever, so they load a window at a
        // time. Each carries an exact count so "Load more" knows when to stop —
        // and so the UI can say how much it isn't showing.
        supabase.from('transactions').select('*', { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false }).limit(limits.transactions),
        supabase.from('subscriptions').select('*, products(name)').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('orders').select('id, order_number, delivery_date, status, quantity, amount, products(name)', { count: 'exact' }).eq('user_id', userId).order('delivery_date', { ascending: false }).limit(limits.orders),
        supabase.from('addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false }),
        supabase.from('support_tickets').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('bottle_returns').select('*', { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false }).limit(limits.bottleReturns),
        // Counted server-side rather than by filtering the loaded window: with
        // the window capped, a customer with a long return history had their
        // outstanding count silently understated.
        supabase.from('bottle_returns').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['pending', 'requested']),
        supabase.from('referrals').select('*').eq('referrer_id', userId).order('created_at', { ascending: false }),
        supabase.from('referrals').select('*').eq('referee_id', userId).maybeSingle(),
        supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
      ]);

      const activeSubs = (subscriptions || []).filter(s => s.status === 'active').length;

      setData({
        user, wallet, transactions: transactions || [], subscriptions: subscriptions || [],
        orders: orders || [], totalOrders: totalOrders || 0, addresses: addresses || [],
        tickets: tickets || [], bottleReturns: bottleReturns || [],
        totalTransactions: totalTransactions || 0,
        totalBottleReturns: totalBottleReturns || 0,
        referralsMade: referralsMade || [], referralReceived: referralReceived || null,
        preferences: preferences || null,
        activeSubs, pendingReturns: pendingReturns || 0,
      });
    } catch (err) {
      console.error('Error fetching customer details:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, limits]);

  useEffect(() => { if (userId) fetchAll(); }, [userId, fetchAll]);

  // A new customer starts from the first window again.
  useEffect(() => { setLimits(INITIAL_LIMITS); }, [userId]);

  useEffect(() => {
    if (!data?.user) return;
    setProfileForm({
      // Edited as a bare 10-digit number behind a static +91, like every other
      // phone input in the product. The stored value is E.164 (+91XXXXXXXXXX).
      full_name: data.user.full_name || '',
      phone_number: (data.user.phone_number || '').replace(/\D/g, '').slice(-10),
      email: data.user.email || '',
      is_active: data.user.is_active !== false,
    });
  }, [data?.user]);

  // Fetch products for create forms
  useEffect(() => {
    supabase.from('products').select('id, name, price, product_type').eq('is_active', true).then(({ data }) => {
      if (data) setProducts(data);
      setSubscriptionProducts((data || []).filter(product => product.product_type === 'subscription'));
    });
  }, []);

  const handleCreateOrder = async () => {
    if (!orderForm.product_id || !orderForm.address_id || !orderForm.delivery_date) {
      setOrderState({ loading: false, error: 'Product, address and delivery date are required.', success: null }); return;
    }
    setOrderState({ loading: true, error: null, success: null });
    try {
      // Route through rpc_create_one_time_order: charges the customer's AVAILABLE
      // balance (balance − reserved) immediately, reserves nothing, and errors if
      // they're short. The amount is computed server-side from the product price,
      // so it always matches what's charged (no arbitrary manual amount).
      const res = await supabase.functions.invoke('admin-db-action', {
        body: {
          action: 'rpc', fn: 'rpc_create_one_time_order',
          params: {
            p_user_id: userId,
            p_product_id: orderForm.product_id,
            p_address_id: orderForm.address_id,
            p_quantity: parseInt(orderForm.quantity) || 1,
            p_delivery_date: orderForm.delivery_date,
          },
        },
      });
      if (res.error) await throwFunctionError(res.error, res.data);
      if (res.data?.error) {
        const d = res.data.data;
        if (d?.error === 'INSUFFICIENT_FUNDS') {
          throw new Error(`Insufficient wallet balance. Short by ₹${Number(d.shortfall || 0).toFixed(2)}. Top up the wallet first.`);
        }
        await throwFunctionError(null, res.data);
      }
      const orderNum = res.data?.data?.order_number || res.data?.order_number || '';
      setOrderState({ loading: false, error: null, success: `Order ${orderNum} created & charged!` });
      setShowOrderForm(false);
      setOrderForm({ product_id: '', address_id: '', delivery_date: '', quantity: '1', amount: '0' });
      fetchAll();
    } catch (err) { setOrderState({ loading: false, error: err.message, success: null }); }
  };

  const handleSaveProfile = async () => {
    const fullName = profileForm.full_name.trim();
    const phone = profileForm.phone_number.trim();
    const email = profileForm.email.trim();

    if (!fullName || fullName.length < 2) {
      setProfileState({ loading: false, error: 'Full name must be at least 2 characters.', success: null });
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setProfileState({ loading: false, error: 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210).', success: null });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProfileState({ loading: false, error: 'Please enter a valid email address.', success: null });
      return;
    }

    setProfileState({ loading: true, error: null, success: null });
    try {
      const res = await supabase.functions.invoke('admin-db-action', {
        body: {
          action: 'update',
          table: 'users',
          payload: {
            id: userId,
            full_name: fullName,
            phone_number: `+91${phone}`,
            email: email || null,
            is_active: !!profileForm.is_active,
          },
        },
      });
      if (res.error) await throwFunctionError(res.error, res.data);
      if (res.data?.error) await throwFunctionError(null, res.data);
      setProfileState({ loading: false, error: null, success: 'Profile updated.' });
      setShowProfileForm(false);
      await fetchAll();
      onUserUpdated?.();
    } catch (err) {
      setProfileState({ loading: false, error: err.message, success: null });
    }
  };

  const handleCreateSubscription = async () => {
    if (!subForm.product_id || !subForm.address_id || !subForm.start_date) {
      setSubState({ loading: false, error: 'Product, address and start date are required.', success: null }); return;
    }
    const durationMonths = subForm.duration_mode === 'months' ? positiveInt(subForm.duration_months) : null;
    const durationDays = subForm.duration_mode === 'days' ? positiveInt(subForm.duration_days) : null;
    if (subForm.duration_mode === 'months' && !durationMonths) {
      setSubState({ loading: false, error: 'Enter a valid positive month duration.', success: null }); return;
    }
    if (subForm.duration_mode === 'days' && !durationDays) {
      setSubState({ loading: false, error: 'Enter a valid positive day duration.', success: null }); return;
    }
    const quantity = positiveInt(subForm.quantity);
    if (subForm.frequency !== 'custom' && !quantity) {
      setSubState({ loading: false, error: 'Quantity must be at least 1.', success: null }); return;
    }
    const intervalDays = subForm.frequency === 'on_interval' ? positiveInt(subForm.interval_days) : null;
    if (subForm.frequency === 'on_interval' && !intervalDays) {
      setSubState({ loading: false, error: 'Interval must be at least 1 day.', success: null }); return;
    }
    const customQuantities = Object.fromEntries(
      Object.entries(subForm.custom_quantities).map(([day, value]) => [day, Math.max(0, Number.parseInt(value, 10) || 0)])
    );
    if (subForm.frequency === 'custom' && !Object.values(customQuantities).some(value => value > 0)) {
      setSubState({ loading: false, error: 'Set at least one custom day quantity greater than zero.', success: null }); return;
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
        p_duration_months: durationMonths,
        p_duration_days: durationDays,
        p_start_date: subForm.start_date,
        p_quantity: quantity || 1,
        p_interval_days: intervalDays,
        p_custom_quantities: subForm.frequency === 'custom' ? customQuantities : null,
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

  // Open the edit form prefilled from an existing subscription. Product and
  // address are fixed (rpc_edit_subscription carries them over), so they are
  // shown read-only. Duration mode is inferred: a plan with duration_months is
  // a month plan; a days-only plan edits in days.
  const openEditSub = (s) => {
    const cq = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
    if (s.custom_quantities && typeof s.custom_quantities === 'object') {
      for (const [k, v] of Object.entries(s.custom_quantities)) if (k in cq) cq[k] = Number(v) || 0;
    }
    const mode = s.duration_months ? 'months' : 'days';
    setEditForm({
      frequency: s.frequency || 'daily',
      quantity: String(s.quantity || 1),
      duration_mode: mode,
      duration_months: String(s.duration_months || 1),
      duration_days: String(s.duration_days || 30),
      interval_days: String(s.interval_days || 2),
      custom_quantities: cq,
    });
    setEditState({ loading: false, error: null, success: null });
    setEditSub(s);
    setShowSubForm(false);
  };

  const handleEditSubscription = async () => {
    if (!editSub || !editForm) return;
    const f = editForm;
    const isBuyOnce = f.frequency === 'buy_once';
    // Duration only applies to recurring plans; buy_once is a single delivery.
    const durationMonths = !isBuyOnce && f.duration_mode === 'months' ? positiveInt(f.duration_months) : null;
    const durationDays = !isBuyOnce && f.duration_mode === 'days' ? positiveInt(f.duration_days) : null;
    if (!isBuyOnce && f.duration_mode === 'months' && !durationMonths) {
      setEditState({ loading: false, error: 'Enter a valid positive month duration.', success: null }); return;
    }
    if (!isBuyOnce && f.duration_mode === 'days' && !durationDays) {
      setEditState({ loading: false, error: 'Enter a valid positive day duration.', success: null }); return;
    }
    const quantity = positiveInt(f.quantity);
    if (f.frequency !== 'custom' && !quantity) {
      setEditState({ loading: false, error: 'Quantity must be at least 1.', success: null }); return;
    }
    const intervalDays = f.frequency === 'on_interval' ? positiveInt(f.interval_days) : null;
    if (f.frequency === 'on_interval' && !intervalDays) {
      setEditState({ loading: false, error: 'Interval must be at least 1 day.', success: null }); return;
    }
    const customQuantities = Object.fromEntries(
      Object.entries(f.custom_quantities).map(([day, value]) => [day, Math.max(0, Number.parseInt(value, 10) || 0)])
    );
    if (f.frequency === 'custom' && !Object.values(customQuantities).some(v => v > 0)) {
      setEditState({ loading: false, error: 'Set at least one custom day quantity greater than zero.', success: null }); return;
    }
    setEditState({ loading: true, error: null, success: null });
    try {
      // Same recreate-from-effective-date path as the consumer edit; the two
      // trailing params let the admin change the length (days or months).
      const params = {
        p_old_sub_id: editSub.id,
        p_user_id: userId,
        p_effective_date: getEffectiveDate(editSub.start_date),
        p_frequency: f.frequency,
        p_quantity: quantity || 1,
        p_interval_days: intervalDays,
        p_custom_quantities: f.frequency === 'custom' ? customQuantities : null,
        p_delivery_time: editSub.delivery_time || '05:00-07:00',
        p_duration_days: durationDays,
        p_duration_months: durationMonths,
      };
      const res = await supabase.functions.invoke('admin-db-action', {
        body: { action: 'rpc', fn: 'rpc_edit_subscription', params }
      });
      if (res.error) await throwFunctionError(res.error, res.data);
      if (res.data?.error) {
        const d = res.data.data;
        if (d?.error === 'INSUFFICIENT_FUNDS') {
          throw new Error(`Insufficient wallet balance. Short by ₹${Number(d.shortfall || 0).toFixed(2)}. Top up the wallet first.`);
        }
        if (d?.error === 'INVALID_DURATION') throw new Error('The duration is not valid.');
        if (d?.error === 'NO_DELIVERIES') throw new Error('These settings produce no deliveries in the period.');
        await throwFunctionError(null, res.data);
      }
      setEditState({ loading: false, error: null, success: 'Subscription updated!' });
      setTimeout(() => setEditSub(null), 1500);
      fetchAll();
    } catch (err) { setEditState({ loading: false, error: err.message, success: null }); }
  };

  // Cancel an active subscription. Cancels all future scheduled orders and
  // refunds their reserved amount to the wallet (rpc_cancel_subscription).
  const handleCancelSubscription = async (s) => {
    if (!window.confirm(`Cancel this ${s.frequency} subscription?\n\nAll future scheduled orders will be cancelled and their reserved amount refunded to the wallet.`)) return;
    setRowBusyId(s.id); setRowError(null);
    try {
      const res = await supabase.functions.invoke('admin-db-action', {
        body: { action: 'rpc', fn: 'rpc_cancel_subscription', params: { p_sub_id: s.id, p_user_id: userId } }
      });
      if (res.error) await throwFunctionError(res.error, res.data);
      if (res.data?.error) await throwFunctionError(null, res.data);
      fetchAll();
    } catch (err) { setRowError(err.message); }
    finally { setRowBusyId(null); }
  };

  // Edit / cancel a single scheduled order via rpc_edit_single_order.
  //   newQty === 0  → cancel the order (refunds its reserved amount)
  //   newQty  >  0  → change quantity (recomputes amount, adjusts reservation)
  const runOrderEdit = async (o, newQty) => {
    setRowBusyId(o.id); setRowError(null);
    try {
      const res = await supabase.functions.invoke('admin-db-action', {
        body: { action: 'rpc', fn: 'rpc_edit_single_order', params: { p_order_id: o.id, p_user_id: userId, p_new_quantity: newQty } }
      });
      if (res.error) await throwFunctionError(res.error, res.data);
      if (res.data?.error) {
        const d = res.data.data;
        if (d?.error === 'INSUFFICIENT_FUNDS') {
          throw new Error(`Insufficient wallet balance. Short by ₹${Number(d.shortfall || 0).toFixed(2)}. Top up the wallet first.`);
        }
        await throwFunctionError(null, res.data);
      }
      fetchAll();
    } catch (err) { setRowError(err.message); }
    finally { setRowBusyId(null); }
  };

  const startEditOrder = (o) => { setEditOrderId(o.id); setEditOrderQty(String(o.quantity || 1)); setRowError(null); };

  const handleSaveOrderQty = async (o) => {
    const qty = positiveInt(editOrderQty);
    if (!qty) { setRowError('Quantity must be at least 1.'); return; }
    await runOrderEdit(o, qty);
    setEditOrderId(null);
  };

  const handleCancelOrder = async (o) => {
    if (!window.confirm(`Cancel order ${o.order_number}?\n\nIts amount will be refunded to the customer's wallet.`)) return;
    await runOrderEdit(o, 0);
  };

  const handleAdjustWallet = async () => {
    // Reserved defaults to the current wallet value; new_balance defaults to the
    // current balance — so the admin can edit either field independently.
    const newBal = walletForm.new_balance === '' ? Number(w?.balance || 0) : parseFloat(walletForm.new_balance);
    if (isNaN(newBal) || newBal < 0) {
      setWalletState({ loading: false, error: 'Enter a valid non-negative balance.', success: null }); return;
    }
    const reservedProvided = walletForm.new_reserved !== '';
    const newReserved = reservedProvided ? parseFloat(walletForm.new_reserved) : null;
    if (reservedProvided && (isNaN(newReserved) || newReserved < 0)) {
      setWalletState({ loading: false, error: 'Enter a valid non-negative reserved amount.', success: null }); return;
    }
    if (reservedProvided && newBal < newReserved) {
      setWalletState({ loading: false, error: `Balance (${money(newBal)}) cannot be below reserved (${money(newReserved)}).`, success: null }); return;
    }
    setWalletState({ loading: true, error: null, success: null });
    try {
      const res = await supabase.functions.invoke('admin-db-action', {
        body: {
          action: 'rpc', fn: 'rpc_admin_adjust_wallet',
          params: { p_user_id: userId, p_new_balance: newBal, p_create_txn: walletForm.create_txn, p_note: walletForm.note || null, p_new_reserved: newReserved },
        },
      });
      if (res.error) await throwFunctionError(res.error, res.data);
      if (res.data?.error) await throwFunctionError(null, res.data);
      setWalletState({ loading: false, error: null, success: `Wallet updated — balance ${money(newBal)}${reservedProvided ? `, reserved ${money(newReserved)}` : ''}.` });
      setWalletForm({ new_balance: '', new_reserved: '', create_txn: true, note: '' });
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
    <Drawer wide title={loading && !data ? 'Loading…' : `Customer — ${u?.full_name || 'Unknown'}`} onClose={onClose}>
      {/* `&& !data` so this only covers the FIRST load. A "Load more" refetch
          must not replace the tab with a spinner — that would throw away the
          reader's place in the very list they were trying to extend. */}
      {loading && !data ? (
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <button
                  onClick={() => {
                    setShowProfileForm(!showProfileForm);
                    setProfileState({ loading: false, error: null, success: null });
                  }}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  {showProfileForm ? 'Cancel' : 'Edit Profile'}
                </button>
              </div>

              {showProfileForm && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, marginBottom: 16, display: 'grid', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" value={profileForm.full_name} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Phone * (10 digits, without +91)</label>
                      <input
                        className="form-input"
                        value={profileForm.phone_number}
                        placeholder="9876543210"
                        maxLength={10}
                        inputMode="numeric"
                        onChange={e => setProfileForm(p => ({ ...p, phone_number: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input type="email" className="form-input" value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} />
                    </div>
                  </div>
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={profileForm.is_active} onChange={e => setProfileForm(p => ({ ...p, is_active: e.target.checked }))} />
                    Account active
                  </label>
                  {profileState.error && <div style={{ padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 12 }}>{profileState.error}</div>}
                  {profileState.success && <div style={{ padding: '8px 12px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 6, fontSize: 12 }}>✓ {profileState.success}</div>}
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileState.loading}
                    style={{ justifySelf: 'start', padding: '7px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: profileState.loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: profileState.loading ? 0.7 : 1 }}
                  >
                    {profileState.loading ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              )}

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
                    <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Reserved balance (₹) — leave blank to keep</label>
                    <input type="number" min="0" step="0.01" value={walletForm.new_reserved}
                      onChange={(e) => setWalletForm(f => ({ ...f, new_reserved: e.target.value }))}
                      placeholder={`Current: ${money(w?.reserved_balance)}`}
                      style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 13 }} />
                    <div style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
                      Reserved is the sum of scheduled subscription orders. Only override it to correct drift.
                    </div>
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
                <SectionTitle count={data.totalTransactions}>Transactions</SectionTitle>
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
                <LoadMore
                  shown={data.transactions.length}
                  total={data.totalTransactions}
                  onClick={() => loadMore('transactions')}
                  loading={loading}
                  label="transactions"
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
                        {subscriptionProducts.map(p => <option key={p.id} value={p.id}>{p.name} (₹{p.price}/unit)</option>)}
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
                      <label className="form-label">Duration Mode</label>
                      <select
                        className="form-select"
                        value={subForm.duration_mode}
                        onChange={e => setSubForm(p => ({ ...p, duration_mode: e.target.value }))}
                      >
                        <option value="months">Months</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">{subForm.duration_mode === 'days' ? 'Duration (days)' : 'Duration (months)'}</label>
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        value={subForm.duration_mode === 'days' ? subForm.duration_days : subForm.duration_months}
                        onChange={e => setSubForm(p => (
                          subForm.duration_mode === 'days'
                            ? { ...p, duration_days: e.target.value }
                            : { ...p, duration_months: e.target.value }
                        ))}
                      />
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
              {editSub && editForm && (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 8, padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>Edit subscription — {editSub.products?.name || 'Product'}</strong>
                    <button onClick={() => setEditSub(null)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, background: 'var(--border)', color: 'var(--text-2)', border: 'none', cursor: 'pointer' }}>Cancel</button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Product &amp; address stay the same. Changes take effect from <strong>{fmtDate(getEffectiveDate(editSub.start_date))}</strong> (the next deliverable date); remaining orders are re-reserved from the wallet.
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                      <label className="form-label">Frequency</label>
                      <select className="form-select" value={editForm.frequency} onChange={e => setEditForm(p => ({ ...p, frequency: e.target.value }))}>
                        <option value="daily">Daily</option>
                        <option value="on_interval">On Interval</option>
                        <option value="custom">Custom</option>
                        <option value="buy_once">Buy Once</option>
                      </select>
                    </div>
                    {editForm.frequency === 'on_interval' && (
                      <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                        <label className="form-label">Repeat Once In</label>
                        <select className="form-select" value={editForm.interval_days} onChange={e => setEditForm(p => ({ ...p, interval_days: e.target.value }))}>
                          <option value="2">2 Days</option>
                          <option value="3">3 Days</option>
                          <option value="4">4 Days</option>
                        </select>
                      </div>
                    )}
                    {editForm.frequency !== 'custom' && (
                      <div className="form-group" style={{ flex: 1, minWidth: 100 }}>
                        <label className="form-label">Quantity</label>
                        <input type="number" min="1" className="form-input" value={editForm.quantity} onChange={e => setEditForm(p => ({ ...p, quantity: e.target.value }))} />
                      </div>
                    )}
                    {editForm.frequency !== 'buy_once' && (
                      <>
                        <div className="form-group" style={{ flex: 1, minWidth: 110 }}>
                          <label className="form-label">Duration Mode</label>
                          <select className="form-select" value={editForm.duration_mode} onChange={e => setEditForm(p => ({ ...p, duration_mode: e.target.value }))}>
                            <option value="months">Months</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ flex: 1, minWidth: 110 }}>
                          <label className="form-label">{editForm.duration_mode === 'days' ? 'Duration (days)' : 'Duration (months)'}</label>
                          <input type="number" min="1" className="form-input"
                            value={editForm.duration_mode === 'days' ? editForm.duration_days : editForm.duration_months}
                            onChange={e => setEditForm(p => (editForm.duration_mode === 'days' ? { ...p, duration_days: e.target.value } : { ...p, duration_months: e.target.value }))}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {editForm.frequency === 'custom' && (
                    <div className="form-group">
                      <label className="form-label">Custom Quantities (Per Day)</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--blue-bg)', padding: '6px 8px', borderRadius: 6, flex: 1, minWidth: 40 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4, fontWeight: 600 }}>{day}</span>
                            <input type="number" min="0" style={{ width: '100%', textAlign: 'center', padding: '4px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}
                              value={editForm.custom_quantities[String(idx)]}
                              onChange={e => setEditForm(p => ({ ...p, custom_quantities: { ...p.custom_quantities, [String(idx)]: parseInt(e.target.value) || 0 } }))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editState.error && <div style={{ padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 12 }}>{editState.error}</div>}
                  {editState.success && <div style={{ padding: '8px 12px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 6, fontSize: 12 }}>✓ {editState.success}</div>}
                  <button
                    style={{ alignSelf: 'flex-start', padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: editState.loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: editState.loading ? 0.7 : 1 }}
                    onClick={handleEditSubscription} disabled={editState.loading}
                  >
                    {editState.loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
              {rowError && <div style={{ padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 12, marginBottom: 10 }}>{rowError}</div>}
              <MiniTable
                columns={['Product', 'Freq', 'Qty', 'Duration', 'Status', 'Start', 'End', '']}
                rows={data.subscriptions}
                empty="No subscriptions"
                renderRow={(s) => (
                  <tr key={s.id}>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{s.products?.name || '—'}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{s.frequency}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{s.quantity}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{fmtDuration(s)}</td>
                    <td style={{ padding: '6px 8px' }}><StatusBadge status={s.status} /></td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{fmtDate(s.start_date)}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{fmtDate(s.end_date)}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {s.status === 'active' && (
                        <>
                          <button onClick={() => openEditSub(s)} disabled={rowBusyId === s.id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: 'var(--accent)', color: '#fff', border: 'none', cursor: rowBusyId === s.id ? 'not-allowed' : 'pointer' }}>Edit</button>
                          <button onClick={() => handleCancelSubscription(s)} disabled={rowBusyId === s.id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', cursor: rowBusyId === s.id ? 'not-allowed' : 'pointer', marginLeft: 6 }}>{rowBusyId === s.id ? '…' : 'Cancel'}</button>
                        </>
                      )}
                    </td>
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
                      <label className="form-label">Amount (auto)</label>
                      <div className="form-input" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', color: 'var(--text-2)' }}>
                        {(() => {
                          const price = Number(products.find(p => p.id === orderForm.product_id)?.price || 0);
                          const qty = parseInt(orderForm.quantity) || 0;
                          return price && qty ? money(price * qty) : '—';
                        })()}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Charged immediately from the customer's available balance (balance − reserved). Fails if they're short.
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
              {rowError && <div style={{ padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 6, fontSize: 12, marginBottom: 10 }}>{rowError}</div>}
              <MiniTable
                columns={['Order', 'Date', 'Product', 'Qty', 'Amount', 'Status', '']}
                rows={data.orders}
                empty="No orders"
                renderRow={(o) => {
                  const editing = editOrderId === o.id;
                  const busy = rowBusyId === o.id;
                  return (
                  <tr key={o.id}>
                    <td style={{ padding: '6px 8px', fontSize: 11, fontFamily: "'DM Mono',monospace", color: 'var(--text-3)' }}>{o.order_number}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{fmtDate(o.delivery_date)}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>{o.products?.name || '—'}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5 }}>
                      {editing ? (
                        <input type="number" min="1" value={editOrderQty} onChange={e => setEditOrderQty(e.target.value)}
                          style={{ width: 56, padding: '2px 6px', fontSize: 11.5, border: '1px solid var(--border)', borderRadius: 4 }} />
                      ) : o.quantity}
                    </td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5, fontFamily: "'DM Mono',monospace" }}>{money(o.amount)}</td>
                    <td style={{ padding: '6px 8px' }}><StatusBadge status={o.status} /></td>
                    <td style={{ padding: '6px 8px', fontSize: 11.5, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {o.status === 'scheduled' && (editing ? (
                        <>
                          <button onClick={() => handleSaveOrderQty(o)} disabled={busy} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: 'var(--accent)', color: '#fff', border: 'none', cursor: busy ? 'not-allowed' : 'pointer' }}>{busy ? '…' : 'Save'}</button>
                          <button onClick={() => setEditOrderId(null)} disabled={busy} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: 'transparent', color: 'var(--text-3)', border: '1px solid var(--border)', cursor: 'pointer', marginLeft: 6 }}>✕</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditOrder(o)} disabled={busy} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: 'var(--accent)', color: '#fff', border: 'none', cursor: busy ? 'not-allowed' : 'pointer' }}>Edit</button>
                          <button onClick={() => handleCancelOrder(o)} disabled={busy} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', cursor: busy ? 'not-allowed' : 'pointer', marginLeft: 6 }}>{busy ? '…' : 'Cancel'}</button>
                        </>
                      ))}
                    </td>
                  </tr>
                  );
                }}
              />
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-4)', textAlign: 'center' }}>
                Showing latest {data.orders.length} of {data.totalOrders} total orders
              </div>
              <LoadMore
                shown={data.orders.length}
                total={data.totalOrders}
                onClick={() => loadMore('orders')}
                loading={loading}
                label="orders"
              />
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
              <SectionTitle count={data.totalBottleReturns}>Bottle Returns</SectionTitle>
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
              <LoadMore
                shown={data.bottleReturns.length}
                total={data.totalBottleReturns}
                onClick={() => loadMore('bottleReturns')}
                loading={loading}
                label="returns"
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
