import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const VerifyEmail = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const status = params.get("status");

  useEffect(() => {
    if (status === "success") {
      setTimeout(() => navigate("/login?verified=true"), 2000);
    }
  }, [status, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-6 bg-white shadow rounded text-center">
        {status === "success" && (
          <>
            <h2 className="text-green-600 text-xl">✅ Email Verified</h2>
            <p>Redirecting to login...</p>
          </>
        )}

        {status !== "success" && (
          <>
            <h2 className="text-red-600 text-xl">❌ Verification Failed</h2>
            <button onClick={() => navigate("/login")}>
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
