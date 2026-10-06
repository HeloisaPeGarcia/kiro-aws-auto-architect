# Security Policy

## 🛡️ Supported Versions

The following versions currently receive security updates and active patches:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## 🔒 Core Security Principles

**AWS Serverless Auto-Architect (Kiro Power)** is engineered under **Zero Trust** and strict **Least Privilege IAM** principles for Infrastructure as Code (IaC):

1. **No Overly Permissive Wildcards:** No generated policies ever include generic wildcards (e.g., `s3:*`, `dynamodb:*`).
2. **Precise Resource ARN Scoping:**
   - **Amazon S3:** Strict demarcation between bucket-level operations (`s3:ListBucket` on `arn:aws:s3:::bucket`) and object-level operations (`s3:GetObject`, `s3:PutObject` on `arn:aws:s3:::bucket/*`).
   - **Amazon DynamoDB:** Enforces `Table.fromTableArn()` to prevent ambiguous table references and ensure proper CDK IAM grant scoping.
3. **Non-Destructive Code Merging:** The synthesizer never overwrites arbitrary code. All CDK additions occur strictly between managed delimiter tags (`// [kiro-power:start]` and `// [kiro-power:end]`).
4. **Drift Detection:** Continuously audits generated IAM statements to alert when application code changes leave behind unused, orphaned permissions.

---

## 🚨 Reporting a Vulnerability

We take the security of this project and cloud infrastructure synthesis seriously. If you discover a security issue or flaw in IAM inference:

1. **Do not disclose the vulnerability in a public GitHub issue.**
2. Send technical details, reproduction steps, and impact assessment to:
   - **Security Contact:** Open a confidential [GitHub Security Advisory](https://github.com) or reach out via project security channels.
3. Please include:
   - Detailed description of the vulnerability.
   - Sample application code (.NET C# or Python) causing the incorrect IAM inference.
   - The generated IAM policy snippet.
   - Estimated security impact.

We will acknowledge receipt within **48 business hours** and provide progress updates until a patch is released.

---

## ⚠️ Safe Usage Guidelines

- **Never Commit AWS Credentials:** Do not store access keys (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`), session tokens, or sensitive values in your repository or config files (`.env`, `appsettings.json`).
- **Review Before Deploying:** Always inspect generated CDK policies and run `cdk diff` prior to executing `cdk deploy` against production environments.
