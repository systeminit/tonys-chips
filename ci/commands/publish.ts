/**
 * Publish command implementation
 */

import { execSync } from 'child_process';

interface Config {
  environment: string;
  tag: string;
  region: string;
  ecrRegistry: string;
  accountId: string;
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
    throw new Error("Usage: publish <environment> <tag>\nExample: publish sandbox 20231201120000-abc1234");
  }
  
  const environment = args[0];
  const tag = args[1];
  const region = process.env.AWS_REGION || "us-west-2";
  
  const accountId = process.env.AWS_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("AWS_ACCOUNT_ID environment variable not found. Make sure AWS credentials are configured.");
  }
  
  const ecrRegistry = `${accountId}.dkr.ecr.${region}.amazonaws.com`;
  
  return { environment, tag, region, ecrRegistry, accountId };
}

async function loginToECR(config: Config): Promise<void> {
  // Get ECR login token and login to Docker registry
  const loginCommand = `aws ecr get-login-password --region ${config.region} | docker login --username AWS --password-stdin ${config.ecrRegistry}`;
  
  runCommand(loginCommand, "Logging into ECR");
}

async function pushImages(config: Config): Promise<void> {
  const apiRepoName = process.env.ECR_API_REPO;
  const webRepoName = process.env.ECR_WEB_REPO;
  
  if (!apiRepoName) {
    throw new Error("ECR_API_REPO environment variable not found. Please specify the ECR repository name for the API.");
  }
  
  if (!webRepoName) {
    throw new Error("ECR_WEB_REPO environment variable not found. Please specify the ECR repository name for the Web app.");
  }
  
  const apiImage = `${config.ecrRegistry}/${apiRepoName}`;
  const webImage = `${config.ecrRegistry}/${webRepoName}`;
  
  // Push API images
  runCommand(
    `docker push ${apiImage}:${config.tag}`,
    "Pushing API image with tag"
  );
  
  runCommand(
    `docker push ${apiImage}:latest`,
    "Pushing API image as latest"
  );
  
  // Push Web images
  runCommand(
    `docker push ${webImage}:${config.tag}`,
    "Pushing Web image with tag"
  );
  
  runCommand(
    `docker push ${webImage}:latest`,
    "Pushing Web image as latest"
  );
  
  console.log("");
  console.log("🎉 Successfully published images:");
  console.log(`   API: ${apiImage}:${config.tag}`);
  console.log(`   Web: ${webImage}:${config.tag}`);
}

export async function publish(args: string[]): Promise<void> {
  console.log("🚀 Starting image publish process");
  
  const config = parseConfig(args);
  
  console.log(`📋 Configuration:`);
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Tag: ${config.tag}`);
  console.log(`   Region: ${config.region}`);
  console.log(`   ECR Registry: ${config.ecrRegistry}`);
  console.log("");
  
  await loginToECR(config);
  await pushImages(config);
}