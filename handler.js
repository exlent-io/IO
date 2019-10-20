/* eslint-disable no-console */
const AWS = require('aws-sdk');
AWS.config.update({
    region: process.env.region,
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey
});


const bucketName = 'exlent-pipeline';
const router = {};

const axios = require('axios').default;
const uuidv4 = require('uuid/v4');

async function getSession(body) {

    return await axios.post('https://auth.exlent.io/api/auth/get_session', { 'session': body.session })
        .catch(err => {
            return err.response;
        });
}

const handler = async (event) => {
    // TODO implement
    if (event.httpMethod == 'OPTIONS') {
        return {
            statusCode: 200, headers: {
                'access-control-allow-headers': '*',
                'access-control-allow-methods': 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT',
                'access-control-allow-origin': event.headers.origin
            }
        };
    }
    const response = await doHandle(event);
    if (response.headers == null) {
        response.headers = {};
    }
    if (response.headers['access-control-allow-origin'] == null) {
        response.headers['access-control-allow-origin'] = event.headers.origin;
    }
    return response;
};

async function doHandle(event) {
    if (event.httpMethod != 'POST') {
        return { statusCode: 404, body: 'POST only' };
    }
    if (!router.hasOwnProperty(event.path)) {
        return { statusCode: 404, body: 'Endpoint not found' };
    }

    const bd = JSON.parse(event.body);

    if (!bd.hasOwnProperty('session')) {
        return { statusCode: 400, body: 'missing key: session' };
    }
    const auth = await getSession(bd);

    if (auth.status != 200) {
        return { statusCode: 401, body: '' };
    }
    // ddb = new AWS.DynamoDB.DocumentClient();

    bd.auth = auth.data;
    try {
        return await router[event.path](bd);
    } catch (e) {
        console.log(e);
        return { statusCode: 500, body: e.toString() };
    }
}

router['/'] = async function (event) {
    if (event.data == null || event.flowid == null) {
        return { statusCode: 400, body: 'missing key' };
    }

    const jobid = uuidv4().replace(/-/g, '');
    try {
        const objectParams = { 
            Bucket: bucketName,
            Key: `${event.auth.gid}/${event.flowid}/${jobid}`,
            Body: JSON.stringify({ data: event.data, who: event.auth }),
            Metadata: { 'status': 'new' }
        };
        // Create object upload promise
        await new AWS.S3({ apiVersion: '2006-03-01' }).putObject(objectParams).promise();
        return { statusCode: 200, body: JSON.stringify({ 'jobid': jobid }) };
    } catch (error) {
        return { statusCode: 500, body: `write s3 err: ${error.stack}` };
    }
};


exports.handler = handler;