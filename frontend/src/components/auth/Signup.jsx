import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import toast from "react-hot-toast";

const Signup = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await signup(formData);
      // response === res.data from backend

      if (response.success && response.data?.requiresVerification) {
        setUserEmail(formData.email);
        setShowVerificationMessage(true);
        toast.success(
          "Account created! Please check your email to verify your account."
        );
        return;
      }

      // Fallback (should not normally happen)
      toast.success("Account created successfully! Please login.");
      navigate("/login");

    } catch (error) {
      console.error("Signup error:", error);
      toast.error(
        error.response?.data?.message ||
        error.message ||
        "Signup failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  /* ================= EMAIL VERIFICATION SCREEN ================= */

  if (showVerificationMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md w-96 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold mb-2">Check Your Email</h2>
          <p className="text-gray-600 mb-2">
            We sent a verification link to:
          </p>
          <p className="font-semibold text-blue-600 mb-4">{userEmail}</p>

          <p className="text-sm text-gray-500 mb-6">
            Verify your email before logging in.
          </p>

          <button
            onClick={() => navigate("/login")}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 mb-3"
          >
            Go to Login
          </button>

          <button
            onClick={() => {
              setShowVerificationMessage(false);
              setFormData({ name: "", email: "", password: "" });
            }}
            className="w-full bg-gray-200 py-2 rounded hover:bg-gray-300"
          >
            Create Another Account
          </button>

          <p className="text-xs text-gray-400 mt-4">
            Didn’t receive the email? Check spam folder.
          </p>
        </div>
      </div>
    );
  }

  /* ================= SIGNUP FORM ================= */

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow-md w-96"
      >
        <h2 className="text-2xl font-bold text-center mb-4">Sign Up</h2>

        <input
          type="text"
          name="name"
          placeholder="Full Name"
          required
          value={formData.name}
          onChange={handleChange}
          className="w-full p-3 mb-3 border rounded"
          disabled={isLoading}
        />

        <input
          type="email"
          name="email"
          placeholder="Email Address"
          required
          value={formData.email}
          onChange={handleChange}
          className="w-full p-3 mb-3 border rounded"
          disabled={isLoading}
        />

        <input
          type="password"
          name="password"
          placeholder="Password (min 6 chars)"
          required
          minLength="6"
          value={formData.password}
          onChange={handleChange}
          className="w-full p-3 mb-4 border rounded"
          disabled={isLoading}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Creating Account..." : "Sign Up"}
        </button>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?
          </p>
          <Link to="/login" className="text-blue-600 font-medium">
            Login here
          </Link>
        </div>
      </form>
    </div>
  );
};

export default Signup;
