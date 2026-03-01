// Главный модуль приложения
const App = (function() {
    const elements = UI.getElements();
	
    // Функция экранирования HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

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
			case 'appeals':
				showGuestAppeals();
				break;
			case 'driver-license': 
				if (window.DriverLicense) {
					DriverLicense.initDriverLicensePage();
				} else {
					UI.showNotification('Модуль не загружен', 'error');
					window.location.hash = 'home';
				}
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
			case 'protocols':
                Protocol.initProtocolsList();
                break;	
			case 'tsu':
				if (window.TSU) {
					TSU.initTsuList();
				} else {
					UI.showNotification('Модуль не загружен', 'error');
					window.location.hash = 'home';
				}
				break;
            case 'admin':
                if (Auth.canManageUsers()) {
                    Admin.initAdminPanel();
                } else {
                    UI.showNotification('Доступ запрещен', 'error');
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
		
		elements.navProtocols.onclick = (e) => {
            e.preventDefault();
            window.location.hash = 'protocols';
        };
		
		elements.navTsu.onclick = (e) => {
			e.preventDefault();
			window.location.hash = 'tsu';
		};
        
        elements.navAdmin.onclick = (e) => {
            e.preventDefault();
            if (Auth.canManageUsers()) {
                window.location.hash = 'admin';
            } else {
                UI.showNotification('Доступ запрещен', 'warning');
            }
        };
        
        // Обработчики для гостей
        elements.guestNavHome.onclick = (e) => {
            e.preventDefault();
            window.location.hash = 'home';
        };
        
        elements.guestNavAppeals.onclick = (e) => {
            e.preventDefault();
            window.location.hash = 'appeals';
        };
		
		if (elements.guestNavDriverLicense) {
			elements.guestNavDriverLicense.onclick = (e) => {
				e.preventDefault();
				window.location.hash = 'driver-license';
			};
		}
        
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

    // Поиск дела по номеру талона для гостей
	async function findKuspByTicketNumber(ticketNumber) {
		try {
			// Ищем запись в КУСП по номеру талона
			const { data, error } = await supabaseClient
				.from('kusps')
				.select(`
					kusp_number,
					ticket_number,
					received_datetime,
					received_by_name,
					reporter_name,
					short_content,
					status,
					review_result,
					notes,
					created_at,
					updated_at
				`)
				.eq('ticket_number', ticketNumber)
				.maybeSingle();

			if (error) {
				console.error('Error finding kusp:', error);
				return { error: 'Ошибка при поиске дела' };
			}

			if (!data) {
				return { error: 'Дело с таким номером не найдено' };
			}

			return { data };
		} catch (error) {
			console.error('Error in findKuspByTicketNumber:', error);
			return { error: 'Ошибка при поиске дела' };
		}
	}

    // Показать информацию о деле для гостя
    function showKuspInfoForGuest(kusp) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'kuspGuestInfoModal';
        
        // Определяем статус дела
        let statusText = '';
        let statusClass = '';
        switch(kusp.status) {
            case 'new':
                statusText = 'Зарегистрировано';
                statusClass = 'badge-new';
                break;
            case 'in_progress':
                statusText = 'В работе';
                statusClass = 'badge-progress';
                break;
            case 'under_review':
                statusText = 'На проверке';
                statusClass = 'badge-progress';
                break;
            case 'closed':
                statusText = 'Рассмотрено';
                statusClass = 'badge-closed';
                break;
            default:
                statusText = kusp.status || 'Не определено';
        }
        
        // Результат рассмотрения
        let resultText = '';
        switch(kusp.review_result) {
            case 'возбуждено_уголовное':
                resultText = 'Возбуждено уголовное дело';
                break;
            case 'отказ_в_возбуждении':
                resultText = 'Отказано в возбуждении уголовного дела';
                break;
            case 'административное':
                resultText = 'Административное правонарушение';
                break;
            case 'передано_по_подследственности':
                resultText = 'Передано по подследственности';
                break;
            case 'приобщено_к_другому':
                resultText = 'Приобщено к другому делу';
                break;
            default:
                resultText = 'На рассмотрении';
        }
        
        modal.innerHTML = `
            <div class="modal-container" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>Информация по обращению</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-content">
                    <div style="background: #f5f9ff; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h4 style="margin:0; color: #1e3a5f;">Талон-уведомление № ${escapeHtml(kusp.ticket_number)}</h4>
                            <span class="badge ${statusClass}">${statusText}</span>
                        </div>
                        
                        <div style="border-bottom: 2px solid #dbe4ee; margin: 15px 0;"></div>
                        
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #4a6f8f; width: 40%;"><strong>Дата регистрации:</strong></td>
                                <td style="padding: 8px 0;">${UI.formatDate(kusp.received_datetime)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #4a6f8f;"><strong>Принял:</strong></td>
                                <td style="padding: 8px 0;">${escapeHtml(kusp.received_by_name || '—')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #4a6f8f;"><strong>Заявитель:</strong></td>
                                <td style="padding: 8px 0;">${escapeHtml(kusp.reporter_name || '—')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #4a6f8f;"><strong>Содержание:</strong></td>
                                <td style="padding: 8px 0;">${escapeHtml(kusp.short_content || '—')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #4a6f8f;"><strong>Статус рассмотрения:</strong></td>
                                <td style="padding: 8px 0;">${statusText}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #4a6f8f;"><strong>Результат:</strong></td>
                                <td style="padding: 8px 0;">${resultText}</td>
                            </tr>
                            ${kusp.notes ? `
                            <tr>
                                <td style="padding: 8px 0; color: #4a6f8f;"><strong>Дополнительно:</strong></td>
                                <td style="padding: 8px 0;">${escapeHtml(kusp.notes)}</td>
                            </tr>
                            ` : ''}
                            <tr>
                                <td style="padding: 8px 0; color: #4a6f8f;"><strong>Дата обновления:</strong></td>
                                <td style="padding: 8px 0;">${UI.formatDate(kusp.updated_at || kusp.created_at)}</td>
                            </tr>
                        </table>
                        
                        <div style="border-top: 2px solid #dbe4ee; margin: 15px 0; padding-top: 15px;">
                            <p style="font-size: 0.9rem; color: #6c757d;">
                                Для получения более подробной информации обратитесь в дежурную часть УГИБДД.
                            </p>
                        </div>
                    </div>
                    
                    <div class="flex-row" style="justify-content: flex-end;">
                        <button id="closeKuspInfoBtn" class="secondary">Закрыть</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики
        modal.querySelector('.modal-close').onclick = () => modal.remove();
        document.getElementById('closeKuspInfoBtn').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    function showGuestAppeals() {
        const clone = UI.loadTemplate('guestAppeals');
        UI.clearMain();
        document.getElementById('mainApp').appendChild(clone);
        
        document.getElementById('findAppealBtn').onclick = async () => {
            const number = document.getElementById('appealNumber').value.trim();
            if (!number) {
                UI.showNotification('Введите номер талона-уведомления', 'warning');
                return;
            }
            
            // Показываем индикатор загрузки
            const btn = document.getElementById('findAppealBtn');
            const originalText = btn.textContent;
            btn.textContent = '⏳ Поиск...';
            btn.disabled = true;
            
            try {
                const result = await findKuspByTicketNumber(number);
                
                if (result.error) {
                    UI.showNotification(result.error, 'error');
                    document.getElementById('appealResult').innerHTML = `
                        <div style="background: #fff0f0; padding: 15px; border-radius: 8px; color: #dc3545;">
                            ${result.error}
                        </div>
                    `;
                } else {
                    showKuspInfoForGuest(result.data);
                    document.getElementById('appealResult').innerHTML = `
                        <div style="background: #e8f4e8; padding: 15px; border-radius: 8px; color: #28a745;">
                            ✓ Дело найдено. Информация отображена в окне.
                        </div>
                    `;
                }
            } catch (error) {
                UI.showNotification('Ошибка при поиске', 'error');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
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

