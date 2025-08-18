# Security Guidelines

## Critical Security Notes

### 🔒 Private Keys and Certificates
- **NEVER** commit private keys (*.p8, *.pem, *.key) to version control
- Store Apple Music private keys in a secure location outside the repository
- Use environment variables to reference key file paths
- Consider using cloud secret management services for production

### 🔑 Environment Variables
- Generate strong, random JWT secrets (minimum 256 bits)
- Use different secrets for development and production
- Never commit actual API keys or database credentials
- Validate that secrets are changed from default values

### 🏗️ Infrastructure Security
- Use HTTPS in production
- Enable CORS only for trusted origins
- Keep rate limiting enabled
- Use proper authentication middleware
- Enable helmet security headers

### 📝 Development Security Checklist

Before deploying to production:

- [ ] JWT secrets are strong and unique
- [ ] Database credentials are not hardcoded
- [ ] API keys are not placeholder values
- [ ] Private keys are stored securely (not in repository)
- [ ] Environment validation is enabled
- [ ] .gitignore includes all sensitive files
- [ ] No console.log statements expose sensitive data

### 🚨 If Private Keys Are Compromised

If Apple Music private keys were ever committed to git:

1. **Immediately revoke** the compromised key in Apple Developer Console
2. **Generate a new** Apple Music private key
3. **Update** all production environments with the new key
4. **Rotate** any other potentially compromised credentials
5. **Review** git history for other sensitive data

### 🔐 Recommended Key Storage

For production deployments:

- **AWS**: AWS Secrets Manager or Systems Manager Parameter Store
- **Google Cloud**: Secret Manager
- **Azure**: Key Vault
- **Railway**: Environment Variables (for keys referenced by path, store files separately)
- **Vercel**: Environment Variables
- **Heroku**: Config Vars

### 📞 Contact

For security-related concerns, please review your deployment security before going to production.