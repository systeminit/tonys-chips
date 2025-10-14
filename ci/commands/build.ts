/**
 * Build command implementation
 */

import { execSync } from 'child_process';

interface Config {
  environment: string;
  tag: string;
  viteApiUrl: string;
}

function runCommand(command: string, description: string): void {
  console.log(`🔧 ${description}`);
  console.log(`   Command: ${command}`);
  
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ Success: ${description}`);
  } catch (error) {
    console.error(`❌ Failed: ${description}`);
    throw new Error(`Command failed: ${description}`);
  }
}

function parseConfig(args: string[]): Config {
  if (args.length !== 2) {
    throw new Error("Usage: build <environment> <tag>\nExample: build sandbox 20231201120000-abc1234");
  }
  
  const environment = args[0];
  const tag = args[1];
  const viteApiUrl = process.env.VITE_API_URL || "http://localhost:3000";
  
  return { environment, tag, viteApiUrl };
}

async function buildDockerImages(config: Config): Promise<void> {
  const region = process.env.AWS_REGION || "us-west-2";
  const accountId = process.env.AWS_ACCOUNT_ID;
  
  if (!accountId) {
    throw new Error("AWS_ACCOUNT_ID environment variable not found. Make sure AWS credentials are configured.");
  }
  
  const ecrRegistry = `${accountId}.dkr.ecr.${region}.amazonaws.com`;
  const apiImage = `${ecrRegistry}/tonys-chips-api`;
  const webImage = `${ecrRegistry}/tonys-chips-web`;
  
  // Build API image
  runCommand(
    `docker build -f docker/api.Dockerfile -t ${apiImage}:${config.tag} .`,
    "Building API Docker image"
  );
  
  runCommand(
    `docker tag ${apiImage}:${config.tag} ${apiImage}:latest`,
    "Tagging API image as latest"
  );
  
  // Build Web image
  runCommand(
    `docker build -f docker/web.Dockerfile --build-arg VITE_API_URL=${config.viteApiUrl} -t ${webImage}:${config.tag} .`,
    "Building Web Docker image"
  );
  
  runCommand(
    `docker tag ${webImage}:${config.tag} ${webImage}:latest`,
    "Tagging Web image as latest"
  );
  
  console.log("");
  console.log("🎉 Successfully built Docker images:");
  console.log(`   API: ${apiImage}:${config.tag}`);
  console.log(`   Web: ${webImage}:${config.tag}`);
}

export async function build(args: string[]): Promise<void> {
  console.log("🚀 Starting Docker image build process");
  
  const config = parseConfig(args);
  
  console.log(`📋 Configuration:`);
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Tag: ${config.tag}`);
  console.log(`   API URL: ${config.viteApiUrl}`);
  console.log("");
  
  await buildDockerImages(config);
}