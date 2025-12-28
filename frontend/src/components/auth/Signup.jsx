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
      
      if (response.success && response.data?.requiresVerification) {
        setUserEmail(formData.email);
        setShowVerificationMessage(true);
        toast.success("Account created! Please check your email to verify your account.");
      } else {
        // Fallback for any edge cases
        toast.success("Account created successfully! Please login.");
        navigate("/login");
      }
    } catch (error) {
      console.error('Signup error:', error);
      toast.error(error.message || "Signup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show email verification message
  if (showVerificationMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md w-96 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Check Your Email!</h2>
          
          <p className="text-gray-600 mb-2">
            We've sent a verification email to:
          </p>
          <p className="text-blue-600 font-semibold mb-4">{userEmail}</p>
          
          <p className="text-sm text-gray-600 mb-6">
            Click the link in the email to verify your account. The link will expire in 24 hours.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => navigate("/login")}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
            
            <button
              onClick={() => {
                setShowVerificationMessage(false);
                setFormData({ name: "", email: "", password: "" });
              }}
              className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300 transition-colors"
            >
              Create Another Account
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-4">
            Didn't receive the email? Check your spam folder or try signing up again.
          </p>
        </div>
      </div>
    );
  }

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
          className="w-full p-3 mb-3 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />

        <input
          type="email"
          name="email"
          placeholder="Email Address"
          required
          value={formData.email}
          onChange={handleChange}
          className="w-full p-3 mb-3 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />

        <input
          type="password"
          name="password"
          placeholder="Password (minimum 6 characters)"
          required
          minLength="6"
          value={formData.password}
          onChange={handleChange}
          className="w-full p-3 mb-4 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Creating Account...
            </div>
          ) : (
            "Sign Up"
          )}
        </button>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center mb-3">
            Already have an account?
          </p>
          <Link 
            to="/login" 
            className="block text-center text-blue-600 hover:text-blue-800 font-medium"
          >
            Login Here
          </Link>
        </div>
      </form>
    </div>
  );
};

export default Signup;
