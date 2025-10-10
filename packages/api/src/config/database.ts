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

// For synchronous access (local dev and tests where DATABASE_URL is set)
// In production with Secrets Manager, use getPrismaClient() instead
function createPrismaClient(): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. For production with AWS Secrets Manager, initialize with getPrismaClient() first.'
    );
  }

  prismaInstance = new PrismaClient({
    log: process.env.NODE_ENV === 'test' ? ['error'] : ['warn', 'error'],
  });

  return prismaInstance;
}

export default createPrismaClient();
