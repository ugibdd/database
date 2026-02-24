// Модуль управления интерфейсом
const UI = (function() {
    // Элементы DOM
    const elements = {
        authSection: document.getElementById('authSection'),
        mainApp: document.getElementById('mainApp'),
        userInfo: document.getElementById('userInfo'),
        topBar: document.getElementById('topBar'),
        systemTitleSpan: document.getElementById('systemTitleSpan'),
        navBar: document.getElementById('navBar'),
        guestNavBar: document.getElementById('guestNavBar'),
        navHome: document.getElementById('navHome'),
        navProfile: document.getElementById('navProfile'),
        navKusp: document.getElementById('navKusp'),
        navAdmin: document.getElementById('navAdmin'),
        navLogout: document.getElementById('navLogout'),
        guestNavHome: document.getElementById('guestNavHome'),
        guestNavTrafficFines: document.getElementById('guestNavTrafficFines'),
        guestNavAppeals: document.getElementById('guestNavAppeals'),
        guestNavInfo: document.getElementById('guestNavInfo'),
        guestNavToEmployee: document.getElementById('guestNavToEmployee'),
        loginBtn: document.getElementById('loginBtn'),
        loginInput: document.getElementById('login'),
        passwordInput: document.getElementById('password'),
        workPanel: document.getElementById('workPanel')
    };

    // Шаблоны
    const templates = {
        home: document.getElementById('homeTemplate')?.content,
        profile: document.getElementById('profileTemplate')?.content,
        admin: document.getElementById('adminTemplate')?.content,
        kuspList: document.getElementById('kuspListTemplate')?.content,
        kuspCreate: document.getElementById('kuspCreateTemplate')?.content,
        guestHome: document.getElementById('guestHomeTemplate')?.content,
        guestFines: document.getElementById('guestFinesTemplate')?.content,
        guestAppeals: document.getElementById('guestAppealsTemplate')?.content,
        guestInfo: document.getElementById('guestInfoTemplate')?.content
    };

    // Текущий режим
    let currentMode = 'auth'; // 'auth', 'guest', 'employee'

    // Переключение между режимами
    function setMode(mode) {
        currentMode = mode;
        
        // Скрываем все
        elements.authSection.classList.add('hidden');
        elements.mainApp.classList.add('hidden');
        elements.topBar.classList.add('hidden');
        elements.navBar.classList.add('hidden');
        elements.guestNavBar.classList.add('hidden');
        
        if (mode === 'auth') {
            elements.authSection.classList.remove('hidden');
            document.body.classList.add('auth-mode');
        } else if (mode === 'guest') {
            elements.mainApp.classList.remove('hidden');
            elements.guestNavBar.classList.remove('hidden');
            elements.topBar.classList.remove('hidden');
            elements.systemTitleSpan.textContent = 'Гостевой доступ';
            document.body.classList.remove('auth-mode');
        } else if (mode === 'employee') {
            elements.mainApp.classList.remove('hidden');
            elements.navBar.classList.remove('hidden');
            elements.topBar.classList.remove('hidden');
            elements.systemTitleSpan.textContent = 'Единая информационная система';
            document.body.classList.remove('auth-mode');
        }
    }

    // Показать гостевой режим
    function showGuestMode() {
        setMode('guest');
        elements.userInfo.innerText = 'Гость · Ограниченный доступ';
        elements.navAdmin.hidden = true; // Скрываем админку для гостей
    }

    // Показать режим сотрудника
    function showEmployeeMode(user) {
        if (!user) {
            console.error('Попытка открыть интерфейс без пользователя');
            setMode('auth');
            return;
        }
        
        setMode('employee');
        elements.userInfo.innerText = `${user.nickname} (${user.category})`;
        elements.navAdmin.hidden = user.category !== 'Администратор';
    }

    // Показать режим авторизации
    function showAuthMode() {
        setMode('auth');
    }

    // Получить текущий режим
    function getCurrentMode() {
        return currentMode;
    }

    // Проверка, является ли текущий пользователь гостем
    function isGuest() {
        return currentMode === 'guest';
    }

    // Установить активную вкладку
    function setActiveTab(btn) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }

    // Форматирование даты
    function formatDate(ts) {
        return ts ? new Date(ts).toLocaleString('ru-RU') : '';
    }

    // Получить бейдж статуса
    function getStatusBadge(status) {
        if (status === 'new') return '<span class="badge badge-new">Новая</span>';
        if (status === 'in_progress') return '<span class="badge badge-progress">В работе</span>';
        if (status === 'closed') return '<span class="badge badge-closed">Закрыта</span>';
        return '<span class="badge">—</span>';
    }

    // Очистить основную область
    function clearMain() {
        elements.mainApp.innerHTML = '';
    }

    // Загрузить шаблон
    function loadTemplate(templateName) {
        return document.importNode(templates[templateName], true);
    }

    // Получить элементы DOM
    function getElements() {
        return elements;
    }

    // Показать уведомление
    function showNotification(message, type = 'info') {
        // Проверяем, не открыто ли уже модальное окно
        const existingModal = document.querySelector('.notification-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay notification-modal';
        
        // Определяем цвет и заголовок в зависимости от типа
        let headerColor = '#1e3a5f';
        let title = 'Информация';
        
        if (type === 'success') {
            headerColor = '#28a745';
            title = '✓ Успешно';
        } else if (type === 'error') {
            headerColor = '#dc3545';
            title = '✗ Ошибка';
        } else if (type === 'warning') {
            headerColor = '#ffc107';
            title = '⚠ Внимание';
        }
        
        modal.innerHTML = `
            <div class="modal-container notification-container" style="max-width: 350px;">
                <div class="modal-header notification-header" style="background: ${headerColor}; color: white; padding: 8px 16px;">
                    <h3 style="color: white; margin: 0; font-size: 1rem;">${title}</h3>
                    <button class="modal-close" style="color: white; font-size: 18px;">&times;</button>
                </div>
                <div class="modal-content" style="padding: 12px 16px;">
                    <p style="margin: 0 0 12px 0; font-size: 0.95rem;">${message}</p>
                    <div class="flex-row" style="justify-content: flex-end; margin-top: 0;">
                        <button id="closeNotificationBtn" class="small secondary" style="padding: 4px 16px; font-size: 0.85rem;">OK</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики
        const closeBtn = modal.querySelector('.modal-close');
        const okBtn = document.getElementById('closeNotificationBtn');
        
        closeBtn.onclick = () => modal.remove();
        okBtn.onclick = () => modal.remove();
        
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };

        // Автоматическое закрытие для успешных операций
        if (type === 'success') {
            setTimeout(() => {
                if (document.body.contains(modal)) {
                    modal.remove();
                }
            }, 2000);
        }
    }

    return {
        showAuthMode,
        showGuestMode,
        showEmployeeMode,
        setActiveTab,
        formatDate,
        getStatusBadge,
        clearMain,
        loadTemplate,
        getElements,
        showNotification,
        getCurrentMode,
        isGuest
    };
})();

// Делаем глобально доступным
window.UI = UI;