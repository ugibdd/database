// Главный модуль приложения
const App = (function() {
    const elements = UI.getElements();

    // Инициализация приложения
    function init() {
        // Проверка сессии сотрудника
        const user = Auth.restoreSession();
        
        if (user && !Auth.isGuest()) {
            UI.showEmployeeMode(user);
            handleRouting();
        } else {
            UI.showAuthMode();
            // Добавляем очистку хэша при возврате на экран авторизации
            if (window.location.hash) {
                window.location.hash = '';
            }
        }

        // Привязка обработчиков
        bindEvents();
        
        // Слушаем изменения hash
        window.addEventListener('hashchange', handleRouting);
    }

    // Обработка роутинга
    function handleRouting() {
        Auth.ping(); // Сбрасываем таймер при смене страницы

        if (UI.getCurrentMode() === 'auth') {
            window.location.hash = '';
            return;
        }

        const hash = window.location.hash.slice(1) || 'home';
        
        if (UI.getCurrentMode() === 'guest') {
            handleGuestRouting(hash);
        } else if (UI.getCurrentMode() === 'employee') {
            handleEmployeeRouting(hash);
        }
    }

    // Маршрутизация для гостей
    function handleGuestRouting(hash) {
        switch(hash) {
            case 'home':
                showGuestHome();
                break;
            case 'fines':
                showGuestFines();
                break;
            case 'appeals':
                showGuestAppeals();
                break;
            case 'info':
                showGuestInfo();
                break;
            default:
                window.location.hash = 'home';
        }
    }

    // Маршрутизация для сотрудников
    function handleEmployeeRouting(hash) {
        switch(hash) {
            case 'home':
                showHome();
                break;
            case 'profile':
                showProfile();
                break;
            case 'kusp':
                KUSP.initKuspList();
                break;
            case 'admin':
                if (Auth.isAdmin()) {
                    Admin.initAdminPanel();
                } else {
                    window.location.hash = 'home';
                }
                break;
            default:
                window.location.hash = 'home';
        }
    }

    // Привязка событий
    function bindEvents() {
        // Обработчики авторизации
        elements.loginBtn.onclick = handleLogin;
        
        // Обработчики для сотрудников
        elements.navLogout.onclick = handleLogout;
        
        elements.navHome.onclick = (e) => {
            e.preventDefault();
            window.location.hash = 'home';
        };
        
        elements.navProfile.onclick = (e) => {
            e.preventDefault();
            window.location.hash = 'profile';
        };
        
        elements.navKusp.onclick = (e) => {
            e.preventDefault();
            window.location.hash = 'kusp';
        };
        
        elements.navAdmin.onclick = (e) => {
            e.preventDefault();
            if (Auth.isAdmin()) {
                window.location.hash = 'admin';
            }
        };
        
        // Обработчики для гостей
        elements.guestNavHome.onclick = (e) => {
            e.preventDefault();
            window.location.hash = 'home';
        };
        
        elements.guestNavTrafficFines.onclick = (e) => {
            e.preventDefault();
            window.location.hash = 'fines';
        };
        
        elements.guestNavAppeals.onclick = (e) => {
            e.preventDefault();
            window.location.hash = 'appeals';
        };
        
        elements.guestNavInfo.onclick = (e) => {
            e.preventDefault();
            window.location.hash = 'info';
        };
        
        elements.guestNavToEmployee.onclick = (e) => {
            e.preventDefault();
            handleGuestLogout();
        };

        // Обработчик для гостевого доступа
        document.getElementById('guestAccessBtn').onclick = handleGuestAccess;
    }

    // Обработка входа для сотрудников
    async function handleLogin() {
        const login = elements.loginInput.value.trim();
        const pass = elements.passwordInput.value.trim();

        if (!login || !pass) {
            UI.showNotification('Введите логин и пароль', 'warning');
            return;
        }

        try {
            const user = await Auth.login(login, pass);
            UI.showEmployeeMode(user);
            window.location.hash = 'home';
            UI.showNotification('Добро пожаловать, ' + user.nickname, 'success');
        } catch (error) {
            UI.showNotification(error.message, 'error');
        }
    }

    // Обработка гостевого доступа
    function handleGuestAccess() {
        const guestUser = Auth.startGuestSession();
        UI.showGuestMode();
        window.location.hash = 'home';
    }

    // Выход из гостевого режима
    function handleGuestLogout() {
        Auth.logout();
        UI.showAuthMode();
        window.location.hash = '';
    }

    // Выход из режима сотрудника
    function handleLogout() {
        Auth.logout();
        UI.showAuthMode();
        elements.loginInput.value = '';
        elements.passwordInput.value = '';
        window.location.hash = '';
    }

    // Показать главную для сотрудников
    function showHome() {
        const clone = UI.loadTemplate('home');
        UI.clearMain();
        document.getElementById('mainApp').appendChild(clone);
        
        const user = Auth.getCurrentUser();
        document.getElementById('greetingMessage').innerText = `👤 ${user.nickname} (${user.rank})`;
        
        UI.setActiveTab(elements.navHome);
    }

    // Показать профиль для сотрудников
    function showProfile() {
        const clone = UI.loadTemplate('profile');
        UI.clearMain();
        document.getElementById('mainApp').appendChild(clone);
        
        const user = Auth.getCurrentUser();
        document.getElementById('profileNickname').textContent = user.nickname;
        document.getElementById('profileRank').textContent = user.rank;
        document.getElementById('profileDepartment').textContent = user.department;
        document.getElementById('profileCategory').textContent = user.category;
        
        UI.setActiveTab(elements.navProfile);
    }

    // Гостевые страницы
    function showGuestHome() {
        const clone = UI.loadTemplate('guestHome');
        UI.clearMain();
        document.getElementById('mainApp').appendChild(clone);
        UI.setActiveTab(elements.guestNavHome);
    }

    function showGuestFines() {
        const clone = UI.loadTemplate('guestFines');
        UI.clearMain();
        document.getElementById('mainApp').appendChild(clone);
        
        document.getElementById('checkFineBtn').onclick = () => {
            const number = document.getElementById('decreeNumber').value;
            if (!number) {
                UI.showNotification('Введите номер постановления', 'warning');
                return;
            }
            UI.showNotification('Функция проверки скоро будет доступна', 'info');
        };
        
        UI.setActiveTab(elements.guestNavTrafficFines);
    }

    function showGuestAppeals() {
        const clone = UI.loadTemplate('guestAppeals');
        UI.clearMain();
        document.getElementById('mainApp').appendChild(clone);
        
        document.getElementById('findAppealBtn').onclick = () => {
            const number = document.getElementById('appealNumber').value;
            if (!number) {
                UI.showNotification('Введите номер обращения', 'warning');
                return;
            }
            UI.showNotification('Функция отслеживания скоро будет доступна', 'info');
        };
        
        UI.setActiveTab(elements.guestNavAppeals);
    }

    function showGuestInfo() {
        const clone = UI.loadTemplate('guestInfo');
        UI.clearMain();
        document.getElementById('mainApp').appendChild(clone);
        UI.setActiveTab(elements.guestNavInfo);
    }

    return {
        init
    };
})();

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', () => App.init());