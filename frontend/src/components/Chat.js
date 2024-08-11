import React, { useState, useEffect, useRef } from 'react';
import { IconButton, Switch, FormControlLabel } from '@mui/material';
import { Send, Mic, MicOff } from '@mui/icons-material';
import { MainContainer, ChatContainer, MessageList, Message, MessageInput, TypingIndicator } from '@chatscope/chat-ui-kit-react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
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
      })
      .catch(error => {
        console.error('Error accessing microphone:', error);
      });
  }, []);

  const sendInputToServer = (input, isAudio = false) => {
    const formData = new FormData();
    if (isAudio) {
      formData.append('audio', input, 'audio.wav');
    } else {
      formData.append('text', input);
    }
    formData.append('audio_enabled', audioEnabled);

    fetch('http://localhost:5000/api/process_input', {
      method: 'POST',
      body: formData,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return audioEnabled ? response.blob() : response.json();
      })
      .then(data => {
        if (audioEnabled) {
          const audioUrl = URL.createObjectURL(data);
          const audio = new Audio(audioUrl);
          audio.play();
        }
        
        // Fetch the transcription and response separately
        return fetch('http://localhost:5000/api/get_last_interaction');
      })
      .then(response => response.json())
      .then(data => {
        console.log('Data received:', data);
        setMessages(prevMessages => [
          ...prevMessages, 
          { message: data.transcription, sender: 'user', direction: 'outgoing' },
          { message: data.response, sender: 'ai', direction: 'incoming' }
        ]);
      })
      .catch(error => {
        console.error('Error:', error);
        setMessages(prevMessages => [...prevMessages, { message: "Error: Unable to process input. Please try again.", sender: 'system', direction: 'incoming' }]);
      });
  };

  const handleSend = () => {
    if (input.trim()) {
      setMessages(prevMessages => [...prevMessages, { message: input, sender: 'user', direction: 'outgoing' }]);
      sendInputToServer(input);
      setInput('');
    }
  };

  const sendAudioToServer = (audioBlob) => {
    sendInputToServer(audioBlob, true);
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
    <div style={{ position: 'relative', height: '80vh' }}>
      <MainContainer>
        <ChatContainer>
          <MessageList>
            {messages.map((message, index) => (
              <Message key={index} model={message} />
            ))}
          </MessageList>
          <MessageInput
            placeholder="Type message here"
            value={input}
            onChange={(val) => setInput(val)}
            onSend={handleSend}
            attachButton={false}
            sendButton={false}
          />
        </ChatContainer>
      </MainContainer>
      <div style={{ position: 'absolute', bottom: '10px', right: '10px', display: 'flex', alignItems: 'center' }}>
        <FormControlLabel
          control={<Switch checked={audioEnabled} onChange={(e) => setAudioEnabled(e.target.checked)} />}
          label="Audio Replies"
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
    </div>
  );
};

export default Chat;
