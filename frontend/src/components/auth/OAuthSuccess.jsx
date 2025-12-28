import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";

const OAuthSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithOAuth } = useAuth();

  const hasHandled = useRef(false);

  useEffect(() => {
    if (hasHandled.current) return;
    hasHandled.current = true;

    const token = searchParams.get("token");

    if (!token) {
      toast.error("OAuth failed. Token missing.");
      navigate("/login", { replace: true });
      return;
    }

    loginWithOAuth(token)
      .then(() => {
        toast.success("Successfully logged in with OAuth!");
        navigate("/", { replace: true });
      })
      .catch(() => {
        toast.error("OAuth login failed");
        navigate("/login", { replace: true });
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600 text-lg">Completing login…</p>
    </div>
  );
};

export default OAuthSuccess;
