import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/errorHandler';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import { getPrismaClient } from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/db', async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    // Simple query to test database connectivity (will refresh token if needed)
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      database: 'connected',
      authMethod: process.env.DB_USE_IAM_AUTH === 'true' ? 'IAM' : 'password'
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Database connectivity verification function
async function verifyDatabaseConnection(prisma: PrismaClient) {
  try {
    // Test basic connectivity with a simple query
    await prisma.$queryRaw`SELECT 1 as test`;
    
    // Test if we can access the database schema by checking for tables
    const result = await prisma.$queryRaw<Array<{ table_count: bigint }>>`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log(`Database connection verified - found ${result[0].table_count} tables in public schema`);
    
    // Test authentication method being used
    const authMethod = process.env.DB_USE_IAM_AUTH === 'true' ? 'IAM' : 'password';
    console.log(`Database authentication method: ${authMethod}`);
    
  } catch (error) {
    console.error('Database connectivity verification failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      
      // Provide helpful error context for common issues
      if (error.message.includes('Authentication failed')) {
        console.error('This appears to be an authentication issue. Check:');
        console.error('- IAM role permissions for rds-db:connect');
        console.error('- RDS Proxy configuration');
        console.error('- Database credentials in Secrets Manager');
      }
      
      if (error.message.includes('Connection refused') || error.message.includes('timeout')) {
        console.error('This appears to be a network connectivity issue. Check:');
        console.error('- Security group rules');
        console.error('- VPC configuration');
        console.error('- Database endpoint accessibility');
      }
    }
    
    // Re-throw the error to fail startup
    throw new Error(`Database connectivity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Initialize database and start server
async function start() {
  try {
    // Initialize Prisma client (this will fetch secrets if needed)
    const prisma = await getPrismaClient();
    console.log('Database connection initialized');

    // Verify database connectivity before starting server
    console.log('Verifying database connectivity...');
    await verifyDatabaseConnection(prisma);
    console.log('Database connectivity verified successfully');

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`${signal} received, shutting down gracefully`);

      // Stop accepting new connections
      server.close(async () => {
        console.log('HTTP server closed');

        // Disconnect Prisma client
        try {
          await prisma.$disconnect();
          console.log('Database connection closed');
          process.exit(0);
        } catch (error) {
          console.error('Error during database disconnect:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
