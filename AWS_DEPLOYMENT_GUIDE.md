# AWS Deployment Guide: Production Microservice on ECS Fargate

This document provides a step-by-step guide to deploying the full-stack **Document Processor** application to **AWS ECS (Fargate)** with **Application Load Balancer (ALB)**, **Route 53 DNS**, **AWS ACM SSL/TLS Certificates**, **Amazon SQS**, **Amazon S3**, and **MongoDB Atlas**.

---

## Architecture Overview

```mermaid
graph TD
    User([User / Web Browser]) -->|HTTPS (Port 443)| R53[Route 53 DNS]
    
    subgraph AWS Cloud Infrastructure
        R53 -->|yourdomain.online & api.yourdomain.online| ALB[Application Load Balancer + ACM SSL]
        
        ALB -->|Forward to Port 8000| TG[ALB Target Group (IP Targets)]
        TG -->|Port 8000| ECS[ECS Fargate Service: pagesense-api-service]
        
        subgraph Unified ECS Fargate Container
            ECS --> Express[Express Server :8000]
            Express --> StaticFE[Static React Frontend (public/)]
            Express --> API[REST API Routes (/v1)]
            Express --> SQSWorker[In-Process SQS Background Consumer]
        end
        
        SQSWorker --> SQSQueue[(AWS SQS Queue & DLQ)]
        Express --> S3Bucket[(AWS S3 Document Storage)]
    end

    subgraph Managed Cloud Persistence
        Express & SQSWorker --> MongoAtlas[(MongoDB Atlas M0 Cluster)]
        Express & SQSWorker --> MySQL[(MySQL / AWS RDS)]
    end
```

---

## Prerequisites & Checklist

- [x] AWS Account with CLI configured (`aws configure`)
- [x] Docker Desktop installed and running locally
- [x] Node.js 20+ and npm installed
- [x] Registered domain name (e.g. from GoDaddy, Namecheap, or Route 53)
- [x] Google Gemini API Key

---

## Step 1: Domain Setup & DNS Delegation (Route 53)

1. **Create a Public Hosted Zone in AWS Route 53**:
   - Open **Route 53** $\rightarrow$ **Hosted zones** $\rightarrow$ Click **Create hosted zone**.
   - **Domain name**: `<YOUR_DOMAIN>` (e.g., `pagesense.online`).
   - **Type**: **Public hosted zone**.
   - Click **Create hosted zone**.

2. **Delegate Nameservers at your Registrar (e.g., GoDaddy)**:
   - Route 53 generates 4 NS (Nameserver) records (e.g., `ns-xxx.awsdns-xx.net`).
   - Open your domain registrar settings $\rightarrow$ **DNS / Nameservers** $\rightarrow$ Select **"Use custom nameservers"**.
   - Copy-paste the 4 nameservers **without any trailing dots (`.`)**.

---

## Step 2: SSL/TLS Certificate Generation (AWS ACM)

1. Open **AWS Certificate Manager (ACM)** in your primary AWS region (e.g. `ap-south-1` Mumbai).
2. Click **Request certificate** $\rightarrow$ Select **Request a public certificate**.
3. **Domain names**:
   - Fully qualified domain name: `<YOUR_DOMAIN>` (e.g. `pagesense.online`).
   - Add another name: `*.<YOUR_DOMAIN>` *(Wildcard covers subdomains like `api.pagesense.online`)*.
4. **Validation method**: Select **DNS validation**.
5. Click **Request**.
6. Once the certificate is requested, click into its details $\rightarrow$ Click **"Create records in Route 53"** $\rightarrow$ Click **"Create records"**.
7. Within 1–2 minutes, the certificate status will change to **Issued (Green)**.

---

## Step 3: MongoDB Atlas Setup (Document Persistence)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create an **M0 (Free)** deployment:
   - **Cloud Provider**: AWS.
   - **Region**: Same region as your ECS setup (e.g., `ap-south-1` Mumbai).
3. Under **Security** $\rightarrow$ **Database Access**:
   - Create a database username and secure password (e.g. `pagesense_admin`).
4. Under **Security** $\rightarrow$ **Network Access**:
   - Click **Add IP Address** $\rightarrow$ Select **"Allow Access from Anywhere"** (`0.0.0.0/0`) $\rightarrow$ Click **Confirm**.
5. Under **Database** $\rightarrow$ Click **Connect** $\rightarrow$ Choose **Drivers (Node.js)**:
   - Note the connection string components:
     - `MONGO_HOST_IP`: `<CLUSTER_SUBDOMAIN>.mongodb.net`
     - `MONGO_USER`: `<DB_USERNAME>`
     - `MONGO_PASSWORD`: `<DB_PASSWORD>`
     - `MONGO_DATABASE`: `<DB_NAME>`
     - `MONGO_SRV_FLAG`: `true`

---

## Step 4: Containerization & Elastic Container Registry (ECR)

### 1. Multi-Stage Container Build (Automatic Frontend + Backend Packaging)
The project utilizes a multi-stage Docker build:
- **Stage 1**: Compiles the React SPA Vite bundle inside a native Linux Node.js environment.
- **Stage 2**: Installs production backend dependencies and bakes the compiled frontend bundle directly into `backend/public/`.

```bash
export AWS_REGION="ap-south-1"
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

# 1. Login Docker to AWS ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# 2. Build multi-stage Docker container for Linux x86_64 architecture (ECS Fargate)
docker build --platform linux/amd64 -t pagesense-backend:latest -f backend/Dockerfile .

# 3. Tag and push to ECR
docker tag pagesense-backend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/pagesense-backend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/pagesense-backend:latest
```

---

## Step 5: Application Load Balancer (ALB) Setup

### 1. Create Target Group
1. Open **EC2 Console** $\rightarrow$ **Target Groups** $\rightarrow$ Click **Create target group**.
2. **Target type**: **IP addresses** *(Required for ECS Fargate)*.
3. **Target group name**: `pagesense-api-tg`.
4. **Protocol / Port**: `HTTP` on port `8000`.
5. **VPC**: Default VPC.
6. **Health check path**: `/ping`.
7. Click **Create target group**.

### 2. Create Load Balancer
1. In EC2 Console $\rightarrow$ **Load Balancers** $\rightarrow$ Click **Create load balancer** (Application Load Balancer).
2. **Name**: `pagesense-alb`.
3. **Scheme**: **Internet-facing** (IPv4).
4. **Network mapping**: Select default VPC and select **all available subnets**.
5. **Security Groups**: Select or create a security group with:
   - Inbound **HTTPS (Port 443)** from `0.0.0.0/0`.
   - Inbound **HTTP (Port 80)** from `0.0.0.0/0`.
6. **Listeners and routing**:
   - **Protocol**: `HTTPS` / **Port**: `443` $\rightarrow$ Forward to target group `pagesense-api-tg`.
   - **Default SSL/TLS certificate**: Select your ACM Certificate for `<YOUR_DOMAIN>`.
   - *(Optional)*: Add `HTTP:80` listener with action **Redirect to HTTPS:443**.
7. Click **Create load balancer**.

---

## Step 6: ECS Fargate Cluster & Service Deployment

### 1. Create ECS Cluster
1. Open **ECS Console** $\rightarrow$ **Clusters** $\rightarrow$ Click **Create cluster**.
2. **Cluster name**: `pagesense-cluster`.
3. **Infrastructure**: **AWS Fargate (Serverless)**.
4. Click **Create**.

### 2. Create Task Definition
1. In ECS Console $\rightarrow$ **Task definitions** $\rightarrow$ Click **Create new task definition**.
2. **Task definition configuration**:
   - **Task definition family**: `pagesense-api-task`.
   - **Launch type**: **AWS Fargate**.
   - **OS / Architecture**: **Linux/X86_64**.
   - **Task CPU**: `0.5 vCPU` / **Memory**: `1 GB`.
3. **Container - 1**:
   - **Container name**: `api-container`.
   - **Image URI**: `<AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/pagesense-backend:latest`.
   - **Port mappings**: `8000` / Protocol: `TCP` / App protocol: `HTTP`.
   - **Environment variables**:
     | Key | Example Value | Description |
     | :--- | :--- | :--- |
     | `PORT` | `8000` | HTTP Port for Express server |
     | `ENV` | `production` | Application environment |
     | `JWT_SECRET` | `<YOUR_SECRET>` | Session JWT signing secret |
     | `JWT_EXPIRES_IN` | `7d` | Token expiry duration |
     | `GEMINI_API_KEY` | `<YOUR_GEMINI_KEY>` | Google AI Gemini API Key |
     | `AWS_REGION` | `ap-south-1` | AWS deployment region |
     | `AWS_S3_BUCKET_NAME` | `s3-document-processor` | S3 bucket for document storage |
     | `MONGO_HOST_IP` | `<CLUSTER>.mongodb.net` | MongoDB Atlas cluster hostname |
     | `MONGO_USER` | `<DB_USER>` | MongoDB username |
     | `MONGO_PASSWORD` | `<DB_PASSWORD>` | MongoDB password |
     | `MONGO_DATABASE` | `pagesense_db` | MongoDB database name |
     | `MONGO_SRV_FLAG` | `true` | Enables `mongodb+srv://` protocol |
     | `AWS_ACCESS_KEY_ID` | `<YOUR_AWS_KEY>` | AWS IAM Access Key |
     | `AWS_SECRET_ACCESS_KEY`| `<YOUR_AWS_SECRET>` | AWS IAM Secret Key |
4. Click **Create**.

### 3. Deploy ECS Service
1. Open `pagesense-cluster` $\rightarrow$ Under **Services** tab $\rightarrow$ Click **Create**.
2. **Configuration**:
   - **Launch type**: **FARGATE**.
   - **Task definition**: `pagesense-api-task` (Latest revision).
   - **Service name**: `pagesense-api-service`.
   - **Desired tasks**: `1`.
   - **Health check grace period**: `60` seconds.
3. **Networking**:
   - **VPC**: Default VPC (all subnets selected).
   - **Public IP**: **Turned ON**.
4. **Load balancing**:
   - **Load balancer type**: **Application Load Balancer**.
   - **Container to load balance**: `api-container 8000:8000`.
   - **Load balancer**: `pagesense-alb`.
   - **Listener**: `443:HTTPS`.
   - **Target group**: `pagesense-api-tg`.
5. Click **Create**.

---

## Step 7: Route 53 Domain Routing (Alias Records)

1. Open **Route 53** $\rightarrow$ Click into your hosted zone `<YOUR_DOMAIN>`.
2. **Create Apex Record**:
   - **Record name**: *(leave blank for apex root)*
   - **Record type**: `A`
   - **Alias**: Toggle `ON`
   - **Route traffic to**: **Alias to Application and Classic Load Balancer** $\rightarrow$ Region: `ap-south-1` $\rightarrow$ Select `pagesense-alb`.
3. **Create API Subdomain Record**:
   - **Record name**: `api`
   - **Record type**: `A`
   - **Alias**: Toggle `ON`
   - **Route traffic to**: Select `pagesense-alb`.
4. **Create WWW Subdomain Record**:
   - **Record name**: `www`
   - **Record type**: `A`
   - **Alias**: Toggle `ON`
   - **Route traffic to**: Select `pagesense-alb`.

---

## Step 8: Verification & Health Checks

Verify your deployment using `curl` or a web browser:

```bash
# 1. Test Backend API Ping
curl -i https://api.<YOUR_DOMAIN>/ping
# Expected Response: {"status":"Success","message":"Server is working fine."}

# 2. Test Frontend Web Application
curl -i https://<YOUR_DOMAIN>/
# Expected Response: HTTP/2 200 OK (HTML document containing React SPA bundle)
```

---

## Cost Optimization: Managing Service State

To avoid continuous compute charges during development downtime, manage task scaling via CLI:

```bash
# Pause / Stop Fargate Compute ($0 compute charges)
aws ecs update-service \
  --cluster pagesense-cluster \
  --service pagesense-api-service \
  --desired-count 0 \
  --region ap-south-1

# Resume / Start Fargate Compute (Launches 1 container instance)
aws ecs update-service \
  --cluster pagesense-cluster \
  --service pagesense-api-service \
  --desired-count 1 \
  --region ap-south-1
```

---

## Step 9: Automated CI/CD Pipeline (GitHub Actions)

Continuous deployment is configured in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) to automatically build, package, and deploy new revisions whenever changes are merged into the `master` branch (or triggered manually via `workflow_dispatch`).

### 1. Required GitHub Repository Secrets

Navigate to your GitHub repository: **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions** $\rightarrow$ Click **New repository secret**:

| Secret Name | Description | Example / Default |
| :--- | :--- | :--- |
| `AWS_ACCESS_KEY_ID` | IAM Access Key with ECR & ECS permissions | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Corresponding IAM Secret Key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` *(Optional)* | AWS Region where resources reside | `ap-south-1` *(defaults to `ap-south-1` if omitted)* |

### 2. Required IAM Permissions for CI/CD

Ensure the IAM user or role whose credentials are added to GitHub Secrets has the following policy actions attached:

- **Amazon ECR**:
  - `ecr:GetAuthorizationToken`
  - `ecr:BatchCheckLayerAvailability`
  - `ecr:GetDownloadUrlForLayer`
  - `ecr:BatchGetImage`
  - `ecr:PutImage`
  - `ecr:InitiateLayerUpload`
  - `ecr:UploadLayerPart`
  - `ecr:CompleteLayerUpload`
- **Amazon ECS**:
  - `ecs:DescribeTaskDefinition`
  - `ecs:RegisterTaskDefinition`
  - `ecs:UpdateService`
  - `ecs:DescribeServices`
- **IAM PassRole**:
  - `iam:PassRole` on the task execution role (`ecsTaskExecutionRole`)

### 3. Pipeline Execution Flow

1. **Checkout & Node.js 20 Setup**: Checks out repo and sets up Node with npm caching.
2. **Monorepo Build**: Runs `npm ci` and `npm run build:frontend` to compile the Vite SPA into `frontend/dist/`.
3. **Static Bundle Placement**: Copies static files into `backend/public/` for unified serving.
4. **AWS Authentication & ECR Login**: Authenticates via `aws-actions/configure-aws-credentials` and logs Docker into AWS ECR.
5. **Multi-Arch Docker Build & Push**: Builds image targeting `linux/amd64` tagged with both git commit SHA and `latest`, then pushes to ECR repo `pagesense-backend`.
6. **ECS Deployment**: Fetches active `pagesense-api-task`, generates a new revision with the new image tag, deploys it to `pagesense-api-service` in `pagesense-cluster`, and waits for rolling update stability.

