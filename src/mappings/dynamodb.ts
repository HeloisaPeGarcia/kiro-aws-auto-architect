import { MethodMapping } from '../types';

/**
 * Mapeamento estrito de métodos da SDK DynamoDB (.NET C# e Python boto3)
 * para as ações IAM correspondentes com menor privilégio.
 *
 * Importante: métodos com múltiplas ações (ex: TransactWriteItems)
 * recebem todas as ações que podem ocorrer internamente.
 */
export const DYNAMODB_MAPPINGS: Readonly<Record<string, MethodMapping>> = {
  // ─── .NET C# (Amazon.DynamoDBv2) ──────────────────────────────────────────
  PutItemAsync:             { iamActions: ['dynamodb:PutItem'] },
  GetItemAsync:             { iamActions: ['dynamodb:GetItem'] },
  QueryAsync:               { iamActions: ['dynamodb:Query'] },
  UpdateItemAsync:          { iamActions: ['dynamodb:UpdateItem'] },
  DeleteItemAsync:          { iamActions: ['dynamodb:DeleteItem'] },
  BatchGetItemAsync:        { iamActions: ['dynamodb:BatchGetItem'] },
  BatchWriteItemAsync:      { iamActions: ['dynamodb:BatchWriteItem'] },
  TransactWriteItemsAsync:  { iamActions: ['dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem'] },
  ScanAsync: {
    iamActions: ['dynamodb:Scan'],
    warning: '⚠️ CUSTO & PERFORMANCE: ScanAsync varre a tabela inteira. Avalie QueryAsync com GSI.',
  },

  // ─── Python boto3 ──────────────────────────────────────────────────────────
  put_item:           { iamActions: ['dynamodb:PutItem'] },
  get_item:           { iamActions: ['dynamodb:GetItem'] },
  query:              { iamActions: ['dynamodb:Query'] },
  update_item:        { iamActions: ['dynamodb:UpdateItem'] },
  delete_item:        { iamActions: ['dynamodb:DeleteItem'] },
  batch_get_item:     { iamActions: ['dynamodb:BatchGetItem'] },
  batch_write_item:   { iamActions: ['dynamodb:BatchWriteItem'] },
  scan: {
    iamActions: ['dynamodb:Scan'],
    warning: '⚠️ CUSTO & PERFORMANCE: scan() varre a tabela inteira. Avalie query() com Index.',
  },
} as const;

/** Namespaces que indicam uso real da SDK DynamoDB em C# */
export const DYNAMODB_CSHARP_NAMESPACES = [
  'Amazon.DynamoDBv2',
  'AWSSDK.DynamoDBv2',
  'IAmazonDynamoDB',
  'AmazonDynamoDBClient',
] as const;

/** Imports que indicam uso real da SDK DynamoDB em Python */
export const DYNAMODB_PYTHON_IMPORTS = [
  "boto3.client('dynamodb')",
  "boto3.resource('dynamodb')",
  "import boto3",
] as const;
