import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import MovieCard from "../components/MovieCard";
import {
  getWatchlist,
  removeFromWatchlist,
  getToken,
  movieKey,
} from "../api";

/**
 * Watchlist page.
 *
 * Shows the logged-in user's saved movies. Items may be TMDB movies (which we
 * cached in MongoDB when they were saved) or the original hand-added movies -
 * both are stored as Movie documents and arrive through the same endpoint.
 */
function Watchlist() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = getToken();

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    getWatchlist()
      .then((data) => {
        setMovies(data);

        // The backend returns the list in insertion order, so the most
        // recently saved film sits at the back - flip that around.
        setMovies([...data].reverse());
      })
      .catch((err) => {
        console.error("Watchlist error:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const removeMovie = async (movie) => {
    try {
      await removeFromWatchlist(movie);

      setMovies((prev) => prev.filter((m) => m._id !== movie._id));
    } catch (err) {
      console.error("Remove failed:", err);
      alert(err.message);
    }
  };

  if (!token) {
    return (
      <div className="empty-page">
        <h1>❤️ Your Watchlist</h1>

        <p>Log in to save movies to your watchlist.</p>

        <Link to="/login" className="primary-btn">
          Log in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="empty-page">
        <h2>Loading your watchlist...</h2>
      </div>
    );
  }

  return (
    <div className="movies-page">
      <div className="page-heading">
        <p className="section-label">YOUR COLLECTION</p>

        <h1>❤️ Watchlist</h1>

        <p>
          {movies.length
            ? `${movies.length} ${movies.length === 1 ? "movie" : "movies"} saved for later.`
            : "Movies you want to watch someday."}
        </p>
      </div>

      {error ? (
        <div className="error-message">
          <h3>Could not load your watchlist</h3>
          <p>{error}</p>
        </div>
      ) : movies.length === 0 ? (
        <div className="empty-page">
          <h2>Your watchlist is empty.</h2>

          <p>Find something you want to watch and save it here.</p>

          <Link to="/movies" className="primary-btn">
            Explore Movies
          </Link>
        </div>
      ) : (
        <div className="movie-grid">
          {movies.map((movie) => (
            <MovieCard key={movieKey(movie)} movie={movie}>
              <button
                className="remove-btn"
                onClick={() => removeMovie(movie)}
                title="Remove from watchlist"
              >
                ✕ Remove
              </button>
            </MovieCard>
          ))}
        </div>
      )}
    </div>
  );
}

export default Watchlist;
