using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Amazon.S3;
using Amazon.S3.Model;

namespace OnnxObject.Services
{
    public class OrdersService
    {
        private readonly IAmazonDynamoDB _dynamoClient;
        private readonly IAmazonS3 _s3Client;

        public OrdersService(IAmazonDynamoDB dynamoClient, IAmazonS3 s3Client)
        {
            _dynamoClient = dynamoClient;
            _s3Client = s3Client;
        }

        public async Task ProcessOrderAsync(string orderId, byte[] invoicePdf)
        {
            // 1. Inserir pedido no DynamoDB (tabela "OrdersTable")
            await _dynamoClient.PutItemAsync(
                tableName: "OrdersTable",
                item: new Dictionary<string, AttributeValue>
                {
                    { "OrderId", new AttributeValue { S = orderId } },
                    { "Status", new AttributeValue { S = "Pending" } }
                }
            );

            // 2. Obter detalhes do pedido
            await _dynamoClient.GetItemAsync(
                tableName: "OrdersTable",
                key: new Dictionary<string, AttributeValue>
                {
                    { "OrderId", new AttributeValue { S = orderId } }
                }
            );

            // 3. Salvar nota fiscal no S3 (bucket "company-invoices")
            await _s3Client.PutObjectAsync(new PutObjectRequest
            {
                BucketName = "company-invoices",
                Key = $"invoices/{orderId}.pdf"
            });

            // 4. Listar notas fiscais (requer permissão de bucket arn)
            await _s3Client.ListObjectsV2Async(new ListObjectsV2Request
            {
                BucketName = "company-invoices",
                Prefix = "invoices/"
            });

            // 5. Chamada de teste/mock suprimida explicitamente
            await _dynamoClient.ScanAsync(new ScanRequest { TableName = "OrdersTable" }); // kiro-ignore
        }
    }
}
