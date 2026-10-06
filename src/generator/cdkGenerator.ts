import { DetectedCall, KiroPowerConfig, AwsService } from '../types';

// ─── Strategy Pattern: cada serviço implementa sua própria geração ─────────────

interface ServiceCodeGenerator {
  readonly service: AwsService;
  generate(resource: string, actions: readonly string[], lambdaTarget: string): string[];
}

class DynamoDbCodeGenerator implements ServiceCodeGenerator {
  readonly service: AwsService = 'dynamodb';

  generate(resource: string, actions: readonly string[], lambdaTarget: string): string[] {
    const safeId = sanitizeId(resource);
    const actionsStr = actions.map((a) => `'${a}'`).join(', ');

    return [
      `    // DynamoDB Table: ${resource}`,
      `    // fromTableArn() garante que .grant() aplique o menor privilégio corretamente`,
      `    const ${safeId}Table = dynamodb.Table.fromTableArn(`,
      `      this,`,
      `      '${safeId}TableRef',`,
      `      \`arn:aws:dynamodb:\${this.region}:\${this.account}:table/${resource}\``,
      `    );`,
      `    ${safeId}Table.grant(${lambdaTarget}, ${actionsStr});`,
      '',
    ];
  }
}

class S3CodeGenerator implements ServiceCodeGenerator {
  readonly service: AwsService = 's3';

  generate(resource: string, actions: readonly string[], lambdaTarget: string): string[] {
    const safeId = sanitizeId(resource);
    const lines: string[] = [
      `    // S3 Bucket: ${resource}`,
      `    const ${safeId}Bucket = s3.Bucket.fromBucketName(this, '${safeId}BucketRef', '${resource}');`,
    ];

    // REGRA CRÍTICA: s3:ListBucket usa o ARN do bucket; demais operações usam ARN de objeto (/*)
    const bucketLevelActions = actions.filter((a) => a === 's3:ListBucket');
    const objectLevelActions = actions.filter((a) => a !== 's3:ListBucket');

    if (bucketLevelActions.length > 0) {
      lines.push(
        `    ${lambdaTarget}.addToRolePolicy(new iam.PolicyStatement({`,
        `      effect: iam.Effect.ALLOW,`,
        `      actions: [${bucketLevelActions.map((a) => `'${a}'`).join(', ')}],`,
        `      resources: [${safeId}Bucket.bucketArn], // ARN do bucket`,
        `    }));`
      );
    }

    if (objectLevelActions.length > 0) {
      lines.push(
        `    ${lambdaTarget}.addToRolePolicy(new iam.PolicyStatement({`,
        `      effect: iam.Effect.ALLOW,`,
        `      actions: [${objectLevelActions.map((a) => `'${a}'`).join(', ')}],`,
        `      resources: [\`\${${safeId}Bucket.bucketArn}/*\`], // ARN de objetos`,
        `    }));`
      );
    }

    lines.push('');
    return lines;
  }
}

class SqsCodeGenerator implements ServiceCodeGenerator {
  readonly service: AwsService = 'sqs';

  generate(resource: string, actions: readonly string[], lambdaTarget: string): string[] {
    const safeId = sanitizeId(resource);
    const actionsStr = actions.map((a) => `'${a}'`).join(', ');

    return [
      `    // SQS Queue: ${resource}`,
      `    const ${safeId}Queue = sqs.Queue.fromQueueArn(`,
      `      this,`,
      `      '${safeId}QueueRef',`,
      `      \`arn:aws:sqs:\${this.region}:\${this.account}:${resource}\``,
      `    );`,
      `    ${safeId}Queue.grant(${lambdaTarget}, ${actionsStr});`,
      '',
    ];
  }
}

class SnsCodeGenerator implements ServiceCodeGenerator {
  readonly service: AwsService = 'sns';

  generate(resource: string, actions: readonly string[], lambdaTarget: string): string[] {
    const safeId = sanitizeId(resource);

    return [
      `    // SNS Topic: ${resource}`,
      `    const ${safeId}Topic = sns.Topic.fromTopicArn(`,
      `      this,`,
      `      '${safeId}TopicRef',`,
      `      \`arn:aws:sns:\${this.region}:\${this.account}:${resource}\``,
      `    );`,
      `    ${safeId}Topic.grantPublish(${lambdaTarget});`,
      '',
    ];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '');
}

/** Chave única para agrupar chamadas: serviço + recurso resolvido */
function groupKey(service: AwsService, resource: string): string {
  return `${service}:::${resource}`;
}

// ─── CDK Generator principal ──────────────────────────────────────────────────

/**
 * Gera código CDK TypeScript com menor privilégio a partir das chamadas detectadas.
 *
 * Usa Strategy Pattern: cada serviço AWS tem seu próprio gerador de código,
 * tornando a adição de novos serviços (ex: EventBridge, KMS) uma operação
 * de adicionar apenas um novo generator — sem tocar no código existente.
 */
export class CdkGenerator {
  private readonly generatorsByService: ReadonlyMap<AwsService, ServiceCodeGenerator>;

  constructor(private readonly config: KiroPowerConfig) {
    this.generatorsByService = new Map<AwsService, ServiceCodeGenerator>([
      ['dynamodb', new DynamoDbCodeGenerator()],
      ['s3', new S3CodeGenerator()],
      ['sqs', new SqsCodeGenerator()],
      ['sns', new SnsCodeGenerator()],
    ]);
  }

  public generate(calls: readonly DetectedCall[]): string {
    const activeCalls = calls.filter((c) => !c.isIgnored);

    if (activeCalls.length === 0) {
      return '    // Nenhuma chamada AWS SDK ativa detectada para gerar IaC.';
    }

    const lambdaTarget = this.config.iac.defaultLambdaTarget;
    const grouped = this.groupByServiceAndResource(activeCalls);
    const lines: string[] = [
      '    // ================================================================',
      '    // 🌩️ Kiro Power: AWS Serverless Auto-Architect (Least Privilege)',
      '    // ================================================================',
      '',
    ];

    for (const [key, actions] of grouped.entries()) {
      const [service, resource] = key.split(':::') as [AwsService, string];
      const generator = this.generatorsByService.get(service);

      if (!generator) {
        lines.push(`    // ⚠️ Serviço '${service}' sem gerador registrado — ignorado.`);
        continue;
      }

      lines.push(...generator.generate(resource, Array.from(actions), lambdaTarget));
    }

    lines.push(...this.buildTagLines());

    return lines.join('\n');
  }

  /**
   * Agrupa as chamadas detectadas por (serviço, recurso), unificando
   * as ações IAM para evitar statements duplicados na política.
   */
  private groupByServiceAndResource(
    calls: readonly DetectedCall[]
  ): Map<string, Set<string>> {
    return calls.reduce((acc, call) => {
      const resource = call.resolvedResourceName || call.resourceNameOrVariable;
      const key = groupKey(call.service, resource);

      if (!acc.has(key)) acc.set(key, new Set<string>());
      call.iamActions.forEach((action) => acc.get(key)!.add(action));

      return acc;
    }, new Map<string, Set<string>>());
  }

  private buildTagLines(): string[] {
    if (!this.config.tagging?.enabled || !this.config.tagging?.tags) return [];

    const tagEntries = Object.entries(this.config.tagging.tags);
    if (tagEntries.length === 0) return [];

    return [
      '    // Tags corporativas de governança',
      ...tagEntries.map(([k, v]) => `    cdk.Tags.of(this).add('${k}', '${v}');`),
      '',
    ];
  }
}
