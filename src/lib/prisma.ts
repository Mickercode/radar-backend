import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env';

// Single shared client. In dev with tsx watch, reuse a global instance so we
// don't exhaust the connection pool across hot reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error'] : ['warn', 'error'],
  });

if (!isProd) globalForPrisma.prisma = prisma;
