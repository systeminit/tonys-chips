import { PrismaClient } from '@prisma/client';
import { buildDatabaseUrl } from './secrets';

let prismaInstance: PrismaClient | null = null;
let lastTokenRefresh: number = 0;
const TOKEN_REFRESH_INTERVAL = 14 * 60 * 1000; // 14 minutes in milliseconds (refresh before 15min expiry)

export async function getPrismaClient(): Promise<PrismaClient> {
  const useIAMAuth = process.env.DB_USE_IAM_AUTH === 'true';
  const now = Date.now();
  
  // Check if we need to refresh the IAM token
  const needsTokenRefresh = useIAMAuth && 
    prismaInstance && 
    (now - lastTokenRefresh) > TOKEN_REFRESH_INTERVAL;

  if (needsTokenRefresh) {
    console.log('IAM token refresh needed, recreating Prisma client...');
    
    // Disconnect the existing client
    try {
      await prismaInstance!.$disconnect();
    } catch (error) {
      console.warn('Error disconnecting previous Prisma client:', error);
    }
    
    // Reset the instance to force recreation
    prismaInstance = null;
    delete process.env.DATABASE_URL; // Clear the cached URL with expired token
  }

  if (prismaInstance) {
    return prismaInstance;
  }

  // If DATABASE_URL is already set (local dev, tests), use it directly
  if (process.env.DATABASE_URL && !useIAMAuth) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'test' ? ['error'] : ['warn', 'error'],
    });
    return prismaInstance;
  }

  // In production, build DATABASE_URL from secrets (this generates a fresh IAM token if needed)
  const databaseUrl = await buildDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;

  prismaInstance = new PrismaClient({
    log: process.env.NODE_ENV === 'test' ? ['error'] : ['warn', 'error'],
  });

  // Update the last token refresh time
  if (useIAMAuth) {
    lastTokenRefresh = now;
    console.log(`Prisma client created with fresh IAM token (expires in ~15 minutes)`);
  }

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
