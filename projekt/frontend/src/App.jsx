import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, Eye, EyeOff, Lock, Check, X, User, FolderLock, Plus, LogOut } from 'lucide-react';
import './App.css';

function App() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [metrics, setMetrics] = useState({ entropy: 0, strength: 'Weak', pwned_count: 0, is_pwned: false });
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authMessage, setAuthMessage] = useState({ text: '', isError: false });
  const [loggedInUserId, setLoggedInUserId] = useState(null);
  const [loggedInUsername, setLoggedInUsername] = useState('');
  const [vaultItems, setVaultItems] = useState([]);
  const [newSite, setNewSite] = useState('');
  const [newLogin, setNewLogin] = useState('');
  const [newPass, setNewPass] = useState('');
  const [vaultMessage, setVaultMessage] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});

  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };

  useEffect(() => {
    if (password.length === 0) {
      setMetrics({ entropy: 0, strength: 'Weak', pwned_count: 0, is_pwned: false });
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/check-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: password }),
        });
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error("API Connection error:", error);
      }
    }, 250);
    return () => clearTimeout(delayDebounceFn);
  }, [password]);

  useEffect(() => {
    if (loggedInUserId) {
      fetchVaultData();
    }
  }, [loggedInUserId]);

  const fetchVaultData = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/vault/${loggedInUserId}`);
      if (response.ok) {
        const data = await response.json();
        setVaultItems(data);
      }
    } catch (error) {
      console.error("Vault data fetch error:", error);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthMessage({ text: '', isError: false });

    const endpoint = isRegisterMode ? 'register' : 'login';
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      const data = await response.json();

      if (!response.ok) {
        setAuthMessage({ text: data.detail || 'An error occurred', isError: true });
        return;
      }

      if (isRegisterMode) {
        setAuthMessage({ text: 'Registered successfully! You can now log in.', isError: false });
        setIsRegisterMode(false);
        setPasswordInput('');
      } else {
        setLoggedInUserId(data.user_id);
        setLoggedInUsername(usernameInput);
        setUsernameInput('');
        setPasswordInput('');
      }
    } catch (error) {
      setAuthMessage({ text: 'No connection to backend', isError: true });
    }
  };

  const handleAddCredential = async (e) => {
    e.preventDefault();
    if (!newSite || !newLogin || !newPass) return;

    try {
      const response = await fetch('http://127.0.0.1:8000/api/vault/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: loggedInUserId,
          site_name: newSite,
          login_name: newLogin,
          password_to_encrypt: newPass
        }),
      });

      if (response.ok) {
        setVaultMessage('Encrypted and saved to database!');
        setNewSite('');
        setNewLogin('');
        setNewPass('');
        fetchVaultData();
        setTimeout(() => setVaultMessage(''), 3000);
      }
    } catch (error) {
      console.error("Add credential error:", error);
    }
  };

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLogout = () => {
    setLoggedInUserId(null);
    setLoggedInUsername('');
    setVaultItems([]);
  };

  const getStrengthTheme = () => {
    if (password.length === 0) return { color: '#6b7280', text: 'None' };
    if (metrics.strength === 'Weak') return { color: '#ef4444', text: 'Weak' };
    if (metrics.strength === 'Medium') return { color: '#f59e0b', text: 'Medium' };
    return { color: '#10b981', text: 'Strong' };
  };
  const theme = getStrengthTheme();

  return (
    <div className="container">
      <div className="vault-layout">
        <div className="card">
          <div className="card-header">
            <div className="icon-wrapper"><KeyRound size={28} color="#60a5fa" /></div>
            <div>
              <h2 className="title">Password Checker</h2>
              <p className="subtitle">Check your password entropy and if it has been compromised</p>
            </div>
          </div>
          <div className="input-container">
            <div className="left-icon"><Lock size={18} color="#9ca3af" /></div>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Type your password..."
              className="password-input"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="eye-button">
              {showPassword ? <EyeOff size={18} color="#9ca3af" /> : <Eye size={18} color="#9ca3af" />}
            </button>
          </div>
          <div className="progress-container">
            <div className="progress-bar" style={{
              width: password.length === 0 ? '0%' : metrics.strength === 'Weak' ? '33%' : metrics.strength === 'Medium' ? '66%' : '100%',
              backgroundColor: theme.color
            }} />
          </div>
          <div className="badge-row">
            <div className="badge">
              <span className="badge-label">Status:</span>
              <span className="badge-value" style={{ color: theme.color }}>{theme.text}</span>
            </div>
            <div className="badge">
              <span className="badge-label">Entropy:</span>
              <span className="badge-value">{metrics.entropy} bits</span>
            </div>
          </div>
          <div className="checklist">
            <RequirementItem label="At least 8 characters" checked={checks.length} />
            <RequirementItem label="Uppercase letter (A-Z)" checked={checks.uppercase} />
            <RequirementItem label="Lowercase letter (a-z)" checked={checks.lowercase} />
            <RequirementItem label="Number (0-9)" checked={checks.number} />
            <RequirementItem label="Special character" checked={checks.special} />
          </div>
          {password.length > 0 && (
            <div className="alert-box" style={{
              backgroundColor: metrics.is_pwned ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${metrics.is_pwned ? '#ef4444' : '#10b981'}`,
              color: metrics.is_pwned ? '#fca5a5' : '#a7f3d0'
            }}>
              {metrics.is_pwned ? (
                <><ShieldAlert size={22} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>Found in <strong>{metrics.pwned_count.toLocaleString()}</strong> public data breaches!</span></>
              ) : (
                <><ShieldCheck size={22} color="#10b981" style={{ flexShrink: 0 }} />
                <span>No records found in breach databases.</span></>
              )}
            </div>
          )}
        </div>
        <div className="card">
          {!loggedInUserId ? (
            <div>
              <div className="card-header">
                <div className="icon-wrapper"><User size={28} color="#a855f7" /></div>
                <div>
                  <h2 className="title">{isRegisterMode ? 'Create account' : 'Log In to your Vault'}</h2>
                </div>
              </div>
              <form onSubmit={handleAuthSubmit} className="auth-form">
                <input
                  type="text"
                  placeholder="Username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="password-input"
                  style={{ paddingLeft: '16px', marginBottom: '4px' }}
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="password-input"
                  style={{ paddingLeft: '16px', marginBottom: '8px' }}
                  required
                />
                {authMessage.text && (
                  <p className={authMessage.isError ? "msg-error" : "msg-success"}>{authMessage.text}</p>
                )}
                <button type="submit" className="btn-primary">
                  {isRegisterMode ? 'Register Account' : 'Log In'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode);
                    setAuthMessage({ text: '', isError: false });
                  }} 
                  className="btn-secondary"
                >
                  {isRegisterMode ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
                </button>
              </form>
            </div>
          ) : (
            <div className="vault-grid">
              <div className="card-header" style={{ marginBottom: '10px' }}>
                <div className="icon-wrapper"><FolderLock size={28} color="#10b981" /></div>
                <div style={{ flexGrow: 1 }}>
                  <h2 className="title">Your Vault {loggedInUsername}</h2>
                  <p className="subtitle">Credentials are AES-encrypted</p>
                </div>
                <button onClick={handleLogout} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <LogOut size={16} /> Log Out
                </button>
              </div>
              <form onSubmit={handleAddCredential} className="add-cred-form">
                <input type="text" placeholder="Service name" value={newSite} onChange={(e) => setNewSite(e.target.value)} required />
                <input type="text" placeholder="Login / Email" value={newLogin} onChange={(e) => setNewLogin(e.target.value)} required />
                <input type="password" placeholder="Password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required />
                <button type="submit" className="btn-primary" style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                  Save
                </button>
              </form>
              {vaultMessage && <p className="msg-success">{vaultMessage}</p>}
              <div style={{ overflowX: 'auto' }}>
                <table className="vault-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Login / Email</th>
                      <th>Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaultItems.length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>Your vault is empty. Add your first password!</td>
                      </tr>
                    ) : (
                      vaultItems.map(item => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>{item.site_name}</td>
                          <td>{item.login_name}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                              <span>{visiblePasswords[item.id] ? item.decrypted_password : '••••••••'}</span>
                              <button type="button" onClick={() => togglePasswordVisibility(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                {visiblePasswords[item.id] ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function RequirementItem({ label, checked }) {
  return (
    <div className="check-item" style={{ color: checked ? '#9ca3af' : '#4b5563' }}>
      {checked ? <Check size={14} color="#10b981" /> : <X size={14} color="#ef4444" />}
      <span style={{ textDecoration: checked ? 'line-through' : 'none' }}>{label}</span>
    </div>
  );
}

export default App;