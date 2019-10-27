/* eslint-disable no-console */


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
    
async function r(event) {
    if (event.spreadsheet == null /*|| event.worksheet == null*/) {
        return { statusCode: 400, body: 'missing key' };
    }
    await initGoogle();
    const validDescription = await checkDescription(event.spreadsheet, 'spff');
    if (!validDescription) {
        return { statusCode: 401, body: 'missing description shared to the group' };
    }
    
    const sheet = await google.sheets('v4').spreadsheets.values.get({ spreadsheetId: event.spreadsheet, range: '工作表1' });

    try {
        return { statusCode: 200, body: JSON.stringify({ 'values': sheet.data.values }) };
    } catch (error) {
        return { statusCode: 500, body: `write s3 err: ${error.stack}` };
    }
}

r({
    spreadsheet: '1eJPHpvgwvsIhpKTPOyItJeaqfdMAW1SkXRCwfmU5NgE'
}).then(it => {
    console.log(it);
});
setTimeout(function() { 
     
}, 5000); 