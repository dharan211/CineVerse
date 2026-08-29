import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import MovieCard from "../components/MovieCard";
import {
  getTmdbMovie,
  getDbMovie,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getToken,
  movieKey,
  POSTER_FALLBACK,
} from "../api";

/**
 * Movie details page.
 *
 * Serves both catalogues from the one /movies/:id route:
 *   - a numeric id (27205)                -> TMDB
 *   - a 24-character ObjectId (6a926d...) -> our MongoDB collection
 *
 * That way the large TMDB catalogue works while the movies originally added
 * to MongoDB by hand still open exactly as before.
 */

/** MongoDB ObjectIds are 24 hex characters; TMDB ids are plain numbers. */
const isObjectId = (value) => /^[0-9a-fA-F]{24}$/.test(value);

function MovieDetails() {
  const { id } = useParams();

  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistNote, setWatchlistNote] = useState("");

  const [showTrailer, setShowTrailer] = useState(false);

  const token = getToken();

  // Load the movie from whichever source its id points at.
  useEffect(() => {
    setLoading(true);
    setError("");
    setShowTrailer(false);

    const request = isObjectId(id) ? getDbMovie(id) : getTmdbMovie(id);

    request
      .then(setMovie)
      .catch((err) => {
        console.error("Movie load failed:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));

    window.scrollTo(0, 0);
  }, [id]);

  // Is this film already saved?
  useEffect(() => {
    if (!token) {
      setInWatchlist(false);
      return;
    }

    getWatchlist()
      .then((watchlist) => {
        const saved = isObjectId(id)
          ? watchlist.some((item) => item._id === id)
          : watchlist.some((item) => String(item.tmdbId) === String(id));

        setInWatchlist(saved);
      })
      .catch((err) => console.error("Watchlist check failed:", err));
  }, [id, token]);

  const handleWatchlist = async () => {
    if (!token) {
      setWatchlistNote("Please log in to save movies to your watchlist.");
      return;
    }

    setWatchlistLoading(true);
    setWatchlistNote("");

    try {
      if (inWatchlist) {
        await removeFromWatchlist(movie);
        setInWatchlist(false);
        setWatchlistNote("Removed from your watchlist.");
      } else {
        await addToWatchlist(movie);
        setInWatchlist(true);
        setWatchlistNote("Saved to your watchlist.");
      }
    } catch (err) {
      console.error("Watchlist error:", err);
      setWatchlistNote(err.message);
    } finally {
      setWatchlistLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <h3>Loading movie...</h3>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="empty-state">
        <h3>Movie not found 😕</h3>
        <p>{error}</p>

        <Link to="/movies" className="primary-btn">
          Back to movies
        </Link>
      </div>
    );
  }

  const releaseDate = movie.releaseDate
    ? new Date(movie.releaseDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  return (
    <>
      {/* Backdrop banner, only for movies that have one. */}
      {movie.backdrop && (
        <div
          className="details-backdrop"
          style={{ backgroundImage: `url(${movie.backdrop})` }}
        >
          <div className="details-backdrop-fade" />
        </div>
      )}

      <section
        className={`movie-details${movie.backdrop ? " has-backdrop" : ""}`}
      >
        <div className="details-poster">
          <img
            src={movie.poster || POSTER_FALLBACK}
            alt={movie.title}
            onError={(e) => {
              e.currentTarget.src = POSTER_FALLBACK;
            }}
          />
        </div>

        <div className="details-content">
          <p className="eyebrow">MOVIE DETAILS</p>

          <h1>{movie.title}</h1>

          {movie.tagline && <p className="details-tagline">{movie.tagline}</p>}

          <div className="details-rating">
            ⭐ {movie.rating}/10
            {movie.voteCount > 0 && (
              <span className="vote-count">
                {" "}
                ({movie.voteCount.toLocaleString()} votes)
              </span>
            )}
          </div>

          {movie.genre?.length > 0 && (
            <div className="details-genres">
              {movie.genre.map((name) => (
                <span key={name} className="genre-tag">
                  {name}
                </span>
              ))}
            </div>
          )}

          <p className="details-description">{movie.description}</p>

          <div className="details-info">
            <div>
              <span>Release Date</span>
              <strong>{releaseDate}</strong>
            </div>

            <div>
              <span>Runtime</span>
              <strong>
                {movie.duration ? `${movie.duration} minutes` : "Unknown"}
              </strong>
            </div>

            <div>
              <span>Language</span>
              <strong>{movie.languageName || movie.language || "—"}</strong>
            </div>

            <div>
              <span>Director</span>
              <strong>{movie.director || "—"}</strong>
            </div>
          </div>

          <div className="details-actions">
            <button
              className={`primary-btn${inWatchlist ? " saved" : ""}`}
              onClick={handleWatchlist}
              disabled={watchlistLoading}
            >
              {watchlistLoading
                ? "Updating..."
                : inWatchlist
                ? "✓ In Watchlist"
                : "❤️ Add to Watchlist"}
            </button>

            {movie.trailerKey && (
              <button
                className="ghost-btn"
                onClick={() => setShowTrailer((open) => !open)}
              >
                {showTrailer ? "Hide trailer" : "▶ Watch trailer"}
              </button>
            )}

            <Link to="/movies">← Back to Movies</Link>
          </div>

          {watchlistNote && <p className="watchlist-note">{watchlistNote}</p>}
        </div>
      </section>

      {/* Trailer */}
      {showTrailer && movie.trailerKey && (
        <section className="trailer-section">
          <div className="trailer-frame">
            <iframe
              src={`https://www.youtube.com/embed/${movie.trailerKey}`}
              title={`${movie.title} trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      )}

      {/* Cast */}
      {movie.cast?.length > 0 && (
        <section className="movies-section">
          <div className="section-header">
            <div>
              <p className="section-label">STARRING</p>
              <h2>Top Cast</h2>
            </div>
          </div>

          <div className="cast-grid">
            {movie.cast.map((person) => (
              <div className="cast-card" key={person.id}>
                {person.profile ? (
                  <img src={person.profile} alt={person.name} loading="lazy" />
                ) : (
                  <div className="cast-placeholder">🎭</div>
                )}

                <h4>{person.name}</h4>
                <p>{person.character}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Similar movies */}
      {movie.similar?.length > 0 && (
        <section className="movies-section">
          <div className="section-header">
            <div>
              <p className="section-label">YOU MIGHT ALSO LIKE</p>
              <h2>Similar Movies</h2>
            </div>
          </div>

          <div className="movie-grid">
            {movie.similar.map((item) => (
              <MovieCard key={movieKey(item)} movie={item} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default MovieDetails;
