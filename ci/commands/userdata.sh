#!/bin/bash
set -x
exec > >(tee /var/log/user-data.log)
exec 2>&1

# Validate imageTag is provided
IMAGE_TAG="{{IMAGE_TAG}}"

if [ -z "$IMAGE_TAG" ] || [ "$IMAGE_TAG" = "" ] || [ "$IMAGE_TAG" = "{{IMAGE_TAG}}" ]; then
  echo "ERROR: imageTag variable is required but not provided"
  exit 1
fi

# Extract commit SHA from imageTag (format: 20251015.115204.0-sha.55ae5ad)
COMMIT_SHA=$(echo "$IMAGE_TAG" | sed 's/.*-sha\.//')

if [ -z "$COMMIT_SHA" ] || [ "$COMMIT_SHA" = "$IMAGE_TAG" ]; then
  echo "ERROR: Failed to extract commit SHA from imageTag: $IMAGE_TAG"
  echo "Expected format: <version>-sha.<commit-sha> (e.g., 20251015.115204.0-sha.55ae5ad)"
  exit 1
fi

echo "Using commit SHA: $COMMIT_SHA"
echo "Using image tag: $IMAGE_TAG"

# Update and install required packages
sudo yum update -y
sudo yum install -y docker amazon-ssm-agent

# Start and enable SSM Agent
echo "Starting and enabling SSM Agent..."
sudo systemctl start amazon-ssm-agent
sudo systemctl enable amazon-ssm-agent
sudo systemctl status amazon-ssm-agent

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker ec2-user

# Install docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.6/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Authenticate with ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 839690184014.dkr.ecr.us-east-1.amazonaws.com

# Function to pull Docker image with retry
pull_image_with_retry() {
  local image=$1
  local max_attempts=2
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt: Pulling $image..."
    if docker pull "$image"; then
      echo "✅ Successfully pulled $image"
      return 0
    else
      echo "❌ Failed to pull $image (attempt $attempt/$max_attempts)"
      if [ $attempt -lt $max_attempts ]; then
        echo "Retrying in 10 seconds..."
        sleep 10
      fi
    fi
    attempt=$((attempt + 1))
  done

  echo "ERROR: Failed to pull $image after $max_attempts attempts"
  return 1
}

# Pull images from ECR with retry logic
echo "Pulling API image from ECR..."
if ! pull_image_with_retry "839690184014.dkr.ecr.us-east-1.amazonaws.com/tonys-chips/api:${IMAGE_TAG}"; then
  echo "ERROR: Failed to pull API image after all retry attempts"
  exit 1
fi

echo "Tagging API image for docker-compose..."
docker tag "839690184014.dkr.ecr.us-east-1.amazonaws.com/tonys-chips/api:${IMAGE_TAG}" "tonys-chips/api:${IMAGE_TAG}"

echo "Pulling web image from ECR..."
if ! pull_image_with_retry "839690184014.dkr.ecr.us-east-1.amazonaws.com/tonys-chips/web:${IMAGE_TAG}"; then
  echo "ERROR: Failed to pull web image after all retry attempts"
  exit 1
fi

echo "Tagging web image for docker-compose..."
docker tag "839690184014.dkr.ecr.us-east-1.amazonaws.com/tonys-chips/web:${IMAGE_TAG}" "tonys-chips/web:${IMAGE_TAG}"

# Create working directory
mkdir -p /home/ec2-user/app
cd /home/ec2-user/app

# Fetch docker-compose.yml from GitHub using commit SHA
curl -o docker-compose.yml "https://raw.githubusercontent.com/systeminit/tonys-chips/${COMMIT_SHA}/docker-compose.yml"

# Verify file was downloaded
if [ ! -f docker-compose.yml ]; then
  echo "Failed to download docker-compose.yml from commit SHA: $COMMIT_SHA"
  exit 1
fi

# Set proper ownership
chown ec2-user:ec2-user docker-compose.yml

# Run docker-compose with IMAGE_TAG
cd /home/ec2-user/app
export PATH="/usr/bin:/usr/local/bin:$PATH"
IMAGE_TAG=$IMAGE_TAG /usr/local/bin/docker-compose up -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 10

# Check container status
docker ps

echo "UserData script completed successfully"