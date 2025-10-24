import express from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient, RedisClientType } from 'redis';
import path from 'path';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { generateIAMAuthToken } from './utils/elasticache-iam-auth';

// Load environment variables
dotenv.config();

// Import routes
import productsRouter from './routes/products';
import cartRouter from './routes/cart';
import ordersRouter from './routes/orders';

const app = express();
const PORT = process.env.PORT || 3001;

// Redis configuration
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const awsRegion = process.env.AWS_REGION || 'us-east-1';
const useIAMAuth = process.env.USE_IAM_AUTH === 'true';

// Token refresh interval reference (for cleanup)
let tokenRefreshInterval: NodeJS.Timeout | null = null;

async function initializeRedisClient(): Promise<RedisClientType> {
  let client: RedisClientType;

  // Store IAM auth details for later use
  let iamAuthDetails: { host: string; port: number; username: string; isServerless: boolean; token: string } | null = null;

  if (useIAMAuth) {
    // Parse endpoint from REDIS_URL for IAM authentication
    const url = new URL(redisUrl);
    const host = url.hostname;
    const port = parseInt(url.port) || 6379;
    // Username must match an IAM-enabled ElastiCache user
    // For Serverless: often 'default' or a custom IAM user created in ElastiCache
    // For regular clusters: custom username from ElastiCache User configuration
    const username = process.env.REDIS_USERNAME || 'tonys-chips-web';

    // Detect if this is a serverless cache
    const isServerless = host.includes('.serverless.');

    console.log('Initializing Valkey client with IAM authentication...');
    console.log(`Connecting to: ${host}:${port}`);
    console.log(`Cache Type: ${isServerless ? 'Serverless' : 'Regular Cluster'}`);
    console.log(`Username: ${username}`);
    console.log(`AWS Region: ${awsRegion}`);
    console.log('TLS encryption: ENABLED (required for IAM auth)');

    // Verify AWS credentials/identity being used
    console.log('Verifying AWS identity...');
    try {
      const { fromNodeProviderChain } = await import('@aws-sdk/credential-providers');
      const credentialProvider = fromNodeProviderChain();
      const credentials = await credentialProvider();
      console.log(`Using AWS AccessKeyId: ${credentials.accessKeyId.substring(0, 10)}...`);
    } catch (error) {
      console.error('Failed to get AWS credentials:', error);
    }

    // Generate initial IAM auth token
    console.log('Generating IAM authentication token...');
    const token = await generateIAMAuthToken(host, port, username, awsRegion, isServerless);
    console.log(`Generated token length: ${token.length} characters`);
    console.log(`Token preview: ${token.substring(0, 100)}...`);
    if (isServerless) {
      console.log('Token includes ResourceType=ServerlessCache parameter');
    }

    // Store for manual AUTH after connection
    iamAuthDetails = { host, port, username, isServerless, token };

    // Create Redis client with IAM credentials and TLS
    // TLS is REQUIRED for IAM authentication with AWS ElastiCache
    //
    // IMPORTANT: For IAM auth, we DON'T pass username/password to createClient
    // Instead, we'll manually call AUTH after connection is established
    // This ensures the AUTH command is sent exactly as needed by ElastiCache
    client = createClient({
      socket: {
        host,
        port,
        connectTimeout: 10000, // 10 second connection timeout
        // Enable TLS/SSL - required for IAM authentication
        tls: true,
        // Optionally reject unauthorized certificates in production
        // rejectUnauthorized: process.env.NODE_ENV === 'production',
        reconnectStrategy: (retries: number) => {
          if (retries > 3) {
            console.error('Max Redis reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          console.log(`Reconnecting to Redis, attempt ${retries + 1}`);
          return Math.min(retries * 100, 3000); // Exponential backoff, max 3s
        },
      },
      // DON'T pass username/password here for IAM auth
      // We'll call AUTH manually after connection
    });

    // Set up token refresh every 10 minutes
    // Tokens are valid for 15 minutes, so 10-minute refresh provides safety margin
    // Note: IAM authenticated connections are auto-disconnected after 12 hours by AWS
    tokenRefreshInterval = setInterval(async () => {
      try {
        console.log('Refreshing IAM auth token...');
        const newToken = await generateIAMAuthToken(host, port, username, awsRegion, isServerless);

        // Use AUTH command to refresh credentials
        // This also extends the 12-hour connection limit
        await client.auth({ username, password: newToken });
        console.log('IAM auth token refreshed successfully');
      } catch (error) {
        console.error('Failed to refresh IAM auth token:', error);
        // Connection might be dead after 12 hours, try to reconnect
        if (error instanceof Error && error.message.includes('closed')) {
          console.log('Connection appears closed, will attempt reconnection...');
        }
      }
    }, 10 * 60 * 1000); // 10 minutes
  } else {
    // Use standard connection (for local development)
    console.log('Initializing Valkey client with standard connection...');
    console.log(`Connecting to: ${redisUrl}`);

    client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 10000, // 10 second connection timeout
        reconnectStrategy: (retries: number) => {
          if (retries > 3) {
            console.error('Max Redis reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          console.log(`Reconnecting to Redis, attempt ${retries + 1}`);
          return Math.min(retries * 100, 3000); // Exponential backoff, max 3s
        },
        // Enable TCP keep-alive to detect dead connections
        keepAlive: true,
      },
    });
  }

  // Event handlers for better debugging
  client.on('error', (err: Error) => {
    console.error('Valkey Client Error:', err);
  });

  client.on('connect', () => {
    console.log('Valkey Client: TCP connection established');
  });

  client.on('ready', () => {
    console.log('Valkey Client: Ready to accept commands');
  });

  client.on('reconnecting', () => {
    console.log('Valkey Client: Attempting to reconnect...');
  });

  client.on('end', () => {
    console.log('Valkey Client: Connection closed');
  });

  // Connect to Valkey with timeout
  console.log('Attempting Redis connection...');
  try {
    await client.connect();
    console.log('Valkey Client: Connected successfully');

    // For IAM auth, manually send AUTH command after connection
    if (iamAuthDetails) {
      console.log('Attempting IAM authentication...');
      console.log(`Username: ${iamAuthDetails.username}`);
      console.log(`Token length: ${iamAuthDetails.token.length} characters`);

      let authenticated = false;
      let lastError: Error | null = null;

      // Try Method 1: HELLO command with AUTH (Redis 6+)
      try {
        console.log('\n[Method 1] Trying HELLO 3 AUTH command...');
        const helloResult = await client.sendCommand(['HELLO', '3', 'AUTH', iamAuthDetails.username, iamAuthDetails.token]);
        console.log(`✓ HELLO AUTH successful:`, helloResult);
        authenticated = true;
      } catch (error) {
        console.error('[Method 1] HELLO AUTH failed:', error instanceof Error ? error.message : error);
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Try Method 2: Direct AUTH command with sendCommand
      if (!authenticated) {
        try {
          console.log('\n[Method 2] Trying AUTH with sendCommand...');
          const authResult = await client.sendCommand(['AUTH', iamAuthDetails.username, iamAuthDetails.token]);
          console.log(`✓ AUTH sendCommand successful, result:`, authResult);
          authenticated = true;
        } catch (error) {
          console.error('[Method 2] AUTH sendCommand failed:', error instanceof Error ? error.message : error);
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }

      // Try Method 3: auth() helper method
      if (!authenticated) {
        try {
          console.log('\n[Method 3] Trying auth() helper method...');
          await client.auth({ username: iamAuthDetails.username, password: iamAuthDetails.token });
          console.log(`✓ auth() method successful`);
          authenticated = true;
        } catch (error) {
          console.error('[Method 3] auth() method failed:', error instanceof Error ? error.message : error);
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }

      if (!authenticated) {
        throw new Error(`All authentication methods failed. Last error: ${lastError?.message}`);
      }

      console.log('\n✅ Successfully authenticated with IAM');
    }
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }

  return client;
}

// Redis connectivity verification function
async function verifyRedisConnection(client: RedisClientType) {
  try {
    // Test basic connectivity with PING command
    const pingResponse = await client.ping();
    console.log(`Redis connection verified - PING response: ${pingResponse}`);

    // Test authentication method being used
    const authMethod = useIAMAuth ? 'IAM' : 'password';
    console.log(`Redis authentication method: ${authMethod}`);

    // Test basic operations
    await client.set('health-check-test', 'ok');
    const testValue = await client.get('health-check-test');
    await client.del('health-check-test');

    if (testValue !== 'ok') {
      throw new Error('Basic Redis operations test failed');
    }

    console.log('Redis basic operations verified successfully');

  } catch (error) {
    console.error('Redis connectivity verification failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);

      // Provide helpful error context for common issues
      if (error.message.includes('NOAUTH') || error.message.includes('Authentication')) {
        console.error('This appears to be an authentication issue. Check:');
        console.error('- IAM role permissions for elasticache:Connect');
        console.error('- ElastiCache User configuration');
        console.error('- Username matches ElastiCache User (tonys-chips-web)');
      }

      if (error.message.includes('Connection refused') || error.message.includes('timeout')) {
        console.error('This appears to be a network connectivity issue. Check:');
        console.error('- Security group rules');
        console.error('- VPC configuration');
        console.error('- ElastiCache endpoint accessibility');
      }

      if (error.message.includes('WRONGPASS')) {
        console.error('IAM auth token may be invalid or expired. Check:');
        console.error('- AWS credentials are available');
        console.error('- IAM role has elasticache:Connect permission');
      }
    }

    // Re-throw the error to fail startup
    throw new Error(`Redis connectivity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Initialize app and start server
async function start() {
  try {
    // Initialize Redis client
    const redisClient = await initializeRedisClient();
    console.log('Redis connection initialized');

    // Verify Redis connectivity before starting server
    console.log('Verifying Redis connectivity...');
    await verifyRedisConnection(redisClient);
    console.log('Redis connectivity verified successfully');

    // Configure session with Valkey store (using RedisStore for protocol compatibility)
    app.use(
      session({
        store: new RedisStore({ client: redisClient }),
        secret: process.env.SESSION_SECRET || 'tony-chips-secret-key',
        resave: false,
        saveUninitialized: true,
        cookie: {
          secure: false, // Set to true if using HTTPS
          maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        },
      })
    );

    // Initialize session ID for cart
    app.use((req, res, next) => {
      if (!req.session.cartSessionId) {
        req.session.cartSessionId = uuidv4();
      }
      res.locals.sessionId = req.session.cartSessionId;
      next();
    });

    // Set view engine
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));

    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, '../public')));

    // Pass API URL to all views
    app.use((req, res, next) => {
      res.locals.apiUrl = process.env.API_URL || 'http://localhost:3000';
      next();
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Redis health check endpoint
    app.get('/health/redis', async (req, res) => {
      try {
        // Test Redis connectivity with PING
        const pingResponse = await redisClient.ping();
        res.json({
          status: 'healthy',
          redis: 'connected',
          ping: pingResponse,
          authMethod: useIAMAuth ? 'IAM' : 'password'
        });
      } catch (error) {
        console.error('Redis health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          redis: 'disconnected',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Routes
    app.use('/', productsRouter);
    app.use('/cart', cartRouter);
    app.use('/orders', ordersRouter);

    // Error handler
    app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error(err.stack);
      res.status(500).render('error', { error: 'Something went wrong!' });
    });

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`Web server running on port ${PORT}`);
      console.log(`API URL: ${process.env.API_URL || 'http://localhost:3000'}`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`${signal} received, shutting down gracefully`);

      // Stop accepting new connections
      server.close(async () => {
        console.log('HTTP server closed');

        // Clear token refresh interval
        if (tokenRefreshInterval) {
          clearInterval(tokenRefreshInterval);
          console.log('Token refresh interval cleared');
        }

        // Disconnect Redis client
        try {
          await redisClient.quit();
          console.log('Redis connection closed');
          process.exit(0);
        } catch (error) {
          console.error('Error during Redis disconnect:', error);
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

    // In development/sandbox, allow app to start without Redis for debugging
    if (process.env.ALLOW_STARTUP_WITHOUT_REDIS === 'true') {
      console.warn('⚠️  ALLOW_STARTUP_WITHOUT_REDIS=true: Starting server despite connection failure');
      console.warn('⚠️  Shopping cart functionality will NOT work');

      // Start server without Redis
      const server = app.listen(PORT, () => {
        console.log(`Web server running on port ${PORT} (WITHOUT REDIS)`);
        console.log(`API URL: ${process.env.API_URL || 'http://localhost:3000'}`);
      });

      process.on('SIGTERM', () => server.close());
      process.on('SIGINT', () => server.close());
    } else {
      process.exit(1);
    }
  }
}

start();
