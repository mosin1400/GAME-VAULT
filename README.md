# 🎮 Game Vault - Professional Monorepo Architecture

![Game Vault Banner](https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=400&fit=crop)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://reactjs.org/)

> **Your ultimate gaming library** - Discover, play, and manage your favorite games all in one place.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start all services (API + Auth + Web)
npm run dev

# Or start individual services
npm run dev:api    # API on port 3001
npm run dev:auth   # Auth service on port 3002
npm run dev:web    # Frontend on port 3000
```

## 📁 Project Structure

```
game-vault/
├── apps/                    # Applications
│   └── web/                 # React frontend (Vite)
│       ├── src/
│       │   ├── components/  # Reusable components
│       │   ├── pages/       # Page components
│       │   ├── styles/      # Global styles
│       │   └── utils/       # Utilities & API client
│       └── package.json
├── services/                # Backend services
│   ├── api/                 # Main API service (Fastify)
│   │   └── src/
│   └── auth/                # Authentication service
│       └── src/
├── packages/                # Shared packages
│   ├── shared/              # Shared utilities & types
│   └── config/              # Shared configuration
├── tests/                   # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── infrastructure/          # Infrastructure code
│   └── docker/
├── data/                    # Database files
├── logs/                    # Application logs
└── scripts/                 # Build & deployment scripts
```

## ✨ Features

### 🔐 Security First
- JWT-based authentication with bcrypt password hashing
- Rate limiting on all API endpoints
- CORS protection
- Helmet security headers
- Input validation and sanitization

### 🏗️ Modern Architecture
- **Monorepo** structure with npm workspaces
- **Microservices-ready** separation of concerns
- **Shared packages** for code reusability
- **Type-safe** development with TypeScript support

### 🎯 Core Features
- User registration and authentication
- Game catalog with search and filtering
- Game details and ratings
- Admin dashboard with statistics
- Responsive design for all devices

### 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, React Router |
| **Backend** | Fastify, Node.js 20+ |
| **Database** | SQLite (dev), PostgreSQL (prod) |
| **Auth** | JWT, bcryptjs |
| **Testing** | Jest, Vitest, Playwright |
| **DevOps** | Docker, Docker Compose |

## 📊 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login user |
| GET | `/api/v1/auth/me` | Get current user |

### Games
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/games` | List all games |
| GET | `/api/v1/games/:id` | Get game details |
| POST | `/api/v1/games` | Create game (admin) |
| PUT | `/api/v1/games/:id` | Update game (admin) |
| DELETE | `/api/v1/games/:id` | Delete game (admin) |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/stats` | Get platform statistics |

## 🧪 Testing

```bash
# Run all tests
npm test

# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Generate coverage report
npm test -- --coverage
```

## 🐳 Docker Support

```bash
# Build all containers
npm run docker:build

# Start all services
npm run docker:up

# Stop all services
npm run docker:down
```

## 📈 Development Workflow

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/game-vault.git
   cd game-vault
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run database migrations**
   ```bash
   npm run migrate
   ```

5. **Seed sample data** (optional)
   ```bash
   npm run seed
   ```

6. **Start development servers**
   ```bash
   npm run dev
   ```

## 🔒 Security Best Practices

- All passwords are hashed with bcrypt (12 rounds)
- JWT tokens expire after 7 days (configurable)
- Rate limiting: 100 requests per minute per IP
- CORS restricted to allowed origins only
- Input validation on all user inputs
- SQL injection prevention with parameterized queries

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Game Vault Team** - *Initial work*

## 🙏 Acknowledgments

- Thanks to all contributors
- Built with ❤️ using modern web technologies

---

<div align="center">

**🎮 Happy Gaming!**

[⬆ Back to Top](#-game-vault---professional-monorepo-architecture)

</div>
