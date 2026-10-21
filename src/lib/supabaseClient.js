import { createClient } from '@supabase/supabase-js';

const rawUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 'https://uizlcxwevrefuofhnlpt.supabase.co';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpemxjeHdldnJlZnVvZmhubHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMDU5MzQsImV4cCI6MjEwNTg4MTkzNH0.InI3WmTda596WAe2rtD8GnhJwnrcCdTtIwVACt-FBAY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
