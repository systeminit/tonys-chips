#!/usr/bin/env -S deno run --allow-run --allow-read --allow-env

/**
 * Centralized CI orchestration entry point
 * Usage: deno run --allow-run --allow-read --allow-env main.ts <command> [args...]
 */

import { pushImage } from "./commands/push-image.ts";
import { build } from "./commands/build.ts";
import { publish } from "./commands/publish.ts";
import { calver } from "./commands/calver.ts";
import { checkPostgres } from "./commands/check-postgres.ts";

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
    description: "Build Docker images",
    usage: "build <environment> <tag>",
    execute: build,
  },
  {
    name: "publish",
    description: "Publish Docker images to ECR",
    usage: "publish <environment> <tag>",
    execute: publish,
  },
  {
    name: "push-image",
    description: "Build and push Docker images to ECR (combined)",
    usage: "push-image <environment> <tag>",
    execute: pushImage,
  },
];

function showHelp() {
  console.log("🚀 Tony's Chips CI Orchestration Tool");
  console.log("");
  console.log("Usage: deno run --allow-run --allow-read --allow-env main.ts <command> [args...]");
  console.log("");
  console.log("Available commands:");
  
  for (const cmd of commands) {
    console.log(`  ${cmd.name.padEnd(12)} - ${cmd.description}`);
    console.log(`  ${" ".repeat(12)}   Usage: ${cmd.usage}`);
    console.log("");
  }
  
  console.log("Examples:");
  console.log("  main.ts push-image sandbox 20231201120000-abc1234");
  console.log("");
}

async function main() {
  const args = Deno.args;
  
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
    Deno.exit(1);
  }
  
  try {
    console.log(`🔧 Executing: ${command.name}`);
    console.log(`📋 Arguments: [${commandArgs.join(", ")}]`);
    console.log("");
    
    await command.execute(commandArgs);
    
    console.log("");
    console.log(`✅ Command '${command.name}' completed successfully`);
  } catch (error) {
    console.error(`❌ Command '${command.name}' failed:`);
    console.error(error.message);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}