import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Função Lambda da aplicação existente
    const appFunction = new lambda.Function(this, 'AppFunction', {
      runtime: lambda.Runtime.DOTNET_8,
      handler: 'OnnxObject::OnnxObject.Function::FunctionHandler',
      code: lambda.Code.fromAsset('../src'),
    });

    // Recursos adicionais definidos manualmente pela equipe
    // (O Kiro Power irá inserir as permissões sem tocar no código acima)
  }
}
