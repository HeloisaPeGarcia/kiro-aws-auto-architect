import { MethodMapping } from '../types';

export const SNS_MAPPINGS: Readonly<Record<string, MethodMapping>> = {
  // ─── .NET C# (Amazon.SimpleNotificationService) ───────────────────────────
  PublishAsync:      { iamActions: ['sns:Publish'] },
  PublishBatchAsync: { iamActions: ['sns:Publish'] },
  SubscribeAsync:    { iamActions: ['sns:Subscribe'] },

  // ─── Python boto3 ──────────────────────────────────────────────────────────
  publish:           { iamActions: ['sns:Publish'] },
  publish_batch:     { iamActions: ['sns:Publish'] },
  subscribe:         { iamActions: ['sns:Subscribe'] },
} as const;

export const SNS_CSHARP_NAMESPACES = [
  'Amazon.SimpleNotificationService',
  'IAmazonSimpleNotificationService',
  'AmazonSimpleNotificationServiceClient',
] as const;
