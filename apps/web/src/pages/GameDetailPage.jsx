import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gamesAPI } from '../utils/api';

function GameDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGame();
  }, [id]);

  const loadGame = async () => {
    try {
      const response = await gamesAPI.getById(id);
      setGame(response.data.game);
    } catch (error) {
      console.error('Failed to load game:', error);
      navigate('/games');
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

  if (!game) return null;

  return (
    <div className="container">
      <section style={{ padding: '60px 0' }}>
        <button 
          onClick={() => navigate('/games')}
          className="btn btn-secondary"
          style={{ marginBottom: '24px' }}
        >
          ← Back to Games
        </button>

        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
            {game.thumbnailUrl && (
              <img 
                src={game.thumbnailUrl} 
                alt={game.title}
                style={{ width: '100%', borderRadius: '12px' }}
              />
            )}
            <div>
              <h1 style={{ fontSize: '36px', marginBottom: '16px' }}>{game.title}</h1>
              <p style={{ color: '#94a3b8', marginBottom: '24px' }}>{game.category}</p>
              <p style={{ marginBottom: '24px', lineHeight: '1.8' }}>{game.description}</p>
              
              <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                <div>
                  <span style={{ color: '#f59e0b', fontSize: '24px' }}>⭐ {game.rating || 'N/A'}</span>
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>Rating</p>
                </div>
                <div>
                  <span style={{ color: '#6366f1', fontSize: '24px' }}>🎮 {game.plays || 0}</span>
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>Plays</p>
                </div>
              </div>

              <button className="btn btn-primary" style={{ width: '100%' }}>
                🎮 Play Now
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default GameDetailPage;
