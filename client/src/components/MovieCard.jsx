import { Link } from "react-router-dom";

import { movieLink, POSTER_FALLBACK } from "../api";

/**
 * One movie tile.
 *
 * Extracted so Home, Movies and Watchlist all render identical cards
 * instead of each keeping its own copy of the markup. It deliberately
 * reuses the existing .movie-card / .poster-wrapper / .rating classes
 * so the current design is unchanged.
 *
 * Works with movies from TMDB and from MongoDB - movieLink() picks the
 * right URL for each.
 */
function MovieCard({ movie, children }) {
  return (
    <div className="movie-card">
      <Link to={movieLink(movie)} className="movie-card-link">
        <div className="poster-wrapper">
          <img
            src={movie.poster || POSTER_FALLBACK}
            alt={movie.title}
            loading="lazy"
            onError={(e) => {
              // A blocked or dead image URL would otherwise show a broken
              // icon and wreck the grid, so swap in the placeholder.
              e.currentTarget.src = POSTER_FALLBACK;
            }}
          />

          {movie.rating > 0 && (
            <div className="rating">⭐ {movie.rating}</div>
          )}
        </div>

        <div className="movie-info">
          <h3 title={movie.title}>{movie.title}</h3>

          <p className="movie-genres">
            {movie.genre?.length
              ? movie.genre.slice(0, 2).join(" • ")
              : "Unclassified"}
          </p>

          {movie.year && <p className="duration">{movie.year}</p>}
        </div>
      </Link>

      {/* Watchlist uses this slot for its Remove button. */}
      {children}
    </div>
  );
}

export default MovieCard;
