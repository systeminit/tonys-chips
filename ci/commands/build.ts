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

function parseConfig(args: string[]): Config & { components: string[] } {
  if (args.length < 3) {
    throw new Error("Usage: build <environment> <component> <tag>\nExample: build sandbox api 20231201120000-abc1234");
  }
  
  const environment = args[0];
  const componentArg = args[1];
  const tag = args[2];
  const viteApiUrl = process.env.VITE_API_URL || "http://localhost:3000";
  
  // Parse component
  const components = [];
  if (componentArg === 'api') {
    components.push('api');
  } else if (componentArg === 'web') {
    components.push('web');
  } else {
    throw new Error(`Invalid component: ${componentArg}. Must be 'api' or 'web'`);
  }
  
  return { environment, tag, viteApiUrl, components };
}

async function buildDockerImages(config: Config & { components: string[] }): Promise<void> {
  const region = process.env.AWS_REGION || "us-west-2";
  const accountId = process.env.AWS_ACCOUNT_ID;
  
  if (!accountId) {
    throw new Error("AWS_ACCOUNT_ID environment variable not found. Make sure AWS credentials are configured.");
  }
  
  const ecrRegistry = `${accountId}.dkr.ecr.${region}.amazonaws.com`;
  const builtImages: string[] = [];
  
  // Build API image if requested
  if (config.components.includes('api')) {
    const apiRepoName = process.env.ECR_API_REPO;
    
    if (!apiRepoName) {
      throw new Error("ECR_API_REPO environment variable not found. Please specify the ECR repository name for the API.");
    }
    
    const apiImage = `${ecrRegistry}/${apiRepoName}`;
    
    runCommand(
      `docker build -f docker/api.Dockerfile -t ${apiImage}:${config.tag} .`,
      "Building API Docker image"
    );
    
    builtImages.push(`API: ${apiImage}:${config.tag}`);
  }
  
  // Build Web image if requested
  if (config.components.includes('web')) {
    const webRepoName = process.env.ECR_WEB_REPO;
    
    if (!webRepoName) {
      throw new Error("ECR_WEB_REPO environment variable not found. Please specify the ECR repository name for the Web app.");
    }
    
    const webImage = `${ecrRegistry}/${webRepoName}`;
    
    runCommand(
      `docker build -f docker/web.Dockerfile --build-arg VITE_API_URL=${config.viteApiUrl} -t ${webImage}:${config.tag} .`,
      "Building Web Docker image"
    );
    
    builtImages.push(`Web: ${webImage}:${config.tag}`);
  }
  
  console.log("");
  console.log("🎉 Successfully built Docker images:");
  builtImages.forEach(image => console.log(`   ${image}`));
}

export async function build(args: string[]): Promise<void> {
  console.log("🚀 Starting Docker image build process");
  
  const config = parseConfig(args);
  
  console.log(`📋 Configuration:`);
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Tag: ${config.tag}`);
  console.log(`   Components: ${config.components.join(', ')}`);
  console.log(`   API URL: ${config.viteApiUrl}`);
  console.log("");
  
  await buildDockerImages(config);
}