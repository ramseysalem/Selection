# Production Setup Guide

This guide covers how to deploy the Outfit Matcher application in a production environment with real email services and enterprise-grade security.

## 📧 Email Service Configuration

The application supports multiple email providers for production use:

### Option 1: SendGrid (Recommended)
SendGrid offers reliable email delivery with excellent deliverability rates.

1. **Sign up for SendGrid**: https://sendgrid.com/
2. **Get API Key**: Create an API key in SendGrid dashboard
3. **Verify sender domain**: Add and verify your sending domain
4. **Configure environment variables**:
```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your-actual-api-key-here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

### Option 2: SMTP (Gmail, Outlook, etc.)
Use any SMTP provider including Gmail, Outlook, or dedicated email services.

**For Gmail:**
1. Enable 2-factor authentication
2. Generate an app password
3. Configure environment variables:
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

**For Custom SMTP:**
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-email-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

## 🔐 Security Configuration

### JWT Secrets
Generate strong, unique secrets for production:
```bash
# Generate secure secrets (use different values for each)
JWT_SECRET=$(openssl rand -base64 64)
JWT_SECRET_REFRESH=$(openssl rand -base64 64)
```

### Database Security
1. **Use strong database passwords**
2. **Enable SSL connections**
3. **Restrict database access to application servers only**
4. **Regular backups with encryption**

### Environment Variables for Production
```bash
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
FORCE_HTTPS=true
TRUST_PROXY=true

# Database (use connection pooling in production)
DATABASE_URL=postgresql://user:password@db-host:5432/outfit_matcher?sslmode=require

# CORS (restrict to your domain)
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

## 📦 Deployment Options

### Option 1: Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Option 2: PM2 (Process Manager)
```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name outfit-matcher
pm2 startup
pm2 save
```

### Option 3: Cloud Platforms

**Heroku:**
1. Install Heroku CLI
2. Create new app: `heroku create outfit-matcher`
3. Add PostgreSQL: `heroku addons:create heroku-postgresql:hobby-dev`
4. Set environment variables: `heroku config:set EMAIL_PROVIDER=sendgrid`
5. Deploy: `git push heroku main`

**Railway:**
1. Connect GitHub repository
2. Add PostgreSQL database
3. Set environment variables in dashboard
4. Deploy automatically on push

**DigitalOcean App Platform:**
1. Create new app from GitHub
2. Add managed PostgreSQL database
3. Configure environment variables
4. Deploy with auto-scaling

## 🗄️ Database Setup

### PostgreSQL Production Setup
```sql
-- Create database and user
CREATE DATABASE outfit_matcher;
CREATE USER outfit_app WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE outfit_matcher TO outfit_app;

-- Enable necessary extensions
\c outfit_matcher;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Database Migrations
The application automatically creates tables on startup, but for production:
1. **Backup before updates**
2. **Test migrations in staging first**
3. **Monitor performance during migrations**
4. **Consider maintenance windows for large changes**

## 🔍 Monitoring & Logging

### Application Monitoring
```bash
# Environment variables for monitoring
LOG_LEVEL=warn
ENABLE_REQUEST_LOGGING=false

# Add monitoring service (optional)
SENTRY_DSN=https://your-sentry-dsn
```

### Health Checks
The application provides health check endpoints:
- `GET /health` - Basic health check
- `GET /api/auth/me` - Authentication health

### Log Management
- **Use structured logging** (JSON format)
- **Centralized log collection** (ELK stack, Splunk)
- **Log rotation** to prevent disk space issues
- **Security event alerting**

## 🚀 Performance Optimization

### Caching
```bash
# Redis for session and data caching
REDIS_URL=redis://localhost:6379

# Enable caching features
ENABLE_CACHING=true
CACHE_TTL=3600
```

### File Storage
```bash
# AWS S3 for production file storage
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=outfit-matcher-production
```

### Database Optimization
- **Connection pooling**: Configure appropriate pool sizes
- **Indexes**: Monitor slow queries and add indexes
- **Read replicas**: For high-traffic applications
- **Query optimization**: Regular EXPLAIN ANALYZE

## 🔒 Security Checklist

### Pre-Production Security Review
- [ ] **Secrets Management**: All secrets in environment variables
- [ ] **HTTPS Enforcement**: Force HTTPS in production
- [ ] **CORS Configuration**: Restrict to production domains
- [ ] **Rate Limiting**: Configured for production traffic
- [ ] **Input Validation**: All endpoints sanitized
- [ ] **SQL Injection**: Parameterized queries only
- [ ] **File Upload Security**: Size limits and type validation
- [ ] **Email Security**: SPF, DKIM, DMARC configured
- [ ] **Database Security**: SSL, strong passwords, restricted access
- [ ] **Audit Logging**: Security events logged and monitored

### Regular Security Maintenance
- **Dependency Updates**: Weekly security patch reviews
- **Security Audits**: Monthly npm audit and fix
- **Log Reviews**: Weekly security event analysis
- **Backup Testing**: Monthly restore testing
- **Access Reviews**: Quarterly user access audit

## 📊 Testing Email Configuration

Test email setup before going live:
```bash
# Run email configuration test
NODE_ENV=production node -e "
const { testEmailConfiguration } = require('./dist/utils/emailService');
testEmailConfiguration().then(result => {
  console.log('Email test result:', result);
  process.exit(result.success ? 0 : 1);
});
"
```

## 🎯 Go-Live Checklist

Before production deployment:
- [ ] **Environment variables** configured correctly
- [ ] **Database** migrated and tested
- [ ] **Email service** tested and working
- [ ] **Domain and SSL** configured
- [ ] **Monitoring** setup and alerting configured
- [ ] **Backups** configured and tested
- [ ] **Load testing** completed
- [ ] **Security scan** passed
- [ ] **Documentation** updated
- [ ] **Rollback plan** prepared

## 🆘 Troubleshooting

### Common Issues

**Email Not Sending:**
1. Check EMAIL_PROVIDER configuration
2. Verify API keys and credentials
3. Check sender domain verification
4. Review email service logs

**Database Connection Errors:**
1. Verify DATABASE_URL format
2. Check network connectivity
3. Confirm SSL requirements
4. Review connection pool settings

**Authentication Issues:**
1. Verify JWT secrets are set
2. Check token expiration settings
3. Review CORS configuration
4. Confirm frontend URL settings

### Support Resources
- **Application Logs**: Check server logs for detailed errors
- **Database Logs**: Monitor PostgreSQL logs
- **Email Service Logs**: Check SendGrid/SMTP provider logs
- **Infrastructure Logs**: Review hosting platform logs

This production setup ensures your Outfit Matcher application is secure, scalable, and ready for real users with proper email functionality.