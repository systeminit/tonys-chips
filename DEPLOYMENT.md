# Deployment Plan for Tony's World of Chips

## Overview
This document describes the deployment architecture for the application using System Initiative to manage AWS infrastructure.

## Architecture Summary

### Network Architecture
- **VPC**: Dedicated VPC for the application
- **Subnets**: Private subnets across multiple availability zones
  - Web tier subnets (private)
  - API tier subnets (private)
  - Database tier subnets (private)
- **Load Balancers**:
  - Public Application Load Balancer for web tier
  - Internal Application Load Balancer for API tier

### Compute & Container Infrastructure
- **Container Registry**: Amazon ECR for Docker images
- **Container Orchestration**: Amazon ECS with Fargate
- **ECS Services**:
  - Web frontend service (behind public ALB)
  - API backend service (behind internal ALB)

### Database
- **Database**: Amazon RDS PostgreSQL instance in private subnets

### Security
- **Security Groups**:
  - Public ALB: Allow HTTPS/HTTP from internet
  - Web tier: Allow traffic from public ALB only
  - Internal ALB: Allow traffic from web tier only
  - API tier: Allow traffic from internal ALB only
  - Database: Allow PostgreSQL (5432) from API tier only
- **IAM Roles**:
  - ECS Task Execution Role (pull images from ECR, write logs)
  - ECS Task Role for web tier
  - ECS Task Role for API tier (access to RDS)

## Container Build & Versioning

### Image Tagging Strategy
All container images are tagged with: `YYYYMMDDHHMMSS-{gitsha}`

Example: `20250109143022-a7b3c5d`

### Images
- `tonys-chips-web:{version}` - Frontend application
- `tonys-chips-api:{version}` - Backend API

## System Initiative Implementation Plan

### Phase 1: Core Network Infrastructure ✅ COMPLETED
**Change Set:** `tonys-chips-network` (ID: 01K75SD3CAS49FQG9JG6GFR3KC)

**Components Created:**
1. ✅ `tonys-chips-vpc` (AWS::EC2::VPC)
   - CIDR: 10.0.0.0/16
   - DNS Support: Enabled
   - DNS Hostnames: Enabled

2. ✅ `tonys-chips-igw` (AWS::EC2::InternetGateway)

3. ✅ `tonys-chips-igw-attachment` (AWS::EC2::VPCGatewayAttachment)

4. ✅ Subnets (6 total across 2 AZs: us-west-1a and us-west-1c):
   - `tonys-chips-subnet-web-1a` - 10.0.1.0/24 (us-west-1a)
   - `tonys-chips-subnet-web-1b` - 10.0.2.0/24 (us-west-1c)
   - `tonys-chips-subnet-api-1a` - 10.0.11.0/24 (us-west-1a)
   - `tonys-chips-subnet-api-1b` - 10.0.12.0/24 (us-west-1c)
   - `tonys-chips-subnet-db-1a` - 10.0.21.0/24 (us-west-1a)
   - `tonys-chips-subnet-db-1b` - 10.0.22.0/24 (us-west-1c)

5. ✅ `tonys-chips-rtb-private` (AWS::EC2::RouteTable)

6. ✅ Route Table Associations (6 total):
   - All subnets associated with private route table

**Status:** Applied to HEAD. All resources created successfully.

### Phase 2: Security Infrastructure ✅ COMPLETED
**Change Set:** `tonys-chips-security` (ID: 01K75SVYVVKKRPQFWXVZ6BME12)

**Components Created:**
1. ✅ Security Groups:
   - `sg-public-alb` (AWS::EC2::SecurityGroup)
     - Ingress: HTTP (80) and HTTPS (443) from 0.0.0.0/0
   - `sg-web-tier` (AWS::EC2::SecurityGroup)
     - Ingress: HTTP (80) from sg-public-alb
   - `sg-internal-alb` (AWS::EC2::SecurityGroup)
     - Ingress: HTTP (80) from sg-web-tier
   - `sg-api-tier` (AWS::EC2::SecurityGroup)
     - Ingress: TCP (3000) from sg-internal-alb
   - `sg-database` (AWS::EC2::SecurityGroup)
     - Ingress: PostgreSQL (5432) from sg-api-tier

2. ✅ IAM Roles:
   - `ecs-task-execution-role` (AWS::IAM::Role)
     - Trust policy: ecs-tasks.amazonaws.com
   - `ecs-task-role-web` (AWS::IAM::Role)
     - Trust policy: ecs-tasks.amazonaws.com
   - `ecs-task-role-api` (AWS::IAM::Role)
     - Trust policy: ecs-tasks.amazonaws.com

3. ✅ IAM Managed Policy:
   - `ecs-task-execution-policy` (AWS::IAM::ManagedPolicy)
     - ECR and CloudWatch Logs permissions
     - Attached to ecs-task-execution-role via AWS::IAM::RolePolicy

**Status:** Applied to HEAD. All resources created successfully.

### Phase 3: Database Layer ✅ COMPLETED
**Change Set:** `tonys-chips-database` (ID: 01K75TKZG8MNR4EW4G9R850HSB)

**Components Created:**
1. ✅ `tonys-chips-db-subnet-group` (AWS::RDS::DBSubnetGroup)
   - Subnets: tonys-chips-subnet-db-1a, tonys-chips-subnet-db-1b

2. ✅ `tonys-chips-postgres-db` (AWS::RDS::DBInstance)
   - Engine: postgres
   - Instance class: db.t3.micro
   - Allocated storage: 20GB
   - Master username: postgres
   - Master password: AWS-managed (stored in Secrets Manager automatically)
   - Storage encrypted: true
   - Publicly accessible: false
   - VPC Security Group: sg-database
   - DB Subnet Group: tonys-chips-db-subnet-group

**Status:** Applied to HEAD. All resources created successfully.

### Phase 4: Load Balancers ✅ COMPLETED
**Change Set:** `tonys-chips-load-balancers` (ID: 01K75VXRS8D9BXEZKZGTDW7AG8)

**Components Created:**
1. ✅ Public ALB:
   - `tonys-chips-public-alb` (AWS::ElasticLoadBalancingV2::LoadBalancer)
     - Scheme: internet-facing
     - Subnets: tonys-chips-subnet-web-1a, tonys-chips-subnet-web-1b
     - Security Groups: sg-public-alb
   - `tonys-chips-web-tg` (AWS::ElasticLoadBalancingV2::TargetGroup)
     - Port: 80
     - Protocol: HTTP
     - Target type: ip (for ECS Fargate)
     - Health checks enabled
   - `tonys-chips-public-alb-listener` (AWS::ElasticLoadBalancingV2::Listener)
     - Port: 80
     - Protocol: HTTP
     - Default action: forward to tonys-chips-web-tg

2. ✅ Internal ALB:
   - `tonys-chips-internal-alb` (AWS::ElasticLoadBalancingV2::LoadBalancer)
     - Scheme: internal
     - Subnets: tonys-chips-subnet-api-1a, tonys-chips-subnet-api-1b
     - Security Groups: sg-internal-alb
   - `tonys-chips-api-tg` (AWS::ElasticLoadBalancingV2::TargetGroup)
     - Port: 3000
     - Protocol: HTTP
     - Target type: ip (for ECS Fargate)
     - Health checks enabled
   - `tonys-chips-internal-alb-listener` (AWS::ElasticLoadBalancingV2::Listener)
     - Port: 80
     - Protocol: HTTP
     - Default action: forward to tonys-chips-api-tg

**Status:** Applied to HEAD. All resources created successfully.

### Phase 5: Container Registry ✅ COMPLETED
**Change Set:** `tonys-chips-ecr` (ID: 01K75WCA4D1KVMNZ6WVHJZ5ZHQ)

**Components Created:**
1. ✅ `tonys-chips-web-repo` (AWS::ECR::Repository)
   - Repository name: tonys-chips-web
   - Image scanning: Enabled on push
   - Lifecycle policy: Keep last 10 images

2. ✅ `tonys-chips-api-repo` (AWS::ECR::Repository)
   - Repository name: tonys-chips-api
   - Image scanning: Enabled on push
   - Lifecycle policy: Keep last 10 images

**Status:** Applied to HEAD. All resources created successfully.

**GitHub Actions Deploy Role:**
**Change Set:** `tonys-chips-github-deploy-role` (ID: 01K75WYPK78V77G8831W7J2MCF)

**Components Created:**
1. ✅ `aws-account-info` (AWS Account)
   - Retrieves AWS account ID for use in IAM policies

2. ✅ `github-oidc-provider-arn` (String Template)
   - Template: `arn:aws:iam::<%= AccountId %>:oidc-provider/token.actions.githubusercontent.com`
   - Dynamically builds OIDC provider ARN using account ID

3. ✅ `github-trust-policy` (String Template)
   - Template: GitHub OIDC trust policy for AssumeRoleWithWebIdentity
   - **IMPORTANT:** Update the template with your GitHub organization and repository name
   - Replace `GITHUB_ORG/GITHUB_REPO` with your actual values (e.g., `myorg/sample-app`)

4. ✅ `ecr-push-policy` (AWS::IAM::ManagedPolicy)
   - Policy name: tonys-chips-ecr-push-policy
   - Permissions:
     - `ecr:GetAuthorizationToken` (global)
     - ECR repository operations for tonys-chips-web and tonys-chips-api
     - Allows: push, pull, list, describe images

5. ✅ `github-actions-deploy-role` (AWS::IAM::Role)
   - Role name: tonys-chips-github-deploy-role
   - Trust policy: Subscribes to github-trust-policy String Template
   - Attached policy: ecr-push-policy
   - Used by GitHub Actions to push container images to ECR

6. ✅ `attach-ecr-push-policy` (AWS::IAM::RolePolicy)
   - Attaches ecr-push-policy to github-actions-deploy-role

**Status:** All components created. Qualifications passed (with expected warning about GitHub repo specificity).

**Configuration Required:**
- Update the `github-trust-policy` String Template component with your GitHub organization and repository name
- Set up GitHub Actions with AWS_DEPLOY_ROLE_ARN secret pointing to the ARN of `github-actions-deploy-role`
- Ensure GitHub OIDC provider is configured in your AWS account

### Phase 6: ECS Cluster & Services ✅ COMPLETED
**Change Set:** `tonys-chips-ecs` (ID: 01K75WH6EC62B83JJZDK9NBEW7)

**Components Created:**
1. ✅ `tonys-chips-ecs-cluster` (AWS::ECS::Cluster)
   - Cluster name: tonys-chips-cluster

2. ✅ ECS Task Definitions:
   - `tonys-chips-web-task` (AWS::ECS::TaskDefinition)
     - Family: tonys-chips-web
     - Network mode: awsvpc
     - Launch type: FARGATE
     - CPU: 256
     - Memory: 512
     - Execution role: ecs-task-execution-role
     - Task role: ecs-task-role-web
     - Container: tonys-chips-web
       - Image: nginx:latest (placeholder, will be updated with actual ECR image)
       - Port: 80
       - Logs: CloudWatch (/ecs/tonys-chips-web)

   - `tonys-chips-api-task` (AWS::ECS::TaskDefinition)
     - Family: tonys-chips-api
     - Network mode: awsvpc
     - Launch type: FARGATE
     - CPU: 256
     - Memory: 512
     - Execution role: ecs-task-execution-role
     - Task role: ecs-task-role-api
     - Container: tonys-chips-api
       - Image: nginx:latest (placeholder, will be updated with actual ECR image)
       - Port: 3000
       - Logs: CloudWatch (/ecs/tonys-chips-api)

3. ✅ ECS Services:
   - `tonys-chips-web-service` (AWS::ECS::Service)
     - Launch type: FARGATE
     - Task definition: tonys-chips-web-task
     - Desired count: 2
     - Subnets: tonys-chips-subnet-web-1a, tonys-chips-subnet-web-1b
     - Security group: sg-web-tier
     - Load balancer: tonys-chips-web-tg (public ALB)
     - Public IP: Disabled

   - `tonys-chips-api-service` (AWS::ECS::Service)
     - Launch type: FARGATE
     - Task definition: tonys-chips-api-task
     - Desired count: 2
     - Subnets: tonys-chips-subnet-api-1a, tonys-chips-subnet-api-1b
     - Security group: sg-api-tier
     - Load balancer: tonys-chips-api-tg (internal ALB)
     - Public IP: Disabled

**Status:** All components created and qualifications passed.

**Note:** Task definitions currently use placeholder nginx:latest images. These should be updated to use actual application images from ECR repositories (tonys-chips-web:tag and tonys-chips-api:tag) once containers are built and pushed.

## Configuration Management

### Environment Variables

**Web Container:**
- `VITE_API_URL`: Internal ALB DNS name (e.g., http://internal-api-alb.us-east-1.elb.amazonaws.com)

**API Container:**
- `DATABASE_URL`: PostgreSQL connection string from RDS
- `NODE_ENV`: production
- `PORT`: 3000

### Secrets Management
Use AWS Secrets Manager for:
- RDS master password
- Any API keys or sensitive configuration

Reference secrets in ECS task definitions using `secrets` parameter instead of `environment`.

## Deployment Workflow

### Initial Infrastructure Setup
1. Create all change sets in order (phases 1-6)
2. Review qualifications for each component
3. Apply change sets to HEAD
4. Verify all AWS resources are created successfully

### Application Deployment
1. GitHub Actions workflow triggers on merge to main
2. Build containers with timestamp-gitsha tag
3. Push to ECR repositories
4. Update ECS task definitions with new image tags (via System Initiative or AWS CLI)
5. ECS performs rolling deployment to services

## Monitoring & Operations

### Health Checks
- ALB target group health checks for both tiers
- ECS service auto-recovery on task failures

### Logging
- ECS task logs to CloudWatch Logs
- ALB access logs to S3

### Scaling
- Configure ECS service auto-scaling based on CPU/memory
- Consider RDS read replicas if needed

## Cost Optimization
- Use Fargate Spot for non-production environments
- Right-size RDS instance based on workload
- Configure ECR lifecycle policies to remove old images
- Use NAT Gateway sparingly or VPC endpoints for AWS services

## Security Checklist
- [ ] All subnets are private (no direct internet access except via load balancers)
- [ ] Security groups follow principle of least privilege
- [ ] IAM roles have minimum required permissions
- [ ] RDS instance not publicly accessible
- [ ] Secrets stored in Secrets Manager, not environment variables
- [ ] Container images scanned for vulnerabilities
- [ ] HTTPS enabled on public ALB with valid certificate

## Future Enhancements
- Add AWS WAF to public ALB
- Implement CloudFront CDN for static assets
- Add AWS Certificate Manager for SSL/TLS certificates
- Implement VPC Flow Logs for network monitoring
- Add RDS automated backups and point-in-time recovery
- Implement blue/green deployments with ECS
