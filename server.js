const https = require('https');
const fs = require('fs');
const express = require('express');
const querystring = require('querystring');
const app = express();

// Load environment variables (manually or use dotenv for production)
const CLIENT_ID = '90681a4f-5ea6-48c5-b54a-a46e5e16b537';
const CLIENT_SECRET = '01e5006d-16c2-4947-9aea-e8ec04f5b5e4';

app.use(express.json());

// ADP mTLS OAuth Token Endpoint
app.post('/adp/token', (req, res) => {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        return res.status(500).json({ error: 'CLIENT_ID or CLIENT_SECRET not set' });
    }

    const postData = querystring.stringify({
        grant_type: 'client_credentials',
        client_id: '90681a4f-5ea6-48c5-b54a-a46e5e16b537',
        client_secret: '01e5006d-16c2-4947-9aea-e8ec04f5b5e4'
    });

    const options = {
        hostname: 'api.adp.com',
        port: 443,
        path: '/auth/oauth/v2/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        },
        cert: fs.readFileSync('./certs/client.pem'),
        key: fs.readFileSync('./certs/client.key'),
        rejectUnauthorized: true
    };

    const request = https.request(options, (response) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => {
            try {
                const parsed = JSON.parse(body);
                res.status(response.statusCode).json(parsed);
            } catch (e) {
                res.status(response.statusCode).send(body);
            }
        });
    });

    request.on('error', (e) => {
        res.status(500).json({ error: e.message });
    });

    request.write(postData);
    request.end();
});

app.get('/', (req, res) => {
    res.send('✅ ADP Token Proxy Running. Use POST /adp/token');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ ADP proxy running on http://localhost:${PORT}`);
});
