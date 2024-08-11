const https = require('https');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const app = express();
const httpsPort = 3443;
const httpPort = 5001; // Changed to avoid conflict

const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem'),
    secureOptions: crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1
};

app.use(cors({
  origin: ['https://localhost:3443', 'http://localhost:3000', 'http://localhost:5000'],
  credentials: true
}));
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'frontend', 'build')));

// Function to run Python script
function runPythonScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const process = spawn('python', [scriptPath, ...args]);
    let output = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      console.error(`Python Error: ${data}`);
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}`));
      } else {
        resolve(output.trim());
      }
    });
  });
}

// Add your API routes here
app.post('/api/process_input', async (req, res) => {
  const { text, audio_enabled, is_new_conversation } = req.body;
  
  try {
    const response = await runPythonScript('./main.py', ['process_input', text]);
    const title = await runPythonScript('./main.py', ['generate_title', text]);

    res.json({
      transcription: text,
      response: response,
      title: title
    });
  } catch (error) {
    console.error('Error processing input:', error);
    res.status(500).json({ error: 'An error occurred while processing the input' });
  }
});

app.post('/api/generate_title', async (req, res) => {
  const { messages } = req.body;
  
  try {
    const title = await runPythonScript('./main.py', ['generate_title', messages[0].text]);
    res.json({ title: title });
  } catch (error) {
    console.error('Error generating title:', error);
    res.status(500).json({ error: 'An error occurred while generating the title' });
  }
});

// Placeholder function for audio response generation
function generateAudioResponse(text) {
  // This is a placeholder. In a real implementation, you would generate an audio buffer here.
  return Buffer.from('Dummy audio data');
}

app.get('/api/get_last_interaction', (req, res) => {
  // Implement your logic to get the last interaction
  res.json({ message: 'Last interaction' });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

// Start HTTPS server
https.createServer(options, app).listen(httpsPort, () => {
    console.log(`HTTPS server running on https://localhost:${httpsPort}`);
});

// Start HTTP server
app.listen(httpPort, () => {
  console.log(`HTTP server running on http://localhost:${httpPort}`);
});
