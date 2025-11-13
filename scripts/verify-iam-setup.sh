#!/bin/bash
# Quick verification script for ElastiCache IAM setup
set -e

REGION=${AWS_REGION:-us-east-1}
USERNAME="tonys-chips-web"
CACHE_NAME="tonys-chips-sandbox"

echo "=== Quick IAM Setup Verification ==="
echo ""

# 1. Check user exists and auth type
echo "1. Checking user '$USERNAME'..."
USER_AUTH=$(aws elasticache describe-users \
  --user-id "$USERNAME" \
  --region "$REGION" \
  --query 'Users[0].Authentication.Type' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$USER_AUTH" = "iam" ]; then
  echo "   ✓ User exists with IAM authentication"
else
  echo "   ❌ User authentication type: $USER_AUTH (expected: iam)"
fi

# 2. Check user is in a UserGroup
echo ""
echo "2. Checking UserGroups..."
USER_GROUPS=$(aws elasticache describe-user-groups \
  --region "$REGION" \
  --query "UserGroups[?contains(UserIds, '$USERNAME')].UserGroupId" \
  --output text)

if [ -z "$USER_GROUPS" ]; then
  echo "   ❌ User is NOT in any UserGroup!"
  exit 1
else
  echo "   ✓ User is in UserGroups: $USER_GROUPS"
fi

# 3. Check if UserGroup is attached to Serverless cache
echo ""
echo "3. Checking Serverless cache '$CACHE_NAME'..."
for UG in $USER_GROUPS; do
  CACHE_UG=$(aws elasticache describe-serverless-caches \
    --serverless-cache-name "$CACHE_NAME" \
    --region "$REGION" \
    --query 'ServerlessCaches[0].UserGroupId' \
    --output text 2>/dev/null || echo "NOT_FOUND")

  if [ "$CACHE_UG" = "$UG" ]; then
    echo "   ✓ Cache uses UserGroup: $UG"

    # Show all users in the UserGroup
    ALL_USERS=$(aws elasticache describe-user-groups \
      --user-group-id "$UG" \
      --region "$REGION" \
      --query 'UserGroups[0].UserIds' \
      --output json)

    echo "   Users in UserGroup: $ALL_USERS"

  fi
done

# 4. Check ECS task role policy
echo ""
echo "4. Checking ECS task role policy..."
TASK_ROLE="tonys-chips-web-task-role"

# List policies
POLICIES=$(aws iam list-attached-role-policies \
  --role-name "$TASK_ROLE" \
  --query 'AttachedPolicies[*].PolicyArn' \
  --output text 2>/dev/null || echo "")

echo "   Attached policies:"
for POLICY_ARN in $POLICIES; do
  POLICY_NAME=$(echo $POLICY_ARN | rev | cut -d'/' -f1 | rev)
  echo "     - $POLICY_NAME"

  # Check if it's elasticache-related
  if [[ "$POLICY_NAME" == *"elasticache"* ]] || [[ "$POLICY_NAME" == *"ElastiCache"* ]]; then
    VERSION=$(aws iam get-policy --policy-arn "$POLICY_ARN" --query 'Policy.DefaultVersionId' --output text)
    POLICY_DOC=$(aws iam get-policy-version --policy-arn "$POLICY_ARN" --version-id "$VERSION" --query 'PolicyVersion.Document' --output json)
    echo "       Policy document: $POLICY_DOC"
  fi
done

# Check inline policies
INLINE_POLICIES=$(aws iam list-role-policies \
  --role-name "$TASK_ROLE" \
  --query 'PolicyNames' \
  --output text 2>/dev/null || echo "")

if [ -n "$INLINE_POLICIES" ]; then
  echo "   Inline policies:"
  for POLICY_NAME in $INLINE_POLICIES; do
    echo "     - $POLICY_NAME"
    POLICY_DOC=$(aws iam get-role-policy \
      --role-name "$TASK_ROLE" \
      --policy-name "$POLICY_NAME" \
      --query 'PolicyDocument' \
      --output json)
    echo "       Policy document: $POLICY_DOC"
  done
fi

echo ""
echo "=== Verification Complete ==="
