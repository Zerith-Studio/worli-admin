import React, { useState, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function SettingsPage() {
  const { 
    settings, 
    loading, 
    error, 
    saving, 
    updateSettings,
  } = useSettings();

  const [localSettings, setLocalSettings] = useState({});

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateLocal = (key, val) => {
    setLocalSettings(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    await updateSettings(localSettings);
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
            <textarea className="form-input" rows="3" value={localSettings.delivery_info || ''} onChange={e => updateLocal('delivery_info', e.target.value)} />
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
            <label className="form-label">Min Bottles Recharge Amount (₹)</label>
            <input type="number" className="form-input" value={localSettings.min_bottles_recharge || '1'} onChange={e => updateLocal('min_bottles_recharge', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Referral Reward Amount (₹)</label>
            <input type="number" className="form-input" value={localSettings.referral_reward_amount || '50'} onChange={e => updateLocal('referral_reward_amount', e.target.value)} />
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
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
        <Button onClick={() => setLocalSettings(settings)}>Discard Changes</Button>
      </div>
    </div>
  );
}
