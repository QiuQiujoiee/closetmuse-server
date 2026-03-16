import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const OutfitCreateSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
  notes: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

const CommentCreateSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().min(1).optional(),
});

router.use(requireAuth);

function outfitToDto(outfit) {
  return {
    ...outfit,
    itemIds: outfit.items?.map((x) => x.itemId) ?? [],
  };
}

// ---- My outfits
router.get("/", async (req, res) => {
  const userId = req.session.userId;

  const outfits = await prisma.outfit.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  const dto = outfits.map(outfitToDto);
  res.json({ data: dto, page: 1, pageSize: dto.length, total: dto.length });
});

router.post("/", async (req, res) => {
  const parsed = OutfitCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
  }

  const userId = req.session.userId;

  // validate item ownership
  const owned = await prisma.item.findMany({
    where: { userId, id: { in: parsed.data.itemIds } },
    select: { id: true },
  });

  const ownedSet = new Set(owned.map((x) => x.id));
  const invalid = parsed.data.itemIds.filter((id) => !ownedSet.has(id));
  if (invalid.length) return res.status(400).json({ error: "INVALID_ITEM_IDS", invalid });

  const outfit = await prisma.$transaction(async (tx) => {
    const created = await tx.outfit.create({
      data: {
        userId,
        notes: parsed.data.notes ?? "",
        isPublic: parsed.data.isPublic ?? false,
      },
    });

    await tx.outfitItem.createMany({
      data: parsed.data.itemIds.map((itemId) => ({ outfitId: created.id, itemId })),
      skipDuplicates: true,
    });

    return tx.outfit.findUnique({
      where: { id: created.id },
      include: { items: true },
    });
  });

  res.status(201).json(outfitToDto(outfit));
});

router.get("/:id", async (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;

  const outfit = await prisma.outfit.findFirst({
    where: { id, userId },
    include: { items: true },
  });
  if (!outfit) return res.status(404).json({ error: "NOT_FOUND" });

  res.json(outfitToDto(outfit));
});

// ---- Interactions (like / favorite / comment)
// Access rule: allow if public OR owner
async function findAccessibleOutfit(id, viewerId) {
  return prisma.outfit.findFirst({
    where: { id, OR: [{ isPublic: true }, { userId: viewerId }] },
    select: {
      id: true,
      userId: true,
      isPublic: true,
      likesCount: true,
      favoritesCount: true,
      commentsCount: true,
    },
  });
}

// Like (idempotent)
router.put("/:id/like", async (req, res, next) => {
  const viewerId = req.session.userId;
  const { id } = req.params;

  const outfit = await findAccessibleOutfit(id, viewerId);
  if (!outfit) return res.status(404).json({ error: "NOT_FOUND" });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.outfitLike.create({ data: { outfitId: id, userId: viewerId } });
      return tx.outfit.update({
        where: { id },
        data: { likesCount: { increment: 1 } },
        select: { likesCount: true },
      });
    });

    res.json({ ok: true, likedByMe: true, likesCount: updated.likesCount });
  } catch (e) {
    // Prisma unique violation => already liked, treat as OK
    if (e && e.code === "P2002") {
      const current = await prisma.outfit.findUnique({ where: { id }, select: { likesCount: true } });
      return res.json({ ok: true, likedByMe: true, likesCount: current?.likesCount ?? outfit.likesCount });
    }
    next(e);
  }
});

router.delete("/:id/like", async (req, res) => {
  const viewerId = req.session.userId;
  const { id } = req.params;

  const outfit = await findAccessibleOutfit(id, viewerId);
  if (!outfit) return res.status(404).json({ error: "NOT_FOUND" });

  const result = await prisma.$transaction(async (tx) => {
    const del = await tx.outfitLike.deleteMany({ where: { outfitId: id, userId: viewerId } });
    if (del.count > 0) {
      const updated = await tx.outfit.update({
        where: { id },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });
      return { likesCount: updated.likesCount };
    }
    return { likesCount: outfit.likesCount };
  });

  res.json({ ok: true, likedByMe: false, likesCount: result.likesCount });
});

// Favorite (idempotent)
router.put("/:id/favorite", async (req, res, next) => {
  const viewerId = req.session.userId;
  const { id } = req.params;

  const outfit = await findAccessibleOutfit(id, viewerId);
  if (!outfit) return res.status(404).json({ error: "NOT_FOUND" });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.outfitFavorite.create({ data: { outfitId: id, userId: viewerId } });
      return tx.outfit.update({
        where: { id },
        data: { favoritesCount: { increment: 1 } },
        select: { favoritesCount: true },
      });
    });

    res.json({ ok: true, favoritedByMe: true, favoritesCount: updated.favoritesCount });
  } catch (e) {
    if (e && e.code === "P2002") {
      const current = await prisma.outfit.findUnique({ where: { id }, select: { favoritesCount: true } });
      return res.json({
        ok: true,
        favoritedByMe: true,
        favoritesCount: current?.favoritesCount ?? outfit.favoritesCount,
      });
    }
    next(e);
  }
});

router.delete("/:id/favorite", async (req, res) => {
  const viewerId = req.session.userId;
  const { id } = req.params;

  const outfit = await findAccessibleOutfit(id, viewerId);
  if (!outfit) return res.status(404).json({ error: "NOT_FOUND" });

  const result = await prisma.$transaction(async (tx) => {
    const del = await tx.outfitFavorite.deleteMany({ where: { outfitId: id, userId: viewerId } });
    if (del.count > 0) {
      const updated = await tx.outfit.update({
        where: { id },
        data: { favoritesCount: { decrement: 1 } },
        select: { favoritesCount: true },
      });
      return { favoritesCount: updated.favoritesCount };
    }
    return { favoritesCount: outfit.favoritesCount };
  });

  res.json({ ok: true, favoritedByMe: false, favoritesCount: result.favoritesCount });
});

// Comment (create only for now)
router.post("/:id/comments", async (req, res) => {
  const viewerId = req.session.userId;
  const { id } = req.params;

  const parsed = CommentCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
  }

  const outfit = await findAccessibleOutfit(id, viewerId);
  if (!outfit) return res.status(404).json({ error: "NOT_FOUND" });

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.outfitComment.create({
      data: {
        outfitId: id,
        userId: viewerId,
        content: parsed.data.content,
        parentId: parsed.data.parentId ?? null,
      },
      select: { id: true, outfitId: true, userId: true, content: true, parentId: true, createdAt: true },
    });

    await tx.outfit.update({
      where: { id },
      data: { commentsCount: { increment: 1 } },
      select: { id: true },
    });

    return created;
  });

  res.status(201).json(comment);
});

router.delete('/:id',async (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;

  const outfit = await prisma.outfit.findFirst({
    where: {id: id, userId: userId},
    select: { id: true }
  });
  if (!outfit) return res.status(404).json({ error: "NOT_FOUND" });

  await prisma.outfit.delete({ where: { id } });
  
  res.json({ ok: true });

  })

router.get('/outfits/like', async (req, res) =>{
  const userId = req.session.userId;

  const likeOutfits = prisma.outfitLike.findMany({
    where: { userId }
  })

  if(!likeOutfits) return res.status(404).json({ error: "NOT_FOUND" });
   
  const outfitIds = likeOutfits.map((like) => like.outfitId);
  
  const outfits = await prisma.outfit.findMany({
    where: { id: { in: outfitIds } },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  const dto = outfits.map(outfitToDto);
  res.json({ data: dto, page: 1, pageSize: dto.length, total: dto.length });

})

router.get('/outfits/favorites', async (req, res) =>{
  const userId = req.session.userId;

  const likeOutfits = prisma.outfitFavorite.findMany({
    where: { userId }
  })

  if(!likeOutfits) return res.status(404).json({ error: "NOT_FOUND" });
   
  const outfitIds = likeOutfits.map((like) => like.outfitId);
  
  const outfits = await prisma.outfit.findMany({
    where: { id: { in: outfitIds } },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  const dto = outfits.map(outfitToDto);
  res.json({ data: dto, page: 1, pageSize: dto.length, total: dto.length });

})





export default router;
