import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import MovieCard from "../components/MovieCard";
import {
  searchMovies,
  discoverMovies,
  getGenres,
  movieKey,
} from "../api";

/**
 * Movies page - the main browsing screen.
 *
 * Search, genre filtering and sorting all happen on TMDB's side rather than
 * by filtering an array in the browser, so all ~1.1 million movies are
 * reachable instead of only the ones already downloaded. Results are added a
 * page at a time with "Load more" so we never try to render thousands of cards.
 *
 * The current filters live in the URL (?q=&genre=&sort=), which means the
 * genre links on the Home page work, and a filtered view can be shared or
 * reloaded without losing state.
 */

const SORT_OPTIONS = [
  { value: "popularity.desc", label: "Most Popular" },
  { value: "vote_average.desc", label: "Highest Rated" },
  { value: "primary_release_date.desc", label: "Newest First" },
  { value: "title.asc", label: "A → Z" },
];

function Movies() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL is the source of truth for the filters.
  const query = searchParams.get("q") || "";
  const genre = searchParams.get("genre") || "";
  const sort = searchParams.get("sort") || "popularity.desc";

  // Separate state for the text box so typing stays responsive and we can
  // debounce before firing a request.
  const [searchInput, setSearchInput] = useState(query);

  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Lets us ignore a slow response that arrives after a newer one - otherwise
  // fast typing can leave stale results on screen.
  const requestRef = useRef(0);

  // Genre list for the dropdown (fetched once).
  useEffect(() => {
    getGenres()
      .then(setGenres)
      .catch((err) => console.error("Genre load failed:", err));
  }, []);

  // Keep the text box in step if the URL changes from elsewhere (e.g. a
  // genre link on the Home page, or the browser Back button).
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  /** Fetch one page. append=true adds to the grid instead of replacing it. */
  const load = useCallback(
    async (pageToLoad, { append } = {}) => {
      const requestId = ++requestRef.current;

      if (append) setLoadingMore(true);
      else setLoading(true);

      setError("");

      try {
        // A search query overrides genre/sort, because TMDB's search
        // endpoint does not accept those filters.
        const data = query.trim()
          ? await searchMovies(query, pageToLoad)
          : await discoverMovies({ genre, sort, page: pageToLoad });

        if (requestId !== requestRef.current) return; // superseded

        setMovies((prev) =>
          append ? [...prev, ...data.results] : data.results
        );
        setPage(data.page);
        setTotalPages(data.totalPages);
        setTotalResults(data.totalResults);
      } catch (err) {
        if (requestId !== requestRef.current) return;

        console.error("Movie load failed:", err);
        setError(err.message);

        if (!append) setMovies([]);
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [query, genre, sort]
  );

  // Reload from page 1 whenever the filters change.
  useEffect(() => {
    load(1);
  }, [load]);

  // Debounce typing so we do not fire a request per keystroke.
  useEffect(() => {
    if (searchInput === query) return;

    const timer = setTimeout(() => {
      updateParams({ q: searchInput || null });
    }, 450);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  /** Merge changes into the URL, dropping empty values to keep it tidy. */
  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    });

    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const activeGenreName =
    genres.find((g) => String(g.id) === String(genre))?.name || "";

  const hasFilters = Boolean(query || genre) || sort !== "popularity.desc";

  /* ---------------- heading text ---------------- */

  let heading = "All Movies";
  let subtitle =
    "Explore thousands of movies, discover new favorites, and find something worth watching.";

  if (query) {
    heading = `Results for "${query}"`;
    subtitle = totalResults
      ? `Found ${totalResults.toLocaleString()} matching movies.`
      : "No matches yet - try a different spelling.";
  } else if (activeGenreName) {
    heading = `${activeGenreName} Movies`;
    subtitle = `Browsing ${totalResults.toLocaleString()} ${activeGenreName.toLowerCase()} movies.`;
  }

  return (
    <section className="movies-page">
      <div className="page-heading">
        <p className="section-label">CINEVERSE LIBRARY</p>

        <h1>{heading}</h1>

        <p>{subtitle}</p>
      </div>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="🔎 Search movies..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />

        <select
          value={genre}
          onChange={(e) => updateParams({ genre: e.target.value || null })}
          disabled={Boolean(query)}
          title={
            query
              ? "Clear the search box to filter by genre"
              : "Filter by genre"
          }
        >
          <option value="">All Genres</option>

          {genres.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value })}
          disabled={Boolean(query)}
          title={
            query ? "Search results are ordered by relevance" : "Sort results"
          }
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button className="ghost-btn" onClick={clearFilters}>
            Clear
          </button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="empty-state">
          <h3>Loading movies 🎬</h3>
          <p>Please wait...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <h3>Could not load movies</h3>
          <p>{error}</p>
        </div>
      ) : movies.length === 0 ? (
        <div className="empty-state">
          <h3>No movies found 😢</h3>
          <p>Try a different search or clear your filters.</p>
        </div>
      ) : (
        <>
          <div className="movie-grid">
            {movies.map((movie) => (
              <MovieCard key={movieKey(movie)} movie={movie} />
            ))}
          </div>

          <div className="load-more-wrap">
            {page < totalPages ? (
              <>
                <button
                  className="primary-btn"
                  onClick={() => load(page + 1, { append: true })}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load more movies"}
                </button>

                <p className="load-more-count">
                  Showing {movies.length.toLocaleString()} of{" "}
                  {totalResults.toLocaleString()} movies
                </p>
              </>
            ) : (
              <p className="load-more-count">
                That's all {totalResults.toLocaleString()} results.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default Movies;
