const https = require('https');
const fs = require('fs');
const express = require('express');

const app = express();
const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

app.get('/', (req, res) => {
    res.send('Hello, HTTPS!');
});

https.createServer(options, app).listen(3000, () => {
    console.log('HTTPS server running on https://localhost:3000');
});
