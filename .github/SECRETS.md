# GitHub Secrets Setup Guide - VPS Deployment

This document describes the required secrets for deploying `sistema-reservas` to a VPS using GitHub Actions.

## 🔐 Required Secrets

### VPS Access (Required for Deployment)

| Secret Name           | Description                                          | Example                                  | Required |
| --------------------- | ---------------------------------------------------- | ---------------------------------------- | -------- |
| `VPS_HOST`            | IP address or domain of your VPS                     | `173.249.49.68` or `vps.example.com`     | ✅ Yes   |
| `VPS_USER`            | SSH username for deployment                          | `deploy` or `root`                       | ✅ Yes   |
| `VPS_SSH_PRIVATE_KEY` | Private SSH key for GitHub Actions to connect to VPS | `-----BEGIN OPENSSH PRIVATE KEY-----...` | ✅ Yes   |

### Database & Security

| Secret Name          | Description                             | Example                                       | Required |
| -------------------- | --------------------------------------- | --------------------------------------------- | -------- |
| `POSTGRES_PASSWORD`  | PostgreSQL database password            | `SecureP@ssw0rd!2024#XYZ`                     | ✅ Yes   |
| `REDIS_PASSWORD`     | Redis cache password                    | `RedisP@ss!2024#ABC`                          | ✅ Yes   |
| `JWT_SECRET`         | JWT token signing secret (min 32 chars) | `your-super-secret-jwt-key-min-32-chars-long` | ✅ Yes   |
| `JWT_REFRESH_SECRET` | JWT refresh token secret (min 32 chars) | `your-refresh-token-secret-min-32-chars`      | ✅ Yes   |

### Payment Processing (Stripe)

| Secret Name             | Description                   | Example                              | Required       |
| ----------------------- | ----------------------------- | ------------------------------------ | -------------- |
| `STRIPE_SECRET_KEY`     | Stripe secret API key         | `sk_live_51H...` or `sk_test_51H...` | ✅ Yes         |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_1234567890abcdef...`          | ⚠️ Recommended |

### Email Service (Resend)

| Secret Name      | Description          | Example            | Required |
| ---------------- | -------------------- | ------------------ | -------- |
| `RESEND_API_KEY` | Resend email API key | `re_xxxxxxxxxxxxx` | ✅ Yes   |

### SMS Service (Twilio)

| Secret Name           | Description         | Example                      | Required    |
| --------------------- | ------------------- | ---------------------------- | ----------- |
| `TWILIO_ACCOUNT_SID`  | Twilio Account SID  | `ACxxxxxxxxxxxxxxxxxxxxxxxx` | ⚠️ Optional |
| `TWILIO_AUTH_TOKEN`   | Twilio Auth Token   | `xxxxxxxxxxxxxxxxxxxxxxxx`   | ⚠️ Optional |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | `+1234567890`                | ⚠️ Optional |

### Cloud Storage (Cloudflare R2)

| Secret Name     | Description                | Example                                  | Required    |
| --------------- | -------------------------- | ---------------------------------------- | ----------- |
| `R2_ENDPOINT`   | Cloudflare R2 endpoint URL | `https://xxxxx.r2.cloudflarestorage.com` | ⚠️ Optional |
| `R2_ACCESS_KEY` | R2 access key ID           | `xxxxxxxxxxxxxxxxxxxxxxxx`               | ⚠️ Optional |
| `R2_SECRET_KEY` | R2 secret access key       | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`       | ⚠️ Optional |
| `R2_BUCKET`     | R2 bucket name             | `sistema-reservas-uploads`               | ⚠️ Optional |

### Domain Configuration

| Secret Name          | Description                                | Example                                | Required |
| -------------------- | ------------------------------------------ | -------------------------------------- | -------- |
| `PRODUCTION_DOMAIN`  | Frontend production domain                 | `reservas.example.com`                 | ✅ Yes   |
| `API_DOMAIN`         | Backend API domain                         | `api.reservas.example.com`             | ✅ Yes   |
| `PRODUCTION_API_URL` | Full API URL for frontend                  | `https://api.reservas.example.com/api` | ✅ Yes   |
| `ACME_EMAIL`         | Email for SSL certificates (Let's Encrypt) | `admin@example.com`                    | ✅ Yes   |

### Notification Webhooks (Optional)

| Secret Name           | Description                        | Example                                | Required    |
| --------------------- | ---------------------------------- | -------------------------------------- | ----------- |
| `SLACK_WEBHOOK_URL`   | Slack webhook for notifications    | `https://hooks.slack.com/...`          | ⚠️ Optional |
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications  | `https://discord.com/api/webhooks/...` | ⚠️ Optional |
| `CODECOV_TOKEN`       | Codecov token for coverage reports | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | ⚠️ Optional |

## 📋 How to Set Up Secrets

### 1. Generate SSH Key for VPS

```bash
# Generate new SSH key (ed25519 recommended)
ssh-keygen -t ed25519 -C "github-actions@sistema-reservas" -f ~/.ssh/github_actions_vps

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/github_actions_vps.pub deploy@YOUR_VPS_IP

# Test connection
ssh -i ~/.ssh/github_actions_vps deploy@YOUR_VPS_IP

# Add private key to GitHub Secrets
gh secret set VPS_SSH_PRIVATE_KEY < ~/.ssh/github_actions_vps
```

### 2. Set Secrets via GitHub CLI

```bash
# VPS Access
gh secret set VPS_HOST --body="173.249.49.68"
gh secret set VPS_USER --body="deploy"
gh secret set VPS_SSH_PRIVATE_KEY < ~/.ssh/github_actions_vps

# Database & Security
gh secret set POSTGRES_PASSWORD --body="SecureP@ssw0rd!2024#XYZ"
gh secret set REDIS_PASSWORD --body="RedisP@ss!2024#ABC"
gh secret set JWT_SECRET --body="your-super-secret-jwt-key-min-32-chars-long"
gh secret set JWT_REFRESH_SECRET --body="your-refresh-token-secret-min-32-chars"

# Domains
gh secret set PRODUCTION_DOMAIN --body="reservas.example.com"
gh secret set API_DOMAIN --body="api.reservas.example.com"
gh secret set PRODUCTION_API_URL --body="https://api.reservas.example.com/api"
gh secret set ACME_EMAIL --body="admin@example.com"

# Services
gh secret set STRIPE_SECRET_KEY --body="sk_live_..."
gh secret set STRIPE_WEBHOOK_SECRET --body="whsec_..."
gh secret set RESEND_API_KEY --body="re_..."
```

### 3. Or Set via GitHub UI

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret name and value
5. Repeat for all required secrets

## 🔒 Security Best Practices

1. **Never commit secrets** to the repository
2. **Use strong passwords** (minimum 32 characters for production secrets)
3. **Use ed25519 SSH keys** (more secure than RSA)
4. **Rotate secrets regularly** (every 90 days recommended)
5. **Use different secrets** for staging and production environments
6. **Enable secret scanning** in repository settings
7. **Use GitHub Environments** to restrict deployment access
8. **Enable required reviewers** for production deployments

### Generate Secure Secrets

```bash
# Generate secure JWT secret (64 chars)
openssl rand -base64 48

# Generate secure password (32 chars)
openssl rand -base64 24

# Generate Redis password
openssl rand -base64 24
```

## 🧪 Testing Deployment

After setting up secrets, test the deployment:

1. Go to **Actions** tab
2. Select **CD - Deploy to VPS**
3. Click **Run workflow**
4. Monitor the deployment logs
5. Verify health checks pass
6. Test the application endpoints

## 🚨 Troubleshooting

### SSH Connection Failed

```bash
# Test SSH connection manually
ssh -i ~/.ssh/github_actions_vps deploy@YOUR_VPS_IP

# Check SSH agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/github_actions_vps
```

### Deployment Fails at Health Check

1. Check workflow logs in GitHub Actions
2. Verify all required secrets are set correctly
3. Ensure VPS has enough resources (RAM, CPU, disk)
4. Check if Docker is running on VPS
5. Verify domain DNS points to VPS IP

### Container Won't Start

```bash
# SSH to VPS and check logs
ssh deploy@YOUR_VPS_IP

# Check container status
docker-compose -f /opt/sistema-reservas/docker-compose.prod.yml ps

# View logs
docker-compose -f /opt/sistema-reservas/docker-compose.prod.yml logs backend
docker-compose -f /opt/sistema-reservas/docker-compose.prod.yml logs frontend
```

### Database Connection Issues

- Verify `POSTGRES_PASSWORD` secret is correct
- Check if PostgreSQL container is running
- Ensure network connectivity between containers
- Check database user permissions

## 🔄 Secret Rotation

To rotate a secret:

1. Generate new secret value
2. Update in GitHub Secrets
3. Trigger deployment: **Actions** → **CD - Deploy to VPS** → **Run workflow**
4. Monitor deployment logs
5. Test application functionality

## 📊 Environment Variables

The workflows automatically inject these environment variables into containers:

### Backend Container

```yaml
NODE_ENV: production
DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/sistema_reservas
REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
JWT_SECRET: ${JWT_SECRET}
JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
RESEND_API_KEY: ${RESEND_API_KEY}
```

### Frontend Container

```yaml
NODE_ENV: production
NEXT_PUBLIC_API_URL: ${PRODUCTION_API_URL}
```

## 🛡️ GitHub Environments (Recommended)

For additional security, use GitHub Environments:

1. Go to **Settings** → **Environments**
2. Click **New environment** → Name: `production`
3. Configure:
   - **Required reviewers**: Add team members
   - **Deployment branches**: `main` only
   - **Environment variables**: Add domain configs
   - **Environment secrets**: Add production secrets

## 📈 Monitoring & Alerts

### Backup Verification

The `backup-verify.yml` workflow runs weekly to:

- Verify database backups exist
- Check backup freshness
- Send notifications if backups are missing

### Health Checks

The deployment workflow includes:

- Post-deployment health checks (10 retries)
- Automatic rollback if health checks fail
- Status notifications

---

**Need help?** Check the [GitHub Actions documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
