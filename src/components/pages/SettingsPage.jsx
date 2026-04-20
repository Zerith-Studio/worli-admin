// ============================================
// FILE: components/pages/SettingsPage.jsx
// Settings Page Component
// ============================================

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
    updateSetting, 
    updateSettings,
    getSetting 
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

      <div style={{ maxWidth: 600 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Order Management</div>
          <div className="form-group">
            <label className="form-label">Daily Order Cutoff Time</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input 
                type="time" 
                className="form-input" 
                style={{ width: 140 }} 
                value={localSettings.order_modification_cutoff_time || '19:00'}
                onChange={e => updateLocal('order_modification_cutoff_time', e.target.value)}
              />
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>Orders after this time count for day+2</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Inventory Buffer %</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input 
                type="number" 
                className="form-input" 
                style={{ width: 80 }} 
                value={localSettings.buffer_percentage || 10}
                onChange={e => updateLocal('buffer_percentage', e.target.value)}
                min={0} 
                max={50} 
              />
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>Extra stock buffer above demand</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Wallet & Payments</div>
          <div className="form-group">
            <label className="form-label">Low Balance Threshold (₹)</label>
            <input 
              type="number" 
              className="form-input" 
              style={{ width: 120 }} 
              value={localSettings.min_wallet_balance || 100}
              onChange={e => updateLocal('min_wallet_balance', e.target.value)}
            />
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
              Customers below this will be flagged at risk
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 12.5 }}>Auto-pause on negative balance</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                Automatically pause subscriptions when wallet goes negative
              </div>
            </div>
            <Toggle 
              checked={localSettings.auto_pause_negative_balance === 'true'}
              onChange={v => updateLocal('auto_pause_negative_balance', String(v))}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 12.5 }}>SMS recharge reminders</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                Send SMS when balance falls below threshold
              </div>
            </div>
            <Toggle 
              checked={localSettings.sms_recharge_reminders === 'true'}
              onChange={v => updateLocal('sms_recharge_reminders', String(v))}
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Delivery Failures</div>
          <div className="form-group">
            <label className="form-label">Max Retry Attempts</label>
            <input 
              type="number" 
              className="form-input" 
              style={{ width: 80 }} 
              value={localSettings.max_retry_attempts || 2}
              onChange={e => updateLocal('max_retry_attempts', e.target.value)}
              min={0} 
              max={5} 
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 12.5 }}>Auto-refund on permanent failure</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                Automatically credit wallet if all retries fail
              </div>
            </div>
            <Toggle 
              checked={localSettings.auto_refund_on_failure === 'true'}
              onChange={v => updateLocal('auto_refund_on_failure', String(v))}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button onClick={() => setLocalSettings(settings)}>Reset to Defaults</Button>
        </div>
      </div>
    </div>
  );
}
