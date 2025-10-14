# Infrastructure Management Guide

This document provides guidance for building and managing infrastructure for the tonys-chips project using System Initiative.

## Naming Conventions

- **Primary Convention**: Use `kebab-case` for all resource names where possible
- **Fallback Convention**: Use `lowerCamelCase` when kebab-case is not permitted by the service
- **Name Tags**: When resources support a `Name` tag, it MUST match the `si/name` value

### Examples

**Good:**
```
si/name: tonys-chips-api-server
Name tag: tonys-chips-api-server
```

**When kebab-case not supported:**
```
si/name: tonysChipsApiServer
Name tag: tonysChipsApiServer
```

## AWS Tagging Policy

### Required Tags

Every AWS resource MUST include the following tags:

#### Environment
Indicates the deployment environment.

**Valid Values:**
- `Sandbox`
- `Shared`
- `Dev`
- `PreProd`
- `Prod`

#### Owner
Email address of the person or team responsible for the resource.

**Rules:**
- Initially set to creator's email if unknown
- Must be a valid email address
- Should be updated if ownership changes

#### CostCenter
Internal accounting reference for cost allocation and chargeback.

**Valid Values:**
- `ProjectApollo`
- `ProjectOrigin`
- `CustomerPortal`
- `DevelopmentSandbox`
- `TestingQA`

**Default:** Use `DevelopmentSandbox` for unallocated or unknown cases.

#### Application
The service, product, or project name this resource supports.

**Rules:**
- Create a new name if the resource is unallocated or for an unknown case
- Should be descriptive and consistent across related resources
- Examples: `tonys-chips-api`, `tonys-chips-web`, `tonys-chips-data-pipeline`

### Tag Formatting Standards

#### Tag Keys
- MUST use `PascalCase` (e.g., `CostCenter`, `Application`, `Owner`)
- No spaces, hyphens, or underscores

#### Tag Values
- MUST come from approved lists where applicable (see above)
- Free-form values allowed when no approved list exists
- Free-form tags may be used for special cases but MUST NOT conflict with organizational tags

### Enforcement and Compliance

**Non-Compliance Consequences:**
- Resources without required tags may be automatically stopped
- Creation requests may be denied at the policy level
- Resources flagged for remediation during audits

**Accountability:**
- Teams are responsible for maintaining tag accuracy
- Stale or incorrect tags will be flagged during periodic audits
- Tags should be reviewed and updated as part of infrastructure changes

### Cost Allocation and Chargeback

**CostCenter Requirements:**
- The `CostCenter` tag is REQUIRED on all billable resources:
  - EC2 instances
  - RDS databases
  - S3 buckets
  - Lambda functions
  - Load balancers
  - NAT gateways
  - Any other resource that incurs direct costs

**Financial Impact:**
- Untagged resources may be assigned to a default CostCenter
- Untagged resources are subject to higher internal chargeback rates
- Proper tagging ensures accurate cost attribution to your team/project

## Working with System Initiative

### Change Set Workflow

1. **Create a Change Set** - All infrastructure changes MUST be made in a change set, never directly in HEAD
2. **Make Changes** - Create, update, or delete components as needed
3. **Check Qualifications** - Review qualification results to ensure changes are valid
4. **Apply to HEAD** - Once validated, apply the change set to make changes live
5. **Monitor Actions** - Check for action failures after applying

### Component Configuration

When creating AWS components in System Initiative:

1. **Always set required subscriptions:**
   - `/secrets/AWS Credential` → Subscribe to AWS Credential component
   - `/domain/extra/Region` → Subscribe to Region component

2. **Always configure required tags:**
   ```
   /domain/Tags/0/Key: "Environment"
   /domain/Tags/0/Value: "Dev"

   /domain/Tags/1/Key: "Owner"
   /domain/Tags/1/Value: "your-email@example.com"

   /domain/Tags/2/Key: "CostCenter"
   /domain/Tags/2/Value: "DevelopmentSandbox"

   /domain/Tags/3/Key: "Application"
   /domain/Tags/3/Value: "tonys-chips-api"
   ```

3. **Set Name tag to match si/name:**
   ```
   /domain/si/name: "tonys-chips-api-server"
   /domain/Tags/4/Key: "Name"
   /domain/Tags/4/Value: "tonys-chips-api-server"
   ```

### Best Practices

- **Validate Before Apply**: Always check component qualifications before applying a change set
- **Use Descriptive Names**: Resource names should clearly indicate their purpose
- **Group Related Resources**: Use consistent naming prefixes for resources that work together
- **Document Complex Configurations**: Add comments or descriptions in System Initiative for non-obvious setups
- **Review Tags Regularly**: Audit tags during infrastructure reviews to ensure accuracy
- **Update Tags on Changes**: When a resource's purpose or ownership changes, update tags immediately

## Getting Help

For questions about:
- **System Initiative Usage**: Consult the System Initiative documentation or your infrastructure team
- **Tag Policies**: Contact the FinOps or Cloud Governance team
- **Cost Centers**: Reach out to Finance or your team lead
- **Infrastructure Design**: Consult with the platform engineering team
