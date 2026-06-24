import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest } from '../lib/http';
import { requireAuth, userId } from '../middleware/auth';

// Account management endpoints
export const accountRouter = Router();
accountRouter.use(requireAuth);

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.'));
    }
  },
});

// POST /account/avatar → { avatarUrl }
// Uploads an avatar image and returns the URL
// Note: This is a placeholder implementation. In production, you would:
// 1. Upload to R2/S3/AWS S3
// 2. Return the public URL
// For now, we'll store a placeholder URL
accountRouter.post(
  '/avatar',
  upload.single('avatar'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw badRequest('No file uploaded');
    }

    const uid = userId(req);

    // TODO: Upload to R2/S3 in production
    // For now, we'll use a placeholder service or base64
    // In production, you would:
    // const avatarUrl = await uploadToR2(req.file.buffer, req.file.mimetype);
    
    // Placeholder: using a placeholder avatar service
    // In production, replace this with actual R2/S3 upload
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`;

    // Update user with avatar URL
    const user = await prisma.appUser.update({
      where: { id: uid },
      data: { avatarUrl },
    });

    res.json({ avatarUrl: user.avatarUrl });
  }),
);

// GET /account → { id, email, name, avatarUrl, isPremium }
accountRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const user = await prisma.appUser.findUnique({
      where: { id: uid },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isPremium: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw badRequest('User not found');
    }

    res.json(user);
  }),
);
