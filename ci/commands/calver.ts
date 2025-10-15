/**
 * Generate CALVER tag command implementation
 */

import { execSync } from 'child_process';

function runCommand(command: string, description: string): string {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    if (description) {
      console.error(`❌ Failed: ${description}`);
      console.error((error as Error).message);
    }
    throw new Error(`Command failed: ${description || command}`);
  }
}

export async function calver(args: string[]): Promise<void> {
  // Check if we're being called for output capture (silent mode)
  const silent = args.includes('--silent') || process.env.NODE_ENV === 'ci';
  
  if (!silent) {
    console.log("🏷️  Generating CALVER tag");
  }
  
  // Get commit timestamp
  const commitTime = runCommand(
    'git show -s --format=%ci HEAD',
    silent ? '' : 'Getting commit timestamp'
  );
  
  // Get commit SHA
  const commitSha = runCommand(
    'git rev-parse --short HEAD',
    silent ? '' : 'Getting commit SHA'
  );
  
  // Format timestamp: YYYY-MM-DD HH:MM:SS +TIMEZONE -> YYYYMMDD.HHMMSS
  const [date, time] = commitTime.split(' ');
  const formattedDate = date.replace(/-/g, '');
  const formattedTime = time.replace(/:/g, '');
  
  // Generate CALVER tag: YYYYMMDD.HHMMSS.0-sha.SHORTSHA
  const tag = `${formattedDate}.${formattedTime}.0-sha.${commitSha}`;
  
  if (!silent) {
    console.log(`📋 Generated tag: ${tag}`);
  }
  
  // Always output the tag (this is what gets captured)
  console.log(tag);
}