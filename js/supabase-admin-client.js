// Клиент для работы с админ-функциями Supabase
const SupabaseAdmin = (function() {
    const FUNCTION_URL = 'https://rsxwekxpmqcrpbuwcljp.supabase.co/functions/v1/admin-users';

    async function callAdminFunction(action, userId, data = {}) {
        const user = Auth.getCurrentUser();
        if (!user) {
            throw new Error('Не авторизован');
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (!session) {
            throw new Error('Сессия истекла');
        }

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

        if (!response.ok) {
            throw new Error(result.error || 'Ошибка при выполнении операции');
        }

        return result.data;
    }

    async function updateUserPassword(userId, newPassword) {
        return callAdminFunction('updateUser', userId, { password: newPassword });
    }

    async function updateUserMetadata(userId, metadata) {
        return callAdminFunction('updateUser', userId, { user_metadata: metadata });
    }

    async function createUser(userData) {
        return callAdminFunction('createUser', null, {
            email: userData.email,
            password: userData.password,
            email_confirm: true,
            user_metadata: userData.metadata
        });
    }

    async function deleteUser(userId) {
        return callAdminFunction('deleteUser', userId);
    }

    return {
        updateUserPassword,
        updateUserMetadata,
        createUser,
        deleteUser
    };
})();

window.SupabaseAdmin = SupabaseAdmin;