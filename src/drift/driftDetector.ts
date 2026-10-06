import { DetectedCall, DriftReport, OrphanPermission, AwsService } from '../types';
import { StackMerger } from '../generator/merger';

// Extrai ações IAM geradas no bloco delimitado: ex. 'dynamodb:PutItem'
const IAM_ACTION_REGEX = /['"]([a-z0-9]+:[A-Za-z0-9]+)['"]/g;


export class DriftDetector {
  public static detect(
    existingStackContent: string,
    activeCalls: readonly DetectedCall[]
  ): DriftReport {
    const generatedBlock = this.extractGeneratedBlock(existingStackContent);

    if (!generatedBlock) {
      return { orphanPermissions: [], activePermissionsCount: activeCalls.length };
    }

    const activeSignatures = this.buildActiveSignatures(activeCalls);
    const orphanPermissions = this.findOrphans(generatedBlock, activeSignatures);

    return {
      orphanPermissions,
      activePermissionsCount: activeCalls.length,
    };
  }

  private static extractGeneratedBlock(content: string): string | null {
    const startIdx = content.indexOf(StackMerger.START_TAG);
    const endIdx = content.indexOf(StackMerger.END_TAG);

    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) return null;

    return content.substring(startIdx + StackMerger.START_TAG.length, endIdx);
  }

  /**
   * Constrói um Set de assinaturas únicas de permissões ativas no código,
   * no formato `service:Action:::resolvedResourceName`.
   *
   * Isso permite comparação precisa por (ação + recurso), não apenas por ação.
   */
  private static buildActiveSignatures(calls: readonly DetectedCall[]): ReadonlySet<string> {
    const signatures = new Set<string>();

    for (const call of calls) {
      if (call.isIgnored) continue;
      const resource = call.resolvedResourceName || call.resourceNameOrVariable;

      for (const action of call.iamActions) {
        signatures.add(this.signature(action, resource));
      }
    }

    return signatures;
  }

  private static findOrphans(
    block: string,
    activeSignatures: ReadonlySet<string>
  ): readonly OrphanPermission[] {
    const orphans: OrphanPermission[] = [];
    const lines = block.split('\n');

    let currentResource = 'unknown';

    for (const line of lines) {
      // Rastreia o recurso atual a partir de comentários de contexto
      const resourceComment = /\/\/ (DynamoDB Table|S3 Bucket|SQS Queue|SNS Topic): (.+)/.exec(line);
      if (resourceComment) {
        currentResource = resourceComment[2].trim();
      }

      // Reseta o regex a cada iteração para evitar bug de lastIndex com flag 'g'
      const regex = new RegExp(IAM_ACTION_REGEX.source, 'g');
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        const action = match[1];
        if (!this.isValidIamAction(action)) continue;

        if (!activeSignatures.has(this.signature(action, currentResource))) {
          orphans.push({
            service: action.split(':')[0] as AwsService,
            action,
            resource: currentResource,
            reason: `A permissão '${action}' para '${currentResource}' existe na IaC, mas nenhuma chamada SDK ativa correspondente foi encontrada no código.`,
          });
        }
      }
    }

    return orphans;
  }

  private static signature(action: string, resource: string): string {
    return `${action}:::${resource}`;
  }

  private static isValidIamAction(action: string): boolean {
    const [service] = action.split(':');
    return (['dynamodb', 's3', 'sqs', 'sns'] as const).includes(service as AwsService);
  }
}
