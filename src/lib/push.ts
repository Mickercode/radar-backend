import webpush from 'web-push';
import { env } from '../config/env';
import { prisma } from './prisma';

let configured = false;

function setup() {
  if (configured || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

/** Send a push notification to all subscriptions for a user. Best-effort. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  setup();
  if (!configured) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const data = JSON.stringify(payload);
  const stale: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, data);
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) stale.push(sub.endpoint);
        else console.error('[push] send failed:', (e as Error).message);
      }
    }),
  );

  // Clean up expired subscriptions
  if (stale.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint: { in: stale } } }).catch(() => {});
  }
}

/** Broadcast to all users (e.g. daily digest). */
export async function broadcastPush(payload: PushPayload): Promise<void> {
  setup();
  if (!configured) return;

  const subs = await prisma.pushSubscription.findMany();
  const data = JSON.stringify(payload);
  const stale: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, data);
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) stale.push(sub.endpoint);
      }
    }),
  );

  if (stale.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } }).catch(() => {});
  }
}

export function getVapidPublicKey(): string | undefined {
  return env.VAPID_PUBLIC_KEY;
}
