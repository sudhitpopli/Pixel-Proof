# Deployment Guide

## Overview

This guide covers deploying Pixel-Proof to production environments, including cloud platforms, containerization, and enterprise deployment strategies.

---

## 🎯 Deployment Options

### Option 1: Cloud Platform (Recommended)
- **Best for**: Production deployments, scalability
- **Platforms**: AWS, Google Cloud, Azure, Heroku
- **Cost**: $50-200/month (depending on usage)

### Option 2: On-Premise
- **Best for**: Enterprise clients with strict data policies
- **Requirements**: Linux server, Docker, 8GB+ RAM
- **Cost**: Infrastructure costs only

### Option 3: Hybrid
- **Best for**: Large enterprises
- **Setup**: Frontend on cloud, ML models on-premise
- **Cost**: Variable

---

## ☁️ Cloud Deployment (AWS)

### Prerequisites
- AWS account with billing enabled
- AWS CLI installed and configured
- Docker installed locally

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CloudFront CDN                    │
│              (Static Assets Distribution)            │
└─────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────┐
│                   Application Load Balancer          │
└─────────────────────────────────────────────────────┘
          │                                    │
┌─────────────────────┐           ┌──────────────────────┐
│   ECS Fargate       │           │   ECS Fargate        │
│   (Node.js Backend) │           │   (Python ML Service)│
│   Port 3000         │           │   Port 5001          │
└─────────────────────┘           └──────────────────────┘
          │                                    │
┌─────────────────────────────────────────────────────┐
│                    Amazon RDS                        │
│                  (PostgreSQL)                        │
└─────────────────────────────────────────────────────┘
```

### Step 1: Containerize Applications

**Create `Dockerfile` for Node.js Backend:**
```dockerfile
# server/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY server/ ./server/
COPY src/ ./src/

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server/server.js"]
```

**Create `Dockerfile` for Python ML Service:**
```dockerfile
# model_service/hatebert_final/Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5001

# Start Flask app
CMD ["python", "app.py"]
```

**Create `requirements.txt`:**
```txt
flask==3.0.0
transformers==4.35.0
torch==2.1.0
opencv-python-headless==4.8.1.78
pandas==2.1.3
numpy==1.26.2
pillow==10.1.0
```

### Step 2: Build and Push Docker Images

```bash
# Login to Amazon ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Create ECR repositories
aws ecr create-repository --repository-name pixel-proof-backend
aws ecr create-repository --repository-name pixel-proof-ml

# Build images
docker build -t pixel-proof-backend:latest -f server/Dockerfile .
docker build -t pixel-proof-ml:latest -f model_service/hatebert_final/Dockerfile model_service/hatebert_final/

# Tag images
docker tag pixel-proof-backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/pixel-proof-backend:latest
docker tag pixel-proof-ml:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/pixel-proof-ml:latest

# Push images
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/pixel-proof-backend:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/pixel-proof-ml:latest
```

### Step 3: Set Up ECS Cluster

**Create ECS Cluster:**
```bash
aws ecs create-cluster --cluster-name pixel-proof-cluster
```

**Create Task Definitions:**

`backend-task-definition.json`:
```json
{
  "family": "pixel-proof-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/pixel-proof-backend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PYTHON_PORT",
          "value": "5001"
        }
      ],
      "secrets": [
        {
          "name": "GEMINI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:pixel-proof/gemini-api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/pixel-proof-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

`ml-task-definition.json`:
```json
{
  "family": "pixel-proof-ml",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "containerDefinitions": [
    {
      "name": "ml-service",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/pixel-proof-ml:latest",
      "portMappings": [
        {
          "containerPort": 5001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "PORT",
          "value": "5001"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/pixel-proof-ml",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

**Register Task Definitions:**
```bash
aws ecs register-task-definition --cli-input-json file://backend-task-definition.json
aws ecs register-task-definition --cli-input-json file://ml-task-definition.json
```

### Step 4: Create ECS Services

```bash
# Create backend service
aws ecs create-service \
  --cluster pixel-proof-cluster \
  --service-name backend-service \
  --task-definition pixel-proof-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"

# Create ML service
aws ecs create-service \
  --cluster pixel-proof-cluster \
  --service-name ml-service \
  --task-definition pixel-proof-ml \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

### Step 5: Set Up Load Balancer

```bash
# Create Application Load Balancer
aws elbv2 create-load-balancer \
  --name pixel-proof-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx

# Create target groups
aws elbv2 create-target-group \
  --name backend-targets \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxx \
  --target-type ip

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

---

## 🐳 Docker Compose (Development/Testing)

**`docker-compose.yml`:**
```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: server/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - PYTHON_ML_URL=http://ml-service:5001
    depends_on:
      - ml-service
    volumes:
      - ./server:/app/server
      - ./uploads:/app/uploads

  ml-service:
    build:
      context: ./model_service/hatebert_final
      dockerfile: Dockerfile
    ports:
      - "5001:5001"
    environment:
      - PORT=5001
    volumes:
      - ./model_service/hatebert_final:/app

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./dist:/usr/share/nginx/html
    depends_on:
      - backend

volumes:
  uploads:
```

**Start services:**
```bash
docker-compose up -d
```

---

## 🔒 Security Configuration

### SSL/TLS Setup

**Using Let's Encrypt (Certbot):**
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.pixelproof.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Environment Variables

**Use AWS Secrets Manager:**
```bash
# Store secrets
aws secretsmanager create-secret \
  --name pixel-proof/gemini-api-key \
  --secret-string "YOUR_API_KEY"

aws secretsmanager create-secret \
  --name pixel-proof/serpapi-key \
  --secret-string "YOUR_API_KEY"
```

### CORS Configuration

**Update `server.js`:**
```javascript
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://express.adobe.com', 'https://new.express.adobe.com']
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

---

## 📊 Monitoring & Logging

### CloudWatch Setup

**Create Log Groups:**
```bash
aws logs create-log-group --log-group-name /ecs/pixel-proof-backend
aws logs create-log-group --log-group-name /ecs/pixel-proof-ml
```

**Set Up Alarms:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name backend-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

### Application Monitoring

**Install Prometheus & Grafana:**
```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana

volumes:
  grafana-storage:
```

---

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow

**`.github/workflows/deploy.yml`:**
```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push backend image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: pixel-proof-backend
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG -f server/Dockerfile .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      - name: Build and push ML image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: pixel-proof-ml
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG -f model_service/hatebert_final/Dockerfile model_service/hatebert_final/
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      - name: Update ECS service
        run: |
          aws ecs update-service --cluster pixel-proof-cluster --service backend-service --force-new-deployment
          aws ecs update-service --cluster pixel-proof-cluster --service ml-service --force-new-deployment
```

---

## 💰 Cost Optimization

### AWS Cost Estimates

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| ECS Fargate (Backend) | 2 tasks, 0.5 vCPU, 1GB RAM | $30 |
| ECS Fargate (ML) | 1 task, 2 vCPU, 4GB RAM | $60 |
| Application Load Balancer | Standard | $20 |
| RDS PostgreSQL | db.t3.micro | $15 |
| CloudWatch Logs | 10GB/month | $5 |
| ECR Storage | 10GB | $1 |
| **Total** | | **~$131/month** |

### Optimization Tips
- Use Fargate Spot for non-critical workloads (70% savings)
- Enable auto-scaling based on CPU/memory
- Use CloudFront CDN for static assets
- Implement request caching with Redis
- Archive old logs to S3

---

## 🔧 Troubleshooting

### Common Issues

**Issue: ECS task fails to start**
```bash
# Check task logs
aws ecs describe-tasks --cluster pixel-proof-cluster --tasks TASK_ID

# View CloudWatch logs
aws logs tail /ecs/pixel-proof-backend --follow
```

**Issue: High memory usage**
```bash
# Increase task memory
aws ecs update-service --cluster pixel-proof-cluster --service ml-service --task-definition pixel-proof-ml:2
```

**Issue: Slow model loading**
- Pre-load models in Docker image
- Use EFS for shared model storage
- Implement model caching

---

## 📋 Pre-Deployment Checklist

- [ ] Environment variables configured
- [ ] SSL certificates obtained
- [ ] Database migrations run
- [ ] API keys stored in Secrets Manager
- [ ] CORS origins whitelisted
- [ ] Monitoring and alerts set up
- [ ] Backup strategy implemented
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated

---

## 🎯 Post-Deployment

### Health Checks

**Backend:**
```bash
curl https://api.pixelproof.com/health
```

**ML Service:**
```bash
curl https://api.pixelproof.com/ml/health
```

### Performance Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test backend
ab -n 1000 -c 10 https://api.pixelproof.com/analyze-hate

# Test ML service
ab -n 100 -c 5 https://api.pixelproof.com/ml/predict
```

---

*Last Updated: January 2026*
