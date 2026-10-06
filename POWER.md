# 🌩️ Kiro Power: AWS Serverless & Infrastructure Auto-Architect

**ID:** `aws-serverless-auto-architect`  
**Version:** `1.0.0`  
**Category:** `DevSecOps & Cloud Infrastructure`  
**Targets:** `AWS CDK (TypeScript)` | `.NET C#` | `Python (boto3)`

---

## 📖 Descrição

O **AWS Serverless Auto-Architect Power** monitora o código da aplicação e detecta chamadas de SDK da AWS (DynamoDB, S3, SQS e SNS). Ele infere as operações exatas e gera automaticamente o código de Infraestrutura como Código (AWS CDK TypeScript) aplicando regras estritas de **Menor Privilégio (Least Privilege IAM)**, sem conceder permissões excessivas (`*`).

---

## 🎯 Capacidades e Triggers

### 1. Triggers de Execução
- **On File Save (`*.cs`, `*.py`):** Inspeciona chamadas diretas a SDKs da AWS.
- **On Manual Command (`/auto-architect scan`):** Varre todo o workspace buscando serviços não mapeados na IaC.
- **On Drift Check (`/auto-architect drift`):** Identifica permissões de IAM geradas anteriormente que não possuem mais chamadas ativas no código.

### 2. Regras de Segurança Integradas
1. **Nunca use wildcards:** Bloqueio estrito de ações coringa como `s3:*` ou `dynamodb:*`.
2. **Separação de ARNs para S3:** `s3:ListBucket` vinculado exclusivamente a `arn:aws:s3:::bucket`, enquanto `s3:GetObject` e `s3:PutObject` vinculados a `arn:aws:s3:::bucket/*`.
3. **Uso de ARNs explícitos no CDK:** Uso de `Table.fromTableArn()` em vez de `Table.fromTableName()` para permitir funcionamento correto do `.grant()`.
4. **Merge Seguro:** Inclusão e atualização de código dentro de blocos delimitados `// [kiro-power:start]` e `// [kiro-power:end]`.

---

## ⚙️ Arquivos de Configuração do Projeto

- **`kiro-power.json`**: Define stack CDK de destino, tags corporativas e alertas.
- **`.kiroignore`**: Ignora diretórios de teste, mocks e fakes.
- **`// kiro-ignore`**: Comentário inline para suprimir avisos pontuais.
