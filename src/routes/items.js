import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const ImageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => value.startsWith("/uploads/") || /^https?:\/\//i.test(value), {
    message: "imageUrl must be an absolute http(s) url or /uploads/...",
  });

const ItemCreateSchema = z.object({
  name: z.string().min(1).max(80),
  category: z.string().max(40).optional(),
  color: z.string().max(40).optional(),
  season: z.string().max(40).optional(),
  imageUrl: ImageUrlSchema.optional(),
  tags: z.array(z.string().max(30)).optional(),
});

const ItemPatchSchema = ItemCreateSchema.partial();

router.use(requireAuth);

// GET /items?q=xxx&page=1&pageSize=50
router.get("/", async (req, res) => {
  const userId = req.session.userId;

  const q = (req.query.q || "").toString().trim();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 50)));
  const skip = (page - 1) * pageSize;

  const where = {
    userId,
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  res.json({ data: items, page, pageSize, total });
});

router.post("/", async (req, res) => {
  const parsed = ItemCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
  }

  const userId = req.session.userId;

  const item = await prisma.item.create({
    data: {
      userId,
      ...parsed.data,
      tags: parsed.data.tags ?? [],
    },
  });

  res.status(201).json(item);
});

router.get("/:id", async (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;

  const item = await prisma.item.findFirst({ where: { id, userId } });
  if (!item) return res.status(404).json({ error: "NOT_FOUND" });

  res.json(item);
});

router.patch("/:id", async (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;

  const parsed = ItemPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
  }

  const item = await prisma.item.findFirst({ where: { id, userId } });
  if (!item) return res.status(404).json({ error: "NOT_FOUND" });

  const updated = await prisma.item.update({
    where: { id },
    data: parsed.data,
  });

  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;

  const item = await prisma.item.findFirst({ where: { id, userId } });
  if (!item) return res.status(404).json({ error: "NOT_FOUND" });

  await prisma.item.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
