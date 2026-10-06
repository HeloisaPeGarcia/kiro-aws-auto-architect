import boto3
import json

sqs = boto3.client('sqs')
sns = boto3.client('sns')

def handler(event, context):
    # Consumir mensagem da fila
    response = sqs.receive_message(
        QueueUrl="orders-processing-queue",
        MaxNumberOfMessages=5
    )
    
    for message in response.get('Messages', []):
        # Processar e deletar
        sqs.delete_message(
            QueueUrl="orders-processing-queue",
            ReceiptHandle=message['ReceiptHandle']
        )
        
        # Publicar notificação no tópico
        sns.publish(
            TopicArn="order-completed-topic",
            Message=json.dumps({"status": "processed"})
        )
