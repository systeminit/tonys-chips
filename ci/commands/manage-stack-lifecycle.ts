/**
 * Manage stack lifecycle command implementation
 * Creates or destroys System Initiative environments with EC2 instances
 * Based on their version/calver tag
 */

import * as fs from "fs/promises";
import { randomUUID } from "crypto";
import { SystemInitiativeClient } from "../lib/system-initiative-client.js";

class StackLifecycleManager extends SystemInitiativeClient {
  async stackUp(
    version: string,
    branchName: string,
    prNumber?: string,
  ): Promise<void> {
    let changeSetId: string | null = null;

    try {
      console.log("🚀 Starting System Initiative Environment Setup");

      // First, destroy any existing components for this branch
      console.log(
        `🔍 Checking for existing components for branch ${branchName}...`,
      );
      const existingInstances = await this.searchComponentsByBranch(
        branchName,
        "AWS::EC2::Instance",
      );
      const existingUserData = await this.searchComponentsByBranch(
        branchName,
        "Userdata",
      );
      const existingComponents = [...existingInstances, ...existingUserData];

      if (existingComponents.length > 0) {
        console.log(
          `Found ${existingComponents.length} existing component(s) for branch ${branchName}. Cleaning up...`,
        );

        // Post PR comment about environment refresh if PR number is provided
        if (prNumber) {
          console.log(
            `📝 Posting environment refresh comment to PR #${prNumber}`,
          );
          try {
            await this.postEnvironmentRefreshComment(prNumber, branchName);
          } catch (error) {
            console.warn(`⚠️  Failed to post PR comment: ${error}`);
          }
        }

        await this.stackDown(branchName);
        console.log("✅ Cleanup complete. Proceeding with new deployment...\n");
      } else {
        console.log(
          `✅ No existing components found for branch ${branchName}. Proceeding with deployment...\n`,
        );
      }

      const environmentUuid = randomUUID();
      const changeSetName = `Environment ${environmentUuid} - v${version}`;
      console.log(`Creating change set: ${changeSetName}`);

      try {
        const changeSetData = await this.createChangeSet(changeSetName);
        changeSetId = changeSetData.changeSet.id;
        console.log(`Created ChangeSet ID: ${changeSetId}`);
      } catch (e) {
        const errorMsg = `Failed to create change set '${changeSetName}': ${e}`;
        await this.writeErrorToFile(errorMsg);
        console.error(errorMsg);
        process.exit(1);
      }

      if (!changeSetId) {
        throw new Error("Failed to create change set");
      }

      // Read the userdata.sh file
      console.log("Reading userdata.sh file...");
      const provisionScriptPath =
        new URL("./userdata.sh", import.meta.url).pathname;
      let userDataScript: string;
      try {
        userDataScript = await fs.readFile(provisionScriptPath, "utf-8");
        console.log("✅ userdata.sh loaded successfully");
      } catch (e) {
        const errorMsg = `Failed to read userdata.sh: ${e}`;
        await this.writeErrorToFile(errorMsg);
        console.error(errorMsg);
        process.exit(1);
      }

      // Replace the placeholder IMAGE_TAG with the actual version
      userDataScript = userDataScript.replace(
        'IMAGE_TAG="{{IMAGE_TAG}}"',
        `IMAGE_TAG="${version}"`,
      );

      // Create UserData component
      console.log("Creating Userdata component...");
      const userDataOptions = {
        attributes: {
          "/domain/userdataContent": userDataScript,
          "/si/tags": {
            "Key": "Branch",
            "Value": branchName,
          },
        },
        viewName: "Environments",
      };

      try {
        await this.createComponent(
          changeSetId,
          "Userdata",
          `tonys-chips-userdata-${environmentUuid}-${version}`,
          userDataOptions,
        );

        console.log("✅ Userdata component created");
      } catch (e) {
        const errorMsg = `Failed to create Userdata component: ${e}`;
        await this.writeErrorToFile(errorMsg);
        console.error(errorMsg);
        process.exit(1);
      }

      const ec2Options = {
        attributes: {
          "/domain/InstanceType": "t3.small",
          "/domain/BlockDeviceMappings/0": {
            "DeviceName": "/dev/sda1",
            "Ebs": {
              "DeleteOnTermination": true,
              "VolumeSize": 20,
              "VolumeType": "gp3",
            },
          },
          "/domain/Tags/0": {
            "Key": "Name",
            "Value": `tc-validation-${version}`,
          },
          "/domain/Tags/1": {
            "Key": "Version",
            "Value": version,
          },
          "/domain/Tags/2": {
            "Key": "Branch",
            "Value": branchName,
          },
          "/domain/SecurityGroupIds/0": {
            "$source": {
              "component": "tonys-chips-api-sg",
              "path": "/resource_value/GroupId",
            },
          },
          "/domain/ImageId": {
            "$source": {
              "component": "amazon-linux-ami",
              "path": "/domain/ImageId",
            },
          },
          "/domain/SubnetId": {
            "$source": {
              "component": "sandbox-default-subnet-us-east-1d",
              "path": "/resource_value/SubnetId",
            },
          },
          "/domain/KeyName": {
            "$source": {
              "component": "tonys-chips-ssh-key",
              "path": "/domain/KeyName",
            },
          },
          "/domain/extra/Region": {
            "$source": {
              "component": "us-east-1",
              "path": "/domain/region",
            },
          },
          "/domain/UserData": {
            "$source": {
              "component": `tonys-chips-userdata-${environmentUuid}-${version}`,
              "path": "/domain/userdataContentBase64",
            },
          },
          "/domain/IamInstanceProfile": {
            "$source": {
              "component": "ec2-ecr-pull-instance-profile",
              "path": "/domain/InstanceProfileName",
            },
          },
          "/secrets/AWS Credential": {
            "$source": {
              "component": "sandbox",
              "path": "/secrets/AWS Credential",
            },
          },
        },
        viewName: "Environments",
      };

      console.log("Creating EC2 instance component...");
      let ec2ComponentId: string;
      try {
        const ec2Data = await this.createComponent(
          changeSetId,
          "AWS::EC2::Instance",
          `${environmentUuid}-${version}`,
          ec2Options,
        );

        ec2ComponentId = ec2Data.component.id;
        console.log(`EC2 component ID: ${ec2ComponentId}`);
      } catch (e) {
        const errorMsg = `Failed to create EC2 instance component: ${e}`;
        await this.writeErrorToFile(errorMsg);
        console.error(errorMsg);
        process.exit(1);
      }

      console.log(`Force applying change set ${changeSetId}...`);
      try {
        await this.forceApplyChangeSet(changeSetId);
      } catch (e) {
        const errorMsg = `Failed to apply change set: ${e}`;
        await this.writeErrorToFile(errorMsg);
        console.error(errorMsg);
        process.exit(1);
      }

      console.log("Waiting for actions to complete...");
      const success = await this.waitForMergeSuccess(changeSetId);

      if (!success) {
        try {
          await fs.access("./error");
        } catch {
          await this.writeErrorToFile(
            "Deployment actions failed - check logs for details",
          );
        }
        console.log("❌ Actions failed. Exiting.");
        process.exit(1);
      }

      console.log("All actions completed successfully...");

      const baseChangeSetId = "head";
      console.log("Querying for public IP...");
      const ipOutputFile = "./ip";

      try {
        const publicIp = await this.getPublicIp(
          baseChangeSetId,
          ec2ComponentId,
          120,
          5,
        );
        console.log(`Instance is reachable at: ${publicIp}`);
        await fs.writeFile(ipOutputFile, publicIp);
      } catch (e) {
        const errorMsg = `Failed to retrieve or save public IP: ${e}`;
        await this.writeErrorToFile(errorMsg);
        console.error(errorMsg);
        process.exit(1);
      }
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes("timeout")) {
          const errorMsg = `Deployment timeout: ${e.message}`;
          await this.writeErrorToFile(errorMsg);
          console.error(errorMsg);
        } else if (e.message.includes("HTTP")) {
          const errorMsg = `HTTP Error during deployment: ${e.message}`;
          await this.writeErrorToFile(errorMsg);
          console.error(errorMsg);
        } else {
          const errorMsg = `Unexpected deployment error: ${e.message}`;
          await this.writeErrorToFile(errorMsg);
          console.error(errorMsg);
        }
      }
      process.exit(1);
    } finally {
      if (changeSetId) {
        try {
          const response = await this.getChangeSet(changeSetId);
          if (response.ok) {
            console.log(`Cleaning up change set ${changeSetId}...`);
            await this.deleteChangeSet(changeSetId);
            console.log("Change set deleted.");
          }
        } catch (cleanupErr) {
          console.error(`Failed to cleanup change set: ${cleanupErr}`);
        }
      }
    }
  }

  async stackDown(branchName: string): Promise<void> {
    let changeSetId: string | null = null;

    try {
      console.log("🔥 Starting System Initiative Environment Teardown");
      console.log(`📋 Branch: ${branchName}`);
      console.log("");

      // Search for instances by branch name
      const instancesToDelete = await this.searchComponentsByBranch(
        branchName,
        "AWS::EC2::Instance",
      );

      if (instancesToDelete.length === 0) {
        console.log(
          `✅ No components found for branch ${branchName} - nothing to clean up`,
        );
        return;
      }

      // Search for userData components by branch name
      const userDataComponentsToDelete = await this.searchComponentsByBranch(
        branchName,
        "Userdata",
      );

      const changeSetName = `Teardown Branch ${branchName} - ${
        new Date().toISOString()
      }`;
      console.log(`Creating teardown change set: ${changeSetName}`);

      try {
        const changeSetData = await this.createChangeSet(changeSetName);
        changeSetId = changeSetData.changeSet.id;
        console.log(`Created ChangeSet ID: ${changeSetId}`);
      } catch (e) {
        const errorMsg =
          `Failed to create teardown change set '${changeSetName}': ${e}`;
        await this.writeErrorToFile(errorMsg);
        console.error(errorMsg);
        process.exit(1);
      }

      if (!changeSetId) {
        throw new Error("Failed to create change set");
      }

      // Delete each instance found
      console.log(`🗑️  Deleting ${instancesToDelete.length} component(s)...`);
      for (const comp of instancesToDelete) {
        console.log(`Deleting component: ${comp.name} (${comp.id})`);
        try {
          await this.deleteComponent(changeSetId, comp.id);
          console.log(`✅ Component ${comp.name} queued for deletion`);
        } catch (e) {
          console.error(`❌ Failed to delete component ${comp.name}: ${e}`);
        }
      }

      // Delete each userData found
      console.log(
        `🗑️  Deleting ${userDataComponentsToDelete.length} component(s)...`,
      );
      for (const comp of userDataComponentsToDelete) {
        console.log(`Deleting component: ${comp.name} (${comp.id})`);
        try {
          await this.deleteComponent(changeSetId, comp.id);
          console.log(`✅ Component ${comp.name} queued for deletion`);
        } catch (e) {
          console.error(`❌ Failed to delete component ${comp.name}: ${e}`);
        }
      }

      console.log(`Force applying teardown change set ${changeSetId}...`);
      try {
        await this.forceApplyChangeSet(changeSetId);
      } catch (e) {
        const errorMsg = `Failed to apply teardown change set: ${e}`;
        await this.writeErrorToFile(errorMsg);
        console.error(errorMsg);
        process.exit(1);
      }

      console.log("Waiting for teardown actions to complete...");
      const success = await this.waitForMergeSuccess(changeSetId);

      if (!success) {
        try {
          await fs.access("./error");
        } catch {
          await this.writeErrorToFile(
            "Teardown actions failed - check logs for details",
          );
        }
        console.log("❌ Teardown actions failed. Exiting.");
        process.exit(1);
      }

      console.log("✅ All teardown actions completed successfully");

      // Clean up local files
      try {
        await fs.unlink("./ip");
        console.log("Removed IP file");
      } catch (e) {
        // File might not exist, that's fine
      }
    } catch (e) {
      if (e instanceof Error) {
        const errorMsg = `Teardown error: ${e.message}`;
        await this.writeErrorToFile(errorMsg);
        console.error(errorMsg);
      }
      process.exit(1);
    } finally {
      if (changeSetId) {
        try {
          const response = await this.getChangeSet(changeSetId);
          if (response.ok) {
            console.log(`Cleaning up teardown change set ${changeSetId}...`);
            await this.deleteChangeSet(changeSetId);
            console.log("Teardown change set deleted.");
          }
        } catch (cleanupErr) {
          console.error(`Failed to cleanup teardown change set: ${cleanupErr}`);
        }
      }
    }
  }

  private async postEnvironmentRefreshComment(
    prNumber: string,
    branchName: string,
  ): Promise<void> {
    const { spawn } = await import("child_process");

    return new Promise((resolve, reject) => {
      const childProcess = spawn("npm", [
        "run",
        "ci:post-to-pr",
        "--",
        "environment-refresh",
        prNumber,
        branchName,
      ], {
        env: {
          ...process.env,
          GITHUB_TOKEN: process.env.GITHUB_TOKEN,
          GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
        },
        stdio: "inherit",
      });

      childProcess.on("close", (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`PR comment command failed with exit code ${code}`));
        }
      });

      childProcess.on("error", (error: Error) => {
        reject(
          new Error(`Failed to spawn PR comment process: ${error.message}`),
        );
      });
    });
  }
}

export async function manageStackLifecycle(args: string[]): Promise<void> {
  if (args.length < 3) {
    console.error("❌ Missing required arguments");
    console.error(
      "Usage: manage-stack-lifecycle <up|down> <version> <branch-name> [pr-number]",
    );
    console.error(
      "Example: manage-stack-lifecycle up 20241015.143022.0-sha.abc1234 feat/new-feature",
    );
    console.error(
      "Example: manage-stack-lifecycle up 20241015.143022.0-sha.abc1234 feat/new-feature 123",
    );
    process.exit(1);
  }

  const [operation, version, branchName, prNumber] = args;

  if (!["up", "down"].includes(operation)) {
    console.error("❌ Invalid operation. Must be 'up' or 'down'");
    console.error(
      "Usage: manage-stack-lifecycle <up|down> <version> <branch-name> [pr-number]",
    );
    process.exit(1);
  }

  console.log(`🚀 Starting System Initiative stack lifecycle management`);
  console.log(`📋 Operation: ${operation}`);
  console.log(`📋 Version: ${version}`);
  console.log(`📋 Branch: ${branchName}`);
  console.log("");

  const client = new StackLifecycleManager();

  if (operation === "up") {
    await client.stackUp(version, branchName, prNumber);
  } else {
    await client.stackDown(branchName);
  }
}