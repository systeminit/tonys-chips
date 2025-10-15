/**
 * Check InfraFlags command implementation
 * Verifies that all required infrastructure flags are deployed to target environment
 *
 * This is the first command to use the System Initiative TypeScript SDK,
 * establishing patterns for future commands.
 */

import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import {
  ComponentsApi,
  ChangeSetsApi,
  SearchApi,
  Configuration,
  type ChangeSetViewV1,
  type ComponentViewV1
} from 'system-initiative-api-client';

/**
 * Structure of infraflags.yaml
 */
interface InfraFlagsYaml {
  infraflags: string[];
}

/**
 * Structure of the environmentFlagMapping code generation output
 */
interface FlagMapping {
  application: string;
  byEnvironment: {
    [env: string]: string[];
  };
  byFlag: {
    [flag: string]: string[];
  };
}

/**
 * Result of the InfraFlags check
 */
interface CheckResult {
  status: 'success' | 'failure' | 'error';
  message: string;
  missingFlags?: string[];
  componentId?: string;
  changeSetId?: string;
  environment?: string;
}

/**
 * InfraFlags checker using the System Initiative TypeScript SDK
 */
class InfraFlagsChecker {
  private componentsApi: ComponentsApi;
  private changeSetsApi: ChangeSetsApi;
  private searchApi: SearchApi;
  private workspaceId: string;
  private applicationName: string;

  constructor() {
    // Load configuration from environment variables
    this.workspaceId = process.env.SI_WORKSPACE_ID || '';
    this.applicationName = process.env.APPLICATION_NAME || 'tonys-chips';
    const apiToken = process.env.SI_API_TOKEN || '';
    const apiUrl = process.env.SI_API_ENDPOINT || 'https://api.systeminit.com';

    if (!apiToken || !this.workspaceId) {
      throw new Error(
        'Missing required environment variables: SI_API_TOKEN and SI_WORKSPACE_ID must be set'
      );
    }

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
  }

  /**
   * Read and parse infraflags.yaml from repository root
   */
  async readInfraFlagsYaml(filePath: string = './infraflags.yaml'): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = yaml.load(content) as InfraFlagsYaml;

      if (!parsed || !Array.isArray(parsed.infraflags)) {
        console.warn('⚠️  infraflags.yaml is empty or malformed, treating as no requirements');
        return [];
      }

      return parsed.infraflags;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('ℹ️  No infraflags.yaml found, treating as no requirements');
        return [];
      }
      throw new Error(`Failed to read infraflags.yaml: ${error}`);
    }
  }

  /**
   * Find the HEAD change set ID using the SDK
   */
  async getHeadChangeSetId(): Promise<string> {
    try {
      const response = await this.changeSetsApi.listChangeSets({ workspaceId: this.workspaceId });
      const changeSets = response.data.changeSets || [];

      const headChangeSet = changeSets.find((cs: ChangeSetViewV1) => cs.isHead === true);

      if (!headChangeSet || !headChangeSet.id) {
        throw new Error('No HEAD change set found in workspace');
      }

      return headChangeSet.id;
    } catch (error) {
      throw new Error(`Failed to find HEAD change set: ${error}`);
    }
  }

  /**
   * Find the SI::CD::InfraFlags component for this application using search
   */
  async findInfraFlagsComponentId(changeSetId: string): Promise<string | null> {
    try {
      // Build search query to find SI::CD::InfraFlags component
      // The search syntax supports: schema:"SchemaName" attribute:"value"
      const searchQuery = `schema:"SI::CD::InfraFlags" application:"${this.applicationName}"`;

      const response = await this.searchApi.search({
        workspaceId: this.workspaceId,
        changeSetId,
        q: searchQuery
      });

      // Search returns an array of ComponentSearchResult objects
      const components = response.data.components || [];

      if (components.length === 0) {
        return null;
      }

      if (components.length > 1) {
        console.warn(
          `⚠️  Multiple InfraFlags components found for ${this.applicationName}, using first one`
        );
      }

      // Return the first component ID
      return components[0].id;
    } catch (error) {
      throw new Error(`Failed to search for InfraFlags component: ${error}`);
    }
  }

  /**
   * Get component details with code generation output
   */
  async getComponentDetails(changeSetId: string, componentId: string): Promise<ComponentViewV1> {
    try {
      const response = await this.componentsApi.getComponent({
        workspaceId: this.workspaceId,
        changeSetId,
        componentId
      });

      return response.data.component;
    } catch (error) {
      throw new Error(`Failed to get component details: ${error}`);
    }
  }

  /**
   * Parse the environmentFlagMapping code generation output from component attributes
   */
  parseFlagMapping(component: ComponentViewV1): FlagMapping | null {
    // The component attributes contain the code generation output
    const attributes = (component as any).attributes || {};

    // Look for /code/environmentFlagMapping/code attribute
    const codegenOutput = attributes['/code/environmentFlagMapping/code'];

    if (!codegenOutput) {
      console.error('❌ No environmentFlagMapping code generation found on component');
      console.error('Available attributes:', Object.keys(attributes));
      return null;
    }

    try {
      return JSON.parse(codegenOutput) as FlagMapping;
    } catch (error) {
      console.error(`❌ Failed to parse code generation output: ${error}`);
      console.error('Output was:', codegenOutput);
      return null;
    }
  }

  /**
   * Get valid environments list from parsed flag mapping
   */
  getValidEnvironments(flagMapping: FlagMapping): string[] {
    return Object.keys(flagMapping.byEnvironment);
  }

  /**
   * Main check logic
   */
  async check(targetEnvironment: string): Promise<CheckResult> {
    console.log(`🔍 Checking infrastructure flags for environment: ${targetEnvironment}`);
    console.log(`📋 Application: ${this.applicationName}`);
    console.log('');

    // Step 1: Read required flags from infraflags.yaml
    const requiredFlags = await this.readInfraFlagsYaml();

    if (requiredFlags.length === 0) {
      return {
        status: 'success',
        message: '✅ No infrastructure flags required (infraflags.yaml is empty or missing)',
      };
    }

    console.log(`📝 Required flags: ${requiredFlags.join(', ')}`);

    // Step 2: Find HEAD change set using SDK
    console.log('🔍 Finding HEAD change set...');
    const headChangeSetId = await this.getHeadChangeSetId();
    console.log(`   Found: ${headChangeSetId}`);

    // Step 3: Search for InfraFlags component using SDK
    console.log(`🔍 Searching for SI::CD::InfraFlags component for '${this.applicationName}'...`);
    const infraflagsComponentId = await this.findInfraFlagsComponentId(headChangeSetId);

    if (!infraflagsComponentId) {
      return {
        status: 'error',
        message: `❌ No SI::CD::InfraFlags component found for application '${this.applicationName}'

Please create an InfraFlags component in System Initiative:
  1. Open your System Initiative workspace
  2. Create a new component with schema 'SI::CD::InfraFlags'
  3. Set the application attribute to '${this.applicationName}'
  4. Configure environments: ["pr", "dev", "preprod", "prod"]
  5. Configure flags mapping for each environment

For more information, see: design/infraflags-si.md`,
      };
    }

    console.log(`   Found component ID: ${infraflagsComponentId}`);

    // Step 4: Get component details using SDK
    const componentDetails = await this.getComponentDetails(
      headChangeSetId,
      infraflagsComponentId
    );

    // Step 5: Parse the flag mapping from code generation
    const flagMapping = this.parseFlagMapping(componentDetails);

    if (!flagMapping) {
      return {
        status: 'error',
        message: `❌ Failed to parse InfraFlags code generation output

The component was found but the environmentFlagMapping code generation output
could not be parsed. Please verify that:
  1. The component has a code generation function named 'environmentFlagMapping'
  2. The function is producing valid JSON output
  3. The output includes 'byEnvironment' property`,
      };
    }

    console.log(`   Parsed flag mapping for application: ${flagMapping.application}`);

    // Step 5.5: Validate target environment against environments in flag mapping
    const validEnvironments = this.getValidEnvironments(flagMapping);

    if (!validEnvironments || validEnvironments.length === 0) {
      return {
        status: 'error',
        message: `❌ No environments configured in SI::CD::InfraFlags component

The component was found but does not have any environments configured in the flag mapping.`,
      };
    }

    if (!validEnvironments.includes(targetEnvironment)) {
      return {
        status: 'error',
        message: `❌ Invalid environment: ${targetEnvironment}

Valid environments for ${this.applicationName}: ${validEnvironments.join(', ')}`,
      };
    }

    console.log(`   Valid environments: ${validEnvironments.join(', ')}`);

    // Step 6: Get deployed flags for target environment
    const deployedFlags = flagMapping.byEnvironment[targetEnvironment] || [];
    console.log(
      `📝 Deployed flags in '${targetEnvironment}': ${
        deployedFlags.length > 0 ? deployedFlags.join(', ') : '(none)'
      }`
    );

    // Step 7: Compare required vs deployed flags
    const missingFlags = requiredFlags.filter(flag => !deployedFlags.includes(flag));

    // Step 8: Return result
    if (missingFlags.length === 0) {
      return {
        status: 'success',
        message: `✅ All infrastructure flags deployed to '${targetEnvironment}':
   ${requiredFlags.join(', ')}`,
        componentId: infraflagsComponentId,
        changeSetId: headChangeSetId,
        environment: targetEnvironment,
      };
    } else {
      const missingList = missingFlags.map(f => `  - ${f}`).join('\n');
      return {
        status: 'failure',
        message: `❌ Missing infrastructure flags in '${targetEnvironment}':
${missingList}

Required: ${requiredFlags.join(', ')}
Deployed: ${deployedFlags.length > 0 ? deployedFlags.join(', ') : '(none)'}

Please deploy these flags to '${targetEnvironment}' before proceeding.`,
        missingFlags,
        componentId: infraflagsComponentId,
        changeSetId: headChangeSetId,
        environment: targetEnvironment,
      };
    }
  }
}

/**
 * GitHub Client for posting PR comments
 */
class GitHubClient {
  private token: string;
  private repo: string;
  private owner: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN || '';
    const repoFullName = process.env.GITHUB_REPOSITORY || '';

    if (!this.token || !repoFullName) {
      // Not in a GitHub environment, skip PR posting
      throw new Error('GitHub environment not detected');
    }

    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid repository format: ${repoFullName}`);
    }

    this.owner = owner;
    this.repo = repo;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'tonys-chips-ci'
    };
  }

  async postComment(prNumber: number, body: string): Promise<void> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/issues/${prNumber}/comments`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ body })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as any;
      console.log(`Posted comment to PR #${prNumber}: ${result.html_url}`);
    } catch (error) {
      console.error(`Failed to post comment to PR #${prNumber}:`, error);
      throw error;
    }
  }

  async findExistingComment(prNumber: number, identifier: string): Promise<number | null> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/issues/${prNumber}/comments`;

    try {
      const response = await fetch(url, {
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const comments = await response.json() as any[];
      const existingComment = comments.find((comment: any) =>
        comment.body.includes(`<!-- ${identifier} -->`)
      );

      return existingComment ? existingComment.id : null;
    } catch (error) {
      console.error(`Failed to find existing comments for PR #${prNumber}:`, error);
      return null;
    }
  }

  async updateComment(commentId: number, body: string): Promise<void> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/issues/comments/${commentId}`;

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify({ body })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as any;
      console.log(`Updated comment: ${result.html_url}`);
    } catch (error) {
      console.error(`Failed to update comment ${commentId}:`, error);
      throw error;
    }
  }
}

/**
 * Post InfraFlags result to GitHub PR
 */
async function postInfraFlagsResultToPR(
  result: CheckResult,
  applicationName: string,
  workspaceId: string,
  requiredFlags: string[]
): Promise<void> {
  try {
    const prNumber = process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER, 10) : null;

    if (!prNumber) {
      console.log('ℹ️  No PR number found, skipping GitHub comment');
      return;
    }

    const client = new GitHubClient();
    const commentIdentifier = `infraflags-check-${result.environment}`;

    let commentBody: string;

    if (result.status === 'success') {
      // Success message
      const flagsList = requiredFlags.map(f => `- \`${f}\``).join('\n');
      commentBody = `<!-- ${commentIdentifier} -->
## ✅ Infrastructure Flags Check Passed

All required infrastructure flags are deployed to **${result.environment}**.

### Deployed Flags
${flagsList}

### Current Status
- **Environment:** ${result.environment}
- **Application:** ${applicationName}
- **Status:** Ready for deployment

> ✅ All infrastructure requirements are met. Deployment can proceed.`;
    } else {
      // Failure message
      const siUrl = `https://app.systeminit.com/n/${workspaceId}/${result.changeSetId}/h/${result.componentId}/c`;
      const missingList = result.missingFlags?.map(f => `- \`${f}\``).join('\n');
      commentBody = `<!-- ${commentIdentifier} -->
## ❌ Infrastructure Flags Check Failed

The deployment to **${result.environment}** is blocked due to missing infrastructure flags.

### Missing Flags
${missingList}

### Current Status
- **Environment:** ${result.environment}
- **Application:** ${applicationName}
- **Required Flags:** ${result.missingFlags?.join(', ')}

### Next Steps
1. Implement the required infrastructure for the environment (or environments)
2. Open the [InfraFlags component in System Initiative](${siUrl})
3. Add the missing flags to the **${result.environment}** environment
4. Apply the changes in System Initiative
5. Re-run this check

> 💡 Infrastructure flags ensure that required infrastructure is deployed before promoting your application to an environment.`;
    }

    // Check for existing comment and update or create
    const existingCommentId = await client.findExistingComment(prNumber, commentIdentifier);

    if (existingCommentId) {
      console.log(`Updating existing InfraFlags comment ID: ${existingCommentId}`);
      await client.updateComment(existingCommentId, commentBody);
    } else {
      console.log(`Posting new InfraFlags comment to PR #${prNumber}`);
      await client.postComment(prNumber, commentBody);
    }
  } catch (error) {
    // Don't fail the check if we can't post to GitHub
    console.warn('⚠️  Failed to post to GitHub PR:', error);
  }
}

/**
 * Parse configuration from command arguments
 * Valid environments are fetched from SI::CD::InfraFlags component at runtime
 */
function parseConfig(args: string[]): { environment: string } {
  if (args.length < 1) {
    throw new Error(
      'Usage: check-infraflags <environment>\n' +
      'Example: check-infraflags pr\n\n' +
      'Valid environments are defined in the SI::CD::InfraFlags component'
    );
  }

  const environment = args[0];

  return { environment };
}

/**
 * Command entry point exported to main.ts
 */
export async function checkInfraFlags(args: string[]): Promise<void> {
  console.log('🚀 InfraFlags Check');
  console.log('');

  try {
    const config = parseConfig(args);
    const checker = new InfraFlagsChecker();
    const result = await checker.check(config.environment);

    console.log('');
    console.log(result.message);
    console.log('');

    // Read required flags to pass to PR comment
    const requiredFlags = await checker.readInfraFlagsYaml();

    // Post to GitHub PR for both success and failure
    if ((result.status === 'success' || result.status === 'failure') && result.componentId) {
      await postInfraFlagsResultToPR(
        result,
        process.env.APPLICATION_NAME || 'tonys-chips',
        process.env.SI_WORKSPACE_ID || '',
        requiredFlags
      );
    }

    if (result.status === 'failure' || result.status === 'error') {
      process.exit(1);
    }
  } catch (error) {
    console.error('');
    console.error('❌ InfraFlags check failed with error:');
    console.error((error as Error).message);
    console.error('');
    process.exit(1);
  }
}
