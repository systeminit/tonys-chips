/**
 * E2E test command implementation
 * Runs E2E tests in Docker container
 */

import { execSync } from 'child_process';

export async function testE2e(args: string[]): Promise<void> {
  console.log("🧪 Running E2E tests in Docker");
  console.log("");

  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const webUrl = process.env.WEB_URL || 'http://localhost:8080';

  console.log(`📋 Configuration:`);
  console.log(`   API URL: ${apiUrl}`);
  console.log(`   Web URL: ${webUrl}`);
  console.log("");

  const command = `docker run --rm --network host -e API_URL=${apiUrl} -e WEB_URL=${webUrl} tonys-chips-e2e:latest`;

  try {
    execSync(command, { stdio: 'inherit' });
    console.log("");
    console.log("✅ E2E tests passed");
  } catch (error) {
    console.error("");
    console.error("❌ E2E tests failed");
    throw error;
  }
}
