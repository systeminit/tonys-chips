/**
 * Shared System Initiative API client library
 * Used across multiple CI commands for common SI operations
 */

import * as fs from "fs/promises";

export class SystemInitiativeClient {
  private apiToken: string;
  private workspaceId: string;
  private apiUrl = "https://api.systeminit.com";

  constructor() {
    this.apiToken = process.env.SI_API_TOKEN || "";
    this.workspaceId = process.env.SI_WORKSPACE_ID || "";

    if (!this.apiToken || !this.workspaceId) {
      throw new Error(
        "Missing required environment variables: SI_API_TOKEN or SI_WORKSPACE_ID"
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
    options: RequestInit = {}
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

  async createChangeSet(name: string): Promise<any> {
    try {
      const response = await this.fetch(
        `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets`,
        {
          method: "POST",
          body: JSON.stringify({ changeSetName: name }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`
        );
      }

      return await response.json();
    } catch (e) {
      throw new Error(`Failed to create change set '${name}': ${e}`);
    }
  }

  async getChangeSet(changeSetId: string): Promise<Response> {
    return await this.fetch(
      `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}`
    );
  }

  async deleteChangeSet(changeSetId: string): Promise<any> {
    const response = await this.fetch(
      `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async createComponent(
    changeSetId: string,
    schemaName: string,
    name: string,
    options?: any
  ): Promise<any> {
    const requestBody = { schemaName, name, ...options };

    try {
      const response = await this.fetch(
        `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/components`,
        {
          method: "POST",
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`
        );
      }

      return await response.json();
    } catch (e) {
      throw new Error(`Failed to create component '${name}': ${e}`);
    }
  }

  async findComponentByName(changeSetId: string, componentName: string): Promise<any> {
    try {
      const response = await this.fetch(
        `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/components/find?component=${encodeURIComponent(componentName)}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json() as any;
      return data.component || null;
    } catch (e) {
      throw new Error(`Failed to find component '${componentName}': ${e}`);
    }
  }

  async updateComponentAttribute(
    changeSetId: string,
    componentId: string,
    attributePath: string,
    value: any
  ): Promise<any> {
    try {
      const response = await this.fetch(
        `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/components/${componentId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            attributes: {
              [attributePath]: value
            }
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`
        );
      }

      return await response.json();
    } catch (e) {
      throw new Error(`Failed to update component attribute '${attributePath}': ${e}`);
    }
  }

  async deleteComponent(
    changeSetId: string,
    componentId: string
  ): Promise<void> {
    const response = await this.fetch(
      `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/components/${componentId}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  async forceApplyChangeSet(
    changeSetId: string,
    timeoutSeconds = 120,
    retryInterval = 5
  ): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutSeconds * 1000) {
      try {
        const response = await this.fetch(
          `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/force_apply`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${this.apiToken}`,
              "accept": "application/json",
            },
            body: "",
          }
        );

        if (!response.ok) {
          if (response.status === 428) {
            const elapsed = Date.now() - startTime;
            const remaining = timeoutSeconds * 1000 - elapsed;
            console.log(
              `⏳ Dependent values still calculating. Retrying in ${retryInterval}s... (${
                (remaining / 1000).toFixed(1)
              }s remaining)`
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
            const errorText = await response.text();
            throw new Error(
              `HTTP ${response.status}: ${response.statusText} - ${errorText}`
            );
          }
        }

        console.log("✅ Change set applied successfully");
        return await response.json();
      } catch (e) {
        if (e instanceof Error && e.message.includes("428")) {
          continue;
        }
        throw e;
      }
    }

    const timeoutMsg = `Change set apply timeout: Failed to apply after ${timeoutSeconds}s - dependent values still calculating`;
    await this.writeErrorToFile(timeoutMsg);
    throw new Error(`❌ ${timeoutMsg}`);
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
    schema: string
  ): Promise<any[]> {
    const headChangesetId = await this.getHeadChangesetId();
    // Search for components by Branch tag (works for both /domain/Tags and /si/tags)
    // Quote the branch name to handle special characters like hyphens
    const query = `schema:${schema} & Key:Branch & Value:"${branchName}"`;
    const url = `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${headChangesetId}/search?q=${encodeURIComponent(query)}`;

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
        `Found ${components.length} ${schema} component(s) for branch ${branchName}`
      );
      for (const comp of components) {
        console.log(`  - ${comp.name} (${comp.id})`);
      }

      return components;
    } catch (error) {
      console.error(
        `Failed to search components for branch ${branchName}:`,
        error
      );
      return [];
    }
  }

  async getActionLogs(changeSetId: string, funcRunId: string): Promise<any[]> {
    try {
      const response = await this.fetch(
        `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/funcs/runs/${funcRunId}`
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
        `❌ Failed to retrieve logs for func run ${funcRunId}: ${e}`
      );
      return [];
    }
  }

  async waitForMergeSuccess(
    changeSetId: string,
    timeoutSeconds = 300,
    pollInterval = 10
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutSeconds * 1000) {
      const response = await this.fetch(
        `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/merge_status`
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
            `⏳ No actions found. Change set status: ${changeSet.status}. Waiting...`
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
              `❌ ${failedActions.length} action(s) failed. Outputting logs:`
            );

            for (const action of failedActions) {
              console.log(
                `\n--- Logs for failed action: ${
                  action.displayName || action.name || "Unknown"
                } ---`
              );

              let funcRunId = action.funcRunId;

              if (!funcRunId) {
                try {
                  const actionResponse = await this.fetch(
                    `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/actions`
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

    const timeoutMsg = `Action execution timeout: Merge not successful for ChangeSet ${changeSetId} after ${timeoutSeconds}s`;
    await this.writeErrorToFile(timeoutMsg);
    throw new Error(`❌ ${timeoutMsg}`);
  }

  async getPublicIp(
    changeSetId: string,
    componentId: string,
    timeoutSeconds = 60,
    pollInterval = 3
  ): Promise<string> {
    const url = `${this.apiUrl}/v1/w/${this.workspaceId}/change-sets/${changeSetId}/components/${componentId}`;
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

    const ipTimeoutMsg = `Public IP lookup timeout: Instance public IP not available after ${timeoutSeconds}s`;
    await this.writeErrorToFile(ipTimeoutMsg);
    throw new Error(`❌ ${ipTimeoutMsg}`);
  }
}