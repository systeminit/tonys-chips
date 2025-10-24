import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { SignatureV4 } from '@smithy/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { Sha256 } from '@aws-crypto/sha256-js';

/**
 * Generates an IAM authentication token for AWS ElastiCache
 *
 * Based on AWS SigV4 signing process:
 * 1. Creates a pre-signed URL with Action=connect&User=username
 * 2. For Serverless: includes ResourceType=ServerlessCache
 * 3. Signs the URL with AWS credentials
 * 4. Returns the signed token (without http:// prefix) for use as password
 *
 * Tokens are valid for 15 minutes.
 *
 * @param endpoint - ElastiCache cluster endpoint hostname
 * @param port - ElastiCache cluster port (typically 6379)
 * @param username - IAM-enabled ElastiCache username
 * @param region - AWS region
 * @param isServerless - Whether this is a Serverless cache (default: auto-detect from endpoint)
 * @returns Signed authentication token to use as password
 */
export async function generateIAMAuthToken(
  endpoint: string,
  port: number,
  username: string,
  region: string,
  isServerless?: boolean
): Promise<string> {
  // Get AWS credentials from the environment (ECS task role in production)
  const credentialProvider = fromNodeProviderChain();
  const credentials = await credentialProvider();

  // Auto-detect if this is a serverless cache based on endpoint
  const detectServerless = isServerless !== undefined
    ? isServerless
    : endpoint.includes('.serverless.');

  // Create query parameters
  const query: Record<string, string> = {
    Action: 'connect',
    User: username,
  };

  // Add ResourceType for Serverless caches (REQUIRED)
  if (detectServerless) {
    query.ResourceType = 'ServerlessCache';
  }

  // Create the HTTP request to sign
  const request = new HttpRequest({
    method: 'GET',
    protocol: 'http:',
    hostname: endpoint,
    port,
    path: '/',
    query,
    headers: {
      host: `${endpoint}:${port}`,
    },
  });

  // Create the signer
  const signer = new SignatureV4({
    credentials,
    region,
    service: 'elasticache',
    sha256: Sha256,
  });

  // Sign the request with 15-minute expiration (900 seconds)
  const signedRequest = await signer.presign(request, {
    expiresIn: 900,
  });

  // Build the signed URL
  const signedUrl = new URL(`http://${signedRequest.hostname}:${signedRequest.port || port}${signedRequest.path}`);

  // Add query parameters from signed request
  if (signedRequest.query) {
    Object.entries(signedRequest.query).forEach(([key, value]) => {
      signedUrl.searchParams.set(key, String(value));
    });
  }

  // Strip the http:// prefix and return
  // ElastiCache expects just the signed string, not the full URL
  return signedUrl.toString().replace('http://', '');
}
