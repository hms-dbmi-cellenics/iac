import json
import requests
 
"""
This is the code for the lambda function that talks to Cellenics API on behalf of SNS.
It is configured according to the instructions here:
https://aws.amazon.com/premiumsupport/knowledge-center/sns-subscribe-private-http-endpoint/

Its deployment is done manually. When deploying, put in the same VPC where EKS.
Put the lambda only in PRIVATE subnets. See more details on why here:
https://stackoverflow.com/questions/52992085/why-cant-an-aws-lambda-function-inside-a-public-subnet-in-a-vpc-connect-to-the
"""
def lambda_handler(event, context):
    print("EVENT: ", event)
    sns_message_payload = event["Records"][0]["Sns"]


    experiment_id = json.loads(sns_message_payload["Message"])["experimentId"]
    print("[experimentId] ", experiment_id)

    url = ""
    
    if sns_message_payload["MessageAttributes"]["type"]["Value"] == "PipelineResponse":
        url = "https://api.cellenics.apps.flaretx.com/v2/pipelineResults"
    elif sns_message_payload["MessageAttributes"]["type"]["Value"] == "GEM2SResponse":
        url = "https://api.cellenics.apps.flaretx.com/v2/gem2sResults"

    print("[ENDPOINT CALLED] ", url)
    
    sns_message_headers = {
        "x-amz-sns-message-id": sns_message_payload['MessageId'],
        "x-amz-sns-message-type": sns_message_payload["Type"],
        "x-amz-sns-subscription-arn" : event["Records"][0]["EventSubscriptionArn"],
        "x-amz-sns-topic-arn" : sns_message_payload["TopicArn"],
        "Content-Type": "text/plain",
        'Connection':'close'
    }
    
    print("[DATA PAYLOAD] ", json.dumps(sns_message_payload))

    try:
        r = requests.post(url = url, data = json.dumps(sns_message_payload), headers = sns_message_headers, verify=False, timeout=300)
        print("[SUCCESS] ", r.content)
        print("***********************")
        return {
            'statusCode': 200,
            'body': {"alles": "gut"}
        }
    except Exception as e:
        print("[FAILURE] ", e)
        print("***********************")
        return {
            'statusCode': 500,
            'body': {"error": "yes"}
        }
