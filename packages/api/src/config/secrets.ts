import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Signer } from '@aws-sdk/rds-signer';

interface DatabaseSecret {
  password: string;
  username?: string;
  engine?: string;
  host?: string;
  port?: number;
  dbname?: string;
}

let cachedSecret: string | null = null;

/**
 * Generate an IAM authentication token for RDS Proxy
 * Token is valid for 15 minutes
 */
export async function generateIAMAuthToken(): Promise<string> {
  const host = process.env.DB_HOST;
  const port = parseInt(process.env.DB_PORT || '5432');
  const user = process.env.DB_USER || 'postgres';
  const region = process.env.AWS_REGION || 'us-east-1';

  if (!host) {
    throw new Error('DB_HOST environment variable not set');
  }

  try {
    const signer = new Signer({
      hostname: host,
      port: port,
      username: user,
      region: region
    });

    const token = await signer.getAuthToken();
    console.log('Generated IAM auth token for database connection');
    return token;
  } catch (error) {
    console.error('Failed to generate IAM auth token:', error);
    throw error;
  }
}

/**
 * Legacy method: Get password from Secrets Manager
 * Used when IAM auth is disabled (local development)
 */
export async function getDatabasePassword(): Promise<string> {
  // If we already fetched the secret, return it
  if (cachedSecret) {
    return cachedSecret;
  }

  const secretArn = process.env.DB_SECRET_ARN;

  if (!secretArn) {
    throw new Error('DB_SECRET_ARN environment variable not set');
  }

  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

  try {
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret: DatabaseSecret = JSON.parse(response.SecretString);
    cachedSecret = secret.password;

    return cachedSecret;
  } catch (error) {
    console.error('Error fetching database password from Secrets Manager:', error);
    throw error;
  }
}

/**
 * Build the database connection URL
 * Uses IAM authentication when DB_USE_IAM_AUTH=true
 * Falls back to Secrets Manager or DATABASE_URL for local development
 */
export async function buildDatabaseUrl(): Promise<string> {
  const user = process.env.DB_USER || 'postgres';
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME || 'postgres';
  const useIAMAuth = process.env.DB_USE_IAM_AUTH === 'true';

  if (!host) {
    throw new Error('DB_HOST environment variable not set');
  }

  let password: string;

  if (useIAMAuth) {
    // Use IAM authentication (RDS Proxy in production)
    console.log('Using IAM authentication for database connection');
    password = await generateIAMAuthToken();
    // SSL is REQUIRED when using IAM authentication
    return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public&sslmode=require`;
  } else {
    // Use password from Secrets Manager or environment
    console.log('Using password authentication for database connection');
    if (process.env.DB_PASSWORD) {
      password = process.env.DB_PASSWORD;
    } else {
      password = await getDatabasePassword();
    }
    return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
  }
}
