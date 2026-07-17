import React, { useState, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { LoadMore } from '../ui/LoadMore';
import { RowsPerLoad } from '../ui/RowsPerLoad';

export function SettingsPage() {
  const { 
    settings, 
    loading, 
    error, 
    saving, 
    updateSettings,
  } = useSettings();

  const [localSettings, setLocalSettings] = useState({});
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountMsg, setDiscountMsg] = useState(null);

  // Admins can add duration tiers (day-based ones landed recently), so this
  // table is no longer the fixed 1/3/6 it was written for.
  const {
    rows: durationDiscounts,
    setRows: setDurationDiscounts,
    loadingMore: discountLoadingMore,
    loadMore: loadMoreDiscounts,
    totalCount: discountTotalCount,
    refresh: refreshDiscounts,
  } = usePaginatedQuery({
    table: 'subscription_duration_discounts',
    select: '*',
    orderBy: { column: 'duration_months', ascending: true },
  });

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateLocal = (key, val) => {
    setLocalSettings(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    await updateSettings(localSettings);
  };

  const handleDiscountChange = (id, field, value) => {
    setDurationDiscounts(prev =>
      prev.map(d => d.id === id ? { ...d, [field]: value } : d)
    );
  };

  const handleSaveDiscounts = async () => {
    setDiscountSaving(true);
    setDiscountMsg(null);
    try {
      // The page's rows are the only ones the admin can have edited, so saving
      // the page is saving every pending change.
      for (const d of durationDiscounts) {
        const { error: err } = await supabase
          .from('subscription_duration_discounts')
          .update({
            discount_percent: parseFloat(d.discount_percent) || 0,
            display_label: d.display_label,
            is_active: d.is_active,
          })
          .eq('id', d.id);
        if (err) throw err;
      }
      setDiscountMsg({ ok: true, text: 'Duration discounts saved ✓' });
      await refreshDiscounts(true);
    } catch (err) {
      setDiscountMsg({ ok: false, text: err.message });
    } finally {
      setDiscountSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-sub">Operations configuration</div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--red-bg)', color: '#991B1B' }}>
          Error: {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Order & Delivery */}
        <div className="card">
          <div className="card-title">Order & Delivery Settings</div>
          <div className="form-group">
            <label className="form-label">Daily Order Cutoff Time</label>
            <input type="time" className="form-input" value={localSettings.order_modification_cutoff_time || '19:00'} onChange={e => updateLocal('order_modification_cutoff_time', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Delivery Charge (₹)</label>
            <input type="number" className="form-input" value={localSettings.delivery_charge || '0'} onChange={e => updateLocal('delivery_charge', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Max Unreturned Bottles</label>
            <input type="number" className="form-input" value={localSettings.max_unreturned_bottles || '5'} onChange={e => updateLocal('max_unreturned_bottles', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Delivery Info (HTML/Text)</label>
            <textarea className="form-input" rows="7" style={{ minHeight: 130, resize: "vertical" }} value={localSettings.delivery_info || ''} onChange={e => updateLocal('delivery_info', e.target.value)} />
          </div>
        </div>

        {/* Wallet & Rewards */}
        <div className="card">
          <div className="card-title">Wallet & Rewards</div>
          <div className="form-group">
            <label className="form-label">Min Wallet Balance Threshold (₹)</label>
            <input type="number" className="form-input" value={localSettings.min_wallet_balance || '100'} onChange={e => updateLocal('min_wallet_balance', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Min Wallet Recharge Amount (₹)</label>
            <input type="number" className="form-input" value={localSettings.min_wallet_recharge || '350'} onChange={e => updateLocal('min_wallet_recharge', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Referrer Reward Amount (₹)</label>
            <input type="number" className="form-input" value={localSettings.referral_reward_amount || '60'} onChange={e => updateLocal('referral_reward_amount', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Trial Sample Price — No Referral (₹)</label>
            <input type="number" className="form-input" value={localSettings.free_sample_price || '99'} onChange={e => updateLocal('free_sample_price', e.target.value)} />
          </div>
        </div>

        {/* Contact Information */}
        <div className="card">
          <div className="card-title">Contact & Support</div>
          <div className="form-group">
            <label className="form-label">Contact Phone</label>
            <input className="form-input" value={localSettings.contact_phone || ''} onChange={e => updateLocal('contact_phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Contact Email</label>
            <input type="email" className="form-input" value={localSettings.contact_email || ''} onChange={e => updateLocal('contact_email', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">WhatsApp Phone</label>
            <input className="form-input" value={localSettings.contact_whatsapp_phone || ''} onChange={e => updateLocal('contact_whatsapp_phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">WhatsApp Message / Link</label>
            <input className="form-input" value={localSettings.contact_whatsapp || ''} onChange={e => updateLocal('contact_whatsapp', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Contact Address</label>
            <textarea className="form-input" rows="2" value={localSettings.contact_address || ''} onChange={e => updateLocal('contact_address', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Map URL</label>
            <input className="form-input" value={localSettings.contact_map_url || ''} onChange={e => updateLocal('contact_map_url', e.target.value)} />
          </div>
        </div>

        {/* System */}
        <div className="card">
          <div className="card-title">System Settings</div>
          <div className="form-group">
            <label className="form-label">App Download Link</label>
            <input className="form-input" value={localSettings.app_download_link || ''} onChange={e => updateLocal('app_download_link', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Cron Secret</label>
            <input type="password" className="form-input" value={localSettings.cron_secret || ''} onChange={e => updateLocal('cron_secret', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(localSettings.auto_assign_cron_enabled ?? 'true') !== 'false'}
                onChange={e => updateLocal('auto_assign_cron_enabled', e.target.checked ? 'true' : 'false')}
              />
              Nightly auto-assign riders (12 AM IST)
            </label>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              When off, the nightly cron skips and you assign riders manually via "Run Auto-Assignment".
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
        <Button onClick={() => setLocalSettings(settings)}>Discard Changes</Button>
      </div>

      {/* Subscription Duration Discounts */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title">
          Subscription Duration Discounts
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)', marginLeft: 8 }}>
            Shown to customers during checkout when selecting 1/3/6-month plans
          </span>
        </div>
        {discountMsg && (
          <div style={{
            padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13,
            background: discountMsg.ok ? 'rgba(34,197,94,0.1)' : 'var(--red-bg)',
            color: discountMsg.ok ? 'var(--green)' : 'var(--red)',
          }}>
            {discountMsg.text}
          </div>
        )}
        <div className="search-filter">
          <RowsPerLoad />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Duration', 'Display Label', 'Discount %', 'Active'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--text-3)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {durationDiscounts.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 16, color: 'var(--text-4)', textAlign: 'center' }}>No duration discounts configured in database</td></tr>
            )}
            {durationDiscounts.map(d => (
              <tr key={d.id}>
                <td style={{ padding: '8px 12px', fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>
                  {d.duration_months} month{d.duration_months > 1 ? 's' : ''}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <input
                    className="form-input"
                    style={{ width: 140 }}
                    value={d.display_label || ''}
                    onChange={e => handleDiscountChange(d.id, 'display_label', e.target.value)}
                  />
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: 80 }}
                    min="0"
                    max="100"
                    step="0.5"
                    value={d.discount_percent}
                    onChange={e => handleDiscountChange(d.id, 'discount_percent', e.target.value)}
                  />
                  <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--text-3)' }}>%</span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <input
                    type="checkbox"
                    checked={d.is_active}
                    onChange={e => handleDiscountChange(d.id, 'is_active', e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <LoadMore
          shown={durationDiscounts.length}
          total={discountTotalCount}
          onLoadMore={loadMoreDiscounts}
          loading={discountLoadingMore}
          label="discounts"
        />
        <div style={{ marginTop: 12 }}>
          <Button variant="primary" onClick={handleSaveDiscounts} disabled={discountSaving || durationDiscounts.length === 0}>
            {discountSaving ? 'Saving...' : 'Save Duration Discounts'}
          </Button>
        </div>
      </div>

      {/* Rider Operations */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Rider Operations</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Attendance Start (IST)</label>
            <input type="time" className="form-input" value={localSettings.rider_attendance_start || '03:45'} onChange={e => updateLocal('rider_attendance_start', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Attendance End (IST)</label>
            <input type="time" className="form-input" value={localSettings.rider_attendance_end || '05:00'} onChange={e => updateLocal('rider_attendance_end', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Lockout Time (IST)</label>
            <input type="time" className="form-input" value={localSettings.rider_lockout_time || '06:45'} onChange={e => updateLocal('rider_lockout_time', e.target.value)} />
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
          Riders must check in between Attendance Start and End. They are locked out after Lockout Time.
        </div>
      </div>
    </div>
  );
}
