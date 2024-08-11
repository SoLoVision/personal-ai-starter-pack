import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from './supabase';
import Chat from './components/Chat';

function App() {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      <div className="App">
        <Routes>
          <Route path="/" element={<Chat />} />
        </Routes>
      </div>
    </SessionContextProvider>
  );
}

export default App;
