import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconButton, Button, TextField, List, ListItem, ListItemText } from '@mui/material';
import { Send, Mic, MicOff, Add } from '@mui/icons-material';
import { supabase, signIn, signUp, signOut, getCurrentUser, saveConversation, getConversations, getConversationById } from '../supabase';
import './Chat.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [isConnecting] = useState(false);
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUpDisabled, setIsSignUpDisabled] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const messagesEndRef = useRef(null);

  const checkUser = useCallback(async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      return;
    }
    try {
      const { data, error } = await getConversations(user.id);
      if (error) {
        console.error('Error fetching conversations:', error);
      } else if (data) {
        setConversations(data);
      }
    } catch (error) {
      console.error('Unexpected error fetching conversations:', error);
    }
  }, [user]);

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
      })
      .catch(error => {
        console.error('Error accessing microphone:', error);
        setMessages(prevMessages => [...prevMessages, { text: "Error: Unable to access microphone. Please check your browser settings.", sender: 'system' }]);
      });
  }, []);

  useEffect(() => {
    const initializeUser = async () => {
      await checkUser();
      setupMediaRecorder();
    };
    initializeUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await fetchConversations();
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setConversations([]);
        setCurrentConversation(null);
      }
    });

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [checkUser, fetchConversations, setupMediaRecorder]);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user, fetchConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleVoiceInput = () => {
    if (listening) {
      console.log('Stopping recording...');
      mediaRecorderRef.current.stop();
      setListening(false);
    } else {
      console.log('Starting recording...');
      chunksRef.current = [];
      mediaRecorderRef.current.start();
      setListening(true);
    }
  };


  const handleSignIn = async () => {
    console.log('Attempting to sign in with email:', email);
    try {
      const { user, error } = await signIn(email, password);
      if (error) {
        console.error('Error signing in:', error);
        alert(`Sign in failed: ${error.message}`);
      } else if (user) {
        console.log('Sign in successful. User:', user);
        setUser(user);
        fetchConversations();
      } else {
        console.error('Sign in failed: No user returned and no error');
        alert('Sign in failed: Please try again');
      }
    } catch (error) {
      console.error('Unexpected error during sign in:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  };

  const handleSignUp = async () => {
    if (isSignUpDisabled) {
      alert('Please wait before attempting to sign up again.');
      return;
    }

    setIsSignUpDisabled(true);
    setTimeout(() => setIsSignUpDisabled(false), 60000); // 1 minute cooldown

    try {
      const { user, error } = await signUp(email, password);
      if (error) {
        if (error.status === 429) {
          console.error('Rate limit exceeded:', error);
          alert('Too many sign-up attempts. Please try again in a minute.');
        } else {
          console.error('Error signing up:', error);
          alert(`Error signing up: ${error.message || 'Unknown error'}`);
        }
      } else {
        setUser(user);
        // Clear the email and password fields after successful sign-up
        setEmail('');
        setPassword('');
        // Fetch conversations for the new user
        fetchConversations();
      }
    } catch (error) {
      console.error('Unexpected error during sign-up:', error);
      alert('An unexpected error occurred. Please try again later.');
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Error signing out:', error);
    } else {
      setUser(null);
      setConversations([]);
      setCurrentConversation(null);
      setMessages([]);
    }
  };

  const sendInputToServer = (input, isAudio = false) => {
    const formData = new FormData();
    if (isAudio) {
      formData.append('audio', input, 'audio.wav');
    } else {
      formData.append('text', input);
    }
    formData.append('audio_enabled', true);
    formData.append('is_new_conversation', !currentConversation);

    fetch('http://localhost:5000/api/process_input', {
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
      .then(response => {
        const conversationName = response.headers.get('X-Conversation-Name');
        return response.json().then(data => ({ ...data, conversationName }));
      })
      .then(data => {
        const newMessages = [
          { text: data.transcription, sender: 'user' },
          { text: data.response, sender: 'ai' }
        ];
        setMessages(prevMessages => [...prevMessages, ...newMessages]);
        if (!currentConversation) {
          console.log('Creating new conversation');
          handleCreateNewConversation(newMessages);
        } else {
          console.log('Updating existing conversation:', currentConversation.id);
          saveConversation(user.id, currentConversation.title, [...messages, ...newMessages]);
        }
      })
      .catch(error => {
        console.error('Error:', error);
        setMessages(prevMessages => [...prevMessages, { text: "Error: Unable to process input. Please try again.", sender: 'system' }]);
      });
  };

  const handleSend = () => {
    if (input.trim()) {
      setMessages(prevMessages => [...prevMessages, { text: input, sender: 'user' }]);
      sendInputToServer(input);
      setInput('');
    }
  };

  const sendAudioToServer = (audioBlob) => {
    sendInputToServer(audioBlob, true);
  };



  const handleNewConversation = async () => {
    setCurrentConversation(null);
    setMessages([]);
  };

  const handleSelectConversation = async (conversation) => {
    setCurrentConversation(conversation);
    const { data, error } = await getConversationById(conversation.id);
    if (error) {
      console.error('Error fetching conversation:', error);
    } else {
      setMessages(data.messages);
    }
  };

  const handleCreateNewConversation = async (initialMessages) => {
    console.log('Attempting to create new conversation. User:', user);
    if (!user) {
      console.error('User is not logged in');
      setMessages(prevMessages => [...prevMessages, { text: "Error: You need to be logged in to create a conversation.", sender: 'system' }]);
      return;
    }
    try {
      console.log('Generating title for new conversation');
      const titleResponse = await fetch('http://localhost:5000/api/generate_title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': '',
        },
        body: JSON.stringify({
          prompt: "Summarize the conversation in 5 words or fewer:\nBe as concise as possible without losing the context of the conversation.\nYour goal is to extract the key point of the conversation.",
          messages: initialMessages.map(msg => ({
            sender: msg.sender,
            text: msg.text
          }))
        }),
        credentials: 'include',
      });

      if (!titleResponse.ok) {
        throw new Error(`Failed to generate title: ${titleResponse.status} ${titleResponse.statusText}`);
      }

      const { title } = await titleResponse.json();
      console.log('Generated title:', title);

      // If the title is not appropriate, use a default title
      const finalTitle = title.startsWith("Please provide") ? "New Conversation" : title;

      console.log('Saving conversation for user ID:', user.id);
      const { data, error } = await saveConversation(user.id, title, initialMessages);
      if (error) {
        console.error('Error creating new conversation:', error);
        setMessages(prevMessages => [...prevMessages, { text: "Error: Unable to create a new conversation. Please try again.", sender: 'system' }]);
      } else if (data && data.length > 0) {
        console.log('New conversation created:', data[0]);
        setCurrentConversation(data[0]);
        setMessages(initialMessages);
        await fetchConversations();
      } else {
        console.error('No data returned when creating conversation');
        setMessages(prevMessages => [...prevMessages, { text: "Error: Unable to create a new conversation. Please try again.", sender: 'system' }]);
      }
    } catch (error) {
      console.error('Unexpected error creating conversation:', error);
      setMessages(prevMessages => [...prevMessages, { text: "Error: An unexpected error occurred. Please try again.", sender: 'system' }]);
    }
  };


  return (
    <div className="chat-container">
      <div className="sidebar">
        {user ? (
          <>
            <Button onClick={handleSignOut}>Sign Out</Button>
            <Button onClick={handleNewConversation}><Add /> New Conversation</Button>
            <List>
              {conversations.map((conv) => (
                <ListItem 
                  key={conv.id} 
                  button 
                  onClick={() => handleSelectConversation(conv)}
                  selected={currentConversation && currentConversation.id === conv.id}
                >
                  <ListItemText primary={conv.title} />
                </ListItem>
              ))}
            </List>
          </>
        ) : (
          <div className="auth-form">
            <TextField
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button onClick={handleSignIn}>Sign In</Button>
            <Button onClick={handleSignUp} disabled={isSignUpDisabled}>
              {isSignUpDisabled ? 'Please wait...' : 'Sign Up'}
            </Button>
          </div>
        )}
      </div>
      <div className="chat-main">
        <div className="messages-container">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.sender}`}>
              <p>{message.text}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
          />
          <IconButton onClick={handleSend}>
            <Send />
          </IconButton>
          <IconButton onClick={handleVoiceInput} disabled={isConnecting}>
            {listening ? <MicOff /> : <Mic />}
          </IconButton>
        </div>
        {listening && <div className="recording-indicator">Recording...</div>}
        {isConnecting && <div className="connecting-indicator">Connecting...</div>}
      </div>
    </div>
  );
};

export default Chat;
