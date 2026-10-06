// ─── Merger ────────────────────────────────────────────────────────────────────

import { StackMerger } from '../generator/merger';

describe('StackMerger', () => {
  const snippet = '    const myTable = dynamodb.Table.fromTableArn(this, "T", "arn");';
  const wrappedBlock = `${StackMerger.START_TAG}\n${snippet}\n    ${StackMerger.END_TAG}`;

  const baseStack = `export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    const appFunction = new lambda.Function(this, 'F', {});
  }
}`;

  it('deve inserir o bloco no final do construtor quando não há bloco anterior', () => {
    const result = StackMerger.merge(baseStack, snippet);
    expect(result).toContain(StackMerger.START_TAG);
    expect(result).toContain(StackMerger.END_TAG);
    expect(result).toContain(snippet);
    // Código original deve ser preservado
    expect(result).toContain("const appFunction = new lambda.Function(this, 'F', {});");
  });

  it('deve substituir o bloco existente sem duplicar em segunda execução', () => {
    const firstPass = StackMerger.merge(baseStack, snippet);
    const updatedSnippet = '    const updated = dynamodb.Table.fromTableArn(this, "U", "arn");';
    const secondPass = StackMerger.merge(firstPass, updatedSnippet);

    // Não deve haver dois blocos START_TAG
    const occurrences = (secondPass.match(new RegExp(StackMerger.START_TAG, 'g')) ?? []).length;
    expect(occurrences).toBe(1);

    // Deve conter o novo snippet e não o antigo
    expect(secondPass).toContain(updatedSnippet);
    expect(secondPass).not.toContain(snippet);
  });

  it('deve preservar código manual fora do bloco após múltiplas execuções', () => {
    const firstPass = StackMerger.merge(baseStack, snippet);
    const secondPass = StackMerger.merge(firstPass, snippet);
    expect(secondPass).toContain("const appFunction = new lambda.Function(this, 'F', {});");
  });
});

// ─── CSharpScanner ─────────────────────────────────────────────────────────────

import { CSharpScanner } from '../scanner/scanner';
import { ConfigResolver } from '../scanner/configResolver';

// Mock do ConfigResolver para testes isolados
const mockResolver = {
  resolve: (key: string) => (key === 'TABLE_NAME' ? 'Orders' : undefined),
} as unknown as ConfigResolver;

describe('CSharpScanner', () => {
  const scanner = new CSharpScanner(mockResolver);

  it('NÃO deve detectar DynamoDB em arquivo sem o namespace AWS importado', () => {
    const content = `
using Microsoft.EntityFrameworkCore;

public class Repo {
  public async Task<Order> QueryAsync(string id) {
    return await _context.Orders.FindAsync(id);
  }
}`;
    const calls = scanner.scan('Repo.cs', content);
    expect(calls.filter((c) => c.service === 'dynamodb')).toHaveLength(0);
  });

  it('deve detectar PutItemAsync em arquivo com o namespace Amazon.DynamoDBv2', () => {
    const content = `
using Amazon.DynamoDBv2;

public class OrdersRepo {
  public async Task Save() {
    await _client.PutItemAsync(tableName: "OrdersTable", item: doc);
  }
}`;
    const calls = scanner.scan('OrdersRepo.cs', content);
    const ddbCalls = calls.filter((c) => c.service === 'dynamodb');
    expect(ddbCalls).toHaveLength(1);
    expect(ddbCalls[0].iamActions).toContain('dynamodb:PutItem');
    expect(ddbCalls[0].resolvedResourceName).toBe('OrdersTable');
  });

  it('deve marcar a linha com // kiro-ignore como isIgnored=true', () => {
    const content = `
using Amazon.DynamoDBv2;

public class Repo {
  public async Task Test() {
    await _client.PutItemAsync(tableName: "Orders", item: doc); // kiro-ignore
  }
}`;
    const calls = scanner.scan('Repo.cs', content);
    expect(calls).toHaveLength(1);
    expect(calls[0].isIgnored).toBe(true);
  });

  it('deve resolver nome de recurso via ConfigResolver quando é uma variável', () => {
    const content = `
using Amazon.DynamoDBv2;

public class Repo {
  public async Task Save() {
    await _client.GetItemAsync(tableName: TABLE_NAME, key: key);
  }
}`;
    const calls = scanner.scan('Repo.cs', content);
    expect(calls[0].resolvedResourceName).toBe('Orders');
  });

  it('deve gerar aviso para ScanAsync', () => {
    const content = `
using Amazon.DynamoDBv2;

public class Repo {
  public async Task GetAll() {
    await _client.ScanAsync(new ScanRequest { TableName = "Orders" });
  }
}`;
    const calls = scanner.scan('Repo.cs', content);
    expect(calls[0].warning).toBeDefined();
    expect(calls[0].warning).toContain('CUSTO');
  });
});

// ─── DriftDetector ─────────────────────────────────────────────────────────────

import { DriftDetector } from '../drift/driftDetector';
import { DetectedCall } from '../types';

describe('DriftDetector', () => {
  const makeCall = (service: string, action: string, resource: string): DetectedCall => ({
    file: 'test.cs',
    lineNumber: 1,
    service: service as any,
    method: 'TestMethod',
    iamActions: [action],
    resourceNameOrVariable: resource,
    resolvedResourceName: resource,
    resourceArnPattern: `arn:aws:${service}:::${resource}`,
    isIgnored: false,
  });

  const stackWithBlock = `
export class AppStack extends cdk.Stack {
  // [kiro-power:start] auto-generated — do not edit manually
    // DynamoDB Table: Orders
    ordersTable.grant(appFunction, 'dynamodb:PutItem', 'dynamodb:GetItem');
    // S3 Bucket: company-invoices
    appFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'],
    }));
  // [kiro-power:end]
}`;

  it('deve retornar sem órfãos quando todas as permissões têm chamadas ativas', () => {
    const calls = [
      makeCall('dynamodb', 'dynamodb:PutItem', 'Orders'),
      makeCall('dynamodb', 'dynamodb:GetItem', 'Orders'),
      makeCall('s3', 's3:PutObject', 'company-invoices'),
    ];
    const report = DriftDetector.detect(stackWithBlock, calls);
    expect(report.orphanPermissions).toHaveLength(0);
  });

  it('deve detectar dynamodb:GetItem como órfã quando removida do código', () => {
    // Apenas PutItem ainda existe no código — GetItem foi removido
    const calls = [makeCall('dynamodb', 'dynamodb:PutItem', 'Orders')];
    const report = DriftDetector.detect(stackWithBlock, calls);

    const orphan = report.orphanPermissions.find((o) => o.action === 'dynamodb:GetItem');
    expect(orphan).toBeDefined();
    expect(orphan?.resource).toBe('Orders');
  });

  it('deve retornar vazio quando não há bloco gerado na stack', () => {
    const stackWithoutBlock = `export class AppStack extends cdk.Stack {}`;
    const calls = [makeCall('dynamodb', 'dynamodb:PutItem', 'Orders')];
    const report = DriftDetector.detect(stackWithoutBlock, calls);
    expect(report.orphanPermissions).toHaveLength(0);
  });
});

