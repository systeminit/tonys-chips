#!/bin/bash
# Script to verify ElastiCache IAM configuration
# Usage: ./scripts/check-elasticache-iam.sh <environment>

set -e

ENVIRONMENT=${1:-sandbox}
REGION=${AWS_REGION:-us-east-1}
USERNAME="tonys-chips-web"

echo "=== ElastiCache IAM Configuration Check ==="
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Username: $USERNAME"
echo ""

# 1. Check if user exists and is IAM-enabled
echo "1. Checking ElastiCache user..."
if aws elasticache describe-users \
  --user-id "$USERNAME" \
  --region "$REGION" 2>/dev/null | jq -r '.Users[0]'; then

  USER_STATUS=$(aws elasticache describe-users \
    --user-id "$USERNAME" \
    --region "$REGION" \
    --query 'Users[0].Status' \
    --output text)

  AUTH_TYPE=$(aws elasticache describe-users \
    --user-id "$USERNAME" \
    --region "$REGION" \
    --query 'Users[0].Authentication.Type' \
    --output text)

  echo "   ✓ User exists"
  echo "   Status: $USER_STATUS"
  echo "   Auth Type: $AUTH_TYPE"

  if [ "$AUTH_TYPE" != "iam" ]; then
    echo "   ❌ ERROR: Authentication type is not 'iam'"
    exit 1
  fi

  if [ "$USER_STATUS" != "active" ]; then
    echo "   ⚠️  WARNING: User status is not 'active'"
  fi
else
  echo "   ❌ ERROR: User '$USERNAME' not found"
  exit 1
fi
echo ""

# 2. Check UserGroups
echo "2. Checking UserGroups..."
USER_GROUPS=$(aws elasticache describe-user-groups \
  --region "$REGION" \
  --query "UserGroups[?contains(UserIds, '$USERNAME')].UserGroupId" \
  --output text)

if [ -z "$USER_GROUPS" ]; then
  echo "   ❌ ERROR: User '$USERNAME' is not in any UserGroup"
  exit 1
fi

echo "   ✓ User is in UserGroups: $USER_GROUPS"

for UG in $USER_GROUPS; do
  USERS=$(aws elasticache describe-user-groups \
    --user-group-id "$UG" \
    --region "$REGION" \
    --query 'UserGroups[0].UserIds' \
    --output json)
  echo "   UserGroup '$UG' users: $USERS"

  # Check if default user is included
  if echo "$USERS" | jq -e 'contains(["default"])' > /dev/null; then
    echo "   ✓ UserGroup includes 'default' user"
  else
    echo "   ⚠️  WARNING: UserGroup does not include 'default' user"
  fi
done
echo ""

# 3. Check Serverless caches using the UserGroup
echo "3. Checking Serverless caches..."
for UG in $USER_GROUPS; do
  CACHES=$(aws elasticache describe-serverless-caches \
    --region "$REGION" \
    --query "ServerlessCaches[?UserGroupId=='$UG'].ServerlessCacheName" \
    --output text 2>/dev/null || echo "")

  if [ -n "$CACHES" ]; then
    echo "   ✓ UserGroup '$UG' attached to caches: $CACHES"

    for CACHE in $CACHES; do
      CACHE_STATUS=$(aws elasticache describe-serverless-caches \
        --serverless-cache-name "$CACHE" \
        --region "$REGION" \
        --query 'ServerlessCaches[0].Status' \
        --output text)

      CACHE_ENDPOINT=$(aws elasticache describe-serverless-caches \
        --serverless-cache-name "$CACHE" \
        --region "$REGION" \
        --query 'ServerlessCaches[0].Endpoint.Address' \
        --output text)

      echo "   Cache: $CACHE"
      echo "     Status: $CACHE_STATUS"
      echo "     Endpoint: $CACHE_ENDPOINT"
    done
  fi
done
echo ""

# 4. Get User ARN for IAM policy
echo "4. Required IAM Policy Resource ARNs..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
USER_ARN="arn:aws:elasticache:$REGION:$ACCOUNT_ID:user:$USERNAME"

echo "   User ARN: $USER_ARN"
echo ""

for UG in $USER_GROUPS; do
  CACHES=$(aws elasticache describe-serverless-caches \
    --region "$REGION" \
    --query "ServerlessCaches[?UserGroupId=='$UG'].ServerlessCacheName" \
    --output text 2>/dev/null || echo "")

  for CACHE in $CACHES; do
    CACHE_ARN="arn:aws:elasticache:$REGION:$ACCOUNT_ID:serverlesscache:$CACHE"
    echo "   Cache ARN: $CACHE_ARN"
  done
done
echo ""

# 5. Show required IAM policy
echo "5. Required IAM Policy for ECS Task Role:"
echo ""
cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "elasticache:Connect",
      "Resource": [
        "$USER_ARN",
EOF

for UG in $USER_GROUPS; do
  CACHES=$(aws elasticache describe-serverless-caches \
    --region "$REGION" \
    --query "ServerlessCaches[?UserGroupId=='$UG'].ServerlessCacheName" \
    --output text 2>/dev/null || echo "")

  for CACHE in $CACHES; do
    CACHE_ARN="arn:aws:elasticache:$REGION:$ACCOUNT_ID:serverlesscache:$CACHE"
    echo "        \"$CACHE_ARN\","
  done
done

cat <<'EOF'
      ]
    }
  ]
}
EOF

echo ""
echo "=== Check Complete ==="
echo ""
echo "Next Steps:"
echo "1. Verify the ECS task role has the IAM policy shown above"
echo "2. Check that both the user ARN and cache ARN are included"
echo "3. Redeploy the ECS task if the policy was just updated"
