# 🎮 Game Vault

<p align="center">
  <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&h=400&fit=crop" alt="Game Vault Banner" width="100%" />
</p>

<p align="center">
  <strong>A comprehensive browser-based game management and development platform with professional editing capabilities</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#project-structure">Structure</a> •
  <a href="#testing">Testing</a> •
  <a href="#tech-stack">Tech Stack</a>
</p>

---

## 📖 About

**Game Vault** is a comprehensive modern platform for managing, showcasing, and developing browser-based games. This project intelligently combines:

- 📚 **Public Game Catalog** - Versioned display with live previews
- 🛠️ **Professional Admin Environment** - Advanced admin panel with powerful capabilities
- 🤖 **AI Workshop** - AI assistant with real-time operation flows
- 🎨 **Theia Studio Editor** - Integrated development environment in the browser

---

## ✨ Features

### 🎯 Core Features

| Section | Description |
|---------|-------------|
| **Smart Catalog** | Versioned game list with precise preview of each version |
| **Auto Documentation** | Automatic Markdown generation and rendering for game descriptions |
| **Activity Tracking** | Real-time tracking of user and system activities |
| **User Profiles** | Profile management, favorites, and community comments |
| **Rating System** | Community rating and comment system |
| **Project Management** | Versioning, upload, and file management operations |
| **AI Assistant** | Smart workspace with manual file approval |
| **Multiple Themes** | Light/dark mode with responsive mobile navigation |

### 🔐 Security & Authentication

- Secure session management (Session-based Authentication)
- Separation of Admin and regular user access
- API key protection on server side
- CORS configured for Theia Studio

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Game Vault Platform                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Frontend   │    │   Backend    │    │    Theia     │   │
│  │   (Pages)    │◄──►│    (API)     │◄──►│   Studio     │   │
│  │              │    │              │    │  (Editor)    │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                   │                   │           │
│         ▼                   ▼                   ▼           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  Core Services                        │   │
│  │  Auth │ Catalog │ Community │ AI │ History │ Tools   │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                               │
│                              ▼                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Data Layer                          │   │
│  │        Games │ Builds │ Vault │ Sessions              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Core Services

| Module | Path | Responsibility |
|--------|------|----------------|
| **Project Core** | `backend/core/` | Safe paths, JSON, metadata validation |
| **Authentication** | `backend/auth/` | User sessions, tokens, admin access |
| **Game Catalog** | `backend/projects/` | Game lists, versions, file trees |
| **Community** | `backend/community/` | Comments, ratings, favorites |
| **AI** | `backend/ai/` | AI agent, conversation memory, tools |
| **Tools** | `backend/tools/` | VS Code, Git, resource stats |
| **History** | `backend/projects/history.js` | Snapshots and safe rollback |
| **HTTP** | `backend/http/` | Static files, CORS, responses |

---

## 🚀 Quick Start

### Prerequisites

```bash
Node.js >= 24
npm
```

### Installation & Running

```powershell
# Clone repository
git clone <repository-url>
cd game-vault

# Install dependencies
npm install

# Run server
npm start
# or
node server.js
```

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| **Main App** | `http://localhost:8080` | Catalog, profiles, management |
| **Theia Studio** | `http://localhost:3010` | Code editor in browser |

> 💡 **Tip:** Create a `.env` file in the project root for environment variables (like `OPENROUTER_API_KEY`). Never commit this file!

---

## 📁 Project Structure

```
game-vault/
├── frontend/                 # User interface
│   ├── pages/               # HTML pages (index, manage, profile)
│   ├── scripts/             # JavaScript logic (app.js, markdown.js)
│   ├── styles/              # CSS styles
│   └── public/              # Public static files
│
├── backend/                  # Server-side services
│   ├── core/                # Core project logic
│   ├── auth/                # Authentication and sessions
│   ├── projects/            # Game catalog and management
│   ├── community/           # User interactions
│   ├── ai/                  # AI services
│   ├── tools/               # System tools
│   ├── http/                # HTTP request handling
│   └── builds/              # Build output management
│
├── games/                    # Game projects
│   └── <slug>/versions/     # Game versions
│       ├── game.json        # Game metadata
│       └── README.md        # Version documentation
│
├── theia/                    # Theia Studio editor
│   ├── gv-extension/        # Game Vault extensions
│   ├── lib/                 # Shared libraries
│   └── src-gen/             # Generated code
│
├── skills/                   # AI skills
│   ├── bug-fix/             # Bug fixing
│   ├── code-review/         # Code review
│   └── metadata-auditor/    # Metadata auditing
│
├── tests/                    # Contract and behavior tests
│   ├── http/                # HTTP tests
│   ├── integration/         # Integration tests
│   └── migration/           # Migration tests
│
├── infrastructure/           # Infrastructure
│   └── database/            # Database configuration
│
├── docs/                     # Documentation
│   ├── CURRENT-ARCHITECTURE.md
│   ├── EXECUTION-PLAN.md
│   └── superpowers/         # Advanced documentation
│
├── data/                     # Operational data
├── .vault/                   # Local sensitive data
├── builds/                   # Build outputs
│
├── server.js                 # Main entry point
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

---

## 🧪 Testing

### Running Tests

```powershell
# Run all tests
npm test

# Behavior tests
npm run test:behavior

# API tests
npm run test:api
```

### Test Coverage

The project includes comprehensive tests in the following areas:

- ✅ API and HTTP contracts
- ✅ Authentication and session management
- ✅ Game catalog and metadata
- ✅ AI services and agents
- ✅ Theia Studio integration
- ✅ Themes and UI synchronization
- ✅ Project history and rollback

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Runtime** | Node.js | >= 24 |
| **Frontend** | Vanilla JS, HTML5, CSS3 | - |
| **Editor** | Monaco Editor | ^0.52.0 |
| **IDE** | Theia Studio | Latest |
| **Build** | esbuild | Latest |
| **Testing** | Node.js Test Runner | Built-in |
| **AI** | OpenRouter API | External |

---

## 🔒 Security Notes

> ⚠️ **Important:** 
> - Never expose API keys (like `OPENROUTER_API_KEY`) in client-side files
> - The `.env` file must be in `.gitignore` and never committed
> - Use `OPENROUTER_MODEL` to specify the AI model
> - All AI requests are managed through server-side endpoints (`POST /api/ai`)

---

## 📸 Screenshots

### Main Page - Game Catalog
<p align="center">
  <img src="https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?w=800&h=450&fit=crop" alt="Game Catalog" width="80%" />
</p>

### Project Management Dashboard
<p align="center">
  <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop" alt="Management Dashboard" width="80%" />
</p>

### Theia Studio Editor
<p align="center">
  <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=450&fit=crop" alt="Theia Editor" width="80%" />
</p>

---

## 🤝 Contributing

To contribute to the project:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is developed under a private license. All rights reserved.

---

## 📞 Contact

For questions and support, please use GitHub Issues.

---

<p align="center">
  <strong>Built with ❤️ for the game development community</strong>
</p>

<p align="center">
  <sub>Game Vault © 2024 - Browser-based Game Management Platform</sub>
</p>
