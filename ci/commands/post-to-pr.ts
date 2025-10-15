/**
 * Post to GitHub PR command implementation
 * Generic command for posting various types of content to GitHub PRs with subcommands
 */

import * as fs from 'fs/promises';

interface GitHubPRComment {
  body: string;
}

class GitHubClient {
  private token: string;
  private repo: string;
  private owner: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN || '';
    const repoFullName = process.env.GITHUB_REPOSITORY || '';
    
    if (!this.token) {
      throw new Error('Missing required environment variable: GITHUB_TOKEN');
    }
    
    if (!repoFullName) {
      throw new Error('Missing required environment variable: GITHUB_REPOSITORY');
    }

    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid repository format: ${repoFullName}. Expected format: owner/repo`);
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

  async findPRForCommit(commitSha: string): Promise<number | null> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/commits/${commitSha}/pulls`;
    
    try {
      const response = await fetch(url, {
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const pulls = await response.json() as any[];
      
      if (pulls.length === 0) {
        console.log(`No PR found for commit ${commitSha}`);
        return null;
      }

      // Return the first PR (most common case)
      const pr = pulls[0];
      console.log(`Found PR #${pr.number}: ${pr.title}`);
      return pr.number;
    } catch (error) {
      console.error(`Failed to find PR for commit ${commitSha}:`, error);
      return null;
    }
  }

  async postComment(prNumber: number, body: string): Promise<void> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/issues/${prNumber}/comments`;
    
    const comment: GitHubPRComment = { body };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(comment)
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
      
      // Look for existing comment with the identifier
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
    
    const comment: GitHubPRComment = { body };

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(comment)
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

async function handleNewEnvironment(args: string[]): Promise<void> {
  if (args.length < 2) {
    console.error("❌ Missing required arguments for new-environment");
    console.error("Usage: post-to-pr new-environment <pr-number> <version> [endpoint]");
    console.error("Example: post-to-pr new-environment 123 20241015.143022.0-sha.abc1234 52.1.2.3");
    process.exit(1);
  }

  const [prNumberStr, version, endpoint] = args;
  
  // Validate PR number
  if (!/^\d+$/.test(prNumberStr)) {
    console.error(`❌ Invalid PR number: ${prNumberStr}. Must be a positive integer.`);
    process.exit(1);
  }
  
  const prNumber = parseInt(prNumberStr, 10);
  
  console.log("📝 Posting new environment info to GitHub PR");
  console.log(`📋 PR Number: ${prNumber}`);
  console.log(`📋 Version: ${version}`);
  if (endpoint) {
    console.log(`📋 Endpoint: ${endpoint}`);
  }
  console.log("");

  // Determine endpoint - either from args or from IP file
  let publicEndpoint: string | null = null;
  
  if (endpoint) {
    publicEndpoint = endpoint;
    console.log(`📍 Using provided endpoint: ${publicEndpoint}`);
  } else {
    try {
      const ipFromFile = (await fs.readFile('./ip', 'utf8')).trim();
      publicEndpoint = ipFromFile;
      console.log(`📍 Using endpoint from IP file: ${publicEndpoint}`);
    } catch (error) {
      console.log("⚠️  No endpoint provided and no IP file found");
    }
  }

  // Check for error file
  let errorMessage: string | null = null;
  try {
    errorMessage = (await fs.readFile('./error', 'utf8')).trim();
    console.log(`❌ Found error message: ${errorMessage}`);
  } catch (error) {
    // No error file is fine
  }

  const client = new GitHubClient();

  // Create unique identifier for this comment type
  const commentIdentifier = `new-environment-${version}`;

  // Check for existing comment for this environment
  const existingCommentId = await client.findExistingComment(prNumber, commentIdentifier);

  // Create comment body
  let commentBody: string;
  
  if (publicEndpoint && !errorMessage) {
    // Successful deployment
    commentBody = `<!-- ${commentIdentifier} -->
🚀 **New Environment Deployed**

✅ Your Tony's Chips application has been deployed and will be ready for testing in a few minutes!

**Environment Details:**
- 🌐 **Application URL:** \`http://${publicEndpoint}:8080\`
- 🏷️ **Version:** \`${version}\`
- ⏰ **Deployed:** ${new Date().toISOString()}

**Quick Links:**
- 🎯 **Application:** [http://${publicEndpoint}:8080](http://${publicEndpoint}:8080)
- 🔧 **API Health Check:** [http://${publicEndpoint}:8080/api/health](http://${publicEndpoint}:8080/api/health)
- 📦 **Products API:** [http://${publicEndpoint}:8080/api/products](http://${publicEndpoint}:8080/api/products)

**Testing the Environment:**
\`\`\`bash
# Access the web application
open http://${publicEndpoint}:8080

# Test API endpoints
curl http://${publicEndpoint}:8080/api/health
curl http://${publicEndpoint}:8080/api/products

# Test the full application flow
curl -X POST http://${publicEndpoint}:8080/api/cart \\
  -H "Content-Type: application/json" \\
  -d '{"productId": 1, "quantity": 2}'
\`\`\`

> 💡 **Tip:** This environment will be automatically cleaned up after testing is complete.`;
  } else if (errorMessage) {
    // Failed deployment
    commentBody = `<!-- ${commentIdentifier} -->
❌ **Environment Deployment Failed**

The deployment for version \`${version}\` encountered an error:

**Error Details:**
\`\`\`
${errorMessage}
\`\`\`

**Deployment Details:**
- 🏷️ **Version:** \`${version}\`
- ⏰ **Attempted:** ${new Date().toISOString()}

Please check the workflow logs for more details.`;
  } else {
    // Unknown state
    commentBody = `<!-- ${commentIdentifier} -->
⚠️ **Environment Deployment Status Unknown**

The deployment for version \`${version}\` completed, but no endpoint information was found.

**Deployment Details:**
- 🏷️ **Version:** \`${version}\`
- ⏰ **Attempted:** ${new Date().toISOString()}

Please check the workflow logs for more details.`;
  }

  // Post or update comment
  if (existingCommentId) {
    console.log(`Updating existing comment ID: ${existingCommentId}`);
    await client.updateComment(existingCommentId, commentBody);
  } else {
    console.log(`Posting new comment to PR #${prNumber}`);
    await client.postComment(prNumber, commentBody);
  }

  console.log("✅ Successfully posted environment info to PR");
}

export async function postToPr(args: string[]): Promise<void> {
  if (args.length < 1) {
    console.error("❌ Missing subcommand");
    console.error("Usage: post-to-pr <subcommand> [args...]");
    console.error("");
    console.error("Available subcommands:");
    console.error("  new-environment <pr-number> <version> [endpoint]");
    console.error("    Post new environment deployment info to PR");
    console.error("");
    console.error("Examples:");
    console.error("  post-to-pr new-environment 123 20241015.143022.0-sha.abc1234");
    console.error("  post-to-pr new-environment 123 20241015.143022.0-sha.abc1234 52.1.2.3");
    process.exit(1);
  }

  const [subcommand, ...subArgs] = args;

  switch (subcommand) {
    case 'new-environment':
      await handleNewEnvironment(subArgs);
      break;
    default:
      console.error(`❌ Unknown subcommand: ${subcommand}`);
      console.error("Available subcommands: new-environment");
      process.exit(1);
  }
}