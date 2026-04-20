// ============================================
// FILE: components/LoginPage.jsx
// Admin Login Page with OTP
// ============================================

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [loading, setLoading] = useState(false);
  const { sendOTP, verifyOTP, error: authError } = useAuth();

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) return;

    setLoading(true);
    // Prepend +91 for Indian phone numbers
    const fullPhone = `+91${phone}`;
    const result = await sendOTP(fullPhone);
    setLoading(false);

    if (result.success) {
      setStep('otp');
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 6) return;

    setLoading(true);
    // Prepend +91 for Indian phone numbers
    const fullPhone = `+91${phone}`;
    const result = await verifyOTP(fullPhone, otp);
    setLoading(false);

    if (!result.success) {
      // Error handled by auth context
    }
  };

  const formatPhone = (value) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');
    // Limit to 10 digits
    return digits.slice(0, 10);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">M</div>
          <div>
            <div className="logo-text" style={{ fontSize: '18px', color: '#111827' }}>MilkRide</div>
            <div className="logo-sub" style={{ fontSize: '11px' }}>Admin Console</div>
          </div>
        </div>

        <div className="login-title">
          {step === 'phone' ? 'Welcome Back' : 'Enter OTP'}
        </div>
        <div className="login-subtitle">
          {step === 'phone' 
            ? 'Enter your phone number to access the admin dashboard'
            : `Enter the 6-digit code sent to +91 ${phone}`
          }
        </div>

        {authError && (
          <div className="login-error">{authError}</div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOTP}>
            <input
              type="tel"
              className="login-input"
              placeholder="Enter 10-digit phone number"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              maxLength={10}
              autoFocus
            />
            <button 
              type="submit" 
              className="login-btn"
              disabled={loading || phone.length < 10}
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <input
              type="text"
              className="login-input"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              autoFocus
            />
            <button 
              type="submit" 
              className="login-btn"
              disabled={loading || otp.length < 6}
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button 
              type="button"
              className="btn"
              style={{ 
                width: '100%', 
                marginTop: '12px', 
                background: 'transparent',
                border: 'none',
                color: 'var(--text-3)'
              }}
              onClick={() => {
                setStep('phone');
                setOtp('');
              }}
            >
              Change Phone Number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
