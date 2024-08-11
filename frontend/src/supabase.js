import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anonymous Key is missing. Please check your environment variables.');
  throw new Error('Supabase configuration is incomplete');
} else {
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Anon Key:', supabaseAnonKey.substring(0, 5) + '...');
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
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title, messages });
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

export const updateConversationTitle = async (conversationId, newTitle) => {
  const { data, error } = await supabase
    .from('conversations')
    .update({ title: newTitle })
    .eq('id', conversationId);
  return { data, error };
};
