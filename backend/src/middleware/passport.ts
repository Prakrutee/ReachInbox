import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import pool from "../config/database";
import dotenv from "dotenv";
dotenv.config();

interface UserRow {
  id: number;
  google_id: string;
  name: string;
  email: string;
  avatar: string;
}

passport.serializeUser((user: Express.User, done) => {
  done(null, (user as UserRow).id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const res = await pool.query("SELECT * FROM users WHERE id=$1", [id]);
    done(null, res.rows[0] || false);
  } catch (err) {
    done(err);
  }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || "";
          const avatar = profile.photos?.[0]?.value || "";
          const res = await pool.query(
            `INSERT INTO users (google_id, name, email, avatar)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (google_id) DO UPDATE SET name=$2, email=$3, avatar=$4
             RETURNING *`,
            [profile.id, profile.displayName, email, avatar]
          );
          done(null, res.rows[0]);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
} else {
  console.warn("Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing)");
}
