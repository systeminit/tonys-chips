#!/usr/bin/env tsx

/**
 * Centralized CI orchestration entry point
 * Usage: tsx ci/main.ts <command> [args...]
 */

import { calver } from './commands/calver.js';
import { checkPostgres } from './commands/check-postgres.js';
import { build } from './commands/build.js';
import { publish } from './commands/publish.js';
import { pushImage } from './commands/push-image.js';
import { buildLocal } from './commands/build-local.js';
import { testE2e } from './commands/test-e2e.js';

interface Command {
  name: string;
  description: string;
  usage: string;
  execute: (args: string[]) => Promise<void>;
}

const commands: Command[] = [
  {
    name: "calver",
    description: "Generate CALVER tag from git commit",
    usage: "calver",
    execute: calver,
  },
  {
    name: "check-postgres",
    description: "Check PostgreSQL service readiness",
    usage: "check-postgres <environment> [timeout-seconds]",
    execute: checkPostgres,
  },
  {
    name: "build",
    description: "Build Docker images for deployment",
    usage: "build <environment> <component> <tag>  (component: api|web|e2e)",
    execute: build,
  },
  {
    name: "publish",
    description: "Publish Docker images to ECR",
    usage: "publish <environment> <component> <tag>  (component: api|web|e2e)",
    execute: publish,
  },
  {
    name: "push-image",
    description: "Build and push Docker image to ECR (combined build + publish)",
    usage: "push-image <environment> <component> <tag>  (component: api|web|e2e)",
    execute: pushImage,
  },
  {
    name: "build-local",
    description: "Build Docker images for local development (latest tag)",
    usage: "build-local [all|api|web|e2e]",
    execute: buildLocal,
  },
  {
    name: "test-e2e",
    description: "Run E2E tests in Docker container",
    usage: "test-e2e",
    execute: testE2e,
  },
];

function showHelp() {
  console.log("🚀 Tony's Chips CI Orchestration Tool");
  console.log("");
  console.log("Usage: tsx ci/main.ts <command> [args...]");
  console.log("");
  console.log("Available commands:");
  
  for (const cmd of commands) {
    console.log(`  ${cmd.name.padEnd(12)} - ${cmd.description}`);
    console.log(`  ${" ".repeat(12)}   Usage: ${cmd.usage}`);
    console.log("");
  }
  
  console.log("Examples:");
  console.log("  tsx ci/main.ts calver");
  console.log("  tsx ci/main.ts build-local all");
  console.log("  tsx ci/main.ts test-e2e");
  console.log("  tsx ci/main.ts push-image sandbox 20231201120000-abc1234");
  console.log("");
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    showHelp();
    return;
  }
  
  const commandName = args[0];
  const commandArgs = args.slice(1);
  
  const command = commands.find(cmd => cmd.name === commandName);
  
  if (!command) {
    console.error(`❌ Unknown command: ${commandName}`);
    console.error("");
    showHelp();
    process.exit(1);
  }
  
  try {
    // Check if running in CI/silent mode
    const silent = process.argv.includes('--silent') || process.env.CI === 'true';
    
    if (!silent) {
      console.log(`🔧 Executing: ${command.name}`);
      console.log(`📋 Arguments: [${commandArgs.join(", ")}]`);
      console.log("");
    }
    
    await command.execute(commandArgs);
    
    if (!silent) {
      console.log("");
      console.log(`✅ Command '${command.name}' completed successfully`);
    }
  } catch (error) {
    console.error(`❌ Command '${command.name}' failed:`);
    console.error((error as Error).message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});