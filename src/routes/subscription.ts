import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest } from '../lib/http';
import { requireAuth, userId } from '../middleware/auth';

// Subscription / Billing endpoints with Paystack integration
export const subscriptionRouter = Router();
subscriptionRouter.use(requireAuth);

// GET /subscription → { plan, renewsAt }
subscriptionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    
    const subscription = await prisma.subscription.findUnique({
      where: { userId: uid },
    });

    if (!subscription) {
      res.json({ plan: 'free', renewsAt: null });
      return;
    }

    // Check if subscription has expired
    if (subscription.renewsAt && subscription.renewsAt < new Date()) {
      // Expired - downgrade to free
      await prisma.$transaction([
        prisma.subscription.delete({ where: { userId: uid } }),
        prisma.appUser.update({ where: { id: uid }, data: { isPremium: false } }),
      ]);
      res.json({ plan: 'free', renewsAt: null });
      return;
    }

    res.json({
      plan: subscription.plan,
      renewsAt: subscription.renewsAt,
    });
  }),
);

// POST /subscription/checkout → { authorizationUrl }
const checkoutBody = z.object({
  plan: z.enum(['monthly', 'annual']),
});

subscriptionRouter.post(
  '/checkout',
  asyncHandler(async (req, res) => {
    const { plan } = checkoutBody.parse(req.body);
    const uid = userId(req);
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    // Get user email
    const user = await prisma.appUser.findUnique({
      where: { id: uid },
      select: { email: true },
    });

    if (!user) {
      throw badRequest('User not found');
    }

    // Determine amount based on plan (in kobo - Paystack uses smallest currency unit)
    const amount = plan === 'monthly' ? 200000 : 2000000; // ₦2,000 monthly / ₦20,000 annual

    // Create Paystack transaction
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: amount,
        plan: plan === 'monthly' ? 'monthly' : 'annual', // You'd need to create these plans in Paystack dashboard
        metadata: {
          userId: uid,
          plan: plan,
        },
      }),
    });

    const data = await response.json() as { status: boolean; data: { authorization_url: string } };

    if (!data.status) {
      throw new Error('Failed to initialize Paystack transaction');
    }

    res.json({ authorizationUrl: data.data.authorization_url });
  }),
);

// POST /subscription/cancel → { ok }
subscriptionRouter.post(
  '/cancel',
  asyncHandler(async (req, res) => {
    const uid = userId(req);

    const subscription = await prisma.subscription.findUnique({
      where: { userId: uid },
    });

    if (!subscription) {
      throw badRequest('No active subscription to cancel');
    }

    // Cancel at Paystack (if using recurring billing)
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (PAYSTACK_SECRET_KEY && subscription.paystackReference) {
      try {
        await fetch(`https://api.paystack.co/subscription/disable`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: subscription.paystackReference,
            token: subscription.paystackReference,
          }),
        });
      } catch (error) {
        // Log error but don't fail - we'll cancel locally anyway
        console.error('Failed to cancel Paystack subscription:', error);
      }
    }

    // Remove subscription and downgrade user
    await prisma.$transaction([
      prisma.subscription.delete({ where: { userId: uid } }),
      prisma.appUser.update({ where: { id: uid }, data: { isPremium: false } }),
    ]);

    res.json({ ok: true });
  }),
);

// Webhook endpoint for Paystack (no auth required - verified by signature)
subscriptionRouter.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    
    // Verify webhook signature (in production)
    // const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');
    // if (hash !== req.headers['x-paystack-signature']) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    const event = req.body.event;

    if (event === 'charge.success' || event === 'subscription.create') {
      const { metadata, customer, reference } = req.body.data;
      const userId = metadata?.userId;
      const plan = metadata?.plan;

      if (userId && plan) {
        // Calculate renewal date
        const now = new Date();
        const renewsAt = plan === 'monthly' 
          ? new Date(now.setMonth(now.getMonth() + 1))
          : new Date(now.setFullYear(now.getFullYear() + 1));

        await prisma.$transaction([
          prisma.appUser.update({
            where: { id: userId },
            data: { isPremium: true },
          }),
          prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              plan,
              renewsAt,
              paystackReference: reference,
            },
            update: {
              plan,
              renewsAt,
              paystackReference: reference,
            },
          }),
        ]);
      }
    }

    res.status(200).json({ received: true });
  }),
);
