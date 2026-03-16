import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { safeUser } from "../utils/auth.js";

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(2).max(30).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
  }

  const { email, password, username } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "EMAIL_TAKEN" });

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      username: username || email.split("@")[0],
      avatarUrl: null,
      passwordHash,
    },
  });

  req.session.userId = user.id;
  res.status(201).json(safeUser(user));
});

router.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  req.session.userId = user.id;
  res.json(safeUser(user));
});

router.post("/logout", async (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "LOGOUT_FAILED" });
    res.clearCookie("cm.sid");
    res.json({ ok: true });
  });
});

router.get("/me", async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" });

  res.json(safeUser(user));
});

export default router;
