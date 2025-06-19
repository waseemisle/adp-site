const express = require('express');
const https = require('https');
const fs = require('fs');
const querystring = require('querystring');
const app = express();

// Config
const config = {
    clientId: '90681a4f-5ea6-48c5-b54a-a46e5e16b537',
    clientSecret: '01e5006d-16c2-4947-9aea-e8ec04f5b5e4'
};

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'healthy' });
});

// Token endpoint
app.post('/adp/token', async (req, res) => {
    try {
        // Load certificates from environment variables
        const cert = process.env.ADP_CLIENT_CERT;
        const key = process.env.ADP_CLIENT_KEY;

        if (!cert || !key) {
            throw new Error('Certificates not found in environment variables');
        }

        const postData = querystring.stringify({
            grant_type: 'client_credentials',
            client_id: config.clientId,
            client_secret: config.clientSecret
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
            cert: cert,
            key: key,
            rejectUnauthorized: true
        };

        const request = https.request(options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    res.status(response.statusCode).json(result);
                } catch (e) {
                    res.status(500).json({ 
                        error: 'Failed to parse ADP response',
                        details: data 
                    });
                }
            });
        });

        request.on('error', (e) => {
            res.status(500).json({ 
                error: 'Request failed',
                details: e.message 
            });
        });

        request.write(postData);
        request.end();

    } catch (e) {
        res.status(500).json({ 
            error: 'Server error',
            details: e.message 
        });
    }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
