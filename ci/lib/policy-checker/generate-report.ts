/**
 * Stage 4: Report Generation
 * Deterministically generates markdown report from all collected data
 */

import * as fs from 'fs';
import type { ExtractedPolicy } from './extract-policy';
import type { SourceDataCollection, ComponentData } from './collect-source-data';
import type { EvaluationResult } from './evaluate-policy';

/**
 * Get value from component attributes by path
 */
function getAttributeValue(component: ComponentData, attributePath: string): string {
  const value = (component as any)[attributePath];
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Generate a markdown table from component data with relevant columns
 */
function generateComponentTable(
  components: ComponentData[],
  relevantColumns: Array<{ attributePath: string; displayName: string }>,
  workspaceId: string,
  changeSetId: string
): string {
  if (components.length === 0) {
    return '| component | ' + relevantColumns.map(c => c.displayName).join(' | ') + ' |\n|' + Array(relevantColumns.length + 1).fill('--').join('|') + '|\n';
  }

  // Build header
  let table = '| component | ' + relevantColumns.map(c => c.displayName).join(' | ') + ' |\n';
  table += '|' + Array(relevantColumns.length + 1).fill('--').join('|') + '|\n';

  // Build rows
  for (const component of components) {
    const schema = component.schema || '';
    const name = component['si/name'] || '';
    const deeplink = `https://app.systeminit.com/n/${workspaceId}/${changeSetId}/h/${component.componentId}/c`;
    const componentLink = `[${schema} ${name}](${deeplink})`;

    const columnValues = relevantColumns.map(col => {
      return getAttributeValue(component, col.attributePath);
    });

    table += `|${componentLink}|` + columnValues.join('|') + '|\n';
  }

  return table;
}

/**
 * Generate the Source Data section
 */
function generateSourceDataSection(
  extractedPolicy: ExtractedPolicy,
  sourceData: SourceDataCollection,
  evaluation: EvaluationResult,
  workspaceId: string,
  changeSetId: string
): string {
  let section = '## Source Data\n\n';
  section += '### System Initiative\n\n';

  // Generate a subsection for each query
  for (const queryName of Object.keys(extractedPolicy.sourceDataQueries)) {
    const components = sourceData[queryName] || [];
    const metadata = evaluation.sourceDataMetadata?.[queryName];

    section += `#### ${queryName}\n\n`;

    if (metadata && metadata.relevantColumns && metadata.relevantColumns.length > 0) {
      section += generateComponentTable(components, metadata.relevantColumns, workspaceId, changeSetId);
      section += '\n';

      // Add reasoning after the table
      if (metadata.reasoning) {
        section += `**Column Selection Reasoning**: ${metadata.reasoning}\n\n`;
      }
    } else {
      // Fallback to basic table if no metadata
      const defaultColumns = [
        { attributePath: 'schema', displayName: 'Schema' },
        { attributePath: 'si/name', displayName: 'Name' }
      ];
      section += generateComponentTable(components, defaultColumns, workspaceId, changeSetId);
      section += '\n';
    }
  }

  return section;
}

/**
 * Generate the Test Results section
 */
function generateTestResultsSection(evaluation: EvaluationResult): string {
  let section = '## Test Results\n\n';
  section += `**Result**: ${evaluation.result}\n\n`;
  section += `${evaluation.summary}\n\n`;

  if (evaluation.failingComponents.length > 0) {
    section += '| component | description |\n';
    section += '| -- | -- |\n';

    for (const component of evaluation.failingComponents) {
      const componentLink = `[${component.schema} ${component.name}](${component.deeplink})`;
      section += `|${componentLink}|${component.description}|\n`;
    }

    section += '\n';
  }

  return section;
}

/**
 * Generate the complete report
 */
export function generateReport(
  extractedPolicy: ExtractedPolicy,
  sourceData: SourceDataCollection,
  evaluation: EvaluationResult,
  workspaceId: string,
  changeSetId: string,
  outputPath: string
): string {
  console.log('\nStage 4: Generating report...');

  // Get current date in ISO 8601 format
  const currentDate = new Date().toISOString().split('.')[0] + 'Z';

  // Build the report
  let report = `# ${extractedPolicy.policyTitle}\n\n`;
  report += `**Date**: ${currentDate}\n\n`;

  // Policy section
  report += `## Policy\n\n`;
  report += `${extractedPolicy.policyText}\n\n`;

  // Tags section
  if (extractedPolicy.outputTags && extractedPolicy.outputTags.length > 0) {
    report += `## Tags\n\n`;
    for (const tag of extractedPolicy.outputTags) {
      report += `- ${tag}\n`;
    }
    report += '\n';
  }

  // Test Results section
  report += generateTestResultsSection(evaluation);

  // Source Data section
  report += generateSourceDataSection(extractedPolicy, sourceData, evaluation, workspaceId, changeSetId);

  // Write to file
  fs.writeFileSync(outputPath, report, 'utf-8');

  console.log(`✓ Report generation complete`);
  console.log(`  Output: ${outputPath}`);

  return report;
}
