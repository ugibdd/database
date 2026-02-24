// Модуль аутентификации с поддержкой гостевого режима
const Auth = (function() {
    let currentUser = null;
    let currentMode = 'auth'; // 'auth', 'guest', 'employee'
    let inactivityTimer = null;
    const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 минут
    const LAST_ACTIVITY_KEY = 'lastActivityTime';

    // -------------------- Utility --------------------
    function updateLastActivity() {
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    }

    function checkInactivityOnLoad() {
        const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (!lastActivity) return false;
        return (Date.now() - parseInt(lastActivity)) > INACTIVITY_TIMEOUT;
    }

    function resetInactivityTimer() {
        updateLastActivity();
        if (inactivityTimer) clearTimeout(inactivityTimer);
        if (currentUser) {
            inactivityTimer = setTimeout(() => handleInactivityLogout(), INACTIVITY_TIMEOUT);
        }
    }

    function setupActivityListeners() {
        const events = ['mousedown','mousemove','keydown','scroll','touchstart','click','wheel'];
        const resetTimer = () => resetInactivityTimer();
        events.forEach(ev => {
            document.removeEventListener(ev, resetTimer);
            document.addEventListener(ev, resetTimer);
        });
    }

    function removeActivityListeners() {
        const events = ['mousedown','mousemove','keydown','scroll','touchstart','click','wheel'];
        const resetTimer = () => resetInactivityTimer();
        events.forEach(ev => document.removeEventListener(ev, resetTimer));
    }

    function handleInactivityLogout() {
        if (!currentUser) return;
        
        const message = isGuest() 
            ? 'Гостевой сеанс завершён из-за бездействия' 
            : 'Сессия завершена из-за длительного бездействия';
        
        UI.showNotification(message, 'warning');
        logout();
        UI.showAuthMode();
        
        const elements = UI.getElements();
        if (elements.loginInput) elements.loginInput.value = '';
        if (elements.passwordInput) elements.passwordInput.value = '';
        window.location.hash = '';
    }

    function saveSession(user) {
        currentUser = user;
        currentMode = 'employee';
        localStorage.setItem('user', JSON.stringify(user));
        updateLastActivity();
        setupActivityListeners();
        resetInactivityTimer();
    }

    // -------------------- Гостевой режим --------------------
    function startGuestSession() {
        // Завершаем предыдущую сессию если была
        logout();
        
        currentMode = 'guest';
        currentUser = {
            id: 'guest',
            nickname: 'Гость',
            rank: 'Гостевой доступ',
            department: 'Портал гражданина',
            category: 'Гость',
            isGuest: true
        };
        
        // Не сохраняем гостя в localStorage, только в памяти
        localStorage.removeItem('user'); // Удаляем возможную старую сессию
        updateLastActivity();
        setupActivityListeners();
        resetInactivityTimer();
        
        return currentUser;
    }

    function isGuest() {
        return currentMode === 'guest';
    }

    // -------------------- Режим сотрудника --------------------
    async function login(nickname, password) {
        const email = `${nickname}@app.local`;
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email, password
        });
        
        if (authError || !authData.user) throw new Error('Неверные данные для входа');

        const userId = authData.user.id;
        const { data, error } = await supabaseClient
            .from('employees')
            .select('*')
            .eq('auth_user_id', userId)
            .maybeSingle();

        if (error) throw new Error(`Ошибка базы данных: ${error.message}`);
        if (!data) throw new Error('Пользователь не найден в системе');

        saveSession(data);
        return data;
    }

    async function register({ nickname, password, rank, department, category }) {
        const email = `${nickname}@app.local`;

        // 1. Создание пользователя в Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({ email, password });
        if (authError || !authData.user) throw new Error(authError?.message || 'Ошибка регистрации');

        const userId = authData.user.id;

        // 2. Создание записи в employees
        const { error: insertError } = await supabaseClient.from('employees').insert([{
            nickname, rank, department, category, auth_user_id: userId
        }]);
        if (insertError) throw new Error(insertError.message);

        // 3. Автоматический логин после регистрации
        await supabaseClient.auth.signInWithPassword({ email, password });

        return true;
    }

    // -------------------- Secure Requests --------------------
    async function secureRequest(table, operation, data = null, id = null) {
        // Гости не имеют доступа к защищённым запросам
        if (isGuest()) {
            throw new Error('Гостевой режим не имеет доступа к этой функции');
        }
        
        const user = getCurrentUser();
        if (!user) throw new Error('Не авторизован');

        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !session) throw new Error('Сессия истекла');

        let query = supabaseClient.from(table);
        switch(operation) {
            case 'select': return await query.select('*');
            case 'insert': return await query.insert(data);
            case 'update': return await query.update(data).eq('id', id);
            case 'delete': return await query.delete().eq('id', id);
            default: return { error: 'Unknown operation' };
        }
    }

    // -------------------- Helpers --------------------
    function logout() {
        currentUser = null;
        currentMode = 'auth';
        localStorage.removeItem('user');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; }
        removeActivityListeners();
    }

    function restoreSession() {
        // Проверяем, не гость ли мы (гости не сохраняются)
        if (currentMode === 'guest') {
            return currentUser;
        }
        
        const saved = localStorage.getItem('user');
        if (!saved) return null;
        
        if (checkInactivityOnLoad()) {
            logout();
            return null;
        }
        
        try {
            const user = JSON.parse(saved);
            currentUser = user;
            currentMode = 'employee';
            
            if (currentUser) {
                setupActivityListeners();
                resetInactivityTimer();
            }
            return currentUser;
        } catch {
            return null;
        }
    }

    function getCurrentUser() { return currentUser; }
    function isAdmin() { return currentMode === 'employee' && currentUser?.category === 'Администратор'; }
    function ping() { resetInactivityTimer(); }
    function getCurrentMode() { return currentMode; }

    return {
        restoreSession,
        login,
        register,
        logout,
        getCurrentUser,
        isAdmin,
        ping,
        secureRequest,
        startGuestSession,
        isGuest,
        getCurrentMode
    };
})();

window.Auth = Auth;