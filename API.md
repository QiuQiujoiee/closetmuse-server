# ClosetMuse API Documentation (Latest)

> Base URL: `/api`  
> All endpoints return JSON. Except for image upload, use `Content-Type: application/json`.

---

## Auth `/auth`

### POST `/auth/register`
Register a new user.
- body: `{ email, password, username? }`
- returns: User object
- errors: `EMAIL_TAKEN`, `BAD_REQUEST`

### POST `/auth/login`
Login.
- body: `{ email, password }`
- returns: User object
- errors: `INVALID_CREDENTIALS`, `BAD_REQUEST`

### POST `/auth/logout`
Logout.
- returns: `{ ok: true }`

### GET `/auth/me`
Get current logged-in user.
- returns: User object
- errors: `UNAUTHENTICATED`

---

## Items `/items` (Requires login)

### GET `/items`
Get item list, supports name fuzzy search.
- query: `q?`, `page?`, `pageSize?`
- returns: `{ data: Item[], page, pageSize, total }`

### POST `/items`
Create an item.
- body: `{ name, category?, color?, season?, imageUrl?, tags? }`
- returns: Item
- errors: `BAD_REQUEST`

### GET `/items/:id`
Get item details.
- returns: Item
- errors: `NOT_FOUND`

### PATCH `/items/:id`
Update an item.
- body: partial fields
- returns: Item
- errors: `NOT_FOUND`, `BAD_REQUEST`

### DELETE `/items/:id`
Delete an item.
- returns: `{ ok: true }`
- errors: `NOT_FOUND`

---

## Outfits `/outfits` (Requires login)

### GET `/outfits`
Get all my outfits.
- returns: `{ data: Outfit[], page, pageSize, total }`

### POST `/outfits`
Create an outfit.
- body: `{ itemIds, notes?, isPublic? }`
- returns: Outfit
- errors: `INVALID_ITEM_IDS`, `BAD_REQUEST`

### GET `/outfits/:id`
Get details of one of my outfits.
- returns: Outfit
- errors: `NOT_FOUND`

### DELETE `/outfits/:id`
Delete my outfit.
- returns: `{ ok: true }`
- errors: `NOT_FOUND`

### PUT `/outfits/:id/like`
Like (idempotent).
- returns: `{ ok: true, likedByMe: true, likesCount }`
- errors: `NOT_FOUND`

### DELETE `/outfits/:id/like`
Unlike.
- returns: `{ ok: true, likedByMe: false, likesCount }`
- errors: `NOT_FOUND`

### PUT `/outfits/:id/favorite`
Favorite (idempotent).
- returns: `{ ok: true, favoritedByMe: true, favoritesCount }`
- errors: `NOT_FOUND`

### DELETE `/outfits/:id/favorite`
Unfavorite.
- returns: `{ ok: true, favoritedByMe: false, favoritesCount }`
- errors: `NOT_FOUND`

### POST `/outfits/:id/comments`
Post a comment.
- body: `{ content, parentId? }`
- returns: Comment object
- errors: `BAD_REQUEST`, `NOT_FOUND`

### GET `/outfits/like`
Get all outfits I liked.
- returns: `{ data: Outfit[], page, pageSize, total }`

### GET `/outfits/favorites`
Get all outfits I favorited.
- returns: `{ data: Outfit[], page, pageSize, total }`

---

## Explore `/explore`

### GET `/explore/outfits`
Get all public outfits.
- query: `page?`, `pageSize?`
- returns: `{ data: OutfitPublic[], page, pageSize, total }`

### GET `/explore/outfits/:id`
Get details of a public outfit.
- returns: OutfitPublic
- errors: `NOT_FOUND`

### GET `/explore/outfits/:id/comments`
Get comments of a public outfit.
- query: `page?`, `pageSize?`
- returns: `{ data: Comment[], page, pageSize, total }`
- errors: `NOT_FOUND`

### GET `/explore/users/:id`
Get all public outfits of a user.
- returns: `{ data: OutfitPublic[], page, pageSize, total }`
- errors: `NOT_FOUND`, `MISSING_USER_ID`

---

## File Upload `/upload` (Requires login)

### POST `/upload/image`
Upload an image.
- form-data: `image` (image file, max 5MB)
- returns: `{ imageUrl, filename, mimetype, size }`
- errors: `IMAGE_REQUIRED`, `ONLY_IMAGE_ALLOWED`, `FILE_TOO_LARGE`

---

## Data Structures

- User: `{ id, email, username, avatarUrl, createdAt, updatedAt }`
- Item: `{ id, userId, name, category, color, season, imageUrl, tags, createdAt, updatedAt }`
- Outfit: `{ id, userId, notes, isPublic, likesCount, favoritesCount, commentsCount, createdAt, updatedAt, itemIds }`
- OutfitPublic: Outfit + `{ itemsPreview, author, likedByMe?, favoritedByMe? }`
- Comment: `{ id, outfitId, content, parentId, createdAt, author }`

---

## Error Response Format

```json
{ "error": "ERROR_CODE" }
// or
{ "error": "BAD_REQUEST", "details": { ... } }
```

Common error codes: `UNAUTHENTICATED`, `BAD_REQUEST`, `NOT_FOUND`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `IMAGE_REQUIRED`, `ONLY_IMAGE_ALLOWED`, `FILE_TOO_LARGE`, `MISSING_USER_ID`

---

## Notes
- All endpoints requiring login need to send the Cookie (`cm.sid`).
- All paginated endpoints return `page`, `pageSize`, `total` fields.
- Images can be accessed directly via `/uploads/<filename>`.
