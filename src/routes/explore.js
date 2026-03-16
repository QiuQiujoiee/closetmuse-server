import { Router } from "express";
import { prisma } from "../prisma.js";
import { safeUser } from "../utils/auth.js";

const router = Router();

function asPage(data, { page = 1, pageSize = 20, total } = {}) {
  return { data, page, pageSize, total: total ?? data.length };
}

function outfitToPublicDto(outfit, viewerFlags = {}) {
  const itemIds = outfit.items?.map((x) => x.itemId) ?? [];
  const itemsPreview =
    outfit.items?.map((x) => ({
      id: x.item.id,
      name: x.item.name,
      imageUrl: x.item.imageUrl,
    })) ?? [];

  return {
    id: outfit.id,
    userId: outfit.userId,
    notes: outfit.notes,
    isPublic: outfit.isPublic,

    likesCount: outfit.likesCount,
    favoritesCount: outfit.favoritesCount,
    commentsCount: outfit.commentsCount,

    createdAt: outfit.createdAt,
    updatedAt: outfit.updatedAt,

    itemIds, // keep compatibility
    itemsPreview, // NEW: for feed cards

    author: safeUser(outfit.user),
    ...viewerFlags,
  };
}

// GET /explore/outfits?page=1&pageSize=20
router.get("/outfits", async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
  const skip = (page - 1) * pageSize;

  const where = { isPublic: true };

  const [total, outfits] = await Promise.all([
    prisma.outfit.count({ where }),
    prisma.outfit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        user: true,
        items: {
          include: {
            item: { select: { id: true, name: true, imageUrl: true } },
          },
        },
      },
    }),
  ]);

  const viewerId = req.session?.userId;
  const ids = outfits.map((o) => o.id);

  let likedSet = new Set();
  let favoritedSet = new Set();

  if (viewerId && ids.length) {
    const [likes, favs] = await Promise.all([
      prisma.outfitLike.findMany({
        where: { userId: viewerId, outfitId: { in: ids } },
        select: { outfitId: true },
      }),
      prisma.outfitFavorite.findMany({
        where: { userId: viewerId, outfitId: { in: ids } },
        select: { outfitId: true },
      }),
    ]);
    likedSet = new Set(likes.map((x) => x.outfitId));
    favoritedSet = new Set(favs.map((x) => x.outfitId));
  }

  const dto = outfits.map((o) =>
    outfitToPublicDto(
      o,
      viewerId ? { likedByMe: likedSet.has(o.id), favoritedByMe: favoritedSet.has(o.id) } : {}
    )
  );

  res.json(asPage(dto, { page, pageSize, total }));
});

// GET /explore/outfits/:id (public detail)
router.get("/outfits/:id", async (req, res) => {
  const { id } = req.params;

  const outfit = await prisma.outfit.findFirst({
    where: { id, isPublic: true },
    include: {
      user: true,
      items: { include: { item: { select: { id: true, name: true, imageUrl: true } } } },
    },
  });
  if (!outfit) return res.status(404).json({ error: "NOT_FOUND" });

  const viewerId = req.session?.userId;
  let likedByMe = false;
  let favoritedByMe = false;

  if (viewerId) {
    const [like, fav] = await Promise.all([
      prisma.outfitLike.findUnique({ where: { outfitId_userId: { outfitId: id, userId: viewerId } } }),
      prisma.outfitFavorite.findUnique({ where: { outfitId_userId: { outfitId: id, userId: viewerId } } }),
    ]);
    likedByMe = !!like;
    favoritedByMe = !!fav;
  }

  res.json(outfitToPublicDto(outfit, viewerId ? { likedByMe, favoritedByMe } : {}));
});

// GET /explore/outfits/:id/comments?page=1&pageSize=20 (public)
router.get("/outfits/:id/comments", async (req, res) => {
  const { id } = req.params;
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
  const skip = (page - 1) * pageSize;

  // Ensure outfit is public
  const outfit = await prisma.outfit.findFirst({ where: { id, isPublic: true }, select: { id: true } });
  if (!outfit) return res.status(404).json({ error: "NOT_FOUND" });

  const [total, comments] = await Promise.all([
    prisma.outfitComment.count({ where: { outfitId: id, isDeleted: false } }),
    prisma.outfitComment.findMany({
      where: { outfitId: id, isDeleted: false },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: { user: true },
    }),
  ]);

  const dto = comments.map((c) => ({
    id: c.id,
    outfitId: c.outfitId,
    content: c.content,
    parentId: c.parentId,
    createdAt: c.createdAt,
    author: safeUser(c.user),
  }));

  res.json(asPage(dto, { page, pageSize, total }));
});

router.get("/users/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ error: "MISSING_USER_ID" });

  const userOutFits = await prisma.outfit.findMany({
    where: {userId: id, isPublic: true},
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  if (!userOutFits) return res.status(404).json({ error: "NOT_FOUND" });
  
  const dto = userOutFits.map(outfitToPublicDto);
  res.json({ data: dto, page: 1, pageSize: dto.length, total: dto.length });

});

export default router;
