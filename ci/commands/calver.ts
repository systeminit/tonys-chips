/**
 * Generate CALVER tag command implementation
 */

async function runCommand(command: string[], description: string): Promise<string> {
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
  
  return new TextDecoder().decode(stdout).trim();
}

export async function calver(args: string[]): Promise<void> {
  console.log("🏷️  Generating CALVER tag");
  
  // Get commit timestamp
  const commitTime = await runCommand(
    ["git", "show", "-s", "--format=%ci", "HEAD"],
    "Getting commit timestamp"
  );
  
  // Get commit SHA
  const commitSha = await runCommand(
    ["git", "rev-parse", "--short", "HEAD"],
    "Getting commit SHA"
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