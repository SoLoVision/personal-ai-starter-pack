import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://your-project-url.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-anon-key';

if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) {
  console.warn('Supabase URL or Anonymous Key is missing. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const signUp = async (email, password) => {
  const { user, error } = await supabase.auth.signUp({ email, password });
  return { user, error };
};

export const signIn = async (email, password) => {
  const { user, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const saveConversation = async (userId, title, messages) => {
  console.log('Saving conversation:', { userId, title, messages });
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title, messages })
    .select();
  if (error) {
    console.error('Error saving conversation:', error);
  } else {
    console.log('Conversation saved successfully:', data);
  }
  return { data, error };
};

export const getConversations = async (userId) => {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data, error };
};

export const getConversationById = async (conversationId) => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();
  return { data, error };
};
