export type AwsService = 'dynamodb' | 's3' | 'sqs' | 'sns';

// Representa uma chamada detectada a um método da SDK AWS no código-fonte
export interface DetectedCall {
  readonly file: string;
  readonly lineNumber: number;
  readonly service: AwsService;
  readonly method: string;
  readonly iamActions: readonly string[];
  readonly resourceNameOrVariable: string;
  readonly resolvedResourceName: string;
  readonly resourceArnPattern: string;
  readonly warning?: string;
  readonly isIgnored: boolean;
}

// Uma permissão IAM gerada que não possui mais chamada ativa correspondente no código
export interface OrphanPermission {
  readonly service: AwsService;
  readonly action: string;
  readonly resource: string;
  readonly reason: string;
}

// Resultado de uma verificação de drift
export interface DriftReport {
  readonly orphanPermissions: readonly OrphanPermission[];
  readonly activePermissionsCount: number;
}

// Configuração por projeto lida de kiro-power.json
export interface KiroPowerConfig {
  readonly version: string;
  readonly iac: {
    readonly target: 'cdk-typescript';
    readonly stackFile: string;
    readonly defaultLambdaTarget: string;
  };
  readonly tagging: {
    readonly enabled: boolean;
    readonly tags: Readonly<Record<string, string>>;
  };
  readonly scanner: {
    readonly excludePaths: readonly string[];
    readonly services: readonly AwsService[];
  };
  readonly security: {
    readonly alertOnWildcards: boolean;
    readonly requireEncryptionOnS3: boolean;
    readonly alertOnDynamoDbScan: boolean;
  };
}

// Mapeamento de método SDK para ações IAM
export interface MethodMapping {
  readonly iamActions: readonly string[];
  readonly warning?: string;
}

// Mapeamento S3 com tipo de ARN necessário
export interface S3MethodMapping extends MethodMapping {
  readonly targetType: 'bucket' | 'object';
}
