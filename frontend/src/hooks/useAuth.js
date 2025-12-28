import { useAuth as useAuthContext } from '../contexts/AuthContext.jsx';

// Re-export the useAuth hook for convenience
export const useAuth = useAuthContext;

// Additional auth-specific hooks
export const useAuthUser = () => {
  const { user } = useAuthContext();
  return user;
};

export const useIsAuthenticated = () => {
  const { isAuthenticated } = useAuthContext();
  return isAuthenticated;
};

export const useAuthLoading = () => {
  const { loading } = useAuthContext();
  return loading;
};

// Role-based access hooks
export const useHasRole = (role) => {
  const { hasRole } = useAuthContext();
  return hasRole(role);
};

export const useIsAdmin = () => {
  const { isAdmin } = useAuthContext();
  return isAdmin();
};

export const useIsParticipant = () => {
  const { isParticipant } = useAuthContext();
  return isParticipant();
};

// Auth actions
export const useAuthActions = () => {
  const { login, signup, logout, refreshToken } = useAuthContext();
  return { login, signup, logout, refreshToken };
};
