import { useState } from 'react';
import { Activity } from 'lucide-react';
import { authApi } from '../lib/api.js';
import { setToken, setTenant } from '../lib/auth.js';

/**
 * Login / Register page.
 * On success: stores the JWT and tenant in localStorage, then calls onSuccess().
 *
 * @param {{ onSuccess: () => void }} props
 */
export function LoginPage({ onSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '', apiKey: '' });
  const [loginMode, setLoginMode] = useState('email'); // 'email' | 'apikey'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;

      if (tab === 'register') {
        result = await authApi.register({
          name: form.name,
          email: form.email,
          password: form.password,
        });
      } else if (loginMode === 'apikey') {
        result = await authApi.login({ apiKey: form.apiKey });
      } else {
        result = await authApi.login({ email: form.email, password: form.password });
      }

      setToken(result.data.token);
      setTenant(result.data.tenant);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Activity size={22} color="white" />
            </div>
          </div>
          <h1>WidgetLab</h1>
          <p>Embeddable Widget & Lead-Capture Platform</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError(''); }}
          >
            Create Account
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="name">Full Name</label>
              <input
                id="name"
                name="name"
                className="form-input"
                type="text"
                placeholder="Acme Corp"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
          )}

          {tab === 'login' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                type="button"
                className={`btn ${loginMode === 'email' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                onClick={() => setLoginMode('email')}
              >
                Email
              </button>
              <button
                type="button"
                className={`btn ${loginMode === 'apikey' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                onClick={() => setLoginMode('apikey')}
              >
                API Key
              </button>
            </div>
          )}

          {loginMode === 'apikey' && tab === 'login' ? (
            <div className="form-group">
              <label className="form-label" htmlFor="apiKey">API Key</label>
              <input
                id="apiKey"
                name="apiKey"
                className="form-input"
                type="text"
                placeholder="Enter your API key"
                value={form.apiKey}
                onChange={handleChange}
                required
              />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  className="form-input"
                  type="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  className="form-input"
                  type="password"
                  placeholder={tab === 'register' ? 'Min. 8 characters' : '••••••••'}
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="skeleton" style={{ width: 16, height: 16, borderRadius: '50%' }} />
                {tab === 'register' ? 'Creating account…' : 'Signing in…'}
              </span>
            ) : (
              tab === 'register' ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          Capstone project — Backend AI Engineering Track
        </p>
      </div>
    </div>
  );
}
