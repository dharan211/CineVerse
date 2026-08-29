const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

app.use(cors({
  origin: "http://localhost:5173"
}));

app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((error) => console.log("MongoDB connection failed:", error));

const movieRoutes = require("./routes/movieRoutes");
const authRoutes = require("./routes/authRoutes");
const watchlistRoutes = require("./routes/watchlistRoutes");
const tmdbRoutes = require("./routes/tmdbRoutes");

// Report which TMDB credential type was detected at boot.
// Prints the credential KIND only, never the secret itself.
const { describeCredential } = require("./config/tmdb");
console.log(describeCredential());

app.use("/api/movies", movieRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/tmdb", tmdbRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});