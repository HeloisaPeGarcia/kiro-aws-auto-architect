const fs = require('fs');
const path = require('path');

// =========================================================================
// 🌩️ Kiro Power: AWS Serverless Auto-Architect - Demonstração Completa
// =========================================================================

console.log('-----------------------------------------------------------------');
console.log('🚀 Iniciando Kiro Power: AWS Serverless Auto-Architect (v1.0.0)');
console.log('-----------------------------------------------------------------');

const examplesDir = __dirname;
const csharpFile = path.join(examplesDir, 'OrdersService.cs');
const pythonFile = path.join(examplesDir, 'NotificationWorker.py');
const stackFile = path.join(examplesDir, 'AppStack.ts');

// 1. Mapeamentos Estritos de Menor Privilégio
const IAM_RULES = {
  dynamodb: {
    'PutItemAsync': ['dynamodb:PutItem'],
    'GetItemAsync': ['dynamodb:GetItem'],
    'QueryAsync': ['dynamodb:Query'],
    'ScanAsync': ['dynamodb:Scan']
  },
  s3: {
    'PutObjectAsync': { actions: ['s3:PutObject'], type: 'object' },
    'GetObjectAsync': { actions: ['s3:GetObject'], type: 'object' },
    'ListObjectsV2Async': { actions: ['s3:ListBucket'], type: 'bucket' }
  },
  sqs: {
    'receive_message': ['sqs:ReceiveMessage'],
    'delete_message': ['sqs:DeleteMessage']
  },
  sns: {
    'publish': ['sns:Publish']
  }
};

// 2. Leitura e Análise dos Códigos
console.log('\n🔍 [Fase 1] Escaneando arquivos de código da aplicação...');

const detected = [];

// Analisando C#
if (fs.existsSync(csharpFile)) {
  const content = fs.readFileSync(csharpFile, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('// kiro-ignore')) {
      console.log(`   [IGNORE] Linha ${idx + 1} suprimida via '// kiro-ignore'`);
      return;
    }
    if (line.includes('PutItemAsync')) {
      detected.push({ file: 'OrdersService.cs', service: 'dynamodb', action: 'dynamodb:PutItem', resource: 'OrdersTable' });
    }
    if (line.includes('GetItemAsync')) {
      detected.push({ file: 'OrdersService.cs', service: 'dynamodb', action: 'dynamodb:GetItem', resource: 'OrdersTable' });
    }
    if (line.includes('PutObjectAsync')) {
      detected.push({ file: 'OrdersService.cs', service: 's3', action: 's3:PutObject', resource: 'company-invoices', type: 'object' });
    }
    if (line.includes('ListObjectsV2Async')) {
      detected.push({ file: 'OrdersService.cs', service: 's3', action: 's3:ListBucket', resource: 'company-invoices', type: 'bucket' });
    }
  });
}

// Analisando Python
if (fs.existsSync(pythonFile)) {
  const content = fs.readFileSync(pythonFile, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('# kiro-ignore')) return;
    if (line.includes('receive_message')) {
      detected.push({ file: 'NotificationWorker.py', service: 'sqs', action: 'sqs:ReceiveMessage', resource: 'orders-processing-queue' });
    }
    if (line.includes('delete_message')) {
      detected.push({ file: 'NotificationWorker.py', service: 'sqs', action: 'sqs:DeleteMessage', resource: 'orders-processing-queue' });
    }
    if (line.includes('publish')) {
      detected.push({ file: 'NotificationWorker.py', service: 'sns', action: 'sns:Publish', resource: 'order-completed-topic' });
    }
  });
}

console.log(`✅ Total de chamadas ativas detectadas com sucesso: ${detected.length}`);
detected.forEach(d => {
  console.log(`   • [${d.file}] ${d.service.toUpperCase()} -> ${d.action} sobre '${d.resource}'`);
});

// 3. Geração do Snippet CDK com Menor Privilégio
console.log('\n⚙️ [Fase 2] Sintetizando Infraestrutura CDK (TypeScript)...');

const cdkSnippet = [
  '    // [kiro-power:start] auto-generated — do not edit manually',
  '    // DynamoDB Table: OrdersTable',
  '    // Referência via fromTableArn para garantir funcionamento do menor privilégio',
  '    const ordersTable = dynamodb.Table.fromTableArn(',
  '      this,',
  '      ' + "'OrdersTableRef',",
  '      `arn:aws:dynamodb:${this.region}:${this.account}:table/OrdersTable`',
  '    );',
  "    ordersTable.grant(appFunction, 'dynamodb:PutItem', 'dynamodb:GetItem');",
  '',
  '    // S3 Bucket: company-invoices',
  "    const invoicesBucket = s3.Bucket.fromBucketName(this, 'InvoicesBucketRef', 'company-invoices');",
  '    // Ação no nível de Bucket ARN',
  '    appFunction.addToRolePolicy(new iam.PolicyStatement({',
  '      effect: iam.Effect.ALLOW,',
  "      actions: ['s3:ListBucket'],",
  '      resources: [invoicesBucket.bucketArn],',
  '    }));',
  '    // Ação no nível de Object ARN (/*)',
  '    appFunction.addToRolePolicy(new iam.PolicyStatement({',
  '      effect: iam.Effect.ALLOW,',
  "      actions: ['s3:PutObject'],",
  '      resources: [`${invoicesBucket.bucketArn}/*`],',
  '    }));',
  '',
  '    // SQS Queue: orders-processing-queue',
  '    const ordersQueue = sqs.Queue.fromQueueArn(',
  '      this,',
  '      ' + "'OrdersQueueRef',",
  '      `arn:aws:sqs:${this.region}:${this.account}:orders-processing-queue`',
  '    );',
  "    ordersQueue.grant(appFunction, 'sqs:ReceiveMessage', 'sqs:DeleteMessage');",
  '',
  '    // SNS Topic: order-completed-topic',
  '    const ordersTopic = sns.Topic.fromTopicArn(',
  '      this,',
  '      ' + "'OrdersTopicRef',",
  '      `arn:aws:sns:${this.region}:${this.account}:order-completed-topic`',
  '    );',
  '    ordersTopic.grantPublish(appFunction);',
  '',
  '    // Tags de Governança',
  "    cdk.Tags.of(this).add('ManagedBy', 'kiro-power:aws-auto-architect');",
  "    cdk.Tags.of(this).add('SecurityLevel', 'LeastPrivilege');",
  '    // [kiro-power:end]'
].join('\n');

// 4. Merge Seguro na Stack
console.log('\n🔀 [Fase 3] Realizando merge seguro em examples/AppStack.ts...');
const originalStack = fs.readFileSync(stackFile, 'utf8');

let mergedStack;
const startTag = '// [kiro-power:start] auto-generated — do not edit manually';
const endTag = '// [kiro-power:end]';

if (originalStack.includes(startTag)) {
  const blockRegex = new RegExp(`${startTag}[\\s\\S]*?${endTag}`, 'g');
  mergedStack = originalStack.replace(blockRegex, cdkSnippet);
} else {
  const lastBraceIndex = originalStack.lastIndexOf('  }');
  mergedStack = originalStack.substring(0, lastBraceIndex) + '\n' + cdkSnippet + '\n' + originalStack.substring(lastBraceIndex);
}

const outputPath = path.join(examplesDir, 'GeneratedAppStack.ts');
fs.writeFileSync(outputPath, mergedStack, 'utf8');
console.log(`✅ Arquivo gerado com sucesso em: ${outputPath}`);

console.log('\n-----------------------------------------------------------------');
console.log('🎉 Demonstração concluída com sucesso!');
console.log('-----------------------------------------------------------------');
