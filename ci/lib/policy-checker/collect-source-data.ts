/**
 * Stage 2: Source Data Collection
 * Uses System Initiative TypeScript SDK to collect component data based on queries
 */

import {
  Configuration,
  ComponentsApi,
  ChangeSetsApi,
  SearchApi,
  type ChangeSetViewV1,
  type ComponentViewV1
} from 'system-initiative-api-client';
import * as fs from 'fs';

export interface ComponentData {
  componentId: string;
  schema: string;
  'si/name': string;
  [key: string]: any; // Additional attributes
}

export interface SourceDataCollection {
  [queryName: string]: ComponentData[];
}

/**
 * Source Data Collector using System Initiative SDK
 */
export class SourceDataCollector {
  private componentsApi: ComponentsApi;
  private changeSetsApi: ChangeSetsApi;
  private searchApi: SearchApi;
  private workspaceId: string;

  constructor(apiToken: string, workspaceId: string, apiUrl: string = 'https://api.systeminit.com') {
    // Initialize SDK Configuration
    const config = new Configuration({
      basePath: apiUrl,
      baseOptions: {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
      },
    });

    // Initialize API clients
    this.componentsApi = new ComponentsApi(config);
    this.changeSetsApi = new ChangeSetsApi(config);
    this.searchApi = new SearchApi(config);
    this.workspaceId = workspaceId;
  }

  /**
   * Find the HEAD change set ID
   */
  async getHeadChangeSetId(): Promise<string> {
    const response = await this.changeSetsApi.listChangeSets({ workspaceId: this.workspaceId });
    const changeSets = response.data.changeSets || [];

    const headChangeSet: any = changeSets.find((cs: any) => cs.isHead === true);

    if (!headChangeSet || !headChangeSet.id) {
      throw new Error('No HEAD change set found in workspace');
    }

    return headChangeSet.id as string;
  }

  /**
   * Search for components matching a query
   */
  async searchComponents(changeSetId: string, query: string): Promise<ComponentData[]> {
    console.log(`  Search string sent to API: "${query}"`);

    const response = await this.searchApi.search({
      workspaceId: this.workspaceId,
      changeSetId,
      q: query,
    });

    const components = response.data.components || [];
    console.log(`  Search returned: ${components.length} component(s)`);

    // Extract component data
    const componentData: ComponentData[] = [];

    for (const component of components) {
      // Get full component details to access all attributes
      const detailResponse = await this.componentsApi.getComponent({
        workspaceId: this.workspaceId,
        changeSetId,
        componentId: component.id
      });

      const fullComponent: ComponentViewV1 = detailResponse.data.component;
      const attributes = (fullComponent as any).attributes || {};

      // Extract schema name from the nested schema object
      const schemaName = (component.schema as any)?.name || 'unknown';

      componentData.push({
        componentId: component.id,
        schema: schemaName,
        'si/name': attributes['/root/si/name'] || attributes['/domain/name'] || component.name || 'unknown',
        // Include other useful attributes
        ...attributes
      });
    }

    return componentData;
  }

  /**
   * Collect source data for all queries
   */
  async collect(queries: Record<string, string>): Promise<SourceDataCollection> {
    console.log('Stage 2: Collecting source data...');

    // Get HEAD change set
    console.log('  Finding HEAD change set...');
    const headChangeSetId = await this.getHeadChangeSetId();
    console.log(`  Found: ${headChangeSetId}`);

    // Collect data for each query
    const results: SourceDataCollection = {};

    for (const [queryName, queryString] of Object.entries(queries)) {
      console.log(`\n  Collecting data for: ${queryName}`);
      console.log(`  Query from policy: "${queryString}"`);
      const components = await this.searchComponents(headChangeSetId, queryString);
      results[queryName] = components;
    }

    return results;
  }
}

/**
 * Main function to collect source data and write to file
 */
export async function collectSourceData(
  queries: Record<string, string>,
  apiToken: string,
  workspaceId: string,
  outputPath: string
): Promise<SourceDataCollection> {
  const collector = new SourceDataCollector(apiToken, workspaceId);
  const data = await collector.collect(queries);

  // Write to file
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\n✓ Source data collection complete`);
  console.log(`  Output: ${outputPath}`);

  return data;
}
