import axios from "./apiClient";
import { jwtDecode } from "jwt-decode";

const TOKEN_KEY = "auth_token";

export const authService = {
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  getCurrentUser() {
    const token = this.getToken();
    if (!token) return null;

    try {
      return jwtDecode(token);
    } catch (error) {
      console.error("Invalid token", error);
      this.logout();
      return null;
    }
  },

  login: async (data) => {
    const res = await axios.post("/auth/login", data);
    if (res.data.token) {
      authService.setToken(res.data.token);
    }
    return res.data;
  },

  signup: async (data) => {
    const res = await axios.post("/auth/signup", data);
    return res.data;
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common["Authorization"];
  }
};
