#!/bin/bash
# Verify the tonys-chips-web user configuration in detail
set -e

REGION=${AWS_REGION:-us-east-1}
USERNAME="tonys-chips-web"
CACHE_NAME="tonys-chips-sandbox"
TASK_ROLE="tonys-chips-web-task-role"

echo "=== Detailed Verification of '$USERNAME' User ==="
echo ""

# 1. Get full user details
echo "1. User Details:"
USER_INFO=$(aws elasticache describe-users \
  --user-id "$USERNAME" \
  --region "$REGION" \
  --query 'Users[0]' \
  --output json)

echo "$USER_INFO" | jq .

USER_ARN=$(echo "$USER_INFO" | jq -r '.ARN')
AUTH_TYPE=$(echo "$USER_INFO" | jq -r '.Authentication.Type')
STATUS=$(echo "$USER_INFO" | jq -r '.Status')

echo ""
if [ "$AUTH_TYPE" = "iam" ]; then
  echo "   ✓ Authentication type: $AUTH_TYPE (correct)"
else
  echo "   ❌ Authentication type: $AUTH_TYPE (should be 'iam')"
  exit 1
fi

if [ "$STATUS" = "active" ]; then
  echo "   ✓ Status: $STATUS"
else
  echo "   ❌ Status: $STATUS (should be 'active')"
  exit 1
fi

# 2. Check UserGroup membership
echo ""
echo "2. UserGroup Membership:"
USER_GROUPS=$(aws elasticache describe-user-groups \
  --region "$REGION" \
  --query "UserGroups[?contains(UserIds, '$USERNAME')].[UserGroupId]" \
  --output text)

if [ -z "$USER_GROUPS" ]; then
  echo "   ❌ User is NOT in any UserGroup!"
  exit 1
else
  echo "   ✓ User is in UserGroups: $USER_GROUPS"
fi

# 3. Verify cache's UserGroup contains this user
echo ""
echo "3. Cache UserGroup Verification:"
CACHE_UG=$(aws elasticache describe-serverless-caches \
  --serverless-cache-name "$CACHE_NAME" \
  --region "$REGION" \
  --query 'ServerlessCaches[0].UserGroupId' \
  --output text)

echo "   Cache UserGroup: $CACHE_UG"

UG_USERS=$(aws elasticache describe-user-groups \
  --user-group-id "$CACHE_UG" \
  --region "$REGION" \
  --query 'UserGroups[0].UserIds' \
  --output json)

if echo "$UG_USERS" | jq -e --arg user "$USERNAME" 'contains([$user])' > /dev/null; then
  echo "   ✓ User '$USERNAME' IS in cache's UserGroup"
else
  echo "   ❌ User '$USERNAME' is NOT in cache's UserGroup"
  exit 1
fi

# 4. Get cache ARN
echo ""
echo "4. Cache ARN:"
CACHE_ARN=$(aws elasticache describe-serverless-caches \
  --serverless-cache-name "$CACHE_NAME" \
  --region "$REGION" \
  --query 'ServerlessCaches[0].ARN' \
  --output text)

echo "   Cache ARN: $CACHE_ARN"

# 5. Check IAM policy in detail
echo ""
echo "5. ECS Task Role IAM Policy Analysis:"
echo "   Required resources:"
echo "     - Cache: $CACHE_ARN"
echo "     - User:  $USER_ARN"
echo ""

# Check inline policies
echo "   Inline policies:"
INLINE_POLICIES=$(aws iam list-role-policies \
  --role-name "$TASK_ROLE" \
  --query 'PolicyNames' \
  --output text 2>/dev/null || echo "")

POLICY_VALID=false

if [ -n "$INLINE_POLICIES" ]; then
  for POLICY_NAME in $INLINE_POLICIES; do
    echo "     Checking policy: $POLICY_NAME"

    POLICY_DOC=$(aws iam get-role-policy \
      --role-name "$TASK_ROLE" \
      --policy-name "$POLICY_NAME" \
      --query 'PolicyDocument' \
      --output json)

    echo "     Policy document:"
    echo "$POLICY_DOC" | jq .

    # Check for elasticache:Connect action
    HAS_CONNECT=$(echo "$POLICY_DOC" | jq -e '.Statement[] | select(.Effect == "Allow" and (.Action == "elasticache:Connect" or (.Action | type == "array" and contains(["elasticache:Connect"]))))' 2>/dev/null && echo "true" || echo "false")

    if [ "$HAS_CONNECT" = "true" ]; then
      echo "       ✓ Has elasticache:Connect action"

      # Check if resources include cache ARN
      HAS_CACHE=$(echo "$POLICY_DOC" | jq -e --arg arn "$CACHE_ARN" '.Statement[].Resource | if type == "array" then contains([$arn]) else . == $arn or . == "*" end' 2>/dev/null | grep -q true && echo "true" || echo "false")

      # Check if resources include user ARN
      HAS_USER=$(echo "$POLICY_DOC" | jq -e --arg arn "$USER_ARN" '.Statement[].Resource | if type == "array" then contains([$arn]) else . == $arn or . == "*" end' 2>/dev/null | grep -q true && echo "true" || echo "false")

      echo "       Cache ARN in resources: $HAS_CACHE"
      echo "       User ARN in resources:  $HAS_USER"

      if [ "$HAS_CACHE" = "true" ] && [ "$HAS_USER" = "true" ]; then
        POLICY_VALID=true
      fi
    else
      echo "       ❌ Missing elasticache:Connect action"
    fi
  done
fi

# Check attached policies
echo ""
echo "   Attached policies:"
ATTACHED_POLICIES=$(aws iam list-attached-role-policies \
  --role-name "$TASK_ROLE" \
  --query 'AttachedPolicies[*].[PolicyName,PolicyArn]' \
  --output text 2>/dev/null || echo "")

if [ -n "$ATTACHED_POLICIES" ]; then
  while IFS=$'\t' read -r POLICY_NAME POLICY_ARN; do
    echo "     Checking policy: $POLICY_NAME"

    VERSION=$(aws iam get-policy --policy-arn "$POLICY_ARN" --query 'Policy.DefaultVersionId' --output text)
    POLICY_DOC=$(aws iam get-policy-version --policy-arn "$POLICY_ARN" --version-id "$VERSION" --query 'PolicyVersion.Document' --output json)

    echo "     Policy document:"
    echo "$POLICY_DOC" | jq .

    # Check for elasticache:Connect action
    HAS_CONNECT=$(echo "$POLICY_DOC" | jq -e '.Statement[] | select(.Effect == "Allow" and (.Action == "elasticache:Connect" or (.Action | type == "array" and contains(["elasticache:Connect"]))))' 2>/dev/null && echo "true" || echo "false")

    if [ "$HAS_CONNECT" = "true" ]; then
      echo "       ✓ Has elasticache:Connect action"

      # Check if resources include cache ARN
      HAS_CACHE=$(echo "$POLICY_DOC" | jq -e --arg arn "$CACHE_ARN" '.Statement[].Resource | if type == "array" then contains([$arn]) else . == $arn or . == "*" end' 2>/dev/null | grep -q true && echo "true" || echo "false")

      # Check if resources include user ARN
      HAS_USER=$(echo "$POLICY_DOC" | jq -e --arg arn "$USER_ARN" '.Statement[].Resource | if type == "array" then contains([$arn]) else . == $arn or . == "*" end' 2>/dev/null | grep -q true && echo "true" || echo "false")

      echo "       Cache ARN in resources: $HAS_CACHE"
      echo "       User ARN in resources:  $HAS_USER"

      if [ "$HAS_CACHE" = "true" ] && [ "$HAS_USER" = "true" ]; then
        POLICY_VALID=true
      fi
    else
      echo "       ❌ Missing elasticache:Connect action"
    fi
  done <<< "$ATTACHED_POLICIES"
fi

echo ""
if [ "$POLICY_VALID" = "true" ]; then
  echo "   ✅ IAM policy appears correctly configured"
else
  echo "   ❌ IAM policy may be missing required resources"
  echo ""
  echo "   The policy should include:"
  echo "   {"
  echo "     \"Effect\": \"Allow\","
  echo "     \"Action\": \"elasticache:Connect\","
  echo "     \"Resource\": ["
  echo "       \"$CACHE_ARN\","
  echo "       \"$USER_ARN\""
  echo "     ]"
  echo "   }"
fi

echo ""
echo "=== Configuration Summary ==="
echo "✓ User exists with IAM authentication"
echo "✓ User is in the correct UserGroup"
echo "✓ UserGroup is attached to the cache"
if [ "$POLICY_VALID" = "true" ]; then
  echo "✓ IAM policy grants elasticache:Connect"
else
  echo "⚠️ IAM policy may need updating"
fi

echo ""
echo "If all checks passed but authentication still fails with WRONGPASS:"
echo "1. This may be a bug in Valkey 8.1 Serverless IAM authentication"
echo "2. Consider opening an AWS Support case"
echo "3. Consider using password-based authentication as a workaround"
echo "4. Consider using DynamoDB for session storage instead"
