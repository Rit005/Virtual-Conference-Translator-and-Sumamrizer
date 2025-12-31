import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

const VerifyEmail = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const token = params.get("token");
    if (!token) return setStatus("error");

    const verify = async () => {
      try {
        const backend = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
        await axios.get(`${backend}/api/auth/verify-email?token=${token}`);
        setStatus("success");
        toast.success("Email verified!");

        setTimeout(() => navigate("/login?verified=true"), 2000);
      } catch {
        setStatus("error");
      }
    };

    verify();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {status === "loading" && <p>Verifying...</p>}
      {status === "success" && <p>✅ Verified! Redirecting...</p>}
      {status === "error" && <p>❌ Verification Failed</p>}
    </div>
  );
};

export default VerifyEmail;
