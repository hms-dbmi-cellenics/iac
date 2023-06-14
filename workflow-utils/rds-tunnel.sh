#!/bin/bash
# The script below is adapted from Cellenics utils tunnel script with modifications to run in the background
# https://github.com/hms-dbmi-cellenics/cellenics-utils/blob/master/cellenics/rds/tunnel.sh

ENVIRONMENT=$1
SANDBOX_ID=$2
REGION=$3
LOCAL_PORT=$4
ENDPOINT_TYPE=$5

RDSHOST="$(aws rds describe-db-cluster-endpoints \
	--region $REGION \
	--db-cluster-identifier aurora-cluster-$ENVIRONMENT-$SANDBOX_ID \
	--filter Name=db-cluster-endpoint-type,Values=\'$ENDPOINT_TYPE\' \
	--query 'DBClusterEndpoints[0].Endpoint' \
	| tr -d '"')"

INSTANCE_DATA=$(aws ec2 describe-instances \
	--region $REGION \
	--filters "Name=tag:Name,Values=rds-$ENVIRONMENT-ssm-agent" "Name=instance-state-name,Values=running" \
	--output json \
	--query "Reservations[*].Instances[*].{InstanceId:InstanceId, AvailabilityZone:Placement.AvailabilityZone}")

INSTANCE_ID=$(echo $INSTANCE_DATA | jq -r '.[0][0].InstanceId')
AVAILABILITY_ZONE=$(echo $INSTANCE_DATA | jq -r '.[0][0].AvailabilityZone')

ssh-keygen -t rsa -N '' -f temp <<<y >/dev/null 2>&1

AWS_PAGER="" aws ec2-instance-connect send-ssh-public-key --region $REGION --instance-id $INSTANCE_ID --availability-zone $AVAILABILITY_ZONE --instance-os-user ec2-user --ssh-public-key file://temp.pub

ssh -i temp -N -f -M -S temp-ssh.sock -L "$LOCAL_PORT:${RDSHOST}:5432" "ec2-user@${INSTANCE_ID}" -o "IdentitiesOnly yes" -o "UserKnownHostsFile=/dev/null" -o "StrictHostKeyChecking=no" -o ProxyCommand="aws ssm start-session --target %h --region ${REGION} --document-name AWS-StartSSHSession --parameters portNumber=%p"

echo "SSH session started at PORT ${LOCAL_PORT}"