# outline-aws-address-renew

This project is a SAM app with a web interface to renew the ip address of a EC2 instance and
retrieve outline related information.

[AWS Serverless Application Repository](https://aws.amazon.com/serverless/serverlessrepo/)

## parameters

* ActiveEC2InstanceId: the instance id of the EC2 instance to update the IP address
* EIPIdleEC2InstanceId: the instance id of the EC2 instance to hold the Elastic IP when update completes
* EIPAllocId: the allocation id of the Elastic IP
* OutlineServerPath: the path to visit outline server
* OutlineServerPort: the port to visit outline server

## deploy

This project should be packaged to s3 bucket `outline-aws-address-renew-app`, and the stack
name should be `outline-aws-address-renew`, however any s3 bucket and stack name could be
used.

* before deploying, first make sure all npm modules are installed
* run `sam package --template-file template.yaml --s3-bucket outline-aws-address-renew-app --output-template-file template.deploy.yaml`
* run `sam deploy --template-file template.deploy.yaml --stack-name outline-aws-address-renew --capabilities CAPABILITY_IAM`

## API endpoints

### POST `/renew-address`

No parameters are required.

If the status code of the response is 201, the address renew process is initiated. Otherwise,
the status code should be 202, which means the EC2 instance is in the progress of renew its
IP address, so no further action will be taken.

### GET `/outline-server`

### Response
```
{
    updating: boolean;
    accessKey?: string;
    ip?: string;
}
```

When the updating is true, the outline server is updating the ip address. Therefore, all
the information cannot be provided.
