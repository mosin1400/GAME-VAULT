import { useState, useEffect } from 'react';
import { adminAPI, gamesAPI } from '../utils/api';

function AdminPage() {
  const [stats, setStats] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const [statsRes, gamesRes] = await Promise.all([
        adminAPI.getStats(),
        gamesAPI.getAll()
      ]);
      setStats(statsRes.data.stats);
      setGames(gamesRes.data.games);
    } catch (err) {
      setError('Access denied. Admin privileges required.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <section style={{ padding: '80px 0', textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', marginBottom: '16px', color: '#ef4444' }}>Access Denied</h1>
          <p style={{ color: '#94a3b8' }}>{error}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="container">
      <section style={{ padding: '60px 0' }}>
        <h1 style={{ fontSize: '36px', marginBottom: '40px' }}>Admin Dashboard</h1>

        {/* Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '24px',
          marginBottom: '40px'
        }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>👥</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#6366f1' }}>
              {stats?.totalUsers || 0}
            </div>
            <div style={{ color: '#94a3b8' }}>Total Users</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎮</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#8b5cf6' }}>
              {stats?.totalGames || 0}
            </div>
            <div style={{ color: '#94a3b8' }}>Total Games</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>⚡</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>
              {stats?.activeUsers || 0}
            </div>
            <div style={{ color: '#94a3b8' }}>Active Users</div>
          </div>
        </div>

        {/* Games Management */}
        <div className="card">
          <h2 style={{ fontSize: '24px', marginBottom: '24px' }}>Games Management</h2>
          
          {games.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>
              No games available yet.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
                  <th style={{ padding: '12px', color: '#94a3b8' }}>Title</th>
                  <th style={{ padding: '12px', color: '#94a3b8' }}>Category</th>
                  <th style={{ padding: '12px', color: '#94a3b8' }}>Rating</th>
                  <th style={{ padding: '12px', color: '#94a3b8' }}>Plays</th>
                  <th style={{ padding: '12px', color: '#94a3b8' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => (
                  <tr key={game.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '12px' }}>{game.title}</td>
                    <td style={{ padding: '12px', color: '#94a3b8' }}>{game.category || '-'}</td>
                    <td style={{ padding: '12px', color: '#f59e0b' }}>⭐ {game.rating || 'N/A'}</td>
                    <td style={{ padding: '12px', color: '#94a3b8' }}>{game.plays || 0}</td>
                    <td style={{ padding: '12px' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '14px' }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default AdminPage;
