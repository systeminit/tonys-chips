#!/bin/bash
# Check if the 'default' user is available in ElastiCache
set -e

REGION=${AWS_REGION:-us-east-1}
CACHE_NAME="tonys-chips-sandbox"

echo "=== Checking 'default' User Configuration ===="
echo ""

# 1. Check if 'default' user exists
echo "1. Checking if 'default' user exists..."
DEFAULT_USER=$(aws elasticache describe-users \
  --user-id "default" \
  --region "$REGION" \
  --query 'Users[0]' \
  --output json 2>/dev/null || echo "null")

if [ "$DEFAULT_USER" = "null" ]; then
  echo "   ❌ 'default' user NOT FOUND"
  echo ""
  echo "   This is unexpected - AWS should automatically create the 'default' user."
  echo "   Listing all users instead:"
  aws elasticache describe-users --region "$REGION" --query 'Users[*].[UserId,UserName,Authentication.Type,Status]' --output table
  exit 1
else
  echo "   ✓ 'default' user exists"
  echo ""
  echo "   User details:"
  echo "$DEFAULT_USER" | jq -r '"\n   User ID: \(.UserId)\n   User Name: \(.UserName)\n   Auth Type: \(.Authentication.Type)\n   Status: \(.Status)\n   Engine: \(.Engine)\n   ARN: \(.ARN)"'

  # Check authentication type
  AUTH_TYPE=$(echo "$DEFAULT_USER" | jq -r '.Authentication.Type')
  if [ "$AUTH_TYPE" != "iam" ]; then
    echo ""
    echo "   ⚠️  WARNING: 'default' user authentication type is '$AUTH_TYPE', not 'iam'"
    echo "   You may need to modify the user to enable IAM authentication"
  fi
fi

echo ""
echo "2. Checking which UserGroups contain 'default'..."
USER_GROUPS=$(aws elasticache describe-user-groups \
  --region "$REGION" \
  --query "UserGroups[?contains(UserIds, 'default')].{UserGroupId:UserGroupId,UserIds:UserIds}" \
  --output json)

if [ "$USER_GROUPS" = "[]" ]; then
  echo "   ❌ 'default' user is NOT in any UserGroup!"
  echo ""
  echo "   AWS documentation states 'default' is automatically added to all user groups,"
  echo "   but it's not showing up. This might be the issue."
else
  echo "   ✓ 'default' user found in UserGroups:"
  echo "$USER_GROUPS" | jq -r '.[] | "     - \(.UserGroupId) (Users: \(.UserIds | join(", ")))"'
fi

echo ""
echo "3. Checking Serverless cache UserGroup..."
CACHE_UG=$(aws elasticache describe-serverless-caches \
  --serverless-cache-name "$CACHE_NAME" \
  --region "$REGION" \
  --query 'ServerlessCaches[0].UserGroupId' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$CACHE_UG" = "NOT_FOUND" ]; then
  echo "   ❌ Cache '$CACHE_NAME' not found"
else
  echo "   ✓ Cache uses UserGroup: $CACHE_UG"

  # Check if 'default' is in that UserGroup
  UG_USERS=$(aws elasticache describe-user-groups \
    --user-group-id "$CACHE_UG" \
    --region "$REGION" \
    --query 'UserGroups[0].UserIds' \
    --output json)

  echo "   Users in this UserGroup:"
  echo "$UG_USERS" | jq -r '.[] | "     - \(.)"'

  if echo "$UG_USERS" | jq -e 'contains(["default"])' > /dev/null; then
    echo ""
    echo "   ✓ 'default' user IS in the cache's UserGroup"
  else
    echo ""
    echo "   ❌ 'default' user is NOT in the cache's UserGroup"
    echo "   This is likely the problem - 'default' needs to be added to UserGroup '$CACHE_UG'"
  fi
fi

echo ""
echo "4. Checking ECS task role IAM policy..."
TASK_ROLE="tonys-chips-web-task-role"

# Get the ARN of the 'default' user
DEFAULT_USER_ARN=$(echo "$DEFAULT_USER" | jq -r '.ARN')

echo "   Default user ARN: $DEFAULT_USER_ARN"
echo ""
echo "   Checking if task role policy includes this ARN..."

# Check inline policies
INLINE_POLICIES=$(aws iam list-role-policies \
  --role-name "$TASK_ROLE" \
  --query 'PolicyNames' \
  --output text 2>/dev/null || echo "")

FOUND_DEFAULT_ARN=false

if [ -n "$INLINE_POLICIES" ]; then
  for POLICY_NAME in $INLINE_POLICIES; do
    POLICY_DOC=$(aws iam get-role-policy \
      --role-name "$TASK_ROLE" \
      --policy-name "$POLICY_NAME" \
      --query 'PolicyDocument' \
      --output json)

    if echo "$POLICY_DOC" | jq -e --arg arn "$DEFAULT_USER_ARN" '.Statement[].Resource | if type == "array" then contains([$arn]) else . == $arn or . == "*" end' | grep -q true; then
      echo "   ✓ Found '$DEFAULT_USER_ARN' in inline policy '$POLICY_NAME'"
      FOUND_DEFAULT_ARN=true
    fi
  done
fi

# Check attached policies
POLICIES=$(aws iam list-attached-role-policies \
  --role-name "$TASK_ROLE" \
  --query 'AttachedPolicies[*].PolicyArn' \
  --output text 2>/dev/null || echo "")

for POLICY_ARN in $POLICIES; do
  VERSION=$(aws iam get-policy --policy-arn "$POLICY_ARN" --query 'Policy.DefaultVersionId' --output text)
  POLICY_DOC=$(aws iam get-policy-version --policy-arn "$POLICY_ARN" --version-id "$VERSION" --query 'PolicyVersion.Document' --output json)

  if echo "$POLICY_DOC" | jq -e --arg arn "$DEFAULT_USER_ARN" '.Statement[].Resource | if type == "array" then contains([$arn]) else . == $arn or . == "*" end' | grep -q true; then
    POLICY_NAME=$(echo $POLICY_ARN | rev | cut -d'/' -f1 | rev)
    echo "   ✓ Found '$DEFAULT_USER_ARN' in attached policy '$POLICY_NAME'"
    FOUND_DEFAULT_ARN=true
  fi
done

if [ "$FOUND_DEFAULT_ARN" = false ]; then
  echo "   ⚠️  WARNING: 'default' user ARN not found in IAM policies"
  echo "   You may need to update the task role policy to include:"
  echo "   Resource: \"$DEFAULT_USER_ARN\""
fi

echo ""
echo "=== Summary ==="
echo ""
echo "To use the 'default' user with IAM authentication:"
echo "1. Ensure 'default' user has Authentication Type: iam"
echo "2. Ensure 'default' is in the cache's UserGroup"
echo "3. Ensure ECS task role has elasticache:Connect permission for 'default' user ARN"
echo "4. Use REDIS_USERNAME=default in your application environment variables"
echo ""
