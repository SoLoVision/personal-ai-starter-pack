import React, { useState, useEffect, useRef } from 'react';
import { IconButton, TextField, Paper, List, ListItem, ListItemText, ListItemAvatar, Avatar } from '@mui/material';
import { Send, Mic, MicOff } from '@mui/icons-material';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
        setInput(transcript);
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const handleSend = () => {
    if (input.trim()) {
      setMessages([...messages, { text: input, sender: 'user' }]);
      setInput('');
      fetch('http://localhost:5000/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: input }),
      })
        .then(response => response.json())
        .then(data => {
          setMessages([...messages, { text: input, sender: 'user' }, { text: data.transcription, sender: 'ai' }]);
        })
        .catch(error => {
          console.error('Error:', error);
        });
    }
  };

  const handleVoiceInput = () => {
    if (listening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
    setListening(!listening);
  };

  return (
    <Paper style={{ padding: '1em', height: '80vh', display: 'flex', flexDirection: 'column' }}>
      <List style={{ flexGrow: 1, overflow: 'auto' }}>
        {messages.map((message, index) => (
          <ListItem key={index}>
            <ListItemAvatar>
              <Avatar>{message.sender === 'user' ? 'U' : 'AI'}</Avatar>
            </ListItemAvatar>
            <ListItemText primary={message.text} />
          </ListItem>
        ))}
      </List>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          fullWidth
        />
        <IconButton onClick={handleSend}>
          <Send />
        </IconButton>
        <IconButton onClick={handleVoiceInput}>
          {listening ? <MicOff /> : <Mic />}
        </IconButton>
      </div>
    </Paper>
  );
};

export default Chat;
