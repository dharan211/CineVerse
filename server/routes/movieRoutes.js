const express = require("express");
const Movie = require("../models/Movie");

const router = express.Router();

// GET all movies
router.get("/", async (req, res) => {
  try {
    const movies = await Movie.find().sort({ createdAt: -1 });
    res.json(movies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET one movie
router.get("/:id", async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    res.json(movie);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST a movie
router.post("/", async (req, res) => {
  try {
    const movie = new Movie(req.body);
    const savedMovie = await movie.save();

    res.status(201).json(savedMovie);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;