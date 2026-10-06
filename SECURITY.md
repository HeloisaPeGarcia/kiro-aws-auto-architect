# Política de Segurança (Security Policy)

## 🛡️ Versões Suportadas

As versões a seguir recebem atualizações de segurança e correções ativas:

| Versão | Suportada          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## 🔒 Princípios de Segurança do Projeto

O **AWS Serverless Auto-Architect (Kiro Power)** foi concebido sob a premissa de **Zero Trust** e **Menor Privilégio (Least Privilege IAM)** para infraestrutura como código (IaC):

1. **Sem Wildcards Permissivos:** Nenhuma regra gerada utiliza ações genéricas (ex: `s3:*`, `dynamodb:*`).
2. **Escopo Preciso de Recursos (ARNs):**
   - **Amazon S3:** Diferenciação estrita entre operações de Bucket (`s3:ListBucket` em `arn:aws:s3:::bucket`) e operações de Objetos (`s3:GetObject`, `s3:PutObject` em `arn:aws:s3:::bucket/*`).
   - **Amazon DynamoDB:** Utilização de `Table.fromTableArn()` garantindo escopo e integração segura com permissões IAM no AWS CDK.
3. **Merge Não-Destrutivo:** O gerador nunca sobrescreve código arbitrário. A inserção e atualização de código CDK ocorrem exclusivamente entre delimitadores controlados (`// [kiro-power:start]` e `// [kiro-power:end]`).
4. **Detecção de Drift:** Monitoramento contínuo para apontar permissões IAM outrora concedidas que se tornaram órfãs após remoção de chamadas no código-fonte da aplicação.

---

## 🚨 Reportando uma Vulnerabilidade

Levamos a segurança do nosso projeto e das permissões de nuvem geradas a sério. Se você encontrar uma falha de segurança ou potencial brecha na geração de IAM:

1. **Não abra uma Issue pública** no GitHub relatando os detalhes da vulnerabilidade.
2. Envie um e-mail com os detalhes técnicos e passos para reprodução para:
   - **E-mail de Segurança:** `security@suaempresa.com` (ou utilize o canal oficial de [GitHub Security Advisories](https://github.com)).
3. Inclua, se possível:
   - Descrição detalhada da vulnerabilidade.
   - Código de exemplo (.NET C# ou Python) que causa a falha na inferência de permissões.
   - O snippet de política gerado incorretamente.
   - Impacto estimado.

Responderemos a confirmação inicial do relatório em até **48 horas úteis**, mantendo você atualizado sobre a investigação e os passos de correção.

---

## ⚠️ Boas Práticas ao Usar este Repositório

- **Nunca comite credenciais AWS:** Nunca insira chaves de acesso (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`), senhas ou tokens no código ou nos arquivos de configuração (`.env`, `appsettings.json`).
- **Validação de IaC:** Sempre revise as permissões geradas antes de rodar `cdk deploy` em ambientes de produção.
