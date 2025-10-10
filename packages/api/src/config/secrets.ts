import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

interface DatabaseSecret {
  password: string;
  username?: string;
  engine?: string;
  host?: string;
  port?: number;
  dbname?: string;
}

let cachedSecret: string | null = null;

export async function getDatabasePassword(): Promise<string> {
  // If we already fetched the secret, return it
  if (cachedSecret) {
    return cachedSecret;
  }

  const secretArn = process.env.DB_SECRET_ARN;

  if (!secretArn) {
    throw new Error('DB_SECRET_ARN environment variable not set');
  }

  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-west-1' });

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

export async function buildDatabaseUrl(): Promise<string> {
  const user = process.env.DB_USER || 'postgres';
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME || 'postgres';

  if (!host) {
    throw new Error('DB_HOST environment variable not set');
  }

  const password = await getDatabasePassword();

  return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
}
