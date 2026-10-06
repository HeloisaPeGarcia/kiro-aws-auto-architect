# 🌩️ Kiro Power: AWS Serverless & Infrastructure Auto-Architect

**ID:** `aws-serverless-auto-architect`  
**Version:** `1.0.0`  
**Category:** `DevSecOps & Cloud Infrastructure`  
**Targets:** `AWS CDK (TypeScript)` | `.NET C#` | `Python (boto3)`  
**Manifest:** [`power.json`](power.json) | [`.kiro/powers/aws-serverless-auto-architect/power.json`](.kiro/powers/aws-serverless-auto-architect/power.json)

---

## 📖 Description

The **AWS Serverless Auto-Architect Power** monitors application code and detects calls to AWS SDKs (DynamoDB, S3, SQS, and SNS). It infers the exact API operations and automatically synthesizes Infrastructure as Code (**AWS CDK TypeScript**), strictly enforcing **Least Privilege IAM** without granting permissive wildcards (`*`).

---

## 🎯 Capabilities & Triggers

### 1. Execution Triggers & Slash Commands
- **On File Save (`*.cs`, `*.py`):** Automatically scans for direct AWS SDK calls upon saving code files.
- **`/auto-architect scan`:** Performs a full workspace scan and displays detected IAM permissions in a clean CLI table or JSON format.
- **`/auto-architect apply`:** Synthesizes least-privilege CDK constructs and injects them non-destructively into the target stack between `// [kiro-power:start]` and `// [kiro-power:end]`.
- **`/auto-architect drift`:** Audits the current CDK stack against application code to identify orphaned, obsolete IAM permissions.

### 2. Built-in Security Rules
1. **Zero Wildcards:** Strict denial of generic actions such as `s3:*` or `dynamodb:*`.
2. **Explicit ARN Separation for S3:** `s3:ListBucket` mapped solely to `arn:aws:s3:::bucket`, while `s3:GetObject` and `s3:PutObject` mapped to `arn:aws:s3:::bucket/*`.
3. **Deterministic CDK Constructs:** Uses `Table.fromTableArn()` instead of `fromTableName()` to ensure proper IAM role grant scoping.
4. **Non-Destructive Merge:** Code changes are isolated within managed tags, preserving 100% of human-authored code.
5. **Continuous Drift Governance:** Alerts engineers immediately when code changes leave orphaned cloud privileges behind.

---

## 🤖 Agent Tools Exposed to Kiro IDE

When interacting with Kiro's AI Agent, the following tools are available:
- `scan_workspace`: Inspect application source files to extract AWS SDK calls.
- `generate_cdk_snippet`: Synthesize least-privilege TypeScript AWS CDK constructs.
- `apply_to_stack`: Merge synthesized constructs into the active stack.
- `check_drift`: Detect orphaned IAM permissions in the target stack.

---

## ⚙️ Project Configuration Files

- **`power.json`**: Official Power manifest defining triggers, slash commands, entrypoints, and tools.
- **`kiro-power.json`**: Defines the target CDK stack file, enterprise tags, and security thresholds.
- **`.kiroignore`**: Excludes test suites, mocks, fakes, and build output directories from analysis.
- **`// kiro-ignore`** or **`# kiro-ignore`**: Inline comments for granular false-positive suppression.
