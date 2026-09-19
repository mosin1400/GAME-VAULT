import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { gamesAPI } from '../utils/api';

function GamesPage() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    try {
      const response = await gamesAPI.getAll();
      setGames(response.data.games);
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGames = games.filter(game =>
    game.title.toLowerCase().includes(filter.toLowerCase()) ||
    (game.category && game.category.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="container">
      <section style={{ padding: '60px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '36px' }}>All Games</h1>
          <input
            type="text"
            placeholder="Search games..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '12px 20px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
              width: '300px',
            }}
          />
        </div>

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
            {filteredGames.map((game) => (
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
                  {game.description?.substring(0, 100)}...
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#f59e0b' }}>⭐ {game.rating || 'N/A'}</span>
                  <span style={{ color: '#94a3b8', fontSize: '14px' }}>🎮 {game.plays || 0} plays</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && filteredGames.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
            <p>No games found. Try a different search term!</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default GamesPage;
