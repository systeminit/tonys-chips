/**
 * Check Policy command implementation
 * Evaluates System Initiative infrastructure against compliance policies
 *
 * This command orchestrates a 4-stage pipeline:
 * 1. Extract policy structure from markdown
 * 2. Collect source data from System Initiative
 * 3. Evaluate policy compliance using Claude agent
 * 4. Generate markdown report and post to GitHub issue
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { extractPolicy } from '../lib/policy-checker/extract-policy';
import { collectSourceData, SourceDataCollector } from '../lib/policy-checker/collect-source-data';
import { evaluatePolicy } from '../lib/policy-checker/evaluate-policy';
import { generateReport } from '../lib/policy-checker/generate-report';
import type { EvaluationResult } from '../lib/policy-checker/evaluate-policy';

/**
 * GitHub Client for managing issues
 */
class GitHubClient {
  private token: string;
  private repo: string;
  private owner: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN || '';
    const repoFullName = process.env.GITHUB_REPOSITORY || '';

    if (!this.token || !repoFullName) {
      throw new Error('GitHub environment not detected (missing GITHUB_TOKEN or GITHUB_REPOSITORY)');
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

  /**
   * Find existing open issue for a specific policy
   */
  async findPolicyIssue(policyIdentifier: string): Promise<number | null> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/issues?state=open&labels=policy-check`;

    try {
      const response = await fetch(url, {
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const issues = await response.json() as any[];

      // Find issue with matching identifier in body
      const existingIssue = issues.find((issue: any) =>
        issue.body && issue.body.includes(`<!-- policy-check:${policyIdentifier} -->`)
      );

      return existingIssue ? existingIssue.number : null;
    } catch (error) {
      console.error(`Failed to find existing policy issue:`, error);
      return null;
    }
  }

  /**
   * Close an existing issue
   */
  async closeIssue(issueNumber: number): Promise<void> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/issues/${issueNumber}`;

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify({ state: 'closed' })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      console.log(`✓ Closed existing issue #${issueNumber}`);
    } catch (error) {
      console.error(`Failed to close issue #${issueNumber}:`, error);
      throw error;
    }
  }

  /**
   * Create a new issue
   */
  async createIssue(title: string, body: string, labels: string[]): Promise<number> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/issues`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ title, body, labels })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as any;
      console.log(`✓ Created new issue #${result.number}: ${result.html_url}`);
      return result.number;
    } catch (error) {
      console.error(`Failed to create issue:`, error);
      throw error;
    }
  }
}

/**
 * Post policy check result to GitHub issue
 */
async function postPolicyResultToIssue(
  policyFilename: string,
  policyTitle: string,
  result: EvaluationResult,
  reportContent: string,
  workspaceId: string,
  changeSetId: string
): Promise<void> {
  try {
    const client = new GitHubClient();

    // Use policy filename as identifier (without extension)
    const policyIdentifier = path.basename(policyFilename, '.md');

    // Check for existing issue
    const existingIssueNumber = await client.findPolicyIssue(policyIdentifier);

    // Close existing issue if found
    if (existingIssueNumber) {
      console.log(`Found existing issue #${existingIssueNumber} for policy '${policyIdentifier}'`);
      await client.closeIssue(existingIssueNumber);
    }

    // Generate issue title
    const statusEmoji = result.result === 'Pass' ? '✅' : '❌';
    const issueTitle = `${statusEmoji} Policy Check: ${policyTitle}`;

    // Generate issue body
    const issueBody = `<!-- policy-check:${policyIdentifier} -->
# ${policyTitle}

**Status**: ${result.result === 'Pass' ? '✅ **PASS**' : '❌ **FAIL**'}
**Policy File**: \`${policyFilename}\`
**Workspace**: [View in System Initiative](https://app.systeminit.com/n/${workspaceId}/${changeSetId})
**Date**: ${new Date().toISOString()}

---

${reportContent}

---

<details>
<summary>About this issue</summary>

This issue was automatically generated by the policy checker workflow. When the workflow runs again for this policy, this issue will be closed and a new one will be created with updated results.

</details>`;

    // Determine labels
    const labels = ['policy-check'];
    if (result.result === 'Pass') {
      labels.push('policy-pass');
    } else {
      labels.push('policy-fail');
    }

    // Create new issue
    await client.createIssue(issueTitle, issueBody, labels);

  } catch (error) {
    // Don't fail the check if we can't post to GitHub
    console.warn('⚠️  Failed to post to GitHub issue:', error);
  }
}

/**
 * Parse configuration from command arguments
 */
function parseConfig(args: string[]): { policyFile: string; outputPath?: string } {
  if (args.length < 1) {
    throw new Error(
      'Usage: check-policy <policy-file> [--output path]\n' +
      'Example: check-policy policy/my-policy.md\n' +
      'Example: check-policy policy/my-policy.md --output ./reports/my-policy-report.md'
    );
  }

  const policyFile = args[0];
  let outputPath: string | undefined;

  // Parse optional --output flag
  const outputFlagIndex = args.indexOf('--output');
  if (outputFlagIndex !== -1 && args[outputFlagIndex + 1]) {
    outputPath = args[outputFlagIndex + 1];
  }

  return { policyFile, outputPath };
}

/**
 * Command entry point exported to main.ts
 */
export async function checkPolicy(args: string[]): Promise<void> {
  console.log('🚀 Policy Check');
  console.log('');

  try {
    const config = parseConfig(args);

    // Read the policy file
    const policyPath = path.resolve(config.policyFile);
    const policyContent = await fs.readFile(policyPath, 'utf-8');

    // Get API token from environment
    const apiToken = process.env.SI_API_TOKEN;
    if (!apiToken) {
      throw new Error('SI_API_TOKEN must be set in environment variables');
    }

    // Get workspace ID from environment
    const workspaceId = process.env.SI_WORKSPACE_ID;
    if (!workspaceId) {
      throw new Error('SI_WORKSPACE_ID must be set in environment variables');
    }

    // Prepare intermediate file paths
    const outputDir = config.outputPath
      ? path.dirname(path.resolve(config.outputPath))
      : path.dirname(policyPath);
    const policyBasename = path.basename(policyPath, '.md');
    const extractedPolicyPath = path.join(outputDir, `${policyBasename}-extracted.json`);
    const sourceDataPath = path.join(outputDir, `${policyBasename}-source-data.json`);
    const evaluationPath = path.join(outputDir, `${policyBasename}-evaluation.json`);
    const reportPath = config.outputPath || path.join(outputDir, `${policyBasename}-report.md`);

    console.log('Configuration:');
    console.log(`  Policy file: ${policyPath}`);
    console.log(`  Workspace ID: ${workspaceId}`);
    console.log(`  Output: ${reportPath}\n`);

    // ============================================================
    // STAGE 1: Extract Policy Structure
    // ============================================================
    const extractedPolicy = await extractPolicy(policyContent, extractedPolicyPath);

    console.log('\nExtracted Policy:');
    console.log(`  Title: ${extractedPolicy.policyTitle}`);
    console.log(`  Source queries: ${Object.keys(extractedPolicy.sourceDataQueries).length}`);
    console.log(`  Output tags: ${extractedPolicy.outputTags.length}`);

    // ============================================================
    // STAGE 2: Collect Source Data
    // ============================================================
    const sourceData = await collectSourceData(
      extractedPolicy.sourceDataQueries,
      apiToken,
      workspaceId,
      sourceDataPath
    );

    // Count total components
    const totalComponents = Object.values(sourceData).reduce((sum, components) => sum + components.length, 0);
    console.log(`  Total components collected: ${totalComponents}`);

    // ============================================================
    // STAGE 3: Evaluate Policy
    // ============================================================
    // Get changeSetId for deep links
    const collector = new SourceDataCollector(apiToken, workspaceId);
    const changeSetId = await collector.getHeadChangeSetId();

    const evaluation = await evaluatePolicy(
      extractedPolicy.policyText,
      sourceData,
      workspaceId,
      changeSetId,
      sourceDataPath,
      evaluationPath
    );

    // ============================================================
    // STAGE 4: Generate Report
    // ============================================================
    const reportContent = generateReport(
      extractedPolicy,
      sourceData,
      evaluation,
      workspaceId,
      changeSetId,
      reportPath
    );

    // ============================================================
    // Post to GitHub Issue
    // ============================================================
    if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
      console.log('\n📝 Posting result to GitHub issue...');
      await postPolicyResultToIssue(
        path.basename(policyPath),
        extractedPolicy.policyTitle,
        evaluation,
        reportContent,
        workspaceId,
        changeSetId
      );
    } else {
      console.log('\nℹ️  Skipping GitHub issue posting (not in GitHub Actions environment)');
    }

    // ============================================================
    // Summary
    // ============================================================
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                     Policy Check Complete                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Summary:');
    console.log(`  Policy: ${extractedPolicy.policyTitle}`);
    console.log(`  Result: ${evaluation.result}`);
    console.log(`  Components evaluated: ${totalComponents}`);
    console.log(`  Failing components: ${evaluation.failingComponents.length}`);
    console.log(`\n  Report: ${reportPath}`);

    // Exit with appropriate code
    if (evaluation.result === 'Fail') {
      console.log('\n❌ Policy check FAILED\n');
      process.exit(1);
    } else {
      console.log('\n✅ Policy check PASSED\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║                           ERROR                            ║');
    console.error('╚════════════════════════════════════════════════════════════╝\n');
    console.error('Error running policy check:', error);
    if (error instanceof Error) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}
