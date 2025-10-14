/**
 * Check PostgreSQL readiness command implementation
 */

import { execSync } from 'child_process';

interface Config {
  environment: string;
  timeoutSeconds: number;
}

async function checkPostgresLocal(): Promise<boolean> {
  try {
    execSync('docker compose -f docker-compose.platform.yml exec -T postgres-test pg_isready', {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

async function checkPostgresByEnvironment(environment: string): Promise<boolean> {
  switch (environment) {
    case "local":
      return await checkPostgresLocal();
    default:
      throw new Error(`Unknown environment: ${environment}. Supported: local`);
  }
}

function parseConfig(args: string[]): Config {
  if (args.length < 1) {
    throw new Error("Usage: check-postgres <environment> [timeout-seconds]\nExample: check-postgres local 60");
  }
  
  const environment = args[0];
  const timeoutSeconds = args.length > 1 ? parseInt(args[1]) : 60;
  
  if (isNaN(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error("Timeout must be a positive number");
  }
  
  return { environment, timeoutSeconds };
}

export async function checkPostgres(args: string[]): Promise<void> {
  console.log("⏳ Checking PostgreSQL readiness");
  
  const config = parseConfig(args);
  
  console.log(`📋 Configuration:`);
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Timeout: ${config.timeoutSeconds}s`);
  console.log("");
  
  const startTime = Date.now();
  const timeoutMs = config.timeoutSeconds * 1000;
  
  while (Date.now() - startTime < timeoutMs) {
    console.log("🔍 Checking PostgreSQL readiness...");
    
    if (await checkPostgresByEnvironment(config.environment)) {
      console.log("✅ PostgreSQL is ready!");
      return;
    }
    
    console.log("⏱️  PostgreSQL not ready yet, waiting 2 seconds...");
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error(`❌ PostgreSQL failed to become ready within ${config.timeoutSeconds} seconds`);
}