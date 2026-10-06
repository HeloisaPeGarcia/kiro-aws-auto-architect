import { DetectedCall } from '../types';
import { DYNAMODB_MAPPINGS } from '../mappings/dynamodb';
import { S3_MAPPINGS } from '../mappings/s3';
import { SQS_MAPPINGS } from '../mappings/sqs';
import { SNS_MAPPINGS } from '../mappings/sns';
import { ConfigResolver } from './configResolver';

export class CSharpScanner {
  constructor(private configResolver: ConfigResolver) {}

  public scan(filePath: string, content: string): DetectedCall[] {
    const results: DetectedCall[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Ignora linhas vazias ou comentários completos
      if (!trimmed || trimmed.startsWith('//')) {
        continue;
      }

      const isIgnored = line.includes('// kiro-ignore');

      // 1. DynamoDB
      for (const [method, mapping] of Object.entries(DYNAMODB_MAPPINGS)) {
        if (line.includes(`.${method}(`)) {
          const resource = this.extractArgument(line, ['tableName', 'TableName']) || 'DefaultTable';
          const resolved = this.configResolver.resolve(resource) || resource;

          results.push({
            file: filePath,
            lineNumber: i + 1,
            service: 'dynamodb',
            method,
            iamActions: mapping.iamActions,
            resourceNameOrVariable: resource,
            resolvedResourceName: resolved,
            resourceArnPattern: `arn:aws:dynamodb:\${region}:\${account}:table/${resolved}`,
            warning: mapping.warning,
            isIgnored
          });
        }
      }

      // 2. S3
      for (const [method, mapping] of Object.entries(S3_MAPPINGS)) {
        if (line.includes(`.${method}(`)) {
          const bucket = this.extractArgument(line, ['bucketName', 'BucketName', 'bucket']) || 'DefaultBucket';
          const resolved = this.configResolver.resolve(bucket) || bucket;
          const arnPattern = mapping.targetType === 'bucket' 
            ? `arn:aws:s3:::${resolved}`
            : `arn:aws:s3:::${resolved}/*`;

          results.push({
            file: filePath,
            lineNumber: i + 1,
            service: 's3',
            method,
            iamActions: mapping.iamActions,
            resourceNameOrVariable: bucket,
            resolvedResourceName: resolved,
            resourceArnPattern: arnPattern,
            warning: mapping.warning,
            isIgnored
          });
        }
      }

      // 3. SQS
      for (const [method, mapping] of Object.entries(SQS_MAPPINGS)) {
        if (line.includes(`.${method}(`)) {
          const queue = this.extractArgument(line, ['queueUrl', 'QueueUrl', 'queue']) || 'DefaultQueue';
          const resolved = this.configResolver.resolve(queue) || queue;

          results.push({
            file: filePath,
            lineNumber: i + 1,
            service: 'sqs',
            method,
            iamActions: mapping.iamActions,
            resourceNameOrVariable: queue,
            resolvedResourceName: resolved,
            resourceArnPattern: `arn:aws:sqs:\${region}:\${account}:${resolved}`,
            warning: mapping.warning,
            isIgnored
          });
        }
      }

      // 4. SNS
      for (const [method, mapping] of Object.entries(SNS_MAPPINGS)) {
        if (line.includes(`.${method}(`)) {
          const topic = this.extractArgument(line, ['topicArn', 'TopicArn', 'topic']) || 'DefaultTopic';
          const resolved = this.configResolver.resolve(topic) || topic;

          results.push({
            file: filePath,
            lineNumber: i + 1,
            service: 'sns',
            method,
            iamActions: mapping.iamActions,
            resourceNameOrVariable: topic,
            resolvedResourceName: resolved,
            resourceArnPattern: `arn:aws:sns:\${region}:\${account}:${resolved}`,
            warning: mapping.warning,
            isIgnored
          });
        }
      }
    }

    return results;
  }

  private extractArgument(line: string, paramNames: string[]): string | undefined {
    // Procura por argumentos nomeados: tableName: "Orders" ou TableName = "Orders"
    for (const name of paramNames) {
      const regexNamed = new RegExp(`${name}\\s*[:=]\\s*["']([^"']+)["']`, 'i');
      const matchNamed = line.match(regexNamed);
      if (matchNamed) return matchNamed[1];

      // Procura variável nomeada: tableName: myVar
      const regexVar = new RegExp(`${name}\\s*[:=]\\s*([a-zA-Z0-9_]+)`, 'i');
      const matchVar = line.match(regexVar);
      if (matchVar && matchVar[1] !== 'new' && matchVar[1] !== 'await') return matchVar[1];
    }

    // Procura primeira string literal entre aspas dentro dos parênteses
    const parenMatch = line.match(/\((.*?)\)/);
    if (parenMatch) {
      const inside = parenMatch[1];
      const stringLiteral = inside.match(/["']([^"']+)["']/);
      if (stringLiteral) return stringLiteral[1];
    }

    return undefined;
  }
}
