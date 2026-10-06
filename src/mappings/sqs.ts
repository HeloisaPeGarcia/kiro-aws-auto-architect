import { MethodMapping } from '../types';

export const SQS_MAPPINGS: Readonly<Record<string, MethodMapping>> = {
  // ─── .NET C# (Amazon.SQS) ─────────────────────────────────────────────────
  SendMessageAsync:      { iamActions: ['sqs:SendMessage'] },
  SendMessageBatchAsync: { iamActions: ['sqs:SendMessage'] },
  ReceiveMessageAsync:   { iamActions: ['sqs:ReceiveMessage'] },
  DeleteMessageAsync:    { iamActions: ['sqs:DeleteMessage'] },
  GetQueueUrlAsync:      { iamActions: ['sqs:GetQueueUrl'] },

  // ─── Python boto3 ──────────────────────────────────────────────────────────
  send_message:          { iamActions: ['sqs:SendMessage'] },
  send_message_batch:    { iamActions: ['sqs:SendMessage'] },
  receive_message:       { iamActions: ['sqs:ReceiveMessage'] },
  delete_message:        { iamActions: ['sqs:DeleteMessage'] },
  get_queue_url:         { iamActions: ['sqs:GetQueueUrl'] },
} as const;

export const SQS_CSHARP_NAMESPACES = ['Amazon.SQS', 'IAmazonSQS', 'AmazonSQSClient'] as const;
