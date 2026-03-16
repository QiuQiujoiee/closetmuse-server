import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../../uploads");

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await fs.mkdir(uploadsDir, { recursive: true });
        cb(null, uploadsDir);
      } catch (error) {
        cb(error);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${nanoid()}${ext}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("ONLY_IMAGE_ALLOWED"));
  },
});

router.use(requireAuth);

router.post("/image", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "IMAGE_REQUIRED" });
  }

  const imageUrl = `/uploads/${req.file.filename}`;

  res.status(201).json({
    imageUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
});

router.use((err, _req, res, _next) => {
  if (err?.message === "ONLY_IMAGE_ALLOWED") {
    return res.status(400).json({ error: "ONLY_IMAGE_ALLOWED" });
  }

  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "FILE_TOO_LARGE", maxBytes: 5 * 1024 * 1024 });
  }

  console.error(err);
  res.status(500).json({ error: "UPLOAD_FAILED" });
});

export default router;