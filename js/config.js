// Конфигурация приложения
const CONFIG = {
    SUPABASE_URL: "https://rsxwekxpmqcrpbuwcljp.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzeHdla3hwbXFjcnBidXdjbGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODcxMjcsImV4cCI6MjA4NzM2MzEyN30.pnXVzQ47RzuRqCNCN1E1jry4JzBR60M3gJ9pJvaPi4M"
};

// Инициализация Supabase клиента с правильными настройками
const { createClient } = supabase;

const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: localStorage // явно указываем хранилище
    },
    global: {
        headers: {
            'X-Client-Info': 'ugibdd-app'
        }
    }
});
