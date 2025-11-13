#!/usr/bin/env node
/**
 * Test node-redis library with ElastiCache IAM authentication
 * This script tests the exact same approach used in the application
 */

const { createClient } = require('redis');
const { fromNodeProviderChain } = require('@aws-sdk/credential-providers');
const { SignatureV4 } = require('@smithy/signature-v4');
const { HttpRequest } = require('@smithy/protocol-http');
const { Sha256 } = require('@aws-crypto/sha256-js');

// Configuration from environment
const ENDPOINT = process.env.REDIS_ENDPOINT || 'tonys-chips-sandbox-fj3rik.serverless.use1.cache.amazonaws.com';
const PORT = parseInt(process.env.REDIS_PORT || '6379');
const USERNAME = process.env.REDIS_USERNAME || 'tonys-chips-web';
const REGION = process.env.AWS_REGION || 'us-east-1';

async function generateIAMAuthToken(endpoint, port, username, region, isServerless) {
  const credentialProvider = fromNodeProviderChain();
  const credentials = await credentialProvider();

  console.log(`[Token] Using AWS credentials - AccessKeyId: ${credentials.accessKeyId.substring(0, 10)}...`);
  if (credentials.sessionToken) {
    console.log(`[Token] Session token present: ${credentials.sessionToken.substring(0, 20)}...`);
  }

  const detectServerless = isServerless !== undefined
    ? isServerless
    : endpoint.includes('.serverless.');

  const query = {
    Action: 'connect',
    User: username,
  };

  if (detectServerless) {
    query.ResourceType = 'ServerlessCache';
  }

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

  const signer = new SignatureV4({
    credentials,
    region,
    service: 'elasticache',
    sha256: Sha256,
  });

  const signedRequest = await signer.presign(request, {
    expiresIn: 900,
  });

  const protocol = signedRequest.protocol || 'http:';
  const hostname = signedRequest.hostname;
  const portNum = signedRequest.port || port;
  const path = signedRequest.path || '/';

  const queryParams = new URLSearchParams();
  if (signedRequest.query) {
    Object.entries(signedRequest.query).forEach(([key, value]) => {
      queryParams.append(key, String(value));
    });
  }

  const queryString = queryParams.toString();
  const fullUrl = `${protocol}//${hostname}:${portNum}${path}${queryString ? '?' + queryString : ''}`;
  const token = fullUrl.replace(/^https?:\/\//, '');

  console.log(`[Token] Endpoint: ${endpoint}`);
  console.log(`[Token] Serverless: ${detectServerless}`);
  console.log(`[Token] Username: ${username}`);
  console.log(`[Token] Token length: ${token.length}`);
  console.log(`[Token] Full token: ${token}`);

  try {
    const tokenUrl = new URL('http://' + token);
    console.log(`[Token] Query params:`);
    tokenUrl.searchParams.forEach((value, key) => {
      if (key === 'User' || key === 'Action' || key === 'ResourceType') {
        console.log(`  ${key}=${value}`);
      }
    });
  } catch (e) {
    console.error(`[Token] Failed to parse token as URL:`, e);
  }

  return token;
}

async function testConnection() {
  console.log('=== node-redis IAM Authentication Test ===\n');
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Port: ${PORT}`);
  console.log(`Username: ${USERNAME}`);
  console.log(`Region: ${REGION}\n`);

  const isServerless = ENDPOINT.includes('.serverless.');
  console.log(`Cache type: ${isServerless ? 'Serverless' : 'Regular Cluster'}\n`);

  try {
    // Generate IAM token
    console.log('Step 1: Generating IAM token...\n');
    const token = await generateIAMAuthToken(ENDPOINT, PORT, USERNAME, REGION, isServerless);
    console.log('\n✓ Token generated successfully\n');

    // Create Redis client WITHOUT credentials
    console.log('Step 2: Creating Redis client...');
    const client = createClient({
      socket: {
        host: ENDPOINT,
        port: PORT,
        connectTimeout: 10000,
        tls: true,
      },
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    client.on('connect', () => {
      console.log('✓ TCP connection established');
    });

    client.on('ready', () => {
      console.log('✓ Client ready');
    });

    // Connect
    console.log('\nStep 3: Connecting to Redis...');
    await client.connect();
    console.log('✓ Connected\n');

    // Manually authenticate
    console.log('Step 4: Sending AUTH command...');
    console.log(`AUTH ${USERNAME} <token>`);
    await client.auth({ username: USERNAME, password: token });
    console.log('✓ AUTH successful\n');

    // Test PING
    console.log('Step 5: Testing PING command...');
    const pongResponse = await client.ping();
    console.log(`✓ PING response: ${pongResponse}\n`);

    // Test basic operations
    console.log('Step 6: Testing basic operations...');
    await client.set('test-key', 'test-value');
    const value = await client.get('test-key');
    await client.del('test-key');
    console.log(`✓ SET/GET/DEL successful (value: ${value})\n`);

    // Get server info
    console.log('Step 7: Getting server info...');
    const info = await client.info('server');
    const lines = info.split('\r\n').filter(line => line && !line.startsWith('#')).slice(0, 5);
    console.log('Server info:');
    lines.forEach(line => console.log(`  ${line}`));
    console.log();

    // Cleanup
    await client.quit();
    console.log('✓ Connection closed\n');

    console.log('=== ✅ SUCCESS! All tests passed ===');
    process.exit(0);

  } catch (error) {
    console.error('\n=== ❌ FAILED ===');
    console.error(`Error: ${error.message}\n`);

    if (error.message.includes('WRONGPASS')) {
      console.error('WRONGPASS error indicates:');
      console.error('  1. User may not be in the correct UserGroup');
      console.error('  2. IAM policy may be missing cache or user ARN');
      console.error('  3. User may not be IAM-enabled');
      console.error('  4. Token generation may have issues');
      console.error('  5. There may be a library compatibility issue with Valkey 8.1\n');
    }

    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

testConnection();
