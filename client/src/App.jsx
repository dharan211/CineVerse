import { useState, lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";

import Watchlist from "./pages/Watchlist";

import "./App.css";

import Home from "./pages/Home";
import Movies from "./pages/Movies";
import MovieDetails from "./pages/MovieDetails";
import Login from "./pages/Login";

// Loaded on demand so the initial bundle stays small.
const Register = lazy(() => import("./pages/Register"));

function AppContent() {
  const [loggedIn, setLoggedIn] = useState(
    !!localStorage.getItem("token")
  );

  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    setLoggedIn(false);
    navigate("/");
  };

  return (
    <div className="app">

      <nav className="navbar">

        <Link to="/" className="logo">
          CineVerse 🎬
        </Link>

        <div className="nav-links">

          <Link to="/">Home</Link>

          <Link to="/movies">
            Movies
          </Link>

          <Link to="/watchlist">
            Watchlist
          </Link>

          {loggedIn ? (
            <button
              onClick={handleLogout}
              className="logout-btn"
            >
              Logout
            </button>
          ) : (
            <Link to="/login">
              Login
            </Link>
          )}

        </div>

      </nav>

      <main>
        <Routes>

          <Route
            path="/"
            element={<Home />}
          />

          <Route
            path="/movies"
            element={<Movies />}
          />

          <Route
            path="/movies/:id"
            element={<MovieDetails />}
          />

          <Route
            path="/login"
            element={
              <Login
                onLogin={() => setLoggedIn(true)}
              />
            }
          />

          <Route
            path="/register"
            element={
              <Suspense fallback={<div className="empty-state">Loading...</div>}>
                <Register onLogin={() => setLoggedIn(true)} />
              </Suspense>
            }
          />

          <Route
            path="/watchlist"
            element={<Watchlist />}
              />

        </Routes>
      </main>

      <footer>

        <h2>CineVerse 🎬</h2>

        <p>
          Discover. Review. Remember.
        </p>

        <p>
          © 2026 CineVerse. All rights reserved.
        </p>

      </footer>

    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;