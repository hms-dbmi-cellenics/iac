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

    message_body = json.loads(sns_message_payload["Message"])

    if message_body.get("experimentId"):
        print("[experimentId] ", message_body.get("experimentId"))
    else:
        print("Kubernetes event")

    url = ""

    sns_message_headers = {
        "x-amz-sns-message-id": sns_message_payload['MessageId'],
        "x-amz-sns-message-type": sns_message_payload["Type"],
        "x-amz-sns-subscription-arn" : event["Records"][0]["EventSubscriptionArn"],
        "x-amz-sns-topic-arn" : sns_message_payload["TopicArn"],
        "Content-Type": "text/plain",
        'Connection':'close'
    }

    application_json_headers = {
        "Content-Type": "application/json"
    }

    if message_body.get("reason") == "BackOff":
        data = message_body
        headers = application_json_headers
        url = "https://api.cellenics.apps.flaretx.com/v2/kubernetesEvents"
    elif sns_message_payload["MessageAttributes"]["type"]["Value"] == "PipelineResponse":
        # url = "https://api-default.scp-staging.biomage.net/v2/pipelineResults"
        # url = "https://api.cellenics.apps.flaretx.com/v2/pipelineResults"
        url = f"{message_body.get('apiUrl')}/v2/pipelineResults"
        data = sns_message_payload
        headers = sns_message_headers
    elif sns_message_payload["MessageAttributes"]["type"]["Value"] == "GEM2SResponse":
        # url = "https://api-default.scp-staging.biomage.net/v2/gem2sResults"
        # url = "https://api.cellenics.apps.flaretx.com/v2/gem2sResults"
        url = f"{message_body.get('apiUrl')}/v2/gem2sResults"
        data = sns_message_payload
        headers = sns_message_headers

    print("[ENDPOINT CALLED] ", url)
    print("[DATA PAYLOAD] ", json.dumps(data))

    try:
        r = requests.post(url = url, data = json.dumps(data), headers = headers, verify=False, timeout=300)
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