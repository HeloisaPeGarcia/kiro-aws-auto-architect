import { DetectedCall, AwsService, MethodMapping, S3MethodMapping } from '../types';
import { ConfigResolver } from './configResolver';

// ─── Constantes de detecção ────────────────────────────────────────────────────

const KIRO_IGNORE_TAG = '// kiro-ignore';
const KIRO_PYTHON_IGNORE_TAG = '# kiro-ignore';

// ─── Interfaces internas ───────────────────────────────────────────────────────

interface ScanContext {
  readonly filePath: string;
  readonly lines: readonly string[];
  readonly fileContent: string;
}

interface ServiceConfig {
  readonly service: AwsService;
  readonly namespaceIndicators: readonly string[];
  readonly mappings: Readonly<Record<string, MethodMapping>>;
  readonly resourceArgNames: readonly string[];
  readonly arnBuilder: (resolvedName: string) => string;
}


abstract class BaseScanner {
  constructor(protected readonly configResolver: ConfigResolver) {}

  protected scanLines(
    context: ScanContext,
    services: readonly ServiceConfig[],
    ignoreTag: string
  ): DetectedCall[] {
    const results: DetectedCall[] = [];

    for (const serviceConfig of services) {
  
      if (!this.fileUsesService(context.fileContent, serviceConfig.namespaceIndicators)) {
        continue;
      }

      for (let i = 0; i < context.lines.length; i++) {
        const line = context.lines[i];
        const trimmed = line.trim();

        if (this.shouldSkipLine(trimmed)) continue;

        const isIgnored = line.includes(ignoreTag);

        for (const [method, mapping] of Object.entries(serviceConfig.mappings)) {
          if (!line.includes(`.${method}(`)) continue;

          const rawName = this.extractResourceName(line, serviceConfig.resourceArgNames);
          const resolvedName = rawName
            ? (this.configResolver.resolve(rawName) ?? rawName)
            : 'UNRESOLVED_RESOURCE';

          results.push({
            file: context.filePath,
            lineNumber: i + 1,
            service: serviceConfig.service,
            method,
            iamActions: mapping.iamActions,
            resourceNameOrVariable: rawName ?? 'unknown',
            resolvedResourceName: resolvedName,
            resourceArnPattern: serviceConfig.arnBuilder(resolvedName),
            warning: mapping.warning,
            isIgnored,
          });
        }
      }
    }

    return results;
  }


  private fileUsesService(
    fileContent: string,
    namespaceIndicators: readonly string[]
  ): boolean {
    return namespaceIndicators.some((indicator) => fileContent.includes(indicator));
  }

  private shouldSkipLine(trimmed: string): boolean {
    return !trimmed || trimmed.startsWith('//') || trimmed.startsWith('#');
  }

  
  protected extractResourceName(line: string, paramNames: readonly string[]): string | undefined {
    for (const name of paramNames) {
      const namedWithLiteral = new RegExp(`${name}\\s*[:=]\\s*["']([^"']+)["']`, 'i').exec(line);
      if (namedWithLiteral) return namedWithLiteral[1];

      const namedWithVar = new RegExp(`${name}\\s*[:=]\\s*([a-zA-Z_][a-zA-Z0-9_]*)`, 'i').exec(line);
      if (namedWithVar && !['new', 'await', 'null', 'true', 'false'].includes(namedWithVar[1])) {
        return namedWithVar[1];
      }
    }

    // Fallback: primeira string literal dentro de parênteses
    const parenContent = /\(([^)]*)\)/.exec(line)?.[1];
    return parenContent ? /["']([^"']+)["']/.exec(parenContent)?.[1] : undefined;
  }
}

// ─── C# Scanner ────────────────────────────────────────────────────────────────

import {
  DYNAMODB_MAPPINGS,
  DYNAMODB_CSHARP_NAMESPACES,
} from '../mappings/dynamodb';
import { S3_MAPPINGS, S3_CSHARP_NAMESPACES } from '../mappings/s3';
import { SQS_MAPPINGS, SQS_CSHARP_NAMESPACES } from '../mappings/sqs';
import { SNS_MAPPINGS, SNS_CSHARP_NAMESPACES } from '../mappings/sns';

export class CSharpScanner extends BaseScanner {
  private readonly services: readonly ServiceConfig[];

  constructor(configResolver: ConfigResolver) {
    super(configResolver);
    this.services = this.buildServiceConfigs();
  }

  public scan(filePath: string, content: string): DetectedCall[] {
    return this.scanLines(
      { filePath, lines: content.split('\n'), fileContent: content },
      this.services,
      KIRO_IGNORE_TAG
    );
  }

  private buildServiceConfigs(): readonly ServiceConfig[] {
    return [
      {
        service: 'dynamodb',
        namespaceIndicators: [...DYNAMODB_CSHARP_NAMESPACES],
        mappings: DYNAMODB_MAPPINGS,
        resourceArgNames: ['tableName', 'TableName'],
        arnBuilder: (name) =>
          `arn:aws:dynamodb:\${region}:\${account}:table/${name}`,
      },
      {
        service: 's3',
        namespaceIndicators: [...S3_CSHARP_NAMESPACES],
        mappings: S3_MAPPINGS,
        resourceArgNames: ['bucketName', 'BucketName', 'bucket'],
        arnBuilder: (name) => `arn:aws:s3:::${name}`,
      },
      {
        service: 'sqs',
        namespaceIndicators: [...SQS_CSHARP_NAMESPACES],
        mappings: SQS_MAPPINGS,
        resourceArgNames: ['queueUrl', 'QueueUrl'],
        arnBuilder: (name) =>
          `arn:aws:sqs:\${region}:\${account}:${name}`,
      },
      {
        service: 'sns',
        namespaceIndicators: [...SNS_CSHARP_NAMESPACES],
        mappings: SNS_MAPPINGS,
        resourceArgNames: ['topicArn', 'TopicArn'],
        arnBuilder: (name) =>
          `arn:aws:sns:\${region}:\${account}:${name}`,
      },
    ];
  }
}

// ─── Python Scanner ─────────────────────────────────────────────────────────────

const PYTHON_DYNAMODB_INDICATORS = [
  "boto3.client('dynamodb')",
  'boto3.resource("dynamodb")',
  "boto3.resource('dynamodb')",
  'import boto3',
] as const;

const PYTHON_S3_INDICATORS = [
  "boto3.client('s3')",
  "boto3.resource('s3')",
] as const;

const PYTHON_SQS_INDICATORS = ["boto3.client('sqs')"] as const;
const PYTHON_SNS_INDICATORS = ["boto3.client('sns')"] as const;

export class PythonScanner extends BaseScanner {
  private readonly services: readonly ServiceConfig[];

  constructor(configResolver: ConfigResolver) {
    super(configResolver);
    this.services = this.buildServiceConfigs();
  }

  public scan(filePath: string, content: string): DetectedCall[] {
    return this.scanLines(
      { filePath, lines: content.split('\n'), fileContent: content },
      this.services,
      KIRO_PYTHON_IGNORE_TAG
    );
  }

  private buildServiceConfigs(): readonly ServiceConfig[] {
    return [
      {
        service: 'dynamodb',
        namespaceIndicators: [...PYTHON_DYNAMODB_INDICATORS],
        mappings: DYNAMODB_MAPPINGS,
        resourceArgNames: ['TableName', 'table_name'],
        arnBuilder: (name) =>
          `arn:aws:dynamodb:\${region}:\${account}:table/${name}`,
      },
      {
        service: 's3',
        namespaceIndicators: [...PYTHON_S3_INDICATORS],
        mappings: S3_MAPPINGS,
        resourceArgNames: ['Bucket', 'bucket_name', 'bucket'],
        arnBuilder: (name) => `arn:aws:s3:::${name}`,
      },
      {
        service: 'sqs',
        namespaceIndicators: [...PYTHON_SQS_INDICATORS],
        mappings: SQS_MAPPINGS,
        resourceArgNames: ['QueueUrl', 'queue_url'],
        arnBuilder: (name) =>
          `arn:aws:sqs:\${region}:\${account}:${name}`,
      },
      {
        service: 'sns',
        namespaceIndicators: [...PYTHON_SNS_INDICATORS],
        mappings: SNS_MAPPINGS,
        resourceArgNames: ['TopicArn', 'topic_arn'],
        arnBuilder: (name) =>
          `arn:aws:sns:\${region}:\${account}:${name}`,
      },
    ];
  }
}
