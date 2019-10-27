/* eslint-disable no-console */
const AWS = require('aws-sdk');
AWS.config.update({
    region: process.env.region,
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey
});


const router = {};

const axios = require('axios').default;

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

    bd.auth = auth.data;
    try {
        return await router[event.path](bd);
    } catch (e) {
        console.log(e);
        return { statusCode: 500, body: e.toString() };
    }
}


const { google } = require('googleapis');
let jwt = null;

async function initGoogle() {
    if (jwt !== null) {
        return;
    }
    const key = require('./cret.json');
    const scopes = 'https://www.googleapis.com/auth/drive.readonly';
    const j = new google.auth.JWT(key.client_email, null, key.private_key, scopes);
    await j.authorize();
    jwt = j;
    google.options({
        auth: j
    });    
}

async function checkDescription(fileId, gid) {
    const drive = google.drive('v3');
    const it = await drive.files.get({fileId: fileId, fields: 'description'});
    const for_exlent = JSON.parse(it.data.description).for_exlent || [];
    return for_exlent.reduce((a, b) => a || b === gid , false);
}
    
router['/read-sheet'] = async function (event) {
    if (event.spreadsheet == null || event.worksheet == null) {
        return { statusCode: 400, body: 'missing key' };
    }
    await initGoogle();
    const validDescription = await checkDescription(event.spreadsheet, event.auth.gid);
    if (!validDescription) {
        return { statusCode: 401, body: 'missing description shared to the group' };
    }
    
    const sheet = await google.sheets('v4').spreadsheets.values.get({ spreadsheetId: event.spreadsheet, range: event.worksheet });

    try {
        return { statusCode: 200, body: JSON.stringify({ 'values': sheet.data.values }) };
    } catch (error) {
        return { statusCode: 500, body: `write s3 err: ${error.stack}` };
    }
};


exports.handler = handler;