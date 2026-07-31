import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yxootyzlpefyztiiacrs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4b290eXpscGVmeXp0aWlhY3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTQyMDksImV4cCI6MjA4MzQ5MDIwOX0.q7kYof5g3i8blQ0Xn7n0OStfN97H09LOX-zsOnuzc1g';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
