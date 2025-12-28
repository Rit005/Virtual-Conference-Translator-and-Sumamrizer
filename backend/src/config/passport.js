import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { prisma } from "../prismaClient.js";


/* ===========================
   GOOGLE OAUTH STRATEGY
=========================== */

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(new Error("Google account has no email"), null);
          }

          let user = await prisma.user.findUnique({ where: { email } });

          if (!user) {
            user = await prisma.user.create({
              data: {
                name: profile.displayName,
                email,
                provider: "GOOGLE",
                isVerified: true,
              },
            });
          }

          done(null, user);
        } catch (error) {
          done(error, null);
        }
      }
    )
  );
} else {
  console.warn("⚠️ Google OAuth not configured");
}

/* ===========================
   GITHUB OAUTH STRATEGY
=========================== */

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: "/api/auth/github/callback",
        scope: ["user:email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // GitHub may or may not return email
          const email =
            profile.emails?.find((e) => e.verified)?.value ||
            profile.emails?.[0]?.value ||
            `${profile.username}@github.com`;

          let user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                name: profile.username || "GitHub User",
                email,
                provider: "GITHUB",
                isVerified: true,
              },
            });
          }

          done(null, user);
        } catch (error) {
          console.error("GitHub OAuth Error:", error);
          done(error, null);
        }
      }
    )
  );
} else {
  console.warn("⚠️ GitHub OAuth not configured");
}
