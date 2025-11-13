#!/bin/bash
# Manual test script for ElastiCache IAM authentication
# This helps verify if the token generation itself is working

set -e

# Configuration
ENDPOINT="${REDIS_ENDPOINT:-tonys-chips-sandbox-fj3rik.serverless.use1.cache.amazonaws.com}"
PORT="${REDIS_PORT:-6379}"
USERNAME="${REDIS_USERNAME:-tonys-chips-web}"
REGION="${AWS_REGION:-us-east-1}"

echo "=== ElastiCache IAM Auth Manual Test ==="
echo "Endpoint: $ENDPOINT"
echo "Port: $PORT"
echo "Username: $USERNAME"
echo "Region: $REGION"
echo ""

# Check if redis-cli is installed
if ! command -v redis-cli &> /dev/null; then
    echo "❌ redis-cli is not installed"
    echo "Install with: brew install redis (macOS) or apt-get install redis-tools (Linux)"
    exit 1
fi

echo "✓ redis-cli is installed"
echo ""

# Generate IAM token using Node.js
echo "Generating IAM token..."
TOKEN=$(node -e "
const { fromNodeProviderChain } = require('@aws-sdk/credential-providers');
const { SignatureV4 } = require('@smithy/signature-v4');
const { HttpRequest } = require('@smithy/protocol-http');
const { Sha256 } = require('@aws-crypto/sha256-js');

(async () => {
  const endpoint = '$ENDPOINT';
  const port = $PORT;
  const username = '$USERNAME';
  const region = '$REGION';

  const credentialProvider = fromNodeProviderChain();
  const credentials = await credentialProvider();

  const isServerless = endpoint.includes('.serverless.');

  const query = {
    Action: 'connect',
    User: username,
  };

  if (isServerless) {
    query.ResourceType = 'ServerlessCache';
  }

  const request = new HttpRequest({
    method: 'GET',
    protocol: 'https:',
    hostname: endpoint,
    port,
    path: '/',
    query,
    headers: {
      host: \`\${endpoint}:\${port}\`,
    },
  });

  const signer = new SignatureV4({
    credentials,
    region,
    service: 'elasticache',
    sha256: Sha256,
  });

  const signedRequest = await signer.presign(request, {
    expiresIn: 900,
  });

  const queryParams = new URLSearchParams();
  if (signedRequest.query) {
    Object.entries(signedRequest.query).forEach(([key, value]) => {
      queryParams.append(key, String(value));
    });
  }

  const protocol = signedRequest.protocol || 'https:';
  const hostname = signedRequest.hostname;
  const portNum = signedRequest.port || port;
  const path = signedRequest.path || '/';
  const queryString = queryParams.toString();

  const fullUrl = \`\${protocol}//\${hostname}:\${portNum}\${path}\${queryString ? '?' + queryString : ''}\`;
  const token = fullUrl.replace(/^https?:\\/\\//, '');

  console.log(token);
})();
")

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to generate IAM token"
    exit 1
fi

echo "✓ Token generated (length: ${#TOKEN})"
echo ""

# Show token preview
echo "Token preview:"
echo "${TOKEN:0:150}..."
echo ""

# Test connection with redis-cli
echo "Testing connection with redis-cli..."
echo "Command: redis-cli -h $ENDPOINT -p $PORT --tls --user $USERNAME --pass '<token>' PING"
echo ""

# Try to connect and run PING
RESPONSE=$(redis-cli -h "$ENDPOINT" -p "$PORT" --tls --user "$USERNAME" --pass "$TOKEN" PING 2>&1)

echo "Response: $RESPONSE"
echo ""

if [ "$RESPONSE" = "PONG" ]; then
    echo "✅ SUCCESS! IAM authentication worked!"
    echo ""
    echo "Testing INFO command..."
    redis-cli -h "$ENDPOINT" -p "$PORT" --tls --user "$USERNAME" --pass "$TOKEN" INFO server | head -10
else
    echo "❌ FAILED! Error: $RESPONSE"
    echo ""
    echo "Common causes:"
    echo "1. User '$USERNAME' not in UserGroup attached to cache"
    echo "2. IAM policy missing cache or user ARN"
    echo "3. User not IAM-enabled"
    echo "4. Token generation issue"
    exit 1
fi
