import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api';

function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.register(formData);
      localStorage.setItem('token', response.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <section style={{ padding: '80px 0', maxWidth: '400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', textAlign: 'center' }}>Create Account</h1>
        <p style={{ color: '#94a3b8', textAlign: 'center', marginBottom: '40px' }}>
          Join Game Vault and start playing
        </p>

        <form onSubmit={handleSubmit} className="card">
          {error && <div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>}

          <div className="input-group">
            <label>Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              placeholder="johndoe"
              minLength="3"
              maxLength="20"
            />
          </div>

          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="your@email.com"
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              placeholder="••••••••"
              minLength="8"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '24px' }}
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>

          <p style={{ textAlign: 'center', marginTop: '24px', color: '#94a3b8' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#6366f1' }}>Sign in</Link>
          </p>
        </form>
      </section>
    </div>
  );
}

export default RegisterPage;
