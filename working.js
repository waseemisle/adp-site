const path = require('path');
require('dotenv').config();

const https = require('https');
const fs = require('fs');
const express = require('express');
const querystring = require('querystring');
const app = express();

// Load credentials
const config = {
    clientId: '90681a4f-5ea6-48c5-b54a-a46e5e16b537',
    clientSecret: '01e5006d-16c2-4947-9aea-e8ec04f5b5e4',
    port: process.env.PORT || 10000
};


// Middleware
app.use(express.json());

// Health check endpoint (required for Render)
app.get('/', (req, res) => {
    res.json({ status: 'healthy' });
});

// Worker endpoint
app.get('/adp/workers/*', async (req, res) => {
    try {
        // Get the path after /adp/workers/
        const workerPath = req.path.replace('/adp/workers/', '');
        
        // Load certificates from environment or files
        const cert = process.env.ADP_CLIENT_CERT || fs.readFileSync(path.join(__dirname, 'certs', 'client.pem'));
        const key = process.env.ADP_CLIENT_KEY || fs.readFileSync(path.join(__dirname, 'certs', 'client.key'));

        // First get the token
        const tokenResponse = await new Promise((resolve, reject) => {
            const postData = querystring.stringify({
                grant_type: 'client_credentials',
                client_id: config.clientId,
                client_secret: config.clientSecret
            });

            const tokenOptions = {
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

            const request = https.request(tokenOptions, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve(result);
                    } catch (e) {
                        reject(new Error('Failed to parse token response'));
                    }
                });
            });

            request.on('error', reject);
            request.write(postData);
            request.end();
        });

        // Now make the worker request with the token
        const options = {
            hostname: 'api.adp.com',
            port: 443,
            path: `/hr/v2/workers/${workerPath}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${tokenResponse.access_token}`
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

        request.end();

    } catch (e) {
        res.status(500).json({ 
            error: 'Server error',
            details: e.message 
        });
    }
});

// Token endpoint
app.post('/adp/token', async (req, res) => {
    try {
        // Load certificates from environment or files
        const cert = process.env.ADP_CLIENT_CERT || fs.readFileSync(path.join(__dirname, 'certs', 'client.pem'));
        const key = process.env.ADP_CLIENT_KEY || fs.readFileSync(path.join(__dirname, 'certs', 'client.key'));

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

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log('Configuration ready');
});


// https://gelatinous-cold-beryllium.glitch.me/adp/token
