import jwt from "jsonwebtoken";

export const generateToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "default-secret-change-in-production",
    { expiresIn: "7d" }
  );

export const verifyToken = (token) => {
  return jwt.verify(
    token,
    process.env.JWT_SECRET || "default-secret-change-in-production"
  );
};

export const decodeToken = (token) => {
  return jwt.decode(token);
};
