// ============================================
// FILE: hooks/useSettings.js
// Hook for fetching and updating app settings
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULT_SETTINGS = {
  order_modification_cutoff_time: '19:00',
  min_wallet_balance: '100',
  max_unreturned_bottles: '5',
  referral_reward_amount: '50',
  delivery_charge: '0',
  contact_phone: '',
  contact_email: '',
  contact_address: '',
  contact_map_url: '',
  contact_whatsapp_phone: '',
  contact_whatsapp: '',
  cron_secret: '',
  min_bottles_recharge: '1',
  min_wallet_recharge: '350',
  delivery_info: '',
  app_download_link: '',
  auto_pause_negative_balance: 'true',
  sms_recharge_reminders: 'true',
  buffer_percentage: '10',
  max_retry_attempts: '2',
  auto_refund_on_failure: 'false',
  auto_assign_cron_enabled: 'true',
};

export function useSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value');

      if (fetchError) throw fetchError;

      // Convert to key-value object
      const settingsMap = {};
      data?.forEach(setting => {
        settingsMap[setting.setting_key] = setting.setting_value;
      });

      // Merge with defaults
      setSettings({ ...DEFAULT_SETTINGS, ...settingsMap });
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err.message);
      // Fall back to defaults
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = useCallback(async (key, value) => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: key,
          setting_value: String(value),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      // Update local state
      setSettings(prev => ({ ...prev, [key]: String(value) }));
      return { success: true };
    } catch (err) {
      console.error('Error updating setting:', err);
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings) => {
    try {
      setSaving(true);

      const updates = Object.entries(newSettings).map(([key, value]) => ({
        setting_key: key,
        setting_value: String(value),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('app_settings')
        .upsert(updates, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      // Update local state
      const settingsMap = {};
      Object.entries(newSettings).forEach(([key, value]) => {
        settingsMap[key] = String(value);
      });
      setSettings(prev => ({ ...prev, ...settingsMap }));
      
      return { success: true };
    } catch (err) {
      console.error('Error updating settings:', err);
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  }, []);

  // Helper to get typed values
  const getSetting = useCallback((key, defaultValue = '') => {
    const value = settings[key];
    if (value === undefined) return defaultValue;
    
    // Try to parse as number if default is number
    if (typeof defaultValue === 'number') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    
    // Try to parse as boolean if default is boolean
    if (typeof defaultValue === 'boolean') {
      return value === 'true' || value === true;
    }
    
    return value;
  }, [settings]);

  return {
    settings,
    loading,
    error,
    saving,
    updateSetting,
    updateSettings,
    getSetting,
    refresh: fetchSettings,
  };
}
