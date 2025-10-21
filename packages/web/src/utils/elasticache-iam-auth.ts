import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { SignatureV4 } from '@smithy/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { Sha256 } from '@aws-crypto/sha256-js';

/**
 * Generates an IAM authentication token for AWS ElastiCache
 *
 * Based on AWS SigV4 signing process:
 * 1. Creates a pre-signed URL with Action=connect&User=username
 * 2. Signs the URL with AWS credentials
 * 3. Returns the signed token (without http:// prefix) for use as password
 *
 * Tokens are valid for 15 minutes.
 *
 * @param endpoint - ElastiCache cluster endpoint hostname
 * @param port - ElastiCache cluster port (typically 6379)
 * @param username - IAM-enabled ElastiCache username
 * @param region - AWS region
 * @returns Signed authentication token to use as password
 */
export async function generateIAMAuthToken(
  endpoint: string,
  port: number,
  username: string,
  region: string
): Promise<string> {
  // Get AWS credentials from the environment (ECS task role in production)
  const credentialProvider = fromNodeProviderChain();
  const credentials = await credentialProvider();

  // Create the HTTP request to sign
  const request = new HttpRequest({
    method: 'GET',
    protocol: 'http:',
    hostname: endpoint,
    port,
    path: '/',
    query: {
      Action: 'connect',
      User: username,
    },
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
