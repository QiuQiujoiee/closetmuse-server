import express from "express";
import session from "express-session";
import cors from "cors";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import pgSessionFactory from "connect-pg-simple";
import "dotenv/config";

import authRouter from "./routes/auth.js";
import itemsRouter from "./routes/items.js";
import outfitsRouter from "./routes/outfits.js";
import exploreRouter from "./routes/explore.js";
import uploadRouter from "./routes/upload.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../uploads");

// ---- middleware
app.use(morgan("dev"));
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

// set CORS_ORIGIN in .env (e.g. http://localhost:5173)
// If you use Vite proxy, you can leave CORS_ORIGIN unset.
if (process.env.CORS_ORIGIN) {
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    })
  );
}

// ---- session store in Postgres (so login survives server restarts)
const pgSession = pgSessionFactory(session);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// In production behind a proxy (Render/Heroku/Nginx), you'll likely need:
// app.set("trust proxy", 1);
app.use(
  session({
    name: "cm.sid",
    store: new pgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "dev-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // requires HTTPS
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// ---- routes
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/items", itemsRouter);
app.use("/api/outfits", outfitsRouter);
app.use("/api/explore", exploreRouter);
app.use("/api/upload", uploadRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: "NOT_FOUND" }));

// error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "INTERNAL_ERROR" });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
