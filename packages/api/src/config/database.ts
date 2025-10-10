import { PrismaClient } from '@prisma/client';
import { buildDatabaseUrl } from './secrets';

let prismaInstance: PrismaClient | null = null;

export async function getPrismaClient(): Promise<PrismaClient> {
  if (prismaInstance) {
    return prismaInstance;
  }

  // If DATABASE_URL is already set (local dev, tests), use it directly
  if (process.env.DATABASE_URL) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'test' ? ['error'] : ['warn', 'error'],
    });
    return prismaInstance;
  }

  // In production, build DATABASE_URL from secrets
  const databaseUrl = await buildDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;

  prismaInstance = new PrismaClient({
    log: process.env.NODE_ENV === 'test' ? ['error'] : ['warn', 'error'],
  });

  return prismaInstance;
}

// Lazy initialization proxy for synchronous access
// This allows routes to import prisma, but actual initialization is deferred
const prismaProxy = new Proxy({} as PrismaClient, {
  get(target, prop) {
    if (!prismaInstance) {
      // Try to initialize synchronously if DATABASE_URL is available
      if (process.env.DATABASE_URL) {
        prismaInstance = new PrismaClient({
          log: process.env.NODE_ENV === 'test' ? ['error'] : ['warn', 'error'],
        });
      } else {
        throw new Error(
          'Prisma client not initialized. Call getPrismaClient() before starting the server.'
        );
      }
    }
    return prismaInstance[prop as keyof PrismaClient];
  },
});

export default prismaProxy;
