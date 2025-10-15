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

function parseConfig(args: string[]): Config & { components: string[] } {
  if (args.length < 3) {
    throw new Error("Usage: publish <environment> <component> <tag>\nExample: publish sandbox api 20231201120000-abc1234");
  }
  
  const environment = args[0];
  const componentArg = args[1];
  const tag = args[2];
  const region = process.env.AWS_REGION || "us-west-2";
  
  const accountId = process.env.AWS_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("AWS_ACCOUNT_ID environment variable not found. Make sure AWS credentials are configured.");
  }
  
  const ecrRegistry = `${accountId}.dkr.ecr.${region}.amazonaws.com`;
  
  // Parse component
  const components = [];
  if (componentArg === 'api') {
    components.push('api');
  } else if (componentArg === 'web') {
    components.push('web');
  } else if (componentArg === 'e2e') {
    components.push('e2e');
  } else {
    throw new Error(`Invalid component: ${componentArg}. Must be 'api', 'web', or 'e2e'`);
  }

  return { environment, tag, region, ecrRegistry, accountId, components };
}

async function loginToECR(config: Config): Promise<void> {
  // Get ECR login token and login to Docker registry
  const loginCommand = `aws ecr get-login-password --region ${config.region} | docker login --username AWS --password-stdin ${config.ecrRegistry}`;
  
  runCommand(loginCommand, "Logging into ECR");
}

async function pushImages(config: Config & { components: string[] }): Promise<void> {
  const publishedImages: string[] = [];
  
  // Push API images if requested
  if (config.components.includes('api')) {
    const apiRepoName = process.env.ECR_API_REPO;
    
    if (!apiRepoName) {
      throw new Error("ECR_API_REPO environment variable not found. Please specify the ECR repository name for the API.");
    }
    
    const apiImage = `${config.ecrRegistry}/${apiRepoName}`;
    
    runCommand(
      `docker push ${apiImage}:${config.tag}`,
      "Pushing API image with tag"
    );
    
    publishedImages.push(`API: ${apiImage}:${config.tag}`);
  }
  
  // Push Web images if requested
  if (config.components.includes('web')) {
    const webRepoName = process.env.ECR_WEB_REPO;

    if (!webRepoName) {
      throw new Error("ECR_WEB_REPO environment variable not found. Please specify the ECR repository name for the Web app.");
    }

    const webImage = `${config.ecrRegistry}/${webRepoName}`;

    runCommand(
      `docker push ${webImage}:${config.tag}`,
      "Pushing Web image with tag"
    );

    publishedImages.push(`Web: ${webImage}:${config.tag}`);
  }

  // Push E2E images if requested
  if (config.components.includes('e2e')) {
    const e2eRepoName = process.env.ECR_E2E_REPO;

    if (!e2eRepoName) {
      throw new Error("ECR_E2E_REPO environment variable not found. Please specify the ECR repository name for E2E tests.");
    }

    const e2eImage = `${config.ecrRegistry}/${e2eRepoName}`;

    runCommand(
      `docker push ${e2eImage}:${config.tag}`,
      "Pushing E2E image with tag"
    );

    publishedImages.push(`E2E: ${e2eImage}:${config.tag}`);
  }

  console.log("");
  console.log("🎉 Successfully published images:");
  publishedImages.forEach(image => console.log(`   ${image}`));
}

export async function publish(args: string[]): Promise<void> {
  console.log("🚀 Starting image publish process");
  
  const config = parseConfig(args);
  
  console.log(`📋 Configuration:`);
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Tag: ${config.tag}`);
  console.log(`   Components: ${config.components.join(', ')}`);
  console.log(`   Region: ${config.region}`);
  console.log(`   ECR Registry: ${config.ecrRegistry}`);
  console.log("");
  
  await loginToECR(config);
  await pushImages(config);
}