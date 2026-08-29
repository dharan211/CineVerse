import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import MovieCard from "../components/MovieCard";
import {
  getTrending,
  getPopular,
  getTopRated,
  getGenres,
  movieKey,
} from "../api";

/**
 * Home page.
 *
 * Now fed by TMDB instead of the single MongoDB movie: a hero built from the
 * top trending film, then trending / popular / top-rated rows and genre
 * browsing. Keeps the original hero + .movies-section + .movie-grid layout.
 */

/** One "Trending this week" style row. */
function MovieRow({ label, title, movies, to }) {
  if (!movies.length) return null;

  return (
    <section className="movies-section">
      <div className="section-header">
        <div>
          <p className="section-label">{label}</p>
          <h2>{title}</h2>
        </div>

        <Link className="view-all" to={to}>
          View all →
        </Link>
      </div>

      <div className="movie-grid">
        {movies.map((movie) => (
          <MovieCard key={movieKey(movie)} movie={movie} />
        ))}
      </div>
    </section>
  );
}

function Home() {
  const [trending, setTrending] = useState([]);
  const [popular, setPopular] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [genres, setGenres] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // All four requests go out together rather than one after another,
    // so the page paints as soon as the slowest one lands.
    Promise.all([
      getTrending("week"),
      getPopular(),
      getTopRated(),
      getGenres(),
    ])
      .then(([trendingData, popularData, topRatedData, genreData]) => {
        setTrending(trendingData.results);
        setPopular(popularData.results);
        setTopRated(topRatedData.results);
        setGenres(genreData);
      })
      .catch((err) => {
        console.error("Home load failed:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  // The most trending film becomes the hero backdrop.
  const feature = trending[0];

  if (loading) {
    return (
      <div className="empty-state">
        <h3>Loading CineVerse 🎬</h3>
        <p>Fetching the latest movies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-message">
        <h3>Could not load movies</h3>
        <p>{error}</p>
        <p>Make sure the backend is running on port 5000.</p>
      </div>
    );
  }

  return (
    <>
      <section
        className="hero"
        style={
          feature?.backdrop
            ? { backgroundImage: `url(${feature.backdrop})` }
            : undefined
        }
      >
        {/* Dark scrim so the hero text stays readable over any backdrop. */}
        <div className="hero-overlay" />

        <div className="hero-content">
          <p className="eyebrow">YOUR MOVIE UNIVERSE</p>

          <h1>
            Discover your next
            <br />
            <span>favorite movie.</span>
          </h1>

          <p className="hero-text">
            Browse thousands of movies, search by title, filter by genre, and
            build your own personal watchlist.
          </p>

          <div className="hero-actions">
            <Link to="/movies" className="primary-btn">
              Explore Movies
            </Link>

            {feature && (
              <Link to={`/movies/${feature.tmdbId}`} className="ghost-btn">
                ▶ Trending: {feature.title}
              </Link>
            )}
          </div>
        </div>
      </section>

      <MovieRow
        label="THIS WEEK"
        title="Trending Now"
        movies={trending.slice(0, 8)}
        to="/movies?sort=popularity.desc"
      />

      <MovieRow
        label="EXPLORE"
        title="Popular Movies"
        movies={popular.slice(0, 8)}
        to="/movies"
      />

      {/* Browse by genre */}
      {genres.length > 0 && (
        <section className="movies-section">
          <div className="section-header">
            <div>
              <p className="section-label">CATEGORIES</p>
              <h2>Browse by Genre</h2>
            </div>
          </div>

          <div className="genre-grid">
            {genres.map((genre) => (
              <Link
                key={genre.id}
                to={`/movies?genre=${genre.id}`}
                className="genre-chip"
              >
                {genre.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <MovieRow
        label="ALL TIME"
        title="Top Rated"
        movies={topRated.slice(0, 8)}
        to="/movies?sort=vote_average.desc"
      />
    </>
  );
}

export default Home;
