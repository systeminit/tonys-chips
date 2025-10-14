/**
 * Publish command implementation
 */

interface Config {
  environment: string;
  tag: string;
  region: string;
  ecrRegistry: string;
  accountId: string;
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
    throw new Error("Usage: publish <environment> <tag>\nExample: publish sandbox 20231201120000-abc1234");
  }
  
  const environment = args[0];
  const tag = args[1];
  const region = Deno.env.get("AWS_REGION") || "us-west-2";
  
  const accountId = Deno.env.get("AWS_ACCOUNT_ID");
  if (!accountId) {
    throw new Error("AWS_ACCOUNT_ID environment variable not found. Make sure AWS credentials are configured.");
  }
  
  const ecrRegistry = `${accountId}.dkr.ecr.${region}.amazonaws.com`;
  
  return { environment, tag, region, ecrRegistry, accountId };
}

async function loginToECR(config: Config): Promise<void> {
  // Get ECR login token
  const loginProcess = new Deno.Command("aws", {
    args: ["ecr", "get-login-password", "--region", config.region],
    stdout: "piped",
    stderr: "piped",
  });
  
  const { code, stdout, stderr } = await loginProcess.output();
  
  if (code !== 0) {
    console.error("Failed to get ECR login token");
    console.error("STDERR:", new TextDecoder().decode(stderr));
    throw new Error("ECR login failed");
  }
  
  const loginToken = new TextDecoder().decode(stdout).trim();
  
  // Login to Docker registry
  const dockerProcess = new Deno.Command("docker", {
    args: ["login", "--username", "AWS", "--password-stdin", config.ecrRegistry],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  
  const dockerCmd = dockerProcess.spawn();
  
  // Write password to stdin
  const writer = dockerCmd.stdin.getWriter();
  await writer.write(new TextEncoder().encode(loginToken));
  await writer.close();
  
  const dockerResult = await dockerCmd.output();
  
  if (dockerResult.code !== 0) {
    console.error("Docker login failed");
    console.error("STDERR:", new TextDecoder().decode(dockerResult.stderr));
    throw new Error("Docker ECR login failed");
  }
  
  console.log("✅ Successfully logged into ECR");
}

async function pushImages(config: Config): Promise<void> {
  const apiImage = `${config.ecrRegistry}/tonys-chips-api`;
  const webImage = `${config.ecrRegistry}/tonys-chips-web`;
  
  // Push API images
  await runCommand(
    ["docker", "push", `${apiImage}:${config.tag}`],
    "Pushing API image with tag"
  );
  
  await runCommand(
    ["docker", "push", `${apiImage}:latest`],
    "Pushing API image as latest"
  );
  
  // Push Web images
  await runCommand(
    ["docker", "push", `${webImage}:${config.tag}`],
    "Pushing Web image with tag"
  );
  
  await runCommand(
    ["docker", "push", `${webImage}:latest`],
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