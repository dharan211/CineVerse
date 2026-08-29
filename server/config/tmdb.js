/**
 * Central TMDB client for CineVerse.
 *
 * Solves two real problems we diagnosed:
 *
 * 1. CREDENTIAL TYPE
 *    TMDB has two credential formats and they authenticate DIFFERENTLY:
 *      - v3 API Key            -> 32 hex chars  -> sent as ?api_key=... query param
 *      - v4 Read Access Token  -> a JWT "eyJ..." -> sent as Authorization: Bearer ...
 *    Sending a v3 key as a Bearer token gives:
 *      { "message": "Invalid API key: You must be granted a valid key." }
 *    So we detect which one is in .env and use the matching auth method.
 *
 * 2. ISP BLOCKING (the ECONNRESET)
 *    Some ISPs (common in India: Jio/Airtel/BSNL) block "api.themoviedb.org" by
 *    inspecting the TLS SNI and killing the connection -> ECONNRESET, even though
 *    the IP is reachable. "api.tmdb.org" is the same API on an unfiltered hostname.
 *    We try hosts in order and remember whichever works, so this runs on a blocked
 *    home network AND on a normal network without any code change.
 *
 * The token NEVER leaves the server - the React app only ever talks to our Express API.
 */

// Hosts to try, in order. First success is cached for the rest of the process.
const HOST_CANDIDATES = [
  process.env.TMDB_API_HOST, // optional manual override from .env
  "api.themoviedb.org", // canonical host
  "api.tmdb.org", // alias that ISPs usually do not block
].filter(Boolean);

const IMAGE_BASE = "https://image.tmdb.org/t/p";

const REQUEST_TIMEOUT_MS = 15000;

// Network-level failures that mean "this host is unreachable, try another one".
// (An HTTP 401/404 is NOT one of these - that is a real answer from TMDB.)
const NETWORK_ERROR_CODES = [
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "CERT_HAS_EXPIRED",
];

let workingHost = null;

/**
 * Read the credential from .env and work out how to send it.
 * Tolerates the two most common copy/paste mistakes: a leading "Bearer "
 * and wrapping quotes.
 */
const getCredential = () => {
  const raw = process.env.TMDB_TOKEN || process.env.TMDB_API_KEY || "";

  const value = raw
    .trim()
    .replace(/^["']|["']$/g, "") // strip accidental quotes
    .replace(/^Bearer\s+/i, ""); // strip accidental "Bearer " prefix

  if (!value) {
    return { mode: "missing", value: "" };
  }

  // A v4 Read Access Token is a JWT: three dot-separated base64 segments.
  const isV4Token = value.startsWith("eyJ") && value.split(".").length === 3;

  return {
    mode: isV4Token ? "v4" : "v3",
    value,
  };
};

const credential = getCredential();

/**
 * Human-readable credential status. Safe to log - never includes the secret.
 */
const describeCredential = () => {
  if (credential.mode === "missing") {
    return "TMDB credential: MISSING (set TMDB_TOKEN in server/.env)";
  }

  if (credential.mode === "v4") {
    return "TMDB credential: v4 Read Access Token (sent as Bearer header)";
  }

  return "TMDB credential: v3 API Key (sent as api_key query param)";
};

const isNetworkError = (error) => {
  const code = error?.cause?.code || error?.code;

  return (
    NETWORK_ERROR_CODES.includes(code) ||
    error?.name === "AbortError" ||
    error?.name === "TimeoutError"
  );
};

/**
 * Build the full URL for one host.
 * For a v3 key the credential goes in the query string; for v4 it goes in a header.
 */
const buildUrl = (host, path, params) => {
  const url = new URL(`https://${host}/3${path}`);

  // Sensible defaults every CineVerse request wants.
  url.searchParams.set("language", "en-US");

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  if (credential.mode === "v3") {
    url.searchParams.set("api_key", credential.value);
  }

  return url.toString();
};

const buildHeaders = () => {
  const headers = { accept: "application/json" };

  if (credential.mode === "v4") {
    headers.Authorization = `Bearer ${credential.value}`;
  }

  return headers;
};

/**
 * Call a TMDB endpoint.
 *
 * @param {string} path   e.g. "/movie/popular"
 * @param {object} params query params (page, query, with_genres, ...)
 * @returns {Promise<object>} parsed TMDB JSON
 * @throws {Error} with .status and .isTmdbError for HTTP errors,
 *                 or .isNetworkError when every host was unreachable.
 */
const tmdbFetch = async (path, params = {}) => {
  if (credential.mode === "missing") {
    const error = new Error(
      "TMDB credential missing. Add TMDB_TOKEN to server/.env"
    );
    error.status = 500;

    throw error;
  }

  // Try the known-good host first, then the rest as fallbacks.
  const hosts = workingHost
    ? [workingHost, ...HOST_CANDIDATES.filter((h) => h !== workingHost)]
    : [...HOST_CANDIDATES];

  const failures = [];

  for (const host of hosts) {
    try {
      const response = await fetch(buildUrl(host, path, params), {
        method: "GET",
        headers: buildHeaders(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const data = await response.json();

      if (!response.ok) {
        // TMDB answered, so this host works - the problem is the request itself
        // (bad key, unknown movie id, rate limit). Do not try other hosts.
        workingHost = host;

        const error = new Error(
          data.status_message || `TMDB request failed (${response.status})`
        );
        error.status = response.status;
        error.isTmdbError = true;

        throw error;
      }

      if (workingHost !== host) {
        console.log(`TMDB: using host ${host}`);
        workingHost = host;
      }

      return data;
    } catch (error) {
      if (error.isTmdbError) {
        throw error; // real API error - propagate, do not retry other hosts
      }

      if (!isNetworkError(error)) {
        throw error; // programming error - do not mask it
      }

      const code = error?.cause?.code || error?.name;
      failures.push(`${host} (${code})`);

      if (workingHost === host) {
        workingHost = null; // stop trusting this host
      }
      // else: fall through and try the next host
    }
  }

  const error = new Error(
    `Could not reach TMDB. Tried: ${failures.join(", ")}. ` +
      `Your network may be blocking TMDB - try a different network or set TMDB_API_HOST in .env.`
  );
  error.status = 503;
  error.isNetworkError = true;

  throw error;
};

/* =========================================================
   IMAGE HELPERS
========================================================= */

const imageUrl = (path, size = "w500") =>
  path ? `${IMAGE_BASE}/${size}${path}` : null;

/* =========================================================
   GENRE CACHE

   TMDB list endpoints return genre_ids (numbers), not names.
   We fetch the id -> name map once and cache it so we can show
   real genre names on movie cards.
========================================================= */

let genreCache = null;
let genreCachePromise = null;

const getGenreMap = async () => {
  if (genreCache) return genreCache;

  // Collapse concurrent callers into a single upstream request.
  if (!genreCachePromise) {
    genreCachePromise = tmdbFetch("/genre/movie/list")
      .then((data) => {
        genreCache = {};

        (data.genres || []).forEach((genre) => {
          genreCache[genre.id] = genre.name;
        });

        return genreCache;
      })
      .catch((error) => {
        genreCachePromise = null; // allow a retry on the next request
        throw error;
      });
  }

  return genreCachePromise;
};

/* =========================================================
   NORMALISERS

   These map TMDB's field names onto the shape CineVerse already
   uses (title / description / poster / genre[] / rating / ...),
   so the existing React components and CSS keep working.
   `tmdbId` is what the frontend routes on, and `source: "tmdb"`
   lets pages tell TMDB movies apart from MongoDB ones.
========================================================= */

const normalizeMovie = (movie, genreMap = {}) => ({
  tmdbId: movie.id,
  source: "tmdb",

  title: movie.title || movie.name || "Untitled",
  description: movie.overview || "No description available.",

  poster: imageUrl(movie.poster_path, "w500"),
  backdrop: imageUrl(movie.backdrop_path, "w1280"),

  // TMDB gives genre_ids on list endpoints and full genre objects on details.
  genre: movie.genres
    ? movie.genres.map((g) => g.name)
    : (movie.genre_ids || [])
        .map((id) => genreMap[id])
        .filter(Boolean),

  rating: movie.vote_average
    ? Number(movie.vote_average.toFixed(1))
    : 0,
  voteCount: movie.vote_count || 0,

  releaseDate: movie.release_date || null,
  year: movie.release_date ? movie.release_date.slice(0, 4) : null,

  duration: movie.runtime || null,
  language: movie.original_language
    ? movie.original_language.toUpperCase()
    : null,
});

/**
 * Normalise a paginated TMDB list response into the envelope the
 * frontend uses for "Load more" pagination.
 */
const normalizeList = async (data) => {
  const genreMap = await getGenreMap().catch(() => ({}));

  return {
    page: data.page || 1,
    totalPages: Math.min(data.total_pages || 1, 500), // TMDB caps paging at 500
    totalResults: data.total_results || 0,
    results: (data.results || [])
      // Drop entries with no poster - they leave ugly holes in the grid.
      .filter((movie) => movie.poster_path)
      .map((movie) => normalizeMovie(movie, genreMap)),
  };
};

module.exports = {
  tmdbFetch,
  imageUrl,
  getGenreMap,
  normalizeMovie,
  normalizeList,
  describeCredential,
};
