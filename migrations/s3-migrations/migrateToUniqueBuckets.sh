aws s3 mb s3://[new-bucket]
aws s3 sync s3://[old-bucket] s3://[new-bucket]
aws s3 rb --force s3://[old-bucket]