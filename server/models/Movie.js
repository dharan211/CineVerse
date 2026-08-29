const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema(
  {
    // Set only for movies that came from TMDB. Lets us find an existing cached
    // copy instead of inserting a duplicate every time someone saves the same
    // film. `sparse` so the older hand-added movies (no tmdbId) stay valid and
    // do not all collide on null.
    tmdbId: {
      type: Number,
      unique: true,
      sparse: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    poster: {
      // Not required: a handful of TMDB entries have no poster image, and a
      // missing picture should not stop a user saving the film.
      type: String,
    },

    backdrop: {
      type: String,
    },

    genre: {
      // Not required: Mongoose fails `required` on an empty array, and a few
      // TMDB titles genuinely have no genres listed yet.
      type: [String],
      default: [],
    },

    releaseDate: {
      type: Date,
    },

    rating: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },

    duration: {
      type: Number, // minutes
    },

    language: {
      type: String,
      default: "English",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Movie", movieSchema);