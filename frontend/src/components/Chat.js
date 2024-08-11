import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconButton, TextField, Paper, List, ListItem, ListItemText, ListItemAvatar, Avatar } from '@mui/material';
import { Send, Mic, MicOff } from '@mui/icons-material';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const sendAudioToServer = useCallback((audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');

    setIsConnecting(true);
    fetch('http://localhost:5000/api/transcribe', {
      method: 'POST',
      body: formData,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.blob();
      })
      .then(blob => {
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.play();
        
        // Fetch the transcription and response separately
        return fetch('http://localhost:5000/api/get_last_interaction');
      })
      .then(response => response.json())
      .then(data => {
        console.log('Data received:', data);
        setMessages(prevMessages => [
          ...prevMessages, 
          { text: data.transcription, sender: 'user' },
          { text: data.response, sender: 'ai' }
        ]);
      })
      .catch(error => {
        console.error('Error:', error);
        setMessages(prevMessages => [...prevMessages, { text: "Error: Unable to process audio. Please try again.", sender: 'system' }]);
      })
      .finally(() => {
        setIsConnecting(false);
      });
  }, []);

  const setupMediaRecorder = useCallback(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        mediaRecorderRef.current = new MediaRecorder(stream);
        
        mediaRecorderRef.current.ondataavailable = (event) => {
          chunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
          sendAudioToServer(audioBlob);
          chunksRef.current = [];
        };

        console.log('MediaRecorder setup complete');
      })
      .catch(error => {
        console.error('Error accessing microphone:', error);
      });
  }, [sendAudioToServer]);

  useEffect(() => {
    setupMediaRecorder();
  }, [setupMediaRecorder]);

  const handleSend = () => {
    if (input.trim()) {
      setMessages(prevMessages => [...prevMessages, { text: input, sender: 'user' }]);
      // Here you would typically send the text input to your backend for processing
      setInput('');
    }
  };

  const handleVoiceInput = () => {
    if (listening) {
      console.log('Stopping recording...');
      mediaRecorderRef.current.stop();
      setListening(false);
    } else {
      console.log('Starting recording...');
      mediaRecorderRef.current.start();
      setListening(true);
    }
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
        <IconButton onClick={handleVoiceInput} disabled={isConnecting}>
          {listening ? <MicOff /> : <Mic />}
        </IconButton>
        {listening && <div style={{ color: 'red', marginLeft: '10px' }}>Recording...</div>}
        {isConnecting && <div style={{ color: 'blue', marginLeft: '10px' }}>Connecting...</div>}
      </div>
    </Paper>
  );
};

export default Chat;
