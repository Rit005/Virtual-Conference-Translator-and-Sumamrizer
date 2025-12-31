import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("verifying"); // verifying | success | error

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        toast.error("Invalid verification link");
        return;
      }

      try {
        const backendUrl =
          import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

        await axios.get(
          `${backendUrl}/api/auth/verify-email?token=${token}`
        );

        setStatus("success");
        toast.success("Email verified successfully!");

        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate("/login?verified=true");
        }, 2000);
      } catch (error) {
        console.error("Email verification failed:", error);
        setStatus("error");
        toast.error(
          error.response?.data?.message ||
            "Verification failed. Link may be expired."
        );
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md text-center w-96">
        {loading && (
          <>
            <h2 className="text-xl font-semibold mb-4">
              Verifying your email...
            </h2>
            <p className="text-gray-600">Please wait</p>
          </>
        )}

        {!loading && status === "success" && (
          <>
            <h2 className="text-xl font-semibold text-green-600 mb-4">
              ✅ Email Verified
            </h2>
            <p className="text-gray-600">
              Redirecting you to login...
            </p>
          </>
        )}

        {!loading && status === "error" && (
          <>
            <h2 className="text-xl font-semibold text-red-600 mb-4">
              ❌ Verification Failed
            </h2>
            <p className="text-gray-600 mb-4">
              The verification link is invalid or expired.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
