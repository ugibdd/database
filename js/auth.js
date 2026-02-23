// Модуль аутентификации
const Auth = (function() {
    let currentUser = null;

    // Восстановление сессии из localStorage
    function restoreSession() {
        const saved = localStorage.getItem('user');
        if (!saved) {
            return null;
        }
        currentUser = JSON.parse(saved);
        return currentUser;
    }

    // Сохранение сессии
    function saveSession(user) {
        currentUser = user;
        localStorage.setItem('user', JSON.stringify(user));
    }

    // Вход в систему
    async function login(nickname, password) {
        const { data, error } = await supabaseClient
            .from('employees')
            .select('*')
            .eq('nickname', nickname)
            .eq('password', password)
            .maybeSingle();

        if (error || !data) {
            throw new Error('Неверные данные для входа');
        }

        saveSession(data);
        return data;
    }

    // Выход из системы
    function logout() {
        currentUser = null;
        localStorage.removeItem('user');
    }

    // Получение текущего пользователя
    function getCurrentUser() {
        return currentUser;
    }

    // Проверка прав администратора
    function isAdmin() {
        return currentUser?.category === 'Администратор';
    }

    return {
        restoreSession,
        login,
        logout,
        getCurrentUser,
        isAdmin
    };
})();