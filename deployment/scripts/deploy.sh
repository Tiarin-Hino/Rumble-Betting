#!/bin/bash
# deploy.sh - Automated deployment script for Virtual Betting Platform
set -e

# Configuration
AWS_REGION="us-east-1"  # Change to your preferred region
STACK_NAME="virtual-betting"
DOMAIN_NAME="" # Your main domain e.g. example.com
SUBDOMAIN="" # e.g. bet
SERVICE_NAME="virtual-betting"
ECR_REPOSITORY_NAME="$SERVICE_NAME"
MONGODB_NAME="betting-db"
MONGODB_USERNAME="admin"
MONGODB_PASSWORD=$(openssl rand -base64 16)
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_prerequisites() {
  echo -e "${YELLOW}Checking prerequisites...${NC}"
  
  # Check AWS CLI
  if ! [ -x "$(command -v aws)" ]; then
    echo -e "${RED}Error: AWS CLI is not installed.${NC}" >&2
    echo "Please install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
  fi
  
  # Check if AWS CLI is configured
  if ! aws sts get-caller-identity &>/dev/null; then
    echo -e "${RED}Error: AWS CLI is not configured.${NC}" >&2
    echo "Please run 'aws configure' to set up your AWS credentials."
    exit 1
  fi
  
  # Check Docker
  if ! [ -x "$(command -v docker)" ]; then
    echo -e "${RED}Error: Docker is not installed.${NC}" >&2
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
  fi
  
  # Check Domain and Subdomain
  if [ -z "$DOMAIN_NAME" ]; then
    read -p "Enter your domain name (e.g. example.com): " DOMAIN_NAME
  fi
  
  if [ -z "$SUBDOMAIN" ]; then
    read -p "Enter the subdomain you want to use (e.g. bet): " SUBDOMAIN
  fi
  
  FULL_DOMAIN="${SUBDOMAIN}.${DOMAIN_NAME}"
  echo -e "${GREEN}Your application will be deployed to ${FULL_DOMAIN}${NC}"
  
  echo -e "${GREEN}All prerequisites satisfied!${NC}"
}

# Create ECR repository
create_ecr_repository() {
  echo -e "${YELLOW}Setting up ECR repository...${NC}"
  
  # Check if repository exists
  if ! aws ecr describe-repositories --repository-names "$ECR_REPOSITORY_NAME" &>/dev/null; then
    aws ecr create-repository --repository-name "$ECR_REPOSITORY_NAME" --region "$AWS_REGION"
    echo -e "${GREEN}ECR repository created: $ECR_REPOSITORY_NAME${NC}"
  else
    echo -e "${GREEN}ECR repository already exists: $ECR_REPOSITORY_NAME${NC}"
  fi
  
  # Log in to ECR
  echo -e "${YELLOW}Logging in to ECR...${NC}"
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
}

# Build and push Docker images
build_and_push() {
  echo -e "${YELLOW}Building and pushing Docker images...${NC}"
  
  # Backend
  echo -e "${YELLOW}Building backend image...${NC}"
  docker build -t "$ECR_REPOSITORY_NAME-backend" -f docker/backend.dockerfile .
  docker tag "$ECR_REPOSITORY_NAME-backend:latest" "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME-backend:latest"
  docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME-backend:latest"
  
  # Frontend
  echo -e "${YELLOW}Building frontend image...${NC}"
  docker build -t "$ECR_REPOSITORY_NAME-frontend" -f docker/frontend.dockerfile .
  docker tag "$ECR_REPOSITORY_NAME-frontend:latest" "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME-frontend:latest"
  docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME-frontend:latest"
  
  echo -e "${GREEN}Images built and pushed successfully!${NC}"
}

# Deploy CloudFormation stacks
deploy_infrastructure() {
  echo -e "${YELLOW}Deploying infrastructure...${NC}"
  
  # Create S3 bucket for CloudFormation templates if it doesn't exist
  S3_BUCKET="$STACK_NAME-cloudformation-templates"
  if ! aws s3api head-bucket --bucket "$S3_BUCKET" 2>/dev/null; then
    aws s3 mb "s3://$S3_BUCKET" --region "$AWS_REGION"
    echo -e "${GREEN}Created S3 bucket for CloudFormation templates: $S3_BUCKET${NC}"
  fi
  
  # Upload CloudFormation templates to S3
  echo -e "${YELLOW}Uploading CloudFormation templates to S3...${NC}"
  aws s3 sync cloudformation/ "s3://$S3_BUCKET/cloudformation/" --region "$AWS_REGION"
  
  # Deploy main CloudFormation stack
  echo -e "${YELLOW}Deploying main CloudFormation stack...${NC}"
  aws cloudformation deploy \
    --template-file cloudformation/main.yaml \
    --stack-name "$STACK_NAME" \
    --parameter-overrides \
      DomainName="$DOMAIN_NAME" \
      Subdomain="$SUBDOMAIN" \
      ServiceName="$SERVICE_NAME" \
      ECRRepositoryName="$ECR_REPOSITORY_NAME" \
      MongoDBName="$MONGODB_NAME" \
      MongoDBUsername="$MONGODB_USERNAME" \
      MongoDBPassword="$MONGODB_PASSWORD" \
      TemplatesS3Bucket="$S3_BUCKET" \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION"
  
  echo -e "${GREEN}Infrastructure deployed successfully!${NC}"
}

# Setup database
setup_database() {
  echo -e "${YELLOW}Setting up database...${NC}"
  
  # Get RDS endpoint from CloudFormation output
  DB_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='MongoDBEndpoint'].OutputValue" \
    --output text \
    --region "$AWS_REGION")
  
  # Run database setup script
  echo -e "${YELLOW}Initializing database...${NC}"
  ./scripts/setup-db.sh "$DB_ENDPOINT" "$MONGODB_USERNAME" "$MONGODB_PASSWORD" "$MONGODB_NAME"
  
  echo -e "${GREEN}Database setup completed!${NC}"
}

# Update application environment
update_environment() {
  echo -e "${YELLOW}Updating application environment...${NC}"
  
  # Get outputs from CloudFormation
  CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomain'].OutputValue" \
    --output text \
    --region "$AWS_REGION")
  
  DB_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='MongoDBEndpoint'].OutputValue" \
    --output text \
    --region "$AWS_REGION")
  
  ECS_CLUSTER=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='ECSCluster'].OutputValue" \
    --output text \
    --region "$AWS_REGION")
  
  ECS_SERVICE=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='ECSService'].OutputValue" \
    --output text \
    --region "$AWS_REGION")
  
  # Create environment files from templates
  cp env/prod.env.example env/prod.env
  cp env/secrets.env.example env/secrets.env
  
  # Update environment variables
  sed -i "s|MONGODB_URI=.*|MONGODB_URI=mongodb://$MONGODB_USERNAME:$MONGODB_PASSWORD@$DB_ENDPOINT:27017/$MONGODB_NAME|g" env/prod.env
  sed -i "s|API_URL=.*|API_URL=https://$FULL_DOMAIN/api|g" env/prod.env
  sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://$FULL_DOMAIN|g" env/prod.env
  
  # Update secrets
  sed -i "s|MONGODB_PASSWORD=.*|MONGODB_PASSWORD=$MONGODB_PASSWORD|g" env/secrets.env
  
  # Create AWS Systems Manager Parameter Store entries for environment variables
  echo -e "${YELLOW}Creating Parameter Store entries...${NC}"
  aws ssm put-parameter \
    --name "/$SERVICE_NAME/MONGODB_URI" \
    --type "SecureString" \
    --value "mongodb://$MONGODB_USERNAME:$MONGODB_PASSWORD@$DB_ENDPOINT:27017/$MONGODB_NAME" \
    --overwrite \
    --region "$AWS_REGION"
  
  aws ssm put-parameter \
    --name "/$SERVICE_NAME/MONGODB_USERNAME" \
    --type "String" \
    --value "$MONGODB_USERNAME" \
    --overwrite \
    --region "$AWS_REGION"
  
  aws ssm put-parameter \
    --name "/$SERVICE_NAME/MONGODB_PASSWORD" \
    --type "SecureString" \
    --value "$MONGODB_PASSWORD" \
    --overwrite \
    --region "$AWS_REGION"
  
  # Update ECS service to use new environment variables
  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --force-new-deployment \
    --region "$AWS_REGION"
  
  echo -e "${GREEN}Environment updated successfully!${NC}"
}

# Output success message with relevant information
output_success() {
  # Get CloudFront distribution domain
  CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomain'].OutputValue" \
    --output text \
    --region "$AWS_REGION")
  
  echo -e "\n${GREEN}========================================${NC}"
  echo -e "${GREEN}Deployment completed successfully!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo -e "Your application is now available at: ${YELLOW}https://$FULL_DOMAIN${NC}"
  echo -e "\nCDN URL: ${YELLOW}$CLOUDFRONT_URL${NC}"
  echo -e "MongoDB Database: ${YELLOW}$MONGODB_NAME${NC}"
  echo -e "MongoDB Username: ${YELLOW}$MONGODB_USERNAME${NC}"
  echo -e "MongoDB Password: ${YELLOW}[Stored in AWS Systems Manager Parameter Store]${NC}"
  echo -e "\nTo access your database credentials, run:"
  echo -e "${YELLOW}aws ssm get-parameter --name \"/$SERVICE_NAME/MONGODB_PASSWORD\" --with-decryption --query Parameter.Value --output text${NC}"
  echo -e "\nEnvironment variables are stored in AWS Systems Manager Parameter Store under the /${SERVICE_NAME}/ prefix."
  echo -e "${GREEN}========================================${NC}"
}

# Main execution
main() {
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}Virtual Betting Platform Deployment${NC}"
  echo -e "${GREEN}========================================${NC}"
  
  check_prerequisites
  create_ecr_repository
  build_and_push
  deploy_infrastructure
  setup_database
  update_environment
  output_success
}

# Run the main function
main
```