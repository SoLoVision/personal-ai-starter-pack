# SoLoAssist Developer Notes

## Repository Map

```
SoLoAssist/
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat.js
│   │   │   └── Chat.css
│   │   ├── pages/
│   │   │   └── Home.js
│   │   ├── App.js
│   │   ├── index.js
│   │   ├── index.css
│   │   └── supabase.js
│   ├── package.json
│   └── package-lock.json
├── backend/
│   ├── main.py
│   ├── modules/
│   │   ├── simple_llm.py
│   │   └── typings.py
│   └── requirements.txt
├── assistants/
│   └── assistants.py
└── .gitignore
```

## Application Overview

SoLoAssist is a web-based chat application that allows users to interact with an AI assistant using text and voice input. The application supports user authentication, conversation management, and real-time audio processing.

## Key Components and Functionality

### Frontend (React)

1. **Chat.js**: The main component of the application.
   - Manages user authentication (sign up, sign in, sign out)
   - Handles conversation management (create, select, display)
   - Processes user input (text and voice)
   - Communicates with the backend API
   - Renders the chat interface

2. **supabase.js**: Handles all Supabase-related operations.
   - Initializes the Supabase client
   - Provides functions for user authentication
   - Manages conversation data in the Supabase database

### Backend (Python)

1. **main.py**: The main entry point for the backend server.
   - Handles API routes for processing user input
   - Manages conversation flow and context

2. **simple_llm.py**: Implements the language model functionality.
   - Provides methods for generating responses

3. **typings.py**: Defines data structures used in the application.

4. **assistants.py**: Implements different assistant frameworks.
   - Handles audio transcription, text-to-speech, and AI thinking processes

## Key Functions and Their Interactions

1. **User Authentication**:
   - `signUp`, `signIn`, `signOut` in `supabase.js`
   - Handled in the `Chat` component using `handleSignUp`, `handleSignIn`, `handleSignOut`

2. **Conversation Management**:
   - `saveConversation`, `getConversations`, `getConversationById` in `supabase.js`
   - `handleCreateNewConversation`, `handleSelectConversation` in `Chat.js`

3. **User Input Processing**:
   - Text input: `handleSend` in `Chat.js`
   - Voice input: `handleVoiceInput` and `sendAudioToServer` in `Chat.js`

4. **Backend Processing**:
   - `/api/process_input` endpoint in `main.py`
   - Uses `simple_llm.py` for generating responses
   - Utilizes `assistants.py` for transcription and text-to-speech

5. **Real-time Audio Handling**:
   - `setupMediaRecorder` in `Chat.js` initializes audio recording
   - `handleVoiceInput` toggles recording on/off
   - Recorded audio is sent to the server using `sendAudioToServer`

6. **State Management**:
   - React's `useState` and `useEffect` hooks manage component state
   - `useCallback` is used for memoizing functions to optimize performance

## Data Flow

1. User interacts with the chat interface (text or voice input)
2. Frontend sends the input to the backend API
3. Backend processes the input:
   - Transcribes audio if necessary
   - Generates a response using the language model
   - Converts the response to audio
4. Frontend receives the response:
   - Plays the audio response
   - Updates the chat messages
   - Saves the conversation to Supabase if needed

## Security Considerations

- User authentication is handled securely through Supabase
- Environment variables are used for sensitive information (API keys)
- HTTPS should be used in production to encrypt data in transit

## Future Improvements

- Implement real-time updates for multi-device synchronization
- Add support for file attachments in conversations
- Enhance error handling and user feedback
- Implement conversation search functionality
- Add user preferences and settings

This overview should provide developers with a clear understanding of the application's structure and functionality, making it easier to maintain and extend the codebase.
