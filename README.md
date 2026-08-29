# CineVerse 🎬

A modern movie discovery web application. Browse thousands of movies powered by the TMDB API, search by title, filter by genre, view rich movie details, and save films to a personal watchlist — all with a dark, cinema-style UI.

**MERN stack:** MongoDB (Atlas) · Express · React (Vite) · Node.js — with **JWT authentication** and the **TMDB** catalogue API.

---

## ✨ Features

- **Movie catalog via TMDB** — popular, trending, top-rated and now-playing collections (1M+ movies, paginated, never all at once)
- **Search** — instant title search with debouncing
- **Genre filtering + sorting** — discover movies by genre (Action, Comedy, Drama, Sci-Fi, ...), sort by popularity / rating / release date / A-Z
- **Movie details** — poster + backdrop, tagline, rating, release date, runtime, language, director, top cast, YouTube trailer, similar movies
- **Authentication** — register / login with JWT; passwords hashed with bcrypt
- **Watchlist** — add / remove movies from a personal list, synced to MongoDB per user
- **Responsive dark UI** — custom, cinema-inspired design, works from phone to desktop

## 🏗️ Architecture

```
┌────────────┐     REST /api/*      ┌────────────┐    fetch     ┌──────────┐
│   React    │ ───────────────────▶ │  Express   │ ──────────▶ │  TMDB    │
│  (Vite)    │ ◀─────────────────── │  (server)  │ ◀────────── │   API    │
└────────────┘                      └─────┬──────┘             └──────────┘
                                          │
                                 MongoDB (users, watchlists,
                                 cached TMDB movies)
```

- **TMDB** supplies the large catalogue: popular/trending/search/genres/details/images.
- **MongoDB** stores only what's ours: users, watchlists, and a cached copy of movies a user saves.
- When you save a TMDB movie, the server caches its details in MongoDB once, then reuses it — so the watchlist works even if TMDB is unreachable.
- The TMDB credential **never leaves the Express server**: the browser only talks to our API.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (tested on 20 / 22 / 26)
- A MongoDB Atlas connection string (free tier is fine)
- A TMDB API key or read-access token: https://www.themoviedb.org/settings/api

### 1. Backend

```bash
cd server
npm install
cp .env.example .env   # then fill in MONGO_URI, JWT_SECRET, TMDB_TOKEN
npm run dev            # starts http://localhost:5000
```

> **Note for Indian ISPs (Jio/Airtel/BSNL):** some networks block `api.themoviedb.org` at
> the TLS layer, which surfaces as `ECONNRESET`. The server tries
> `TMDB_API_HOST` first and falls back to `api.tmdb.org` automatically.
> If you're on an unrestricted network you can delete `TMDB_API_HOST`
> and nothing breaks — the failover is automatic.

### 2. Frontend

```bash
cd client
npm install
npm run dev            # starts http://localhost:5173
```

Open http://localhost:5173 and you're in. Or run the production build:

```bash
npm run build          # emits client/dist
```

### 3. Database setup (optional)

The app works with an empty database — TMDB provides the catalogue.
If you'd like a seed movie in MongoDB, POST to `/api/movies`:

```json
{
  "title": "Inception",
  "description": "A thief who enters the dreams of others.",
  "poster": "https://example.com/inception.jpg",
  "genre": ["Sci-Fi", "Thriller"],
  "releaseDate": "2010-07-16",
  "rating": 8.8,
  "duration": 148,
  "language": "English"
}
```

## 🧭 API Overview

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create an account |
| POST | `/api/auth/login` | — | Log in, returns JWT |
| GET | `/api/movies` | — | Hand-added MongoDB movies |
| GET | `/api/movies/:id` | — | MongoDB movie by ObjectId |
| GET | `/api/watchlist` | JWT | User's saved movies |
| POST | `/api/watchlist/:movieId` | JWT | Add a MongoDB movie |
| DELETE | `/api/watchlist/:movieId` | JWT | Remove it |
| POST | `/api/watchlist/tmdb/:tmdbId` | JWT | Add a TMDB movie (caches it) |
| DELETE | `/api/watchlist/tmdb/:tmdbId` | JWT | Remove a cached TMDB movie |
| GET | `/api/tmdb/popular?page=N` | — | Popular, paginated |
| GET | `/api/tmdb/trending?window=week\|day` | — | Trending |
| GET | `/api/tmdb/top-rated?page=N` | — | Top rated |
| GET | `/api/tmdb/now-playing?page=N` | — | In theatres now |
| GET | `/api/tmdb/search?query=...&page=N` | — | Title search |
| GET | `/api/tmdb/discover?genre=ID&sort=...&page=N` | — | Filter + sort discovery |
| GET | `/api/tmdb/genres` | — | Genre id→name list |
| GET | `/api/tmdb/movie/:id` | — | Full details + cast + trailer + similar |

## 📁 Project Structure

```
Cineverse/
├── client/                     # React + Vite frontend
│   └── src/
│       ├── api.js              # single source of backend calls
│       ├── components/
│       │   └── MovieCard.jsx   # shared movie card
│       └── pages/
│           ├── Home.jsx        # hero + trending/popular/genres/top-rated
│           ├── Movies.jsx      # search, filter, sort, load-more
│           ├── MovieDetails.jsx# details + watchlist + trailer + cast
│           ├── Watchlist.jsx
│           ├── Login.jsx
│           └── Register.jsx
│
└── server/                     # Node + Express backend
    ├── config/
    │   ├── db.js               # MongoDB connection
    │   └── tmdb.js             # TMDB client (auth auto-detect + host failover)
    ├── models/
    │   ├── User.js
    │   └── Movie.js
    ├── routes/
    │   ├── authRoutes.js
    │   ├── movieRoutes.js
    │   ├── tmdbRoutes.js
    │   └── watchlistRoutes.js
    ├── .env.example
    └── server.js
```

## 🔐 Security notes

- Passwords hashed with **bcrypt** (10 rounds).
- JWTs signed with a secret from `.env` (7-day expiry).
- All watchlist routes require a valid token.
- The TMDB token exists **only** in `server/.env` — never in browser code.
- `.env` is gitignored; `.env.example` ships with placeholders.

---

Made with React, Express, MongoDB and TMDB. 🍿
