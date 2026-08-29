import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { register, login } from "../api";

/**
 * Registration page.
 *
 * The Login page already linked to /register, but this file was empty and
 * the route did not exist, so that link was dead. This completes the auth
 * flow: create the account, then log straight in so the new user does not
 * have to type their details a second time.
 */
function Register({ onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Checked here as well as by the server so the user gets instant feedback.
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password);

      // Account created - log in immediately to get a JWT.
      const data = await login(email, password);

      localStorage.setItem("token", data.token);
      localStorage.setItem("userName", data.user.name);

      onLogin?.(data.user);

      navigate("/");
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">JOIN CINEVERSE</p>

        <h1>Create your account 🎬</h1>

        <p className="auth-subtitle">
          Save movies to your watchlist and pick up where you left off.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
