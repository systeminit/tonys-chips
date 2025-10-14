/**
 * Generate CALVER tag command implementation
 */

import { execSync } from 'child_process';

function runCommand(command: string, description: string): string {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`❌ Failed: ${description}`);
    console.error((error as Error).message);
    throw new Error(`Command failed: ${description}`);
  }
}

export async function calver(args: string[]): Promise<void> {
  console.log("🏷️  Generating CALVER tag");
  
  // Get commit timestamp
  const commitTime = runCommand(
    'git show -s --format=%ci HEAD',
    'Getting commit timestamp'
  );
  
  // Get commit SHA
  const commitSha = runCommand(
    'git rev-parse --short HEAD',
    'Getting commit SHA'
  );
  
  // Format timestamp: YYYY-MM-DD HH:MM:SS +TIMEZONE -> YYYYMMDD.HHMMSS
  const [date, time] = commitTime.split(' ');
  const formattedDate = date.replace(/-/g, '');
  const formattedTime = time.replace(/:/g, '');
  
  // Generate CALVER tag: YYYYMMDD.HHMMSS.0-sha.SHORTSHA
  const tag = `${formattedDate}.${formattedTime}.0-sha.${commitSha}`;
  
  console.log(`📋 Generated tag: ${tag}`);
  console.log(tag); // Output for capture
}