const path = require('path');
require('dotenv').config();

const https = require('https');
const fs = require('fs');
const express = require('express');
const querystring = require('querystring');
const app = express();

// Load credentials
const config = {
    clientId: process.env.ADP_CLIENT_ID || '90681a4f-5ea6-48c5-b54a-a46e5e16b537',
    clientSecret: process.env.ADP_CLIENT_SECRET || '01e5006d-16c2-4947-9aea-e8ec04f5b5e4',
    port: process.env.PORT || 3000
};

// Middleware
app.use(express.json());

// Debug logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Health check endpoint (required for Render)
app.get('/', (req, res) => {
    res.json({ status: 'healthy' });
});

// Function to get ADP token
async function getADPToken() {
    return new Promise((resolve, reject) => {
        try {
            // Load certificates
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

            console.log('Requesting access token from ADP...');

            const request = https.request(options, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        console.log('Token response received:', {
                            statusCode: response.statusCode,
                            hasToken: !!result.access_token
                        });
                        if (response.statusCode === 200 && result.access_token) {
                            resolve(result);
                        } else {
                            reject(new Error(`Token request failed: ${data}`));
                        }
                    } catch (e) {
                        console.error('Error parsing token response:', data);
                        reject(new Error(`Failed to parse token response: ${e.message}`));
                    }
                });
            });

            request.on('error', (e) => {
                console.error('Token request error:', e);
                reject(e);
            });

            request.write(postData);
            request.end();

        } catch (e) {
            reject(e);
        }
    });
}

// Function to get worker data
async function getWorkerData(workerId, accessToken) {
    return new Promise((resolve, reject) => {
        try {
            // Load certificates
            const cert = process.env.ADP_CLIENT_CERT || fs.readFileSync(path.join(__dirname, 'certs', 'client.pem'));
            const key = process.env.ADP_CLIENT_KEY || fs.readFileSync(path.join(__dirname, 'certs', 'client.key'));

            const options = {
                hostname: 'api.adp.com',
                port: 443,
                path: `/hr/v2/workers/${workerId}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                },
                cert: cert,
                key: key,
                rejectUnauthorized: true
            };

            console.log('Making worker request to ADP...');

            const request = https.request(options, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        console.log('Worker response received:', {
                            statusCode: response.statusCode
                        });
                        resolve({
                            statusCode: response.statusCode,
                            data: result
                        });
                    } catch (e) {
                        console.error('Error parsing worker response:', data);
                        reject(new Error(`Failed to parse worker data response: ${e.message}`));
                    }
                });
            });

            request.on('error', (e) => {
                console.error('Worker request error:', e);
                reject(e);
            });

            request.end();

        } catch (e) {
            reject(e);
        }
    });
}

// Function to get all workers data
async function getAllWorkersData(accessToken, queryString = '') {
    return new Promise((resolve, reject) => {
        try {
            // Load certificates
            console.log('Loading certificates...');
            let cert, key;
            try {
                cert = process.env.ADP_CLIENT_CERT || fs.readFileSync(path.join(__dirname, 'certs', 'client.pem'));
                key = process.env.ADP_CLIENT_KEY || fs.readFileSync(path.join(__dirname, 'certs', 'client.key'));
                console.log('Certificates loaded successfully');
            } catch (certError) {
                console.error('Error loading certificates:', certError);
                throw new Error(`Failed to load certificates: ${certError.message}`);
            }
            const adpPath = '/hr/v2/workers' + queryString;
            const options = {
                hostname: 'api.adp.com',
                port: 443,
                path: adpPath,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                },
                cert: cert,
                key: key,
                rejectUnauthorized: true
            };
            console.log('Making request to ADP: ' + adpPath);
            const request = https.request(options, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        console.log('Workers list response received:', {
                            statusCode: response.statusCode
                        });
                        resolve({
                            statusCode: response.statusCode,
                            data: result
                        });
                    } catch (e) {
                        console.error('Error parsing workers list response:', data);
                        reject(new Error(`Failed to parse workers list response: ${e.message}`));
                    }
                });
            });
            request.on('error', (e) => {
                console.error('Workers list request error:', e);
                reject(e);
            });
            request.end();
        } catch (e) {
            reject(e);
        }
    });
}

// Token endpoints (supports both GET and POST)
app.get('/adp/token', async (req, res) => {
    try {
        const tokenData = await getADPToken();
        res.json(tokenData);
    } catch (e) {
        console.error('Token error:', e);
        res.status(500).json({ 
            error: 'Failed to get token',
            details: e.message 
        });
    }
});

app.post('/adp/token', async (req, res) => {
    try {
        const tokenData = await getADPToken();
        res.json(tokenData);
    } catch (e) {
        console.error('Token error:', e);
        res.status(500).json({ 
            error: 'Failed to get token',
            details: e.message 
        });
    }
});

// Workers list endpoint (must come before the specific worker endpoint)
app.get('/adp/workers', async (req, res) => {
    try {
        console.log('Fetching all workers data');
        // Get token first
        const tokenResponse = await getADPToken();
        if (!tokenResponse.access_token) {
            console.error('No access token in response:', tokenResponse);
            return res.status(500).json({
                error: 'Failed to get access token',
                details: tokenResponse
            });
        }
        // Use the original query string (including $top)
        const queryString = req.originalUrl.includes('?') ? req.originalUrl.substring(req.originalUrl.indexOf('?')) : '';
        // Get all workers data, passing the query string
        const workersResponse = await getAllWorkersData(tokenResponse.access_token, queryString);
        res.status(workersResponse.statusCode).json(workersResponse.data);
    } catch (e) {
        console.error('Server error:', e);
        res.status(500).json({ 
            error: 'Server error',
            details: e.message 
        });
    }
});

// Endpoint to get workers modified in the last 7 days (must come before :workerId route)
app.get('/adp/workers/modified-last-week', async (req, res) => {
    try {
        // Calculate the date 7 days ago in ISO format
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const isoDate = sevenDaysAgo.toISOString().split('.')[0] + 'Z'; // Remove ms for ADP compatibility
        // Try all three filter syntaxes:
        // 1. With datetimeoffset
        // const filterValue = `lastModifiedDateTime ge datetimeoffset'${isoDate}'`.replace(/ /g, '%20');
        // 2. With single quotes
        // const filterValue = `lastModifiedDateTime ge '${isoDate}'`.replace(/ /g, '%20');
        // 3. Without quotes
        const filterValue = `lastModifiedDateTime ge ${isoDate}`.replace(/ /g, '%20');
        const queryString = `?$filter=${filterValue}`;
        console.log(`Fetching workers modified since: ${isoDate}`);
        // Get token first
        const tokenResponse = await getADPToken();
        if (!tokenResponse.access_token) {
            console.error('No access token in response:', tokenResponse);
            return res.status(500).json({
                error: 'Failed to get access token',
                details: tokenResponse
            });
        }
        // Forward the filter to ADP
        const workersResponse = await getAllWorkersData(tokenResponse.access_token, queryString);
        res.status(workersResponse.statusCode).json(workersResponse.data);
    } catch (e) {
        console.error('Server error:', e);
        res.status(500).json({ 
            error: 'Server error',
            details: e.message 
        });
    }
});

// Endpoint to get workers meta information (supported filters, etc.)
app.get('/adp/workers/meta', async (req, res) => {
    try {
        const tokenResponse = await getADPToken();
        if (!tokenResponse.access_token) {
            return res.status(500).json({ error: 'Failed to get access token', details: tokenResponse });
        }
        // Fetch /meta from ADP
        const workersResponse = await getAllWorkersData(tokenResponse.access_token, '/meta');
        res.status(workersResponse.statusCode).json(workersResponse.data);
    } catch (e) {
        res.status(500).json({ error: 'Server error', details: e.message });
    }
});

// Endpoint to get workers whose expectedStartDate is after 6 months from today
app.get('/adp/workers/expected-after-6-months', async (req, res) => {
    try {
        // Calculate the date 6 months from now in ISO format
        const now = new Date();
        const sixMonthsLater = new Date(now.setMonth(now.getMonth() + 6));
        const isoDate = sixMonthsLater.toISOString().split('.')[0] + 'Z'; // Remove ms for ADP compatibility
        const filterValue = `expectedStartDate ge ${isoDate}`;
        const queryString = `?$filter=${encodeURIComponent(filterValue)}`;
        console.log(`Fetching workers with expectedStartDate after: ${isoDate}`);
        // Get token first
        const tokenResponse = await getADPToken();
        if (!tokenResponse.access_token) {
            console.error('No access token in response:', tokenResponse);
            return res.status(500).json({
                error: 'Failed to get access token',
                details: tokenResponse
            });
        }
        // Forward the filter to ADP
        const workersResponse = await getAllWorkersData(tokenResponse.access_token, queryString);
        res.status(workersResponse.statusCode).json(workersResponse.data);
    } catch (e) {
        console.error('Server error:', e);
        res.status(500).json({ 
            error: 'Server error',
            details: e.message 
        });
    }
});

// Specific worker endpoint
app.get('/adp/workers/:workerId', async (req, res) => {
    try {
        const workerId = req.params.workerId;
        if (!workerId) {
            return res.status(400).json({
                error: 'Missing worker ID',
                details: 'Please provide a worker ID in the URL, e.g., /adp/workers/G3W9GWKGVHQ57JQ3'
            });
        }
        console.log(`Fetching worker data for ID: ${workerId}`);
        // Get token first
        const tokenResponse = await getADPToken();
        if (!tokenResponse.access_token) {
            console.error('No access token in response:', tokenResponse);
            return res.status(500).json({
                error: 'Failed to get access token',
                details: tokenResponse
            });
        }
        // Get worker data
        const workerResponse = await getWorkerData(workerId, tokenResponse.access_token);
        res.status(workerResponse.statusCode).json(workerResponse.data);
    } catch (e) {
        console.error('Server error:', e);
        res.status(500).json({ 
            error: 'Server error',
            details: e.message 
        });
    }
});

// Catch-all for unmatched routes
app.use((req, res) => {
    console.error(`No route matched for ${req.method} ${req.url}`);
    res.status(404).json({ error: `No route matched for ${req.method} ${req.url}` });
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
