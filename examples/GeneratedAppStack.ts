import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class AppStack extends cdk.Stack {
  region: any;
  account: any;
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Função Lambda da aplicação existente
    const appFunction = new lambda.Function(this, 'AppFunction', {
      runtime: lambda.Runtime.DOTNET_8,
      handler: 'OnnxObject::OnnxObject.Function::FunctionHandler',
      code: lambda.Code.fromAsset('../src'),
    });


    const ordersTable = dynamodb.Table.fromTableArn(
      this,
      'OrdersTableRef',
      `arn:aws:dynamodb:${this.region}:${this.account}:table/OrdersTable`
    );
    ordersTable.grant(appFunction, 'dynamodb:PutItem', 'dynamodb:GetItem');

    // S3 Bucket: company-invoices
    const invoicesBucket = s3.Bucket.fromBucketName(this, 'InvoicesBucketRef', 'company-invoices');
    // Ação no nível de Bucket ARN
    appFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListBucket'],
      resources: [invoicesBucket.bucketArn],
    }));
    // Ação no nível de Object ARN (/*)
    appFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject'],
      resources: [`${invoicesBucket.bucketArn}/*`],
    }));

    // SQS Queue: orders-processing-queue
    const ordersQueue = sqs.Queue.fromQueueArn(
      this,
      'OrdersQueueRef',
      `arn:aws:sqs:${this.region}:${this.account}:orders-processing-queue`
    );
    ordersQueue.grant(appFunction, 'sqs:ReceiveMessage', 'sqs:DeleteMessage');

    // SNS Topic: order-completed-topic
    const ordersTopic = sns.Topic.fromTopicArn(
      this,
      'OrdersTopicRef',
      `arn:aws:sns:${this.region}:${this.account}:order-completed-topic`
    );
    ordersTopic.grantPublish(appFunction);

    // Tags de Governança
    cdk.Tags.of(this).add('ManagedBy', 'kiro-power:aws-auto-architect');
    cdk.Tags.of(this).add('SecurityLevel', 'LeastPrivilege');
    // [kiro-power:end]
  }
}
