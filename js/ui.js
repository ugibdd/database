// Модуль управления интерфейсом
const UI = (function() {
    // Элементы DOM
    const elements = {
        authSection: document.getElementById('authSection'),
        mainApp: document.getElementById('mainApp'),
        userInfo: document.getElementById('userInfo'),
        topBar: document.getElementById('topBar'),
        navBar: document.getElementById('navBar'),
        navHome: document.getElementById('navHome'),
        navProfile: document.getElementById('navProfile'),
        navKusp: document.getElementById('navKusp'),
        navAdmin: document.getElementById('navAdmin'),
        navLogout: document.getElementById('navLogout'),
        loginBtn: document.getElementById('loginBtn'),
        loginInput: document.getElementById('login'),
        passwordInput: document.getElementById('password'),
        workPanel: document.getElementById('workPanel')
    };

    // Шаблоны
    const templates = {
        home: document.getElementById('homeTemplate').content,
        profile: document.getElementById('profileTemplate').content,
        admin: document.getElementById('adminTemplate').content,
        kuspList: document.getElementById('kuspListTemplate').content,
        kuspCreate: document.getElementById('kuspCreateTemplate').content
    };

    // Показать режим авторизации
    function showAuthMode() {
        elements.authSection.classList.remove('hidden');
        elements.mainApp.classList.add('hidden');
        elements.topBar.classList.add('hidden');
        elements.navBar.classList.add('hidden');
        document.body.classList.add('auth-mode');
    }

    // Показать рабочий режим
    function showAppMode(user) {
        elements.authSection.classList.add('hidden');
        elements.mainApp.classList.remove('hidden');
        elements.topBar.classList.remove('hidden');
        elements.navBar.classList.remove('hidden');
        document.body.classList.remove('auth-mode');
        
        elements.userInfo.innerText = `${user.nickname} (${user.category})`;
        elements.navAdmin.hidden = user.category !== 'Администратор';
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

    return {
        showAuthMode,
        showAppMode,
        setActiveTab,
        formatDate,
        getStatusBadge,
        clearMain,
        loadTemplate,
        getElements
    };
})();