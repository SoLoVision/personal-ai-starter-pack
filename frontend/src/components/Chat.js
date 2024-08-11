import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconButton } from '@mui/material';
import { Mic, MicOff } from '@mui/icons-material';
import { MessageList, Input, Button } from 'react-chat-elements';
import 'react-chat-elements/dist/main.css';

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
        
        return fetch('http://localhost:5000/api/get_last_interaction');
      })
      .then(response => response.json())
      .then(data => {
        console.log('Data received:', data);
        const newMessages = [
          { position: 'right', type: 'text', text: data.transcription, date: new Date() },
          { position: 'left', type: 'text', text: data.response, date: new Date() }
        ];
        setMessages(prevMessages => [...prevMessages, ...newMessages]);
      })
      .catch(error => {
        console.error('Error:', error);
        setMessages(prevMessages => [...prevMessages, { position: 'left', type: 'text', text: "Error: Unable to process audio. Please try again.", date: new Date() }]);
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
      const newMessage = { position: 'right', type: 'text', text: input, date: new Date() };
      setMessages(prevMessages => [...prevMessages, newMessage]);
      setInput('');
      // Here you would typically send the text input to your backend for processing
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
    <div style={{ height: '90vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <MessageList
          className='message-list'
          lockable={true}
          toBottomHeight={'100%'}
          dataSource={messages}
        />
      </div>
      <div style={{ display: 'flex', padding: '10px' }}>
        <Input
          placeholder="Type here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rightButtons={
            <Button
              color='white'
              backgroundColor='black'
              text='Send'
              onClick={handleSend}
            />
          }
        />
        <IconButton onClick={handleVoiceInput} disabled={isConnecting} style={{ marginLeft: '10px' }}>
          {listening ? <MicOff /> : <Mic />}
        </IconButton>
      </div>
      {listening && <span style={{ color: 'red', marginLeft: '10px' }}>Recording...</span>}
      {isConnecting && <span style={{ color: 'blue', marginLeft: '10px' }}>Connecting...</span>}
    </div>
  );
};

export default Chat;
