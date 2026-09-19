import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { gamesAPI } from '../utils/api';

function HomePage() {
  const [featuredGames, setFeaturedGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeaturedGames();
  }, []);

  const loadFeaturedGames = async () => {
    try {
      const response = await gamesAPI.getAll();
      setFeaturedGames(response.data.games.slice(0, 6));
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      {/* Hero Section */}
      <section style={{ padding: '80px 0', textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Welcome to Game Vault
        </h1>
        <p style={{ fontSize: '20px', color: '#94a3b8', marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px' }}>
          Your ultimate gaming library. Discover, play, and manage your favorite games all in one place.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link to="/games" className="btn btn-primary">
            Browse Games
          </Link>
          <Link to="/register" className="btn btn-secondary">
            Get Started
          </Link>
        </div>
      </section>

      {/* Featured Games */}
      <section style={{ padding: '60px 0' }}>
        <h2 style={{ fontSize: '32px', marginBottom: '40px' }}>Featured Games</h2>
        
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '24px' 
          }}>
            {featuredGames.map((game) => (
              <Link to={`/games/${game.id}`} key={game.id} className="card">
                {game.thumbnailUrl && (
                  <img 
                    src={game.thumbnailUrl} 
                    alt={game.title}
                    style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }}
                  />
                )}
                <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>{game.title}</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '12px' }}>
                  {game.category || 'Uncategorized'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#f59e0b' }}>⭐ {game.rating || 'N/A'}</span>
                  <span style={{ color: '#94a3b8', fontSize: '14px' }}>🎮 {game.plays || 0} plays</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && featuredGames.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
            <p>No games available yet. Check back soon!</p>
          </div>
        )}
      </section>

      {/* Features Section */}
      <section style={{ padding: '60px 0', borderTop: `1px solid #334155` }}>
        <h2 style={{ fontSize: '32px', marginBottom: '40px', textAlign: 'center' }}>Why Choose Game Vault?</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '32px' 
        }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎮</div>
            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Huge Collection</h3>
            <p style={{ color: '#94a3b8' }}>Access hundreds of games across all categories</p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Fast & Secure</h3>
            <p style={{ color: '#94a3b8' }}>Lightning-fast loading with enterprise-grade security</p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📱</div>
            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Cross-Platform</h3>
            <p style={{ color: '#94a3b8' }}>Play on any device, anywhere, anytime</p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Community</h3>
            <p style={{ color: '#94a3b8' }}>Join a thriving community of gamers</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
