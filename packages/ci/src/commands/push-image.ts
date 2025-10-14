/**
 * Push image command implementation (combines build + publish)
 */

import { build } from './build.js';
import { publish } from './publish.js';

export async function pushImage(args: string[]): Promise<void> {
  console.log("🚀 Starting combined build and push process");
  
  // Build images first
  await build(args);
  
  console.log("");
  console.log("📤 Now publishing images...");
  console.log("");
  
  // Then publish them
  await publish(args);
}