const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Movie = require("../models/Movie");
const { tmdbFetch, normalizeMovie } = require("../config/tmdb");

const router = express.Router();

// Middleware to check logged-in user
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Please login first",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.userId = decoded.userId;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

// GET user's watchlist
router.get("/", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate("watchlist");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(user.watchlist);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

/* =========================================================
   TMDB WATCHLIST

   TMDB movies are not in our database, and they have numeric ids
   (27205) rather than Mongo ObjectIds. So when a user saves one we
   cache a copy of it as a Movie document first, then push that
   document's ObjectId onto the user's watchlist.

   That means the existing schema, the populate() above, and the
   ObjectId routes below all keep working untouched - and saving the
   same film twice reuses the cached document instead of duplicating it.
========================================================= */

/**
 * Find the cached Movie for a TMDB id, creating it from TMDB if we
 * have not seen this film before.
 */
const findOrCreateTmdbMovie = async (tmdbId) => {
  const existing = await Movie.findOne({ tmdbId });

  if (existing) return existing;

  // Not cached yet - pull the details from TMDB.
  const details = await tmdbFetch(`/movie/${tmdbId}`);
  const movie = normalizeMovie(details);

  try {
    return await Movie.create({
      tmdbId: movie.tmdbId,
      title: movie.title,
      description: movie.description,
      poster: movie.poster,
      backdrop: movie.backdrop,
      genre: movie.genre,
      releaseDate: movie.releaseDate || undefined,
      rating: movie.rating,
      duration: movie.duration || undefined,
      language: details.spoken_languages?.[0]?.english_name || "English",
    });
  } catch (error) {
    // Two simultaneous saves of the same film can both miss the findOne and
    // race to insert. The unique index rejects the loser (E11000), so just
    // read back the copy the winner created.
    if (error.code === 11000) {
      return Movie.findOne({ tmdbId });
    }

    throw error;
  }
};

// ADD a TMDB movie to the watchlist
router.post("/tmdb/:tmdbId", authenticate, async (req, res) => {
  try {
    const tmdbId = Number.parseInt(req.params.tmdbId, 10);

    if (!Number.isFinite(tmdbId)) {
      return res.status(400).json({
        message: "Invalid TMDB movie id",
      });
    }

    const movie = await findOrCreateTmdbMovie(tmdbId);

    if (!movie) {
      return res.status(404).json({
        message: "Movie not found on TMDB",
      });
    }

    const user = await User.findById(req.userId);

    if (user.watchlist.some((id) => id.equals(movie._id))) {
      return res.status(400).json({
        message: "Movie already in watchlist",
      });
    }

    user.watchlist.push(movie._id);

    await user.save();

    res.json({
      message: "Movie added to watchlist",
      movie: {
        _id: movie._id,
        tmdbId: movie.tmdbId,
        title: movie.title,
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message,
    });
  }
});

// REMOVE a TMDB movie from the watchlist
router.delete("/tmdb/:tmdbId", authenticate, async (req, res) => {
  try {
    const tmdbId = Number.parseInt(req.params.tmdbId, 10);

    const movie = await Movie.findOne({ tmdbId });

    if (!movie) {
      return res.status(404).json({
        message: "Movie is not in your watchlist",
      });
    }

    const user = await User.findById(req.userId);

    user.watchlist = user.watchlist.filter(
      (movieId) => !movieId.equals(movie._id)
    );

    await user.save();

    res.json({
      message: "Movie removed from watchlist",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ADD movie to watchlist
router.post("/:movieId", authenticate, async (req, res) => {
  try {
    const movie = await Movie.findById(
      req.params.movieId
    );

    if (!movie) {
      return res.status(404).json({
        message: "Movie not found",
      });
    }

    const user = await User.findById(req.userId);

    if (user.watchlist.includes(movie._id)) {
      return res.status(400).json({
        message: "Movie already in watchlist",
      });
    }

    user.watchlist.push(movie._id);

    await user.save();

    res.json({
      message: "Movie added to watchlist",
      watchlist: user.watchlist,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// REMOVE movie from watchlist
router.delete("/:movieId", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    user.watchlist = user.watchlist.filter(
      (movieId) =>
        movieId.toString() !== req.params.movieId
    );

    await user.save();

    res.json({
      message: "Movie removed from watchlist",
      watchlist: user.watchlist,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;