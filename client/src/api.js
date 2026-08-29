/**
 * Single place that knows how to talk to the CineVerse backend.
 *
 * Every page imports from here instead of hardcoding http://localhost:5000,
 * so the API address only has to change in one spot (and can be set per
 * environment with VITE_API_URL when the project is deployed).
 *
 * The TMDB credential lives ONLY on the Express server. The browser never
 * sees it - the frontend just calls our own /api/tmdb/* endpoints.
 */

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export const API_BASE = `${API_URL}/api`;

/** Read the saved JWT, if the user is logged in. */
export const getToken = () => localStorage.getItem("token");

/** Authorization header for protected endpoints. */
export const authHeaders = () => {
  const token = getToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Fetch JSON from the backend and turn API errors into thrown Errors,
 * so callers can use a single try/catch instead of checking response.ok
 * in every component.
 */
export const apiFetch = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, options);

  // A crashed or missing server sends HTML, not JSON - handle that cleanly
  // instead of throwing an opaque "Unexpected token <" parse error.
  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? "Received an invalid response from the server."
        : `Server error (${response.status}). Is the backend running on port 5000?`
    );
  }

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
};

/* =========================================================
   TMDB CATALOGUE (public - no login needed)
========================================================= */

export const getPopular = (page = 1) =>
  apiFetch(`/tmdb/popular?page=${page}`);

export const getTrending = (window = "week", page = 1) =>
  apiFetch(`/tmdb/trending?window=${window}&page=${page}`);

export const getTopRated = (page = 1) =>
  apiFetch(`/tmdb/top-rated?page=${page}`);

export const getNowPlaying = (page = 1) =>
  apiFetch(`/tmdb/now-playing?page=${page}`);

export const getGenres = () => apiFetch("/tmdb/genres");

export const searchMovies = (query, page = 1) =>
  apiFetch(`/tmdb/search?query=${encodeURIComponent(query)}&page=${page}`);

export const discoverMovies = ({ genre, sort, page = 1 } = {}) => {
  const params = new URLSearchParams({ page });

  if (genre) params.set("genre", genre);
  if (sort) params.set("sort", sort);

  return apiFetch(`/tmdb/discover?${params}`);
};

export const getTmdbMovie = (tmdbId) => apiFetch(`/tmdb/movie/${tmdbId}`);

/* =========================================================
   MONGODB MOVIES (the original hand-added catalogue)
========================================================= */

export const getDbMovie = (id) => apiFetch(`/movies/${id}`);

/* =========================================================
   AUTH
========================================================= */

export const login = (email, password) =>
  apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

export const register = (name, email, password) =>
  apiFetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

/* =========================================================
   WATCHLIST (requires JWT)
========================================================= */

export const getWatchlist = () =>
  apiFetch("/watchlist", { headers: authHeaders() });

/**
 * Add or remove a movie. TMDB movies and the original MongoDB movies use
 * different endpoints, because a TMDB id is a number while a MongoDB id is
 * an ObjectId - so we pick the right one based on the movie.
 */
export const addToWatchlist = (movie) =>
  apiFetch(watchlistPath(movie), {
    method: "POST",
    headers: authHeaders(),
  });

export const removeFromWatchlist = (movie) =>
  apiFetch(watchlistPath(movie), {
    method: "DELETE",
    headers: authHeaders(),
  });

const watchlistPath = (movie) =>
  movie.tmdbId
    ? `/watchlist/tmdb/${movie.tmdbId}`
    : `/watchlist/${movie._id}`;

/* =========================================================
   SHARED HELPERS
========================================================= */

/**
 * Where a movie card should link to.
 * TMDB movies route on their numeric TMDB id; the original MongoDB
 * movies route on their ObjectId. MovieDetails works out which is which.
 */
export const movieLink = (movie) =>
  `/movies/${movie.tmdbId || movie._id}`;

/** A stable React key for a movie from either source. */
export const movieKey = (movie) =>
  movie.tmdbId ? `tmdb-${movie.tmdbId}` : `db-${movie._id}`;

/** Shown when a movie has no poster image. */
export const POSTER_FALLBACK =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750">
       <rect width="500" height="750" fill="#17171e"/>
       <text x="50%" y="50%" fill="#3a3a46" font-family="Arial" font-size="28"
             text-anchor="middle">No poster</text>
     </svg>`
  );
