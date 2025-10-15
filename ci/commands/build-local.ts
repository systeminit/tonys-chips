/**
 * Local Docker build command implementation
 * Builds images with the 'latest' tag for local development
 */

import { execSync } from "child_process";

function runCommand(command: string, description: string): void {
  console.log(`🔧 ${description}`);
  console.log(`   Command: ${command}`);

  try {
    execSync(command, { stdio: "inherit" });
    console.log(`✅ Success: ${description}`);
  } catch (error) {
    console.error(`❌ Failed: ${description}`);
    throw new Error(`Command failed: ${description}`);
  }
}

export async function buildLocal(args: string[]): Promise<void> {
  console.log("🚀 Building Docker images for local development");
  console.log("");

  const component = args[0] || "all";

  const validComponents = ["all", "api", "web", "e2e"];
  if (!validComponents.includes(component)) {
    throw new Error(
      `Invalid component: ${component}. Must be one of: ${
        validComponents.join(", ")
      }`,
    );
  }

  const builtImages: string[] = [];

  // Build API image
  if (component === "all" || component === "api") {
    runCommand(
      "docker build -f docker/api.Dockerfile -t tonys-chips/api:latest .",
      "Building API Docker image",
    );
    builtImages.push("tonys-chips/api:latest");
  }

  // Build Web image
  if (component === "all" || component === "web") {
    runCommand(
      "docker build -f docker/web.Dockerfile -t tonys-chips/web:latest .",
      "Building Web Docker image",
    );
    builtImages.push("tonys-chips/web:latest");
  }

  // Build E2E image
  if (component === "all" || component === "e2e") {
    runCommand(
      "docker build -f docker/e2e.Dockerfile -t tonys-chips/e2e:latest .",
      "Building E2E test Docker image",
    );
    builtImages.push("tonys-chips/e2e:latest");
  }

  console.log("");
  console.log("🎉 Successfully built Docker images:");
  builtImages.forEach((image) => console.log(`   ${image}`));
  console.log("");
  console.log("💡 Next steps:");
  console.log("   Start services: npm run docker:up");
  console.log("   Or use:         docker-compose up");
}
