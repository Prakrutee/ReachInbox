import { Router } from "express";
import passport from "passport";

const router = Router();
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${frontendUrl}/login?error=auth_failed` }),
  (req, res) => {
    res.redirect(frontendUrl);
  }
);

router.get("/me", (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
  res.json(req.user);
});

router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ ok: true });
  });
});

export default router;
