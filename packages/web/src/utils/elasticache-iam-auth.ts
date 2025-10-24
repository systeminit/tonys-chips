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

  // Log credential details for debugging (not the actual secrets)
  console.log(`[IAM Token Debug] Using AWS credentials - AccessKeyId: ${credentials.accessKeyId.substring(0, 10)}...`);
  if (credentials.sessionToken) {
    console.log(`[IAM Token Debug] Session token present: ${credentials.sessionToken.substring(0, 20)}...`);
  }

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
  // IMPORTANT: Use http:// protocol for the signature (not https)
  // The Go implementation from AWS community shows Scheme: "http"
  // Even though we connect with TLS, the token signature uses http://
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

  // Build the complete presigned URL from the signed request
  // The query parameters are already signed and included in signedRequest.query
  const protocol = signedRequest.protocol || 'http:';
  const hostname = signedRequest.hostname;
  const portNum = signedRequest.port || port;
  const path = signedRequest.path || '/';

  // Build query string from signed request query parameters
  const queryParams = new URLSearchParams();
  if (signedRequest.query) {
    // The presigner returns query parameters in the correct order and format
    Object.entries(signedRequest.query).forEach(([key, value]) => {
      queryParams.append(key, String(value));
    });
  }

  const queryString = queryParams.toString();

  // Build full URL and strip http:// prefix
  const fullUrl = `${protocol}//${hostname}:${portNum}${path}${queryString ? '?' + queryString : ''}`;
  const token = fullUrl.replace(/^https?:\/\//, '');

  // Log token details for debugging
  console.log(`[IAM Token Debug] Endpoint: ${endpoint}`);
  console.log(`[IAM Token Debug] Serverless: ${detectServerless}`);
  console.log(`[IAM Token Debug] Username: ${username}`);
  console.log(`[IAM Token Debug] Token length: ${token.length}`);
  console.log(`[IAM Token Debug] Full token: ${token}`);

  // Parse and log query parameters for verification
  try {
    const tokenUrl = new URL('http://' + token);
    console.log(`[IAM Token Debug] Query params:`);
    tokenUrl.searchParams.forEach((value, key) => {
      if (key === 'User' || key === 'Action' || key === 'ResourceType') {
        console.log(`  ${key}=${value}`);
      }
    });
  } catch (e) {
    console.error(`[IAM Token Debug] Failed to parse token as URL:`, e);
  }

  return token;
}
