// Клиент для работы с админ-функциями Supabase
const SupabaseAdmin = (function() {
    const FUNCTION_URL = 'https://rsxwekxpmqcrpbuwcljp.supabase.co/functions/v1/admin-users';

    async function callAdminFunction(action, userId, data = {}) {
        const user = Auth.getCurrentUser();
        if (!user) {
            throw new Error('Не авторизован');
        }

        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError || !session) {
            console.error('Session error:', sessionError);
            throw new Error('Сессия истекла. Пожалуйста, выполните вход заново.');
        }

        console.log(`Calling admin function: ${action} for user: ${userId}`, {
            token: session.access_token.substring(0, 20) + '...',
            user: user.nickname
        });

        try {
            const response = await fetch(FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    action,
                    userId,
                    data
                })
            });

            const result = await response.json();
            console.log('Admin function response:', { status: response.status, result });

            if (!response.ok) {
                // Подробная диагностика ошибки
                let errorMessage = result.error || 'Ошибка при выполнении операции';
                
                // Проверяем специфичные ошибки для удаления
                if (action === 'deleteUser') {
                    if (response.status === 400) {
                        if (errorMessage.includes('not found')) {
                            // Пользователь уже удален - это не критично
                            console.warn('User already deleted in auth, continuing...');
                            return { user: { id: userId, already_deleted: true } };
                        }
                        if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
                            errorMessage = 'Недостаточно прав для удаления пользователя. Проверьте настройки сервисной роли.';
                        }
                    }
                }
                
                // Проверяем специфичные ошибки для обновления email
                if (action === 'updateUser' && data.email) {
                    if (errorMessage.includes('email already exists') || errorMessage.includes('duplicate key')) {
                        errorMessage = 'Пользователь с таким логином (email) уже существует';
                    }
                }
                
                throw new Error(ErrorHandler.localizeError(errorMessage));
            }

            return result.data;
        } catch (error) {
            console.error('Admin function error:', error);
            
            // Если это ошибка сети или CORS
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Не удалось подключиться к серверу. Проверьте подключение к интернету.');
            }
            
            throw error;
        }
    }

    // Обновление пароля пользователя
    async function updateUserPassword(userId, newPassword) {
        return callAdminFunction('updateUser', userId, { password: newPassword });
    }

    // Обновление email пользователя
    async function updateUserEmail(userId, newEmail) {
        // Проверяем формат email
        if (!newEmail || !newEmail.includes('@')) {
            throw new Error('Некорректный формат email');
        }
        
        return callAdminFunction('updateUser', userId, { email: newEmail });
    }

    // Обновление метаданных пользователя
    async function updateUserMetadata(userId, metadata) {
        return callAdminFunction('updateUser', userId, { user_metadata: metadata });
    }

    // Создание нового пользователя
    async function createUser(userData) {
        return callAdminFunction('createUser', null, {
            email: userData.email,
            password: userData.password,
            email_confirm: true,
            user_metadata: userData.metadata
        });
    }

    // Удаление пользователя
    async function deleteUser(userId) {
        try {
            return await callAdminFunction('deleteUser', userId);
        } catch (error) {
            // Если ошибка связана с тем, что пользователь не найден
            if (error.message.includes('not found')) {
                console.warn('User not found in auth, proceeding with local deletion');
                return { user: { id: userId, not_found: true } };
            }
            throw error;
        }
    }

    // Получение информации о пользователе
    async function getUserById(userId) {
        return callAdminFunction('getUser', userId);
    }

    // Блокировка/разблокировка пользователя
    async function toggleUserBan(userId, banUntil = null) {
        return callAdminFunction('updateUser', userId, { 
            ban_duration: banUntil ? '8760h' : null // Бан на год, если указана дата
        });
    }

    return {
        updateUserPassword,
        updateUserEmail,
        updateUserMetadata,
        createUser,
        deleteUser,
        getUserById,
        toggleUserBan
    };
})();

window.SupabaseAdmin = SupabaseAdmin;