/**
 * Build command implementation
 */

interface Config {
  environment: string;
  tag: string;
  viteApiUrl: string;
}

async function runCommand(command: string[], description: string): Promise<void> {
  console.log(`🔧 ${description}`);
  console.log(`   Command: ${command.join(' ')}`);
  
  const process = new Deno.Command(command[0], {
    args: command.slice(1),
    stdout: "piped",
    stderr: "piped",
  });
  
  const { code, stdout, stderr } = await process.output();
  
  if (code !== 0) {
    console.error(`❌ Failed: ${description}`);
    console.error("STDOUT:", new TextDecoder().decode(stdout));
    console.error("STDERR:", new TextDecoder().decode(stderr));
    throw new Error(`Command failed: ${description}`);
  }
  
  console.log(`✅ Success: ${description}`);
}

function parseConfig(args: string[]): Config {
  if (args.length !== 2) {
    throw new Error("Usage: build <environment> <tag>\nExample: build sandbox 20231201120000-abc1234");
  }
  
  const environment = args[0];
  const tag = args[1];
  const viteApiUrl = Deno.env.get("VITE_API_URL") || "http://localhost:3000";
  
  return { environment, tag, viteApiUrl };
}

async function buildDockerImages(config: Config): Promise<void> {
  const region = Deno.env.get("AWS_REGION") || "us-west-2";
  const accountId = Deno.env.get("AWS_ACCOUNT_ID");
  
  if (!accountId) {
    throw new Error("AWS_ACCOUNT_ID environment variable not found. Make sure AWS credentials are configured.");
  }
  
  const ecrRegistry = `${accountId}.dkr.ecr.${region}.amazonaws.com`;
  const apiImage = `${ecrRegistry}/tonys-chips-api`;
  const webImage = `${ecrRegistry}/tonys-chips-web`;
  
  // Build API image
  await runCommand(
    ["docker", "build", "-f", "docker/api.Dockerfile", "-t", `${apiImage}:${config.tag}`, "."],
    "Building API Docker image"
  );
  
  await runCommand(
    ["docker", "tag", `${apiImage}:${config.tag}`, `${apiImage}:latest`],
    "Tagging API image as latest"
  );
  
  // Build Web image
  await runCommand(
    [
      "docker", "build", 
      "-f", "docker/web.Dockerfile",
      "--build-arg", `VITE_API_URL=${config.viteApiUrl}`,
      "-t", `${webImage}:${config.tag}`,
      "."
    ],
    "Building Web Docker image"
  );
  
  await runCommand(
    ["docker", "tag", `${webImage}:${config.tag}`, `${webImage}:latest`],
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