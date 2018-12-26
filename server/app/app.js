/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 * @param {string} event.resource - Resource path.
 * @param {string} event.path - Path parameter.
 * @param {string} event.httpMethod - Incoming request's method name.
 * @param {Object} event.headers - Incoming request headers.
 * @param {Object} event.queryStringParameters - query string parameters.
 * @param {Object} event.pathParameters - path parameters.
 * @param {Object} event.stageVariables - Applicable stage variables.
 * @param {Object} event.requestContext - Request context, including authorizer-returned key-value pairs, requestId, sourceIp, etc.
 * @param {Object} event.body - A JSON string of the request payload.
 * @param {boolean} event.body.isBase64Encoded - A boolean flag to indicate if the applicable request payload is Base64-encode
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 * @param {string} context.logGroupName - Cloudwatch Log Group name
 * @param {string} context.logStreamName - Cloudwatch Log stream name.
 * @param {string} context.functionName - Lambda function name.
 * @param {string} context.memoryLimitInMB - Function memory.
 * @param {string} context.functionVersion - Function version identifier.
 * @param {function} context.getRemainingTimeInMillis - Time in milliseconds before function times out.
 * @param {string} context.awsRequestId - Lambda request ID.
 * @param {string} context.invokedFunctionArn - Function ARN.
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * @returns {boolean} object.isBase64Encoded - A boolean flag to indicate if the applicable payload is Base64-encode (binary support)
 * @returns {string} object.statusCode - HTTP Status Code to be returned to the client
 * @returns {Object} object.headers - HTTP Headers to be returned
 * @returns {Object} object.body - JSON Payload to be returned
 * 
 */
const AWS = require("aws-sdk");
const util = require("util");
const https = require("https");
const axios = require("axios").create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    }),
});

const ec2 = new AWS.EC2();
const sqs = new AWS.SQS();

const {
    ACTIVE_EC2_INSTANCE_ID,
    EIP_IDLE_EC2_INSTANCE_ID,
    EIP_ALLOC_ID,
    RENEW_ADDR_DELAY_QUEUE_URL,
    OUTLINE_SERVER_PORT,
    OUTLINE_SERVER_PATH,
} = process.env;

async function renewAddress(ec2InstanceId, eipAllocationId) {
    await util.promisify(ec2.associateAddress.bind(ec2))({
        InstanceId: ec2InstanceId,
        AllocationId: eipAllocationId,
    });
}

async function isUpdating() {
    const instanceInfo = await util.promisify(ec2.describeAddresses.bind(ec2))({
        AllocationIds: [ EIP_ALLOC_ID ],
    });
    return instanceInfo.Addresses[0].InstanceId === ACTIVE_EC2_INSTANCE_ID;
}

exports.releaseAddress = async (event, context) => {
    const instanceInfo = await util.promisify(ec2.describeAddresses.bind(ec2))({
        AllocationIds: [ EIP_ALLOC_ID ],
    });
    const updating = await isUpdating();
    if(!updating) {
        await renewAddress(ACTIVE_EC2_INSTANCE_ID, EIP_ALLOC_ID);
        await util.promisify(sqs.sendMessage.bind(sqs))({
            MessageBody: '_',
            QueueUrl: RENEW_ADDR_DELAY_QUEUE_URL,
        });
    }
    const response = {
        'statusCode': updating ? 202 : 201,
        'body': '',
    };
    return response;
};

exports.renewAddress = async (event) => {
    await renewAddress(EIP_IDLE_EC2_INSTANCE_ID, EIP_ALLOC_ID);
    return true;
};

exports.getOutlineServer = async (event) => {
    const updating = await isUpdating();
    const body = {
        updating,
    };
    if(!updating) {
        const ip = (await util.promisify(ec2.describeInstances.bind(ec2))({
            InstanceIds: [ ACTIVE_EC2_INSTANCE_ID ],
        })).Reservations[0].Instances[0].NetworkInterfaces[0].Association.PublicIp;
        body.ip = ip;
        const apiUrl = `https://${ip}:${OUTLINE_SERVER_PORT}${OUTLINE_SERVER_PATH}/access-keys/`;
        const { port, password, method } = (await axios.get(apiUrl)).data.accessKeys[0];
        const accessKey = 'ss://' + Buffer.from(`${method}:${password}@${ip}:${port}`).toString('base64');
        body.accessKey = accessKey;
    }
    return {
        statusCode: 200,
        body: JSON.stringify(body),
    };
};
