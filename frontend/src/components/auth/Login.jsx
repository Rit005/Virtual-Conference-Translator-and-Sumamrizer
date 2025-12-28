import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext.jsx";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // 🔹 Handle messages from URL (email verification / oauth errors)
  useEffect(() => {
    const verified = searchParams.get("verified");
    const error = searchParams.get("error");

    if (verified === "true") {
      toast.success("Email verified successfully! Please login.");
      window.history.replaceState({}, document.title, "/login");
    }

    if (error) {
      toast.error("Authentication failed. Please try again.");
      window.history.replaceState({}, document.title, "/login");
    }
  }, [searchParams]);

  // 🔹 Input change
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔹 Email/Password Login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(formData);

      if (result?.success) {
        toast.success("Login successful");
        navigate("/");
      } else {
        toast.error(result?.error || "Login failed");
      }
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 OAUTH LOGIN (🔥 IMPORTANT PART)
  const handleOAuthLogin = (provider) => {
    const backendUrl =
      import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

    // FULL redirect is REQUIRED for OAuth
    window.location.href = `${backendUrl}/api/auth/${provider}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-96 p-6 bg-white shadow-md rounded-lg"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-900">
          Login
        </h2>

        {/* Email */}
        <input
          type="email"
          name="email"
          placeholder="Email Address"
          required
          value={formData.email}
          onChange={handleChange}
          className="w-full p-3 mb-3 border border-gray-300 rounded-lg"
          disabled={isLoading}
        />

        {/* Password */}
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          value={formData.password}
          onChange={handleChange}
          className="w-full p-3 mb-4 border border-gray-300 rounded-lg"
          disabled={isLoading}
        />

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Signing In..." : "Sign In"}
        </button>

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="flex-grow h-px bg-gray-300" />
          <span className="px-2 text-gray-500 text-sm">
            Or continue with
          </span>
          <div className="flex-grow h-px bg-gray-300" />
        </div>

        {/* GOOGLE LOGIN */}
        <button
          type="button"
          onClick={() => handleOAuthLogin("google")}
          className="w-full flex items-center justify-center gap-3 border py-3 rounded-lg hover:bg-gray-100 mb-3"
        >
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            alt="Google"
            className="w-5 h-5"
          />
          Continue with Google
        </button>

        {/* GITHUB LOGIN */}
        <button
          type="button"
          onClick={() => handleOAuthLogin("github")}
          className="w-full flex items-center justify-center gap-3 border py-3 rounded-lg hover:bg-gray-100"
        >
          <img
            src="https://www.svgrepo.com/show/475654/github-color.svg"
            alt="GitHub"
            className="w-5 h-5"
          />
          Continue with GitHub
        </button>

        {/* Signup */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Don’t have an account?{" "}
          <Link to="/signup" className="text-blue-600 font-medium">
            Sign up here
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
