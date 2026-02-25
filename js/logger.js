// Модуль логирования действий
const Logger = (function() {
    // Типы действий
    const ACTION_TYPES = {
        // Действия с сотрудниками
        EMPLOYEE_CREATE: 'employee_create',
        EMPLOYEE_UPDATE: 'employee_update',
        EMPLOYEE_DELETE: 'employee_delete',
        EMPLOYEE_PASSWORD_CHANGE: 'employee_password_change',
        
        // Действия с КУСП
        KUSP_CREATE: 'kusp_create',
        KUSP_UPDATE: 'kusp_update',
        KUSP_DELETE: 'kusp_delete',
        KUSP_VIEW: 'kusp_view',
        
        // Действия с сессиями
		// USER_LOGIN: 'user_login',      // Не используется
		// USER_LOGOUT: 'user_logout'     // Не используется
    };

    // Максимальное количество логов для хранения
    const MAX_LOGS_COUNT = 100;

    // Получение IP адреса (если доступно)
    async function getIpAddress() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (e) {
            return null;
        }
    }

    // Очистка старых логов, если превышен лимит
    async function cleanOldLogsIfNeeded() {
        try {
            // Получаем общее количество логов
            const { count, error: countError } = await supabaseClient
                .from('action_logs')
                .select('*', { count: 'exact', head: true });

            if (countError) {
                console.error('Error counting logs:', countError);
                return;
            }

            // Если логов больше MAX_LOGS_COUNT, удаляем самые старые
            if (count > MAX_LOGS_COUNT) {
                const logsToDelete = count - MAX_LOGS_COUNT;
                
                console.log(`Logs count (${count}) exceeds maximum (${MAX_LOGS_COUNT}). Deleting ${logsToDelete} oldest logs.`);

                // Получаем ID самых старых записей для удаления
                const { data: oldLogs, error: selectError } = await supabaseClient
                    .from('action_logs')
                    .select('id')
                    .order('created_at', { ascending: true })
                    .limit(logsToDelete);

                if (selectError) {
                    console.error('Error selecting old logs:', selectError);
                    return;
                }

                if (oldLogs && oldLogs.length > 0) {
                    const oldLogIds = oldLogs.map(log => log.id);
                    
                    // Удаляем старые логи
                    const { error: deleteError } = await supabaseClient
                        .from('action_logs')
                        .delete()
                        .in('id', oldLogIds);

                    if (deleteError) {
                        console.error('Error deleting old logs:', deleteError);
                    } else {
                        console.log(`Successfully deleted ${oldLogIds.length} old logs`);
                    }
                }
            }
        } catch (error) {
            console.error('Error in cleanOldLogsIfNeeded:', error);
        }
    }

    // Основная функция логирования
    async function log(actionType, details = {}, entityType = null, entityId = null) {
        try {
            // Проверяем, нужно ли логировать это действие
            const skipLogging = [
                'kusp_ticket_save',
                'guest_session_start',
                'session_timeout',
                'admin_panel_access',
                'admin_tab_switch'
            ].includes(actionType);
            
            if (skipLogging) {
                return; // Пропускаем логирование для указанных действий
            }

            const user = Auth.getCurrentUser();
            const currentMode = Auth.getCurrentMode?.() || 'unknown';
            
            // Определяем имя пользователя
            let userName = 'Система';
            let userId = null;
            let userCategory = null;
            
            if (currentMode === 'guest') {
                userName = 'Гость';
                userCategory = 'Гость';
            } else if (user) {
                userName = user.nickname || 'Неизвестный';
                userId = user.auth_user_id || user.id;
                userCategory = user.category;
            }

            // Получаем IP асинхронно, но не ждём его (чтобы не замедлять операцию)
            getIpAddress().then(ip => {
                // Сохраняем лог с IP
                saveLogToDatabase({
                    user_id: userId,
                    user_name: userName,
                    user_category: userCategory,
                    action_type: actionType,
                    action_details: {
                        ...details,
                        mode: currentMode,
                        timestamp: new Date().toISOString(),
                        user_agent: navigator.userAgent
                    },
                    entity_type: entityType,
                    entity_id: entityId,
                    ip_address: ip
                }).then(() => {
                    // После сохранения проверяем и чистим старые логи
                    cleanOldLogsIfNeeded();
                });
            }).catch(() => {
                // Сохраняем лог без IP
                saveLogToDatabase({
                    user_id: userId,
                    user_name: userName,
                    user_category: userCategory,
                    action_type: actionType,
                    action_details: {
                        ...details,
                        mode: currentMode,
                        timestamp: new Date().toISOString(),
                        user_agent: navigator.userAgent
                    },
                    entity_type: entityType,
                    entity_id: entityId,
                    ip_address: null
                }).then(() => {
                    // После сохранения проверяем и чистим старые логи
                    cleanOldLogsIfNeeded();
                });
            });

        } catch (error) {
            console.error('Error logging action:', error);
        }
    }

    // Сохранение лога в базу данных
    async function saveLogToDatabase(logData) {
        try {
            await supabaseClient
                .from('action_logs')
                .insert([logData]);
        } catch (error) {
            console.error('Error saving log to database:', error);
        }
    }

    // Получение логов с фильтрацией
    async function getLogs(filters = {}) {
        try {
            let query = supabaseClient
                .from('action_logs')
                .select('*')
                .order('created_at', { ascending: false });

            // Применяем фильтры
            if (filters.user_id) {
                query = query.eq('user_id', filters.user_id);
            }
            if (filters.action_type) {
                query = query.eq('action_type', filters.action_type);
            }
            if (filters.entity_type) {
                query = query.eq('entity_type', filters.entity_type);
            }
            if (filters.entity_id) {
                query = query.eq('entity_id', filters.entity_id);
            }
            if (filters.date_from) {
                query = query.gte('created_at', filters.date_from);
            }
            if (filters.date_to) {
                query = query.lte('created_at', filters.date_to);
            }
            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            const { data, error } = await query;
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting logs:', error);
            return [];
        }
    }

    // Очистка старых логов (для администраторов)
    async function manualCleanOldLogs(daysToKeep = 30) {
        try {
            const user = Auth.getCurrentUser();
            if (!user || user.category !== 'Администратор') {
                throw new Error('Только администраторы могут очищать логи');
            }

            const date = new Date();
            date.setDate(date.getDate() - daysToKeep);

            const { error } = await supabaseClient
                .from('action_logs')
                .delete()
                .lt('created_at', date.toISOString());

            if (error) throw error;
            
            UI.showNotification(`Старые логи (старше ${daysToKeep} дней) удалены`, 'success');
            return true;
        } catch (error) {
            console.error('Error cleaning logs:', error);
            UI.showNotification('Ошибка при очистке логов', 'error');
            return false;
        }
    }

    // Принудительная очистка до определенного количества
    async function trimLogsToCount(maxCount = MAX_LOGS_COUNT) {
        try {
            const user = Auth.getCurrentUser();
            if (!user || user.category !== 'Администратор') {
                throw new Error('Только администраторы могут очищать логи');
            }

            // Получаем общее количество логов
            const { count, error: countError } = await supabaseClient
                .from('action_logs')
                .select('*', { count: 'exact', head: true });

            if (countError) throw countError;

            if (count > maxCount) {
                const logsToDelete = count - maxCount;
                
                // Получаем ID самых старых записей для удаления
                const { data: oldLogs, error: selectError } = await supabaseClient
                    .from('action_logs')
                    .select('id')
                    .order('created_at', { ascending: true })
                    .limit(logsToDelete);

                if (selectError) throw selectError;

                if (oldLogs && oldLogs.length > 0) {
                    const oldLogIds = oldLogs.map(log => log.id);
                    
                    const { error: deleteError } = await supabaseClient
                        .from('action_logs')
                        .delete()
                        .in('id', oldLogIds);

                    if (deleteError) throw deleteError;
                    
                    UI.showNotification(`Оставлено ${maxCount} последних записей, удалено ${oldLogIds.length}`, 'success');
                }
            } else {
                UI.showNotification(`Количество логов (${count}) не превышает лимит (${maxCount})`, 'info');
            }
            
            return true;
        } catch (error) {
            console.error('Error trimming logs:', error);
            UI.showNotification('Ошибка при обрезке логов', 'error');
            return false;
        }
    }

    // Форматирование лога для отображения
    function formatLogForDisplay(log) {
        const date = new Date(log.created_at).toLocaleString('ru-RU');
        let actionText = '';
        
        switch(log.action_type) {
            case ACTION_TYPES.EMPLOYEE_CREATE:
                actionText = `➕ Создал сотрудника: ${log.action_details?.nickname || ''}`;
                break;
                
            case ACTION_TYPES.EMPLOYEE_UPDATE:
                if (log.action_details?.changes) {
                    const changesList = Object.entries(log.action_details.changes)
                        .map(([field, value]) => `${field}: ${value.было} → ${value.стало}`)
                        .join('; ');
                    actionText = `✏️ Изменил данные сотрудника ${log.action_details.employee}`;
                } else {
                    actionText = `✏️ Изменил данные сотрудника: ${log.action_details?.nickname || ''}`;
                }
                break;
                
            case ACTION_TYPES.EMPLOYEE_DELETE:
                actionText = `🗑️ Удалил сотрудника: ${log.action_details?.nickname || ''}`;
                break;
                
            case ACTION_TYPES.EMPLOYEE_PASSWORD_CHANGE:
                actionText = `🔑 Изменил пароль сотрудника: ${log.action_details?.nickname || ''}`;
                break;
                
            case ACTION_TYPES.KUSP_CREATE:
                actionText = `📝 Создал запись КУСП №${log.entity_id || ''}`;
                break;
                
            case ACTION_TYPES.KUSP_UPDATE:
                if (log.action_details?.changes) {
                    const changesCount = Object.keys(log.action_details.changes).length;
                    const changesList = Object.keys(log.action_details.changes).join(', ');
                    actionText = `📝 Обновил запись КУСП №${log.entity_id}`;
                } else {
                    actionText = `📝 Обновил запись КУСП №${log.entity_id || ''}`;
                }
                break;
                
            case ACTION_TYPES.KUSP_DELETE:
                actionText = `🗑️ Удалил запись КУСП №${log.entity_id || ''}`;
                break;
                
            case ACTION_TYPES.USER_LOGIN:
                actionText = `🔓 Вошёл в систему`;
                break;
                
            case ACTION_TYPES.USER_LOGOUT:
                actionText = `🔒 Вышел из системы`;
                break;
                
            case 'kusp_update_attempt':
                actionText = `⚠️ Попытка обновления КУСП №${log.entity_id} без изменений`;
                break;
            
            default:
                actionText = log.action_type;
        }

        // Добавляем IP и браузер в детали, если они есть
        let additionalDetails = '';
        if (log.ip_address || log.action_details?.user_agent) {
            additionalDetails = '<div style="margin-top: 8px; font-size: 0.8rem; color: #6c757d;">';
            if (log.ip_address) additionalDetails += `IP: ${log.ip_address}<br>`;
            if (log.action_details?.user_agent) {
                // Сокращаем user agent для читаемости
                const ua = log.action_details.user_agent;
                const browser = ua.includes('Chrome') ? 'Chrome' : 
                               ua.includes('Firefox') ? 'Firefox' :
                               ua.includes('Safari') ? 'Safari' : 'Другой браузер';
                additionalDetails += `Браузер: ${browser}`;
            }
            additionalDetails += '</div>';
        }

        return {
            ...log,
            formattedDate: date,
            formattedAction: actionText,
            formattedUser: `${log.user_name} (${log.user_category || '—'})`,
            additionalDetails: additionalDetails
        };
    }

    return {
        ACTION_TYPES,
        log,
        getLogs,
        cleanOldLogs: manualCleanOldLogs,
        trimLogsToCount,
        formatLogForDisplay
    };
})();

window.Logger = Logger;