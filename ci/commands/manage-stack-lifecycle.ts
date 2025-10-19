/**
 * Manage stack lifecycle command implementationts
 * Creates or destroys System Initiative environments with EC2 instances
 * Based on their version/calver tag
 */

import * as fs from "fs/promises";
import { randomUUID } from "crypto";

class SystemInitiativeClient {
  private apiToken: string;
  private workspaceId: string;
  private apiUrl = "https://api.systeminit.com";

  constructor() {
    this.apiToken = process.env.SI_API_TOKEN || "";
    this.workspaceId = process.env.SI_WORKSPACE_ID || "";

    if (!this.apiToken || !this.workspaceId) {
      throw new Error(
        "Missing required environment variables: SI_API_TOKEN or SI_WORKSPACE_ID",
      );
    }
  }

  private get headers() {
    return {
      "Authorization": `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  private async fetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });
    return response;
  }

  async writeErrorToFile(errorMessage: string): Promise<void> {
    try {
      await fs.writeFile("./error", errorMessage);
    } catch (e) {
      console.error(`Failed to write error to file: ${e}`);
    }
  }

  async getActionLogs(changeSetId: string, funcRunId: string): Promise<any[]> {
    try {
      const response = await this.fetch(
        `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/funcs/runs/${funcRunId}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const logsData = await response.json() as any;
      const funcRun = logsData.funcRun || {};

      if (funcRun.logs && funcRun.logs.logs) {
        return funcRun.logs.logs;
      }

      return [];
    } catch (e) {
      console.error(
        `❌ Failed to retrieve logs for func run ${funcRunId}: ${e}`,
      );
      return [];
    }
  }

  async waitForMergeSuccess(
    changeSetId: string,
    timeoutSeconds = 300,
    pollInterval = 10,
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutSeconds * 1000) {
      const response = await this.fetch(
        `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/merge_status`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const mergeData = await response.json() as any;
      const changeSet = mergeData.changeSet || {};
      const actions = mergeData.actions || [];

      if (actions.length === 0) {
        if (changeSet.status === "Applied") {
          console.log("✅ Change set applied with no actions remaining.");
          return true;
        } else {
          console.log(
            `⏳ No actions found. Change set status: ${changeSet.status}. Waiting...`,
          );
        }
      } else {
        const states = actions.map((action: any) => action.state);

        if (states.every((state: string) => state === "Success")) {
          console.log("✅ All actions succeeded.");
          return true;
        } else {
          const failedActions = actions.filter((action: any) =>
            action.state === "Failed"
          );

          if (failedActions.length > 0) {
            console.log(
              `❌ ${failedActions.length} action(s) failed. Outputting logs:`,
            );

            for (const action of failedActions) {
              console.log(
                `\n--- Logs for failed action: ${
                  action.displayName || action.name || "Unknown"
                } ---`,
              );

              let funcRunId = action.funcRunId;

              if (!funcRunId) {
                try {
                  const actionResponse = await this.fetch(
                    `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/actions`,
                  );

                  if (actionResponse.ok) {
                    const actionsData = await actionResponse.json() as any;
                    const actionDetail = actionsData.actions?.find((a: any) =>
                      a.id === action.id
                    );
                    funcRunId = actionDetail?.funcRunId;
                  }
                } catch (e) {
                  console.error(`Failed to get detailed action info: ${e}`);
                }
              }

              if (funcRunId) {
                let logs = await this.getActionLogs("head", funcRunId);
                if (logs.length === 0) {
                  logs = await this.getActionLogs(changeSetId, funcRunId);
                }

                let errorMessage = "";
                if (logs.length > 0) {
                  for (const log of logs) {
                    const timestamp = log.timestamp || "";
                    const stream = log.stream || "";
                    const message = log.message || "";
                    console.log(`[${timestamp}] ${stream}: ${message}`);

                    if (
                      stream === "output" &&
                      (message.toLowerCase().includes("error") ||
                        message.includes("message"))
                    ) {
                      try {
                        const outputData = message.includes("Output: ")
                          ? JSON.parse(message.split("Output: ")[1])
                          : JSON.parse(message);
                        if (outputData.message) {
                          errorMessage = outputData.message;
                        }
                      } catch {
                        errorMessage = message;
                      }
                    }
                  }
                } else {
                  console.log("No logs available for this action.");
                }

                if (errorMessage) {
                  await this.writeErrorToFile(errorMessage);
                }
              } else {
                console.log("No func run ID available for this action.");
              }
              console.log("--- End of logs ---\n");
            }
            return false;
          } else {
            console.log(`⏳ Action states: ${states}. Waiting...`);
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000));
    }

    const timeoutMsg =
      `Action execution timeout: Merge not successful for ChangeSet ${changeSetId} after ${timeoutSeconds}s`;
    await this.writeErrorToFile(timeoutMsg);
    throw new Error(`❌ ${timeoutMsg}`);
  }

  async getPublicIp(
    changeSetId: string,
    componentId: string,
    timeoutSeconds = 60,
    pollInterval = 3,
  ): Promise<string> {
    const url =
      `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/components/${componentId}`;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutSeconds * 1000) {
      const response = await this.fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const component = data.component || {};

      for (const prop of component.resourceProps || []) {
        if (prop.path === "root/resource_value/PublicIp" && prop.value) {
          console.log(`✅ Public IP found: ${prop.value}`);
          return prop.value;
        }
      }

      console.log("⏳ Public IP not ready yet, retrying...");
      await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000));
    }

    const ipTimeoutMsg =
      `Public IP lookup timeout: Instance public IP not available after ${timeoutSeconds}s`;
    await this.writeErrorToFile(ipTimeoutMsg);
    throw new Error(`❌ ${ipTimeoutMsg}`);
  }

  async forceApplyWithRetry(
    changeSetId: string,
    timeoutSeconds = 120,
    retryInterval = 5,
  ): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutSeconds * 1000) {
      try {
        const forceApplyUrl =
          `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/force_apply`;
        const response = await this.fetch(forceApplyUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiToken}`,
            "accept": "application/json",
          },
          body: "",
        });

        if (!response.ok) {
          if (response.status === 428) {
            const elapsed = Date.now() - startTime;
            const remaining = timeoutSeconds * 1000 - elapsed;
            console.log(
              `⏳ DVU Roots still present. Retrying in ${retryInterval}s... (${
                (remaining / 1000).toFixed(1)
              }s remaining)`,
            );

            if (remaining > retryInterval * 1000) {
              await new Promise((resolve) =>
                setTimeout(resolve, retryInterval * 1000)
              );
              continue;
            } else {
              break;
            }
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }

        console.log("Change set applied successfully.");
        return await response.json();
      } catch (e) {
        if (e instanceof Error && e.message.includes("428")) {
          continue;
        }
        throw e;
      }
    }

    const forceApplyTimeoutMsg =
      `Force apply timeout: Change set apply failed after ${timeoutSeconds}s - DVUs still processing`;
    await this.writeErrorToFile(forceApplyTimeoutMsg);
    throw new Error(`❌ ${forceApplyTimeoutMsg}`);
  }

  async createChangeSet(name: string): Promise<any> {
    try {
      const response = await this.fetch(
        `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets`,
        {
          method: "POST",
          body: JSON.stringify({ changeSetName: name }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
        );
      }

      return await response.json();
    } catch (e) {
      throw new Error(`Failed to create change set '${name}': ${e}`);
    }
  }

  async createComponent(
    changeSetId: string,
    schemaName: string,
    name: string,
    options?: any,
  ): Promise<any> {
    const requestBody = { schemaName, name, ...options };

    try {
      const response = await this.fetch(
        `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/components`,
        {
          method: "POST",
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
        );
      }

      return await response.json();
    } catch (e) {
      throw new Error(`Failed to create component '${name}': ${e}`);
    }
  }

  async getChangeSet(changeSetId: string): Promise<Response> {
    return await this.fetch(
      `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}`,
    );
  }

  async deleteChangeSet(changeSetId: string): Promise<any> {
    const response = await this.fetch(
      `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

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
        await this.forceApplyWithRetry(changeSetId);
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

  async getHeadChangesetId(): Promise<string> {
    const url = `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets`;

    try {
      const response = await this.fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const changeSets = data.changeSets || [];

      // Find the changeset where isHead is true
      const headChangeSet = changeSets.find((cs: any) => cs.isHead === true);

      if (!headChangeSet) {
        throw new Error("No HEAD changeset found");
      }

      console.log(`Found HEAD changeset: ${headChangeSet.id}`);
      return headChangeSet.id;
    } catch (error) {
      console.error("Failed to get HEAD changeset ID:", error);
      throw error;
    }
  }

  async searchComponentsByBranch(
    branchName: string,
    schema: string,
  ): Promise<any[]> {
    const headChangesetId = await this.getHeadChangesetId();
    // Search for components by Branch tag (works for both /domain/Tags and /si/tags)
    // Quote the branch name to handle special characters like hyphens
    const query = `schema:${schema} & Key:Branch & Value:"${branchName}"`;
    const url =
      `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${headChangesetId}/search?q=${
        encodeURIComponent(query)
      }`;

    console.log(`Searching with query: ${query}`);
    console.log(`Encoded URL: ${url}`);

    try {
      const response = await this.fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Search API error response: ${errorText}`);

        // If the error is about change set index not found, treat as no components found
        if (response.status === 500 && errorText.includes('change set index not found')) {
          console.warn(`⚠️  Change set index not found - treating as no components found`);
          console.warn(`   This may happen if the change set was recently created`);
          return [];
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const searchData = await response.json() as any;
      const components = searchData.components || [];

      console.log(
        `Found ${components.length} ${schema} component(s) for branch ${branchName}`,
      );
      for (const comp of components) {
        console.log(`  - ${comp.name} (${comp.id})`);
      }

      return components;
    } catch (error) {
      console.error(
        `Failed to search components for branch ${branchName}:`,
        error,
      );
      return [];
    }
  }

  async deleteComponent(
    changeSetId: string,
    componentId: string,
  ): Promise<void> {
    const response = await this.fetch(
      `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/components/${componentId}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
        await this.forceApplyWithRetry(changeSetId);
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

  const client = new SystemInitiativeClient();

  if (operation === "up") {
    await client.stackUp(version, branchName, prNumber);
  } else {
    await client.stackDown(branchName);
  }
}
