/**
 * Unified Image Lifecycle Management
 * Refactors build.ts, publish.ts, and push-image.ts into a single cohesive framework
 */

import { execSync } from 'child_process';

export type ImageAction = 'build' | 'publish' | 'push' | 'deploy';
export type Component = 'api' | 'web' | 'e2e';
export type Environment = 'sandbox' | 'dev' | 'preprod' | 'prod' | 'pr';

interface BaseConfig {
  environment: Environment;
  tag: string;
  region: string;
  accountId: string;
  ecrRegistry: string;
}

interface BuildConfig extends BaseConfig {
  viteApiUrl: string;
}

interface ImageManifest {
  component: Component;
  localImage: string;
  remoteImage: string;
  dockerfile: string;
  buildArgs?: Record<string, string>;
}

class ImageLifecycleManager {
  private config: BaseConfig;
  private buildConfig: BuildConfig;

  constructor(environment: Environment, tag: string) {
    const region = process.env.AWS_REGION || "us-west-2";
    const accountId = process.env.AWS_ACCOUNT_ID;
    
    if (!accountId) {
      throw new Error("AWS_ACCOUNT_ID environment variable not found. Make sure AWS credentials are configured.");
    }

    const ecrRegistry = `${accountId}.dkr.ecr.${region}.amazonaws.com`;
    const viteApiUrl = process.env.VITE_API_URL || "http://localhost:3000";

    this.config = { environment, tag, region, accountId, ecrRegistry };
    this.buildConfig = { ...this.config, viteApiUrl };
  }

  private runCommand(command: string, description: string): void {
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

  private getImageManifest(component: Component): ImageManifest {
    const repoName = this.getRepoName(component);
    
    const manifests: Record<Component, ImageManifest> = {
      api: {
        component: 'api',
        localImage: `tonys-chips/api:${this.config.tag}`,
        remoteImage: `${this.config.ecrRegistry}/${repoName}:${this.config.tag}`,
        dockerfile: 'docker/api.Dockerfile'
      },
      web: {
        component: 'web',
        localImage: `tonys-chips/web:${this.config.tag}`,
        remoteImage: `${this.config.ecrRegistry}/${repoName}:${this.config.tag}`,
        dockerfile: 'docker/web.Dockerfile',
        buildArgs: {
          VITE_API_URL: this.buildConfig.viteApiUrl
        }
      },
      e2e: {
        component: 'e2e',
        localImage: `tonys-chips/e2e:${this.config.tag}`,
        remoteImage: `${this.config.ecrRegistry}/${repoName}:${this.config.tag}`,
        dockerfile: 'docker/e2e.Dockerfile'
      }
    };

    return manifests[component];
  }

  private getRepoName(component: Component): string {
    const envVars: Record<Component, string> = {
      api: 'ECR_API_REPO',
      web: 'ECR_WEB_REPO',
      e2e: 'ECR_E2E_REPO'
    };

    const repoName = process.env[envVars[component]];
    if (!repoName) {
      throw new Error(`${envVars[component]} environment variable not found. Please specify the ECR repository name for ${component}.`);
    }
    
    return repoName;
  }

  private async loginToECR(): Promise<void> {
    const loginCommand = `aws ecr get-login-password --region ${this.config.region} | docker login --username AWS --password-stdin ${this.config.ecrRegistry}`;
    this.runCommand(loginCommand, "Logging into ECR");
  }

  async buildImage(component: Component): Promise<string> {
    const manifest = this.getImageManifest(component);
    
    let buildCommand = `docker build -f ${manifest.dockerfile}`;
    
    // Add build args if they exist
    if (manifest.buildArgs) {
      for (const [key, value] of Object.entries(manifest.buildArgs)) {
        buildCommand += ` --build-arg ${key}=${value}`;
      }
    }
    
    buildCommand += ` -t ${manifest.remoteImage} .`;
    
    this.runCommand(buildCommand, `Building ${component.toUpperCase()} Docker image`);
    
    return manifest.remoteImage;
  }

  async publishImage(component: Component): Promise<string> {
    const manifest = this.getImageManifest(component);
    
    this.runCommand(
      `docker push ${manifest.remoteImage}`,
      `Pushing ${component.toUpperCase()} image to ECR`
    );
    
    return manifest.remoteImage;
  }

  async pushImage(component: Component): Promise<string> {
    // Build first, then publish
    await this.buildImage(component);
    return await this.publishImage(component);
  }

  async deployImage(component: Component): Promise<string> {
    const manifest = this.getImageManifest(component);
    
    console.log(`⚠️  Deploy action is not yet implemented for ${component.toUpperCase()}`);
    console.log(`   This would deploy image: ${manifest.remoteImage}`);
    console.log(`   Environment: ${this.config.environment}`);
    console.log(`   Tag: ${this.config.tag}`);
    
    throw new Error(`Deploy functionality not yet implemented. Please implement deployment logic for ${component} component.`);
  }

  async executeAction(action: ImageAction, components: Component[]): Promise<void> {
    console.log(`🚀 Starting image ${action} process`);
    console.log(`📋 Configuration:`);
    console.log(`   Environment: ${this.config.environment}`);
    console.log(`   Tag: ${this.config.tag}`);
    console.log(`   Components: ${components.join(', ')}`);
    console.log(`   Region: ${this.config.region}`);
    console.log(`   ECR Registry: ${this.config.ecrRegistry}`);
    
    if (action === 'build') {
      console.log(`   API URL: ${this.buildConfig.viteApiUrl}`);
    }
    
    console.log("");

    // Login to ECR for publish/push actions
    if (action === 'publish' || action === 'push') {
      await this.loginToECR();
    }

    const processedImages: string[] = [];

    for (const component of components) {
      let imageRef: string;

      switch (action) {
        case 'build':
          imageRef = await this.buildImage(component);
          break;
        case 'publish':
          imageRef = await this.publishImage(component);
          break;
        case 'push':
          imageRef = await this.pushImage(component);
          break;
        case 'deploy':
          imageRef = await this.deployImage(component);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      processedImages.push(`${component.toUpperCase()}: ${imageRef}`);
    }

    console.log("");
    console.log(`🎉 Successfully ${action === 'push' ? 'built and published' : `${action}ed`} images:`);
    processedImages.forEach(image => console.log(`   ${image}`));
  }
}

// Main unified interface
export async function manageImageLifecycle(args: string[]): Promise<void> {
  if (args.length < 4) {
    throw new Error("Usage: manage-image-lifecycle <action> <environment> <component> <tag>\nExample: manage-image-lifecycle build sandbox api 20231201120000-abc1234");
  }

  const action = args[0] as ImageAction;
  const environment = args[1] as Environment;
  const componentArg = args[2];
  const tag = args[3];
  
  if (!['build', 'publish', 'push', 'deploy'].includes(action)) {
    throw new Error(`Invalid action: ${action}. Must be 'build', 'publish', 'push', or 'deploy'`);
  }

  if (!['sandbox', 'dev', 'preprod', 'prod', 'pr'].includes(environment)) {
    throw new Error(`Invalid environment: ${environment}. Must be 'sandbox', 'dev', 'preprod', 'prod', or 'pr'`);
  }

  if (!['api', 'web', 'e2e'].includes(componentArg)) {
    throw new Error(`Invalid component: ${componentArg}. Must be 'api', 'web', or 'e2e'`);
  }

  const component = componentArg as Component;
  const manager = new ImageLifecycleManager(environment, tag);
  await manager.executeAction(action, [component]);
}