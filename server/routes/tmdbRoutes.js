/**
 * TMDB routes - CineVerse's large movie catalogue.
 *
 * These endpoints proxy TMDB through our own Express server so that:
 *   - the TMDB credential stays on the server (never shipped to React)
 *   - the frontend receives our own field names, matching the shape the
 *     existing components already render
 *
 * All TMDB access goes through ../config/tmdb.js, which handles credential
 * type detection and hostname failover.
 */

const express = require("express");

const {
  tmdbFetch,
  getGenreMap,
  normalizeMovie,
  normalizeList,
} = require("../config/tmdb");

const router = express.Router();

/**
 * Shared error responder. Keeps messages useful without leaking the token.
 */
const sendError = (res, error, label) => {
  console.error(`TMDB ${label} error:`, error.message);

  res.status(error.status || 500).json({
    message: error.message || "TMDB request failed",
  });
};

/** Clamp page to TMDB's supported range so a silly ?page=99999 cannot 422. */
const parsePage = (value) => {
  const page = Number.parseInt(value, 10);

  if (!Number.isFinite(page) || page < 1) return 1;

  return Math.min(page, 500);
};

/* =========================================================
   GET /api/tmdb/popular
   Popular movies, paginated.
========================================================= */
router.get("/popular", async (req, res) => {
  try {
    const data = await tmdbFetch("/movie/popular", {
      page: parsePage(req.query.page),
    });

    res.json(await normalizeList(data));
  } catch (error) {
    sendError(res, error, "popular");
  }
});

/* =========================================================
   GET /api/tmdb/trending?window=week|day
========================================================= */
router.get("/trending", async (req, res) => {
  try {
    const timeWindow = req.query.window === "day" ? "day" : "week";

    const data = await tmdbFetch(`/trending/movie/${timeWindow}`, {
      page: parsePage(req.query.page),
    });

    res.json(await normalizeList(data));
  } catch (error) {
    sendError(res, error, "trending");
  }
});

/* =========================================================
   GET /api/tmdb/top-rated
========================================================= */
router.get("/top-rated", async (req, res) => {
  try {
    const data = await tmdbFetch("/movie/top_rated", {
      page: parsePage(req.query.page),
    });

    res.json(await normalizeList(data));
  } catch (error) {
    sendError(res, error, "top-rated");
  }
});

/* =========================================================
   GET /api/tmdb/now-playing
========================================================= */
router.get("/now-playing", async (req, res) => {
  try {
    const data = await tmdbFetch("/movie/now_playing", {
      page: parsePage(req.query.page),
    });

    res.json(await normalizeList(data));
  } catch (error) {
    sendError(res, error, "now-playing");
  }
});

/* =========================================================
   GET /api/tmdb/genres
   The id -> name list used to build the genre filter.
========================================================= */
router.get("/genres", async (req, res) => {
  try {
    const genreMap = await getGenreMap();

    const genres = Object.entries(genreMap).map(([id, name]) => ({
      id: Number(id),
      name,
    }));

    genres.sort((a, b) => a.name.localeCompare(b.name));

    res.json(genres);
  } catch (error) {
    sendError(res, error, "genres");
  }
});

/* =========================================================
   GET /api/tmdb/search?query=inception&page=1
========================================================= */
router.get("/search", async (req, res) => {
  try {
    const query = (req.query.query || "").trim();

    if (!query) {
      return res.status(400).json({
        message: "A search query is required",
      });
    }

    const data = await tmdbFetch("/search/movie", {
      query,
      page: parsePage(req.query.page),
      include_adult: false,
    });

    res.json(await normalizeList(data));
  } catch (error) {
    sendError(res, error, "search");
  }
});

/* =========================================================
   GET /api/tmdb/discover?genre=28&sort=popularity.desc&year=2024
   Powers the genre filter and sorting on the Movies page.
========================================================= */
router.get("/discover", async (req, res) => {
  try {
    const allowedSorts = [
      "popularity.desc",
      "vote_average.desc",
      "primary_release_date.desc",
      "title.asc",
      "revenue.desc",
    ];

    const sortBy = allowedSorts.includes(req.query.sort)
      ? req.query.sort
      : "popularity.desc";

    const params = {
      page: parsePage(req.query.page),
      sort_by: sortBy,
      include_adult: false,
      with_genres: req.query.genre || undefined,
      primary_release_year: req.query.year || undefined,
    };

    // Sorting by rating without a vote floor surfaces obscure titles with a
    // single 10/10 vote, so require a meaningful sample size.
    if (sortBy === "vote_average.desc") {
      params["vote_count.gte"] = 300;
    }

    const data = await tmdbFetch("/discover/movie", params);

    res.json(await normalizeList(data));
  } catch (error) {
    sendError(res, error, "discover");
  }
});

/* =========================================================
   GET /api/tmdb/movie/:id
   Full details for one movie, plus cast, trailer and similar titles.
========================================================= */
router.get("/movie/:id", async (req, res) => {
  try {
    const data = await tmdbFetch(`/movie/${req.params.id}`, {
      append_to_response: "credits,videos,similar",
    });

    const movie = normalizeMovie(data);

    // Extra detail-page-only fields.
    movie.tagline = data.tagline || null;
    movie.status = data.status || null;
    movie.homepage = data.homepage || null;

    movie.languageName =
      data.spoken_languages?.[0]?.english_name || movie.language;

    movie.cast = (data.credits?.cast || []).slice(0, 8).map((person) => ({
      id: person.id,
      name: person.name,
      character: person.character,
      profile: person.profile_path
        ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
        : null,
    }));

    movie.director =
      (data.credits?.crew || []).find((person) => person.job === "Director")
        ?.name || null;

    const trailer = (data.videos?.results || []).find(
      (video) =>
        video.site === "YouTube" &&
        (video.type === "Trailer" || video.type === "Teaser")
    );

    movie.trailerKey = trailer ? trailer.key : null;

    const genreMap = await getGenreMap().catch(() => ({}));

    movie.similar = (data.similar?.results || [])
      .filter((item) => item.poster_path)
      .slice(0, 8)
      .map((item) => normalizeMovie(item, genreMap));

    res.json(movie);
  } catch (error) {
    sendError(res, error, `movie/${req.params.id}`);
  }
});

module.exports = router;
