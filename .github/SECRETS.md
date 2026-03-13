# GitHub Secrets Setup Guide

This document describes the required secrets for deploying `sistema-reservas`.

## 🔐 Required Secrets

### VPS Access (Required for all deployments)

| Secret Name    | Description                      | Example                                  |
| -------------- | -------------------------------- | ---------------------------------------- |
| `VPS_HOST`     | Your VPS IP address or domain    | `192.168.1.100` or `vps.example.com`     |
| `VPS_USERNAME` | SSH username                     | `root` or `deploy`                       |
| `VPS_SSH_KEY`  | Private SSH key for deployment   | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VPS_PORT`     | SSH port (optional, default: 22) | `22`                                     |

### Staging Environment

| Secret Name                  | Description          | Example                                        |
| ---------------------------- | -------------------- | ---------------------------------------------- |
| `STAGING_DOMAIN`             | Frontend domain      | `staging.sistema-reservas.com`                 |
| `STAGING_API_DOMAIN`         | Backend API domain   | `api-staging.sistema-reservas.com`             |
| `STAGING_API_URL`            | API URL for frontend | `https://api-staging.sistema-reservas.com/api` |
| `STAGING_DB_USER`            | PostgreSQL username  | `postgres`                                     |
| `STAGING_DB_PASSWORD`        | PostgreSQL password  | `secure_password_123`                          |
| `STAGING_DB_NAME`            | Database name        | `sistema_reservas_staging`                     |
| `STAGING_JWT_SECRET`         | JWT signing secret   | `your-super-secret-jwt-key`                    |
| `STAGING_JWT_REFRESH_SECRET` | JWT refresh secret   | `your-refresh-secret-key`                      |

### Production Environment

| Secret Name               | Description          | Example                                |
| ------------------------- | -------------------- | -------------------------------------- |
| `PRODUCTION_DOMAIN`       | Frontend domain      | `sistema-reservas.com`                 |
| `PRODUCTION_API_DOMAIN`   | Backend API domain   | `api.sistema-reservas.com`             |
| `PRODUCTION_API_URL`      | API URL for frontend | `https://api.sistema-reservas.com/api` |
| `PROD_DB_USER`            | PostgreSQL username  | `postgres`                             |
| `PROD_DB_PASSWORD`        | PostgreSQL password  | `super_secure_production_password`     |
| `PROD_DB_NAME`            | Database name        | `sistema_reservas_prod`                |
| `PROD_JWT_SECRET`         | JWT signing secret   | `production-jwt-secret-64-chars-min`   |
| `PROD_JWT_REFRESH_SECRET` | JWT refresh secret   | `production-refresh-secret-64-chars`   |
| `PROD_RESEND_API_KEY`     | Resend email API key | `re_xxxxxxxxxxxxx`                     |
| `PROD_STRIPE_KEY`         | Stripe secret key    | `sk_live_xxxxxxxxxxxxx`                |

## 📋 How to Set Up Secrets

### 1. Generate SSH Key for VPS

```bash
# Generate new SSH key
ssh-keygen -t ed25519 -C "github-actions@sistema-reservas" -f ~/.github/id_github_actions

# Copy public key to VPS
ssh-copy-id -i ~/.github/id_github_actions.pub user@your-vps-ip

# Copy private key to GitHub Secrets
cat ~/.github/id_github_actions | gh secret set VPS_SSH_KEY
```

### 2. Set Secrets via GitHub CLI

```bash
# VPS Access
gh secret set VPS_HOST --body="your-vps-ip.com"
gh secret set VPS_USERNAME --body="root"
gh secret set VPS_SSH_KEY < ~/.github/id_github_actions

# Staging
gh secret set STAGING_DOMAIN --body="staging.sistema-reservas.com"
gh secret set STAGING_API_DOMAIN --body="api-staging.sistema-reservas.com"
gh secret set STAGING_DB_PASSWORD --body="your-staging-password"
gh secret set STAGING_JWT_SECRET --body="your-staging-jwt-secret"

# Production
gh secret set PRODUCTION_DOMAIN --body="sistema-reservas.com"
gh secret set PRODUCTION_API_DOMAIN --body="api.sistema-reservas.com"
gh secret set PROD_DB_PASSWORD --body="your-production-password"
gh secret set PROD_JWT_SECRET --body="your-production-jwt-secret"
```

### 3. Or Set via GitHub UI

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret name and value

## 🔒 Security Best Practices

1. **Never commit secrets** to the repository
2. **Use strong passwords** (minimum 32 characters for production)
3. **Rotate secrets regularly** (every 90 days recommended)
4. **Use different secrets** for staging and production
5. **Enable secret scanning** in repository settings
6. **Limit secret access** to necessary workflows only

## 🧪 Testing Secrets

After setting up secrets, test the deployment:

1. Go to **Actions** tab
2. Select **CD - Deploy to Staging**
3. Click **Run workflow**
4. Monitor the deployment logs

## 🚨 Troubleshooting

### SSH Connection Failed

```bash
# Test SSH connection manually
ssh -i ~/.github/id_github_actions user@your-vps-ip
```

### Database Connection Failed

- Verify database credentials in secrets
- Check if PostgreSQL container is running on VPS
- Ensure network connectivity between containers

### Deployment Fails

- Check workflow logs in GitHub Actions
- Verify all required secrets are set
- Ensure VPS has enough resources (RAM, CPU, disk)

## 📊 Environment Variables in Deployments

The workflows automatically inject these environment variables:

### Backend

```yaml
NODE_ENV: production
DATABASE_URL: (from secrets)
REDIS_URL: (from container network)
JWT_SECRET: (from secrets)
JWT_REFRESH_SECRET: (from secrets)
```

### Frontend

```yaml
NODE_ENV: production
NEXT_PUBLIC_API_URL: (from secrets)
```

## 🔄 Secret Rotation

To rotate a secret:

1. Generate new secret value
2. Update in GitHub Secrets
3. Redeploy to staging: `workflow_dispatch` on `cd-staging.yml`
4. Test thoroughly
5. Redeploy to production: `workflow_dispatch` on `cd-production.yml`

---

**Need help?** Check the [GitHub Actions documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
