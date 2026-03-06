// Модуль Протоколы
const Protocol = (function() {
    let protocolsCache = [];

    // Статусы протоколов
    const PROTOCOL_STATUS = {
        ACTIVE: 'active',
        ARCHIVED: 'archived',
    };
	
	function getMonthGenitive(monthIndex) {
		const monthsGenitive = [
			'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
			'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
		];
		return monthsGenitive[monthIndex] || '';
	}
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Загрузка списка протоколов из БД
    async function loadProtocolsList() {
        try {
            Auth.ping();
            
            const { data, error } = await supabaseClient
                .from('protocols')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error loading protocols:', error);
                UI.showNotification('Ошибка загрузки протоколов: ' + error.message, 'error');
                return [];
            }
            
            protocolsCache = data || [];
            return protocolsCache;
        } catch (error) {
            console.error('Error in loadProtocolsList:', error);
            ErrorHandler.showError(error, 'Ошибка загрузки протоколов');
            return [];
        }
    }

    // Генерация номера протокола
		async function generateProtocolNumber() {
		const prefix = '77AA'; // префикс
		
		const { data } = await supabaseClient
			.from('protocols')
			.select('protocol_number');
		
		let maxNumber = 0;
		if (data && data.length > 0) {
			data.forEach(item => {
				if (item.protocol_number && item.protocol_number.startsWith(prefix)) {
					const numPart = item.protocol_number.substring(prefix.length);
					const num = parseInt(numPart, 10);
					if (!isNaN(num) && num > maxNumber) {
						maxNumber = num;
					}
				}
			});
		}
		
		// Следующий порядковый номер (начинаем с 1, если нет протоколов)
		const nextNumber = maxNumber + 1;
		
		// Форматируем номер с ведущими нулями до 6 цифр
		const formattedNumber = nextNumber.toString().padStart(6, '0');
		
		return `${prefix}${formattedNumber}`;
	}

    // Проверка прав на редактирование протокола
    function canEditProtocol(protocol) {
		const user = Auth.getCurrentUser();
		if (!user) return false;
		
		// Администратор и ВРС могут редактировать любые протоколы
		if (user.category === 'Администратор' || user.category === 'ВРС') {
			return true;
		}
		
		// РС могут редактировать только свои протоколы
		if (user.category === 'РС') {
			return protocol.created_by_id === user.auth_user_id;
		}
		
		// МС могут редактировать только свои протоколы
		if (user.category === 'МС') {
			return protocol.created_by_id === user.auth_user_id;
		}
		
		return false;
	}

    // Проверка прав на удаление протокола
    function canDeleteProtocol() {
        const user = Auth.getCurrentUser();
        if (!user) return false;
        
        return user.category === 'Администратор' || user.category === 'ВРС';
    }

    // Получение текста статуса для отображения
    function getStatusText(status) {
        switch(status) {
            case 'active': return 'Действующий';
            case 'archived': return 'Архивный';
            default: return 'Неизвестно';
        }
    }

    // Получение класса для бейджа статуса
    function getStatusBadgeClass(status) {
        switch(status) {
            case 'active': return 'badge-new';
            case 'archived': return 'badge-closed';
            default: return '';
        }
    }

    // Фильтрация списка протоколов
    function filterProtocolsList(search, status) {
		return protocolsCache.filter(p => {
			// Фильтр по статусу
			if (status && p.status !== status) return false;
			
			// Если нет поискового запроса - показываем все
			if (!search) return true;
			
			const searchLower = search.toLowerCase();
			
			// Извлекаем цифры из поискового запроса для поиска по номеру ВУ
			const searchDigits = searchLower.replace(/[^0-9]/g, '');
			
			// Формируем ФИО для поиска
			const fullName = `${p.violator_lastname} ${p.violator_firstname} ${p.violator_patronymic || ''}`.toLowerCase();
			
			// Проверяем совпадение по разным полям
			return (
				// Поиск по номеру протокола
				p.protocol_number?.toLowerCase().includes(searchLower) ||
				// Поиск по ФИО
				fullName.includes(searchLower) ||
				// Поиск по описанию
				p.offense_description?.toLowerCase().includes(searchLower) ||
				// Поиск по госномеру
				p.vehicle_license_plate?.toLowerCase().includes(searchLower) ||
				// Поиск по новому столбцу с номером ВУ (только цифры)
				(searchDigits && p.violator_driver_license_number?.includes(searchDigits)) ||
				// Поиск по старому полю ВУ (полный текст)
				p.violator_driver_license?.toLowerCase().includes(searchLower)
			);
		});
	}

    // Отображение списка протоколов
    function renderProtocolsList(filteredList) {
		const container = document.getElementById('protocolList');
		if (!container) return;

		container.innerHTML = '';
		
		if (!filteredList.length) {
			container.innerHTML = '<div class="list-item" style="justify-content: center; color: #6b7f99;">Нет протоколов</div>';
			return;
		}

		filteredList.forEach(p => {
			const div = document.createElement('div');
			div.className = 'list-item';
			
			const canEdit = canEditProtocol(p);
			const canDelete = canDeleteProtocol();
			
			// Формируем ФИО нарушителя
			const violatorName = [p.violator_lastname, p.violator_firstname, p.violator_patronymic]
				.filter(Boolean)
				.join(' ');
			
			// Используем новый столбец с номером ВУ
			const driverLicenseDigits = p.violator_driver_license_number || '—';
			
			const statusClass = getStatusBadgeClass(p.status);
			const statusText = getStatusText(p.status);
			
			div.innerHTML = `
				<div style="flex:1;">
					<div class="item-title">
						Протокол №${escapeHtml(p.protocol_number || 'б/н')} 
						<span class="badge ${statusClass}">${statusText}</span>
					</div>
					<div class="item-meta">
						<strong>${escapeHtml(violatorName)}</strong> · 
						${escapeHtml(p.vehicle_make_model || '—')} (${escapeHtml(p.vehicle_license_plate || '—')})<br>
						<small>ВУ: ${escapeHtml(driverLicenseDigits)} · 
						Ст. ${escapeHtml(p.offense_article_number || '')} ч.${escapeHtml(p.offense_article_part || '')} · 
						${p.offense_datetime ? p.offense_datetime.replace('T', ' ').substring(0, 16) : ''}</small>
					</div>
				</div>
				<div class="flex-row" style="gap: 8px;">
					<button class="small" data-id="${p.id}" data-action="view">👁️ Просмотр</button>
					${canEdit ? `<button class="small" data-id="${p.id}" data-action="edit">✏️ Редактировать</button>` : ''}
					${canDelete ? `<button class="small secondary" data-id="${p.id}" data-action="delete">🗑️ Удалить</button>` : ''}
				</div>
			`;
			container.appendChild(div);
		});

		// Назначаем обработчики
		container.querySelectorAll('button[data-action="view"]').forEach(btn => {
			btn.onclick = () => openProtocolModal(btn.dataset.id, 'view');
		});
		
		container.querySelectorAll('button[data-action="edit"]').forEach(btn => {
			btn.onclick = () => openProtocolModal(btn.dataset.id, 'edit');
		});
		
		container.querySelectorAll('button[data-action="delete"]').forEach(btn => {
			btn.onclick = () => deleteProtocol(btn.dataset.id);
		});
	}

    // Фильтрация и отображение списка
    function filterAndRenderProtocols() {
        const search = document.getElementById('protocolSearch')?.value.toLowerCase() || '';
        const status = document.getElementById('protocolFilterStatus')?.value || '';
        const filtered = filterProtocolsList(search, status);
        renderProtocolsList(filtered);
    }

    // Инициализация списка протоколов
    async function initProtocolsList() {
        try {
            Auth.ping();
            
            const clone = UI.loadTemplate('protocolList');
            if (!clone) {
                console.error('Protocol template not found');
                UI.showNotification('Ошибка загрузки шаблона', 'error');
                return;
            }
            
            UI.clearMain();
            document.getElementById('mainApp').appendChild(clone);
            
            // Устанавливаем активную вкладку
            const elements = UI.getElements();
            if (elements.navProtocols) {
                UI.setActiveTab(elements.navProtocols);
            }

            // Загружаем данные
            await loadProtocolsList();
            filterAndRenderProtocols();

            // Назначаем обработчики событий
            const searchInput = document.getElementById('protocolSearch');
            const filterSelect = document.getElementById('protocolFilterStatus');
            const createBtn = document.getElementById('protocolCreateOpen');

            if (searchInput) {
                searchInput.addEventListener('input', filterAndRenderProtocols);
            }
            
            if (filterSelect) {
                filterSelect.addEventListener('change', filterAndRenderProtocols);
            }
            
            if (createBtn) {
                createBtn.onclick = () => openProtocolModal(null, 'create');
            }

        } catch (error) {
            console.error('Error in initProtocolsList:', error);
            UI.showNotification('Ошибка при загрузке раздела протоколов', 'error');
        }
    }

    // Открыть модальное окно протокола
    // Открыть модальное окно протокола
async function openProtocolModal(id = null, mode = 'create') {
    Auth.ping();
    
    const user = Auth.getCurrentUser();
    let protocol = null;
    let employees = [];
    
    // Загружаем протокол, если передан ID
    if (id) {
        protocol = protocolsCache.find(p => p.id == id);
        if (!protocol) {
            UI.showNotification('Протокол не найден', 'error');
            return;
        }
        
        if (mode === 'edit' && !canEditProtocol(protocol)) {
            UI.showNotification('У вас нет прав на редактирование этого протокола', 'error');
            return;
        }
    }
    
    // Загружаем список сотрудников для выбора
    const { data: empData } = await supabaseClient
        .from('employees')
        .select('id, auth_user_id, nickname, rank')
        .order('nickname');
    employees = empData || [];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'protocolModal';
    
    const title = mode === 'create' ? 'Новый протокол об АП' : 
                 (mode === 'edit' ? `Редактирование протокола №${protocol.protocol_number}` : 
                  `Просмотр протокола №${protocol.protocol_number}`);
    
    const isReadOnly = mode === 'view';
    const protocolNumber = protocol ? protocol.protocol_number : await generateProtocolNumber();
    
    // Флаг для отслеживания изменений в форме
    let formChanged = false;
    
    // Функция для проверки, были ли изменения в форме
    function checkFormChanges() {
        if (mode === 'create' || mode === 'edit') {
            formChanged = true;
        }
    }
    
    // Функция для безопасного закрытия с подтверждением
    function safeClose() {
        if ((mode === 'create' || mode === 'edit') && formChanged) {
            // Показываем диалог подтверждения
            const confirmCloseModal = document.createElement('div');
            confirmCloseModal.className = 'modal-overlay';
            confirmCloseModal.innerHTML = `
                <div class="modal-container" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>Подтверждение закрытия</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-content">
                        <p>У вас есть несохранённые изменения. Вы действительно хотите закрыть окно?</p>
                        <div class="flex-row" style="justify-content: flex-end; margin-top: 20px;">
                            <button id="cancelCloseBtn" class="secondary">Остаться</button>
                            <button id="confirmCloseBtn" style="background: #dc3545;">Закрыть без сохранения</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(confirmCloseModal);
            
            // Обработчики закрытия
            confirmCloseModal.querySelector('.modal-close').onclick = () => confirmCloseModal.remove();
            confirmCloseModal.onclick = (e) => {
                if (e.target === confirmCloseModal) confirmCloseModal.remove();
            };
            
            document.getElementById('cancelCloseBtn').onclick = () => confirmCloseModal.remove();
            document.getElementById('confirmCloseBtn').onclick = () => {
                confirmCloseModal.remove();
                modal.remove();
            };
        } else {
            modal.remove();
        }
    }
    
    // Для режимов создания и редактирования показываем форму
    if (mode === 'create' || mode === 'edit') {
        modal.innerHTML = `
        <div class="modal-container modal-large" style="max-width: 900px; width: 95%;">
            <div class="modal-header">
                <h3>${escapeHtml(title)}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-content" style="max-height: 80vh; overflow-y: auto;">
                <form id="protocolForm">
                    <!-- Скрытое поле для номера протокола -->
                    <input type="hidden" id="protocol_number" value="${escapeHtml(protocolNumber)}">
                    
                    <!-- Вкладки мастера создания -->
                    <div class="protocol-wizard">
                        <div class="wizard-steps" style="display: flex; justify-content: space-between; margin-bottom: 20px; padding: 0 10px;">
                            <div class="step" style="text-align: center; flex: 1; cursor: pointer;" data-tab="main">
                                <div class="step-indicator" style="width: 30px; height: 30px; border-radius: 50%; background: #1e3a5f; color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 5px;">1</div>
                                <div class="step-label" style="font-size: 0.9rem;">Основное</div>
                            </div>
                            <div class="step" style="text-align: center; flex: 1; cursor: pointer;" data-tab="violator">
                                <div class="step-indicator" style="width: 30px; height: 30px; border-radius: 50%; background: #eef3fa; color: #6b7f99; display: flex; align-items: center; justify-content: center; margin: 0 auto 5px;">2</div>
                                <div class="step-label" style="font-size: 0.9rem;">Нарушитель</div>
                            </div>
                            <div class="step" style="text-align: center; flex: 1; cursor: pointer;" data-tab="vehicle">
                                <div class="step-indicator" style="width: 30px; height: 30px; border-radius: 50%; background: #eef3fa; color: #6b7f99; display: flex; align-items: center; justify-content: center; margin: 0 auto 5px;">3</div>
                                <div class="step-label" style="font-size: 0.9rem;">Транспорт</div>
                            </div>
                            <div class="step" style="text-align: center; flex: 1; cursor: pointer;" data-tab="offense">
                                <div class="step-indicator" style="width: 30px; height: 30px; border-radius: 50%; background: #eef3fa; color: #6b7f99; display: flex; align-items: center; justify-content: center; margin: 0 auto 5px;">4</div>
                                <div class="step-label" style="font-size: 0.9rem;">Правонарушение</div>
                            </div>
                            <div class="step" style="text-align: center; flex: 1; cursor: pointer;" data-tab="additional">
                                <div class="step-indicator" style="width: 30px; height: 30px; border-radius: 50%; background: #eef3fa; color: #6b7f99; display: flex; align-items: center; justify-content: center; margin: 0 auto 5px;">5</div>
                                <div class="step-label" style="font-size: 0.9rem;">Дополнительно</div>
                            </div>
                        </div>
                        
                        <!-- Вкладка 1: Основное -->
                        <div class="tab-content" data-tab="main">
                            <h4>Основная информация</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                <div class="form-group">
                                    <label>Дата составления <span class="required">*</span></label>
                                    <input type="date" id="protocol_date" required value="${protocol ? (protocol.protocol_date ? protocol.protocol_date.slice(0,10) : '') : new Date().toISOString().slice(0,10)}">
                                </div>
                                <div class="form-group">
                                    <label>Время составления <span class="required">*</span></label>
                                    <input type="time" id="protocol_time" required value="${protocol ? (protocol.protocol_time ? protocol.protocol_time.slice(0,5) : '') : new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}">
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Место составления <span class="required">*</span></label>
                                    <input type="text" id="protocol_place" required value="${protocol ? escapeHtml(protocol.protocol_place || '') : ''}" placeholder="г. Мирный, ул. Ленина">
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Должностное лицо (должность, специальное звание, подразделение, фамилия, инициалы) <span class="required">*</span></label>
                                    <input type="text" id="official_name" required 
                                       value="${protocol ? escapeHtml(protocol.official_name || '') : ''}" 
                                       placeholder="Инспектор ДПС лейтенант полиции ОБ ДПС Иванов И.И.">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка 2: Нарушитель -->
                        <div class="tab-content hidden" data-tab="violator">
                            <h4>Данные нарушителя</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                <div class="form-group">
                                    <label>Фамилия <span class="required">*</span></label>
                                    <input type="text" id="violator_lastname" required value="${protocol ? escapeHtml(protocol.violator_lastname || '') : ''}">
                                </div>
                                <div class="form-group">
                                    <label>Имя <span class="required">*</span></label>
                                    <input type="text" id="violator_firstname" required value="${protocol ? escapeHtml(protocol.violator_firstname || '') : ''}">
                                </div>
                                <div class="form-group">
                                    <label>Отчество</label>
                                    <input type="text" id="violator_patronymic" value="${protocol ? escapeHtml(protocol.violator_patronymic || '') : ''}">
                                </div>
                                <div class="form-group">
                                    <label>Дата рождения</label>
                                    <input type="date" id="violator_birth_date" value="${protocol ? (protocol.violator_birth_date ? protocol.violator_birth_date.slice(0,10) : '') : ''}">
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Место рождения</label>
                                    <input type="text" id="violator_birth_place" value="${protocol ? escapeHtml(protocol.violator_birth_place || '') : ''}" placeholder="г. Мирный">
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Владение русским языком</label>
                                    <select id="violator_russian_language_skill">
                                        <option value="">Не указано</option>
                                        <option value="владеет" ${protocol?.violator_russian_language_skill === 'владеет' ? 'selected' : ''}>Владеет</option>
                                        <option value="не владеет" ${protocol?.violator_russian_language_skill === 'не владеет' ? 'selected' : ''}>Не владеет</option>
                                    </select>
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Водительское удостоверение (номер, кем выдано) <span class="required">*</span></label>
                                    <input type="text" id="violator_driver_license" required value="${protocol ? escapeHtml(protocol.violator_driver_license || '') : ''}" placeholder="№ 123456, выдано МРЭО УГИБДД УМВД по г.Мирный">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка 3: Транспорт -->
                        <div class="tab-content hidden" data-tab="vehicle">
                            <h4>Данные транспортного средства</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Марка и модель ТС <span class="required">*</span></label>
                                    <input type="text" id="vehicle_make_model" required value="${protocol ? escapeHtml(protocol.vehicle_make_model || '') : ''}" placeholder="Toyota Camry">
                                </div>
                                <div class="form-group">
                                    <label>Государственный номер <span class="required">*</span></label>
                                    <input type="text" id="vehicle_license_plate" required value="${protocol ? escapeHtml(protocol.vehicle_license_plate || '') : ''}" placeholder="А123ВС 77">
                                </div>
                                <div class="form-group">
                                    <label>Владелец ТС (ФИО, организация)</label>
                                    <input type="text" id="vehicle_owner" value="${protocol ? escapeHtml(protocol.vehicle_owner || '') : ''}" placeholder="Иванов И.И.">
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>ТС состоит на учете</label>
                                    <input type="text" id="vehicle_registered_info" value="${protocol ? escapeHtml(protocol.vehicle_registered_info || '') : ''}" placeholder="МРЭО УГИБДД УМВД по г.Мирный">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка 4: Правонарушение -->
                        <div class="tab-content hidden" data-tab="offense">
                            <h4>Данные о правонарушении</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Дата и время правонарушения <span class="required">*</span></label>
                                    <input type="datetime-local" id="offense_datetime" required value="${protocol ? (protocol.offense_datetime ? protocol.offense_datetime.slice(0,16) : '') : new Date().toISOString().slice(0,16)}">
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Место совершения</label>
                                    <input type="text" id="offense_place" value="${protocol ? escapeHtml(protocol.offense_place || '') : ''}" placeholder="г. Мирный, ул. Ленина">
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Пункт нормативного акта <span class="required">*</span></label>
                                    <input type="text" id="offense_violation_point" required value="${protocol ? escapeHtml(protocol.offense_violation_point || '') : ''}" placeholder="п. 6.1 ПДД РП">
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Описание правонарушения <span class="required">*</span></label>
                                    <textarea id="offense_description" rows="3" required placeholder="Проезд на запрещающий сигнал светофора" style="resize: vertical;">${protocol ? escapeHtml(protocol.offense_description || '') : ''}</textarea>
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Специальные технические средства (наименование, показания)</label>
                                    <input type="text" id="offense_special_equipment" value="${protocol ? escapeHtml(protocol.offense_special_equipment || '') : ''}" placeholder="Тоник, показания 23%">
                                </div>
                                <div class="form-group">
                                    <label>Статья КоАП <span class="required">*</span></label>
                                    <input type="text" id="offense_article_number" required value="${protocol ? escapeHtml(protocol.offense_article_number || '') : ''}" placeholder="6">
                                </div>
                                <div class="form-group">
                                    <label>Часть статьи <span class="required">*</span></label>
                                    <input type="text" id="offense_article_part" required value="${protocol ? escapeHtml(protocol.offense_article_part || '') : ''}" placeholder="1">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Вкладка 5: Дополнительно -->
                        <div class="tab-content hidden" data-tab="additional">
                            <h4>Дополнительная информация и подпись</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Объяснения и замечания по содержанию протокола</label>
                                    <textarea id="explanatory_note" rows="3" placeholder="Объяснения нарушителя, замечания по содержанию протокола" style="resize: vertical;">${protocol ? escapeHtml(protocol.explanatory_note || '') : ''}</textarea>
                                </div>
                                
                                <!-- Блок для подписи сотрудника -->
                                <div class="form-group signature-section" style="grid-column: span 2; margin-top: 10px; border-top: 1px solid #d8e2ed; padding-top: 20px;">
                                    <h4 style="margin-bottom: 15px;">Подпись должностного лица, составившего протокол</h4>
                                    
                                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px; align-items: start;">
                                        <!-- Область для рисования подписи -->
                                        <div>
                                            <label>Нарисуйте подпись:</label>
                                            <div style="border: 2px dashed #1e3a5f; border-radius: 8px; padding: 5px; background: #fff; margin-top: 5px;">
                                                <canvas id="signatureCanvas" width="250" height="120" style="width: 100%; height: auto; background: white; border: 1px solid #d8e2ed; border-radius: 4px; cursor: crosshair;"></canvas>
                                            </div>
                                            
                                            <!-- Кнопки управления подписью -->
                                            <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
                                                <button type="button" id="clearSignatureBtn" class="small secondary">🧹 Очистить</button>
                                            </div>
                                        </div>
                                        
                                        <!-- Предпросмотр подписи и информация -->
                                        <div>
                                            <label>Предпросмотр подписи:</label>
                                            <div style="border: 1px solid #d8e2ed; border-radius: 8px; padding: 15px; background: #f8fafd; margin-top: 5px; min-height: 120px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                                                <canvas id="signaturePreviewCanvas" width="200" height="80" style="width: 100%; height: auto; background: white; border: 1px solid #d8e2ed; border-radius: 4px; display: none;"></canvas>
                                                <div id="noSignatureMessage" style="color: #6b7f99; text-align: center;">
                                                    ⚠️ Подпись не добавлена
                                                </div>
                                                <img id="signaturePreviewImg" style="max-width: 100%; max-height: 100px; display: none;">
                                            </div>
                                            
                                            <!-- Поле для хранения данных подписи (base64) -->
                                            <input type="hidden" id="signature_data" value="${protocol ? escapeHtml(protocol.signature_data || '') : ''}">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-group" style="grid-column: span 2; margin-top: 10px;">
                                    <label>Статус протокола</label>
                                    <select id="status">
                                        <option value="active" ${protocol?.status === 'active' ? 'selected' : ''}>Действующий</option>
                                        <option value="archived" ${protocol?.status === 'archived' ? 'selected' : ''}>Архивный</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Кнопки управления: Отмена слева, Назад/Далее/Создать/Сохранить справа -->
                        <div class="flex-row" style="justify-content: space-between; align-items: center; margin-top: 20px;">
                            <button type="button" id="cancelProtocolBtn" class="secondary">Отмена</button>
                            <div class="flex-row" style="gap: 8px;">
                                <button type="button" id="prevTabBtn" class="secondary" style="display: none;">← Назад</button>
                                <button type="button" id="nextTabBtn" class="secondary">Далее →</button>
                                <button type="submit" id="saveProtocolBtn" class="primary">
                                    ${mode === 'create' ? '➕ Создать' : '💾 Сохранить'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
        `;

        document.body.appendChild(modal);

        // Отслеживаем изменения в форме
        const form = document.getElementById('protocolForm');
        const inputs = form.querySelectorAll('input:not([type="hidden"]), select, textarea');
        inputs.forEach(input => {
            input.addEventListener('input', checkFormChanges);
            input.addEventListener('change', checkFormChanges);
        });

        // Обработчики закрытия
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.onclick = (e) => {
            e.preventDefault();
            safeClose();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                e.preventDefault();
                safeClose();
            }
        };
        
        const cancelBtn = document.getElementById('cancelProtocolBtn');
        if (cancelBtn) {
            cancelBtn.onclick = (e) => {
                e.preventDefault();
                safeClose();
            };
        }
        
        // Инициализация подписи
        function initSignatureCanvas() {
            const canvas = document.getElementById('signatureCanvas');
            const previewCanvas = document.getElementById('signaturePreviewCanvas');
            const previewImg = document.getElementById('signaturePreviewImg');
            const noSignatureMessage = document.getElementById('noSignatureMessage');
            const signatureDataInput = document.getElementById('signature_data');
            
            if (!canvas) return;
            
            let isDrawing = false;
            let lastX = 0;
            let lastY = 0;
            let mode = 'draw';
            
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = '#002b59';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Очистка canvas
            function clearCanvas() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                updatePreview();
                checkFormChanges(); // Отмечаем изменение
            }
            
            // Обновление предпросмотра
            function updatePreview() {
                const signatureData = canvas.toDataURL('image/png');
                signatureDataInput.value = signatureData;
                
                // Показываем предпросмотр
                if (previewCanvas) {
                    previewCanvas.width = 200;
                    previewCanvas.height = 80;
                    const previewCtx = previewCanvas.getContext('2d');
                    previewCtx.clearRect(0, 0, 200, 80);
                    previewCtx.drawImage(canvas, 0, 0, 200, 80);
                    
                    previewCanvas.style.display = 'block';
                    if (noSignatureMessage) noSignatureMessage.style.display = 'none';
                }
                
                // Также сохраняем как base64
                signatureDataInput.value = canvas.toDataURL('image/png');
            }
            
            // Рисование
            function draw(e) {
                if (!isDrawing) return;
                
                e.preventDefault();
                
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                
                if (mode === 'draw') {
                    ctx.beginPath();
                    ctx.moveTo(lastX, lastY);
                    ctx.lineTo(x, y);
                    ctx.strokeStyle = '#002b59';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                } else if (mode === 'erase') {
                    ctx.clearRect(x - 5, y - 5, 10, 10);
                }
                
                lastX = x;
                lastY = y;
            }
            
            // Обработчики событий мыши
            canvas.addEventListener('mousedown', (e) => {
                isDrawing = true;
                const rect = canvas.getBoundingClientRect();
                lastX = (e.clientX - rect.left) * (canvas.width / rect.width);
                lastY = (e.clientY - rect.top) * (canvas.height / rect.height);
            });
            
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', () => {
                isDrawing = false;
                updatePreview();
                checkFormChanges(); // Отмечаем изменение
            });
            canvas.addEventListener('mouseleave', () => {
                isDrawing = false;
            });
            
            // Кнопка очистки
            const clearBtn = document.getElementById('clearSignatureBtn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    clearCanvas();
                });
            }
        }

        // Вызываем инициализацию подписи
        initSignatureCanvas();

        // Настройка навигации по вкладкам
        const tabs = ['main', 'violator', 'vehicle', 'offense', 'additional'];
        let currentTabIndex = 0;
        const tabContents = modal.querySelectorAll('.tab-content');
        const stepIndicators = modal.querySelectorAll('.step-indicator');
        const stepLabels = modal.querySelectorAll('.step-label');
        const stepElements = modal.querySelectorAll('.step');
        const prevBtn = document.getElementById('prevTabBtn');
        const nextBtn = document.getElementById('nextTabBtn');
        const saveBtn = document.getElementById('saveProtocolBtn');

        function updateTabDisplay() {
            tabContents.forEach(content => content.classList.add('hidden'));
            tabContents[currentTabIndex].classList.remove('hidden');
            
            stepIndicators.forEach((indicator, index) => {
                if (index < currentTabIndex) {
                    indicator.style.background = '#1e3a5f';
                    indicator.style.color = 'white';
                    indicator.style.borderColor = '#1e3a5f';
                    indicator.innerHTML = '✓';
                } else if (index === currentTabIndex) {
                    indicator.style.background = '#1e3a5f';
                    indicator.style.color = 'white';
                    indicator.style.borderColor = '#1e3a5f';
                    indicator.innerHTML = index + 1;
                } else {
                    indicator.style.background = '#eef3fa';
                    indicator.style.color = '#6b7f99';
                    indicator.style.borderColor = '#d8e2ed';
                    indicator.innerHTML = index + 1;
                }
            });
            
            stepLabels.forEach((label, index) => {
                if (index <= currentTabIndex) {
                    label.style.color = '#1e3a5f';
                    label.style.fontWeight = '600';
                } else {
                    label.style.color = '#6b7f99';
                    label.style.fontWeight = '400';
                }
            });
            
            // Показываем/скрываем кнопки навигации
            if (prevBtn) {
                prevBtn.style.display = currentTabIndex === 0 ? 'none' : 'inline-flex';
            }
            
            if (nextBtn) {
                // В режиме создания показываем "Далее" до последней вкладки, 
                // на последней вкладке показываем "Создать"
                if (mode === 'create') {
                    if (currentTabIndex === tabContents.length - 1) {
                        nextBtn.style.display = 'none';
                        // Кнопка сохранения уже видна с текстом "Создать"
                    } else {
                        nextBtn.style.display = 'inline-flex';
                    }
                } 
                // В режиме редактирования показываем "Далее" всегда, если не последняя вкладка
                else if (mode === 'edit') {
                    nextBtn.style.display = currentTabIndex === tabContents.length - 1 ? 'none' : 'inline-flex';
                }
            }
            
            // Кнопка сохранения теперь видна на всех вкладках в режиме редактирования,
            // а в режиме создания - только на последней вкладке
            if (saveBtn) {
                if (mode === 'create') {
                    // В режиме создания показываем кнопку только на последней вкладке
                    saveBtn.style.display = currentTabIndex === tabContents.length - 1 ? 'inline-flex' : 'none';
                    saveBtn.textContent = '➕ Создать';
                } else {
                    // В режиме редактирования показываем на всех вкладках
                    saveBtn.style.display = 'inline-flex';
                    saveBtn.textContent = '💾 Сохранить';
                }
            }
        }
        
        function switchToTab(tabName) {
            const index = tabs.indexOf(tabName);
            if (index !== -1 && index !== currentTabIndex) {
                currentTabIndex = index;
                updateTabDisplay();
            }
        }
        
        stepElements.forEach(step => {
            const tabName = step.dataset.tab;
            step.addEventListener('click', () => switchToTab(tabName));
        });
        
        function validateCurrentTab(index) {
            const tabName = tabs[index];
            let isValid = true;
            let errorMessage = '';
            
            switch(tabName) {
                case 'main':
                    if (!document.getElementById('protocol_date')?.value) {
                        errorMessage = 'Заполните дату составления';
                        isValid = false;
                    } else if (!document.getElementById('protocol_time')?.value) {
                        errorMessage = 'Заполните время составления';
                        isValid = false;
                    } else if (!document.getElementById('protocol_place')?.value?.trim()) {
                        errorMessage = 'Заполните место составления';
                        isValid = false;
                    } else if (!document.getElementById('official_name')?.value?.trim()) {
                        errorMessage = 'Заполните данные должностного лица';
                        isValid = false;
                    }
                    break;
                    
                case 'violator':
                    if (!document.getElementById('violator_lastname')?.value?.trim()) {
                        errorMessage = 'Заполните фамилию нарушителя';
                        isValid = false;
                    } else if (!document.getElementById('violator_firstname')?.value?.trim()) {
                        errorMessage = 'Заполните имя нарушителя';
                        isValid = false;
                    } else if (!document.getElementById('violator_driver_license')?.value?.trim()) {
                        errorMessage = 'Заполните водительское удостоверение';
                        isValid = false;
                    }
                    break;
                    
                case 'vehicle':
                    if (!document.getElementById('vehicle_make_model')?.value?.trim()) {
                        errorMessage = 'Заполните марку и модель ТС';
                        isValid = false;
                    } else if (!document.getElementById('vehicle_license_plate')?.value?.trim()) {
                        errorMessage = 'Заполните государственный номер';
                        isValid = false;
                    }
                    break;
                    
                case 'offense':
                    if (!document.getElementById('offense_datetime')?.value) {
                        errorMessage = 'Заполните дату и время правонарушения';
                        isValid = false;
                    } else if (!document.getElementById('offense_description')?.value?.trim()) {
                        errorMessage = 'Заполните описание правонарушения';
                        isValid = false;
                    } else if (!document.getElementById('offense_article_number')?.value?.trim()) {
                        errorMessage = 'Заполните статью КоАП';
                        isValid = false;
                    } else if (!document.getElementById('offense_article_part')?.value?.trim()) {
                        errorMessage = 'Заполните часть статьи';
                        isValid = false;
                    } else if (!document.getElementById('offense_violation_point')?.value?.trim()) {
                        errorMessage = 'Заполните пункт нормативного акта';
                        isValid = false;
                    }
                    break;
                    
                case 'additional':
                    // Статус протокола всегда имеет значение по умолчанию, поэтому проверка не требуется
                    break;
            }
            
            if (!isValid) {
                UI.showNotification(errorMessage, 'warning');
            }
            
            return isValid;
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (validateCurrentTab(currentTabIndex)) {
                    if (currentTabIndex < tabContents.length - 1) {
                        currentTabIndex++;
                        updateTabDisplay();
                    }
                }
            });
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentTabIndex > 0) {
                    currentTabIndex--;
                    updateTabDisplay();
                }
            });
        }
        
        updateTabDisplay();
        
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                
                if (!validateCurrentTab(currentTabIndex)) {
                    return;
                }
                
                let success = false;
                if (mode === 'create') {
                    success = await createProtocol();
                } else {
                    success = await updateProtocol(id);
                }
                
                if (success) {
                    modal.remove();
                }
            };
        }
    } else if (mode === 'view') {
        // Для режима просмотра (без изменений)
        modal.innerHTML = `
        <div class="modal-container protocol-document-modal" style="max-width: 800px; width: 90%;">
            <div class="modal-header">
                <h3>${escapeHtml(title)}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-content protocol-document-content">
                <!-- Документ протокола по шаблону -->
                <div class="protocol-document">
                    <!-- Заголовок -->
                    <div class="center title">
                        <div>ПРОТОКОЛ</div>
                        <div>об административном правонарушении</div>
                        <div class="title-line handwritten" style="font-size: 24px !important;">№ ${escapeHtml(protocol?.protocol_number || '_______________')}</div>
                        <div class="note note-center">(регистрационный номер)</div>
                    </div>
                    
                    <!-- Дата / Время / Место -->
                    <div class="date-container">
                        <div class="date-item date-left">
                            <div class="date-field">
                                <div class="date-row">
                                    <span>"</span>
                                    <div class="line handwritten" style="width: 26px; text-align:left;">${protocol?.protocol_date ? new Date(protocol.protocol_date).getDate().toString().padStart(2,'0') : ''}</div>
                                    <span>"</span>
                                    <div class="line handwritten" style="width: 81px; text-align:left;">
                                      ${protocol?.protocol_date 
                                        ? (() => {
                                            const date = new Date(protocol.protocol_date);
                                            const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                                                            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
                                            return months[date.getMonth()];
                                          })()
                                        : ''}
                                    </div>
                                    <span>20</span>
                                    <div class="line handwritten" style="width: 26px; text-align:left;">${protocol?.protocol_date ? new Date(protocol.protocol_date).getFullYear().toString().slice(-2) : ''}</div>
                                    <span>г.</span>
                                </div>
                                <div class="note">(дата составления)</div>
                            </div>
                        </div>
                        
                        <div class="date-item date-center">
                            <div class="date-field">
                                <div class="date-row">
                                    <div class="line handwritten" style="width: 26px; text-align:left;">${protocol?.protocol_time ? protocol.protocol_time.split(':')[0] : ''}</div>
                                    <span>час. </span>
                                    <div class="line handwritten" style="width: 26px; text-align:left;">${protocol?.protocol_time ? protocol.protocol_time.split(':')[1] : ''}</div>
                                    <span>мин.</span>
                                </div>
                                <div class="note">(время составления)</div>
                            </div>
                        </div>
                        
                        <div class="date-item date-right" style="display: flex; justify-content: flex-end; width: 100%;">
                            <div class="date-field" style="width: 100%;">
                                <div class="date-row" style="display: flex; justify-content: flex-end; width: 100%;">
                                    <div class="line handwritten" style="width: 100%; text-align: right;">${escapeHtml(protocol?.protocol_place || '')}</div>
                                </div>
                                <div class="note" style="text-align: right;">(место составления)</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Я, ... -->
                    <div class="block block-narrow">
                        <div class="line-row">
                            <span>Я,</span>
                            <span class="line handwritten">${escapeHtml(protocol?.official_name || '')}</span>
                        </div>
                        <div class="note note-center">
                            (должность, специальное звание, подразделение, фамилия, инициалы<br>
                            должностного лица, составившего протокол)
                        </div>
                    </div>
                    
                    <div class="block">
                        в соответствии со статьей 58 Административный регламент ГИБДД составил настоящий протокол о том, что гражданин(ка)
                    </div>
                    
                    <!-- Клетки для ФИО -->
                    ${(() => {
                        const violatorName = [protocol?.violator_lastname || '', protocol?.violator_firstname || '', protocol?.violator_patronymic || ''].join(' ');
                        const truncatedName = violatorName.length > 35 ? violatorName.substring(0, 35) : violatorName;
                        const nameChars = truncatedName.split('');
                        const cells = [];
                        for (let i = 0; i < 35; i++) {
                            cells.push(nameChars[i] || '');
                        }
                        return `
                        <div class="grid">
                            <table>
                                <tr>
                                    ${cells.map(char => `<td class="handwritten">${escapeHtml(char)}</td>`).join('')}
                                </tr>
                            </table>
                            <div class="note note-center">фамилия имя отчество</div>
                        </div>
                        `;
                    })()}
                    
                    <!-- Дата и место рождения / владение русским языком -->
                    <div class="block">
                        <div class="flex-row" style="flex-wrap: wrap; gap: 5px;">
                            <div class="line handwritten" style="flex: 2;">
                                ${protocol.violator_birth_date ? new Date(protocol.violator_birth_date).toLocaleDateString('ru-RU') + ', ' : ''}${escapeHtml(protocol.violator_birth_place || '')}
                            </div>
                            <div class="nowrap">, русским языком</div>
                            <div class="line handwritten" style="flex: 1;">${protocol.violator_russian_language_skill || ''}</div>
                        </div>
                        <div class="note flex-space-between">
                            <span>(дата и место рождения)</span>
                            <span>(владеет/не владеет)</span>
                        </div>
                    </div>
                    
                    <!-- Водительское удостоверение и транспорт -->
                    ${(() => {
                        const licenseText = protocol?.violator_driver_license || '';
                        const licenseMaxLength = 19;
                        
                        // Разбиваем текст водительского удостоверения
                        let licenseFirstLine = licenseText;
                        let licenseSecondLine = '';
                        
                        if (licenseText.length > licenseMaxLength) {
                            let cutIndex = licenseText.lastIndexOf(' ', licenseMaxLength);
                            if (cutIndex === -1) cutIndex = licenseMaxLength;
                            
                            licenseFirstLine = licenseText.substring(0, cutIndex);
                            licenseSecondLine = licenseText.substring(cutIndex).trim();
                        }
                        
                        // Разбиваем текст для поля "принадлежащим"
                        const ownerText = protocol?.vehicle_owner || '';
                        const ownerMaxLength1 = 68; // длина первой строки
                        const ownerMaxLength2 = 83; // длина второй строки
                        
                        let ownerFirstLine = ownerText;
                        let ownerSecondLine = '';
                        let ownerThirdLine = ''; // на случай если текст очень длинный
                        
                        if (ownerText.length > ownerMaxLength1) {
                            let cutIndex1 = ownerText.lastIndexOf(' ', ownerMaxLength1);
                            if (cutIndex1 === -1) cutIndex1 = ownerMaxLength1;
                            
                            ownerFirstLine = ownerText.substring(0, cutIndex1);
                            
                            const remainingText = ownerText.substring(cutIndex1).trim();
                            
                            if (remainingText.length > ownerMaxLength2) {
                                let cutIndex2 = remainingText.lastIndexOf(' ', ownerMaxLength2);
                                if (cutIndex2 === -1) cutIndex2 = ownerMaxLength2;
                                
                                ownerSecondLine = remainingText.substring(0, cutIndex2);
                                ownerThirdLine = remainingText.substring(cutIndex2).trim();
                            } else {
                                ownerSecondLine = remainingText;
                            }
                        }
                        
                        return `
                            <div class="block">
                                <!-- Водительское удостоверение -->
                                <div class="flex-row">
                                    <div class="nowrap">водительское удостоверение (документ, удостоверяющий личность)</div>
                                    <div class="line handwritten" style="flex: 3;">${escapeHtml(licenseFirstLine)}</div>
                                </div>
                                
                                ${licenseSecondLine ? `
                                <!-- Вторая строка с правильным отступом как в поле "совершил(а) нарушение" -->
                                <div class="line-row" style="margin-top: 5px;">
                                    <div class="line handwritten" style="flex: 1;">${escapeHtml(licenseSecondLine)}</div>
                                </div>
                                ` : `
                                <!-- Пустая строка для сохранения отступа, если нет текста (как в идеальной реализации) -->
                                <div class="line-row" style="margin-top: 5px;">
                                    <div class="line handwritten" style="flex: 1;">&nbsp;</div>
                                </div>
                                `}
                                <div class="note note-center">(серия, номер, когда и кем выдан)</div>
                                
                                <!-- Управляя транспортным средством -->
                                <div style="margin-top:15px;">
                                    <div class="flex-row">
                                        <div class="nowrap">управляя транспортным средством</div>
                                        <div class="line handwritten" style="flex: 2;">
                                            ${escapeHtml(protocol?.vehicle_make_model || '')} 
                                            ${protocol?.vehicle_license_plate ? '(' + escapeHtml(protocol.vehicle_license_plate) + ')' : ''}
                                        </div>
                                    </div>
                                    <div class="note note-center">(марка, гос. регистрационный знак)</div>
                                </div>
                                
                                <!-- Принадлежащим - всегда показываем две строки как в идеальной реализации -->
                                <div style="margin-top:15px;">
                                    <!-- Первая строка -->
                                    <div class="flex-row">
                                        <div class="nowrap">принадлежащим</div>
                                        <div class="line handwritten" style="flex: 2; white-space: nowrap; overflow: hidden;">
                                            ${escapeHtml(ownerFirstLine)}
                                        </div>
                                    </div>
                                    
                                    <div class="note note-center" style="margin-top: 2px;">(фамилия, имя, отчество, организация)</div>
                                    
                                    <!-- Вторая строка (всегда показываем, даже если пустая) -->
                                    <div class="line-row" style="margin-top: 8px;">
                                        <div class="line handwritten" style="flex: 1; white-space: nowrap; overflow: hidden;">
                                            ${ownerSecondLine ? escapeHtml(ownerSecondLine) : '&nbsp;'}
                                        </div>
                                    </div>
                                    
                                    <!-- Третья строка (если есть) -->
                                    ${ownerThirdLine ? `
                                    <div class="line-row" style="margin-top: 5px;">
                                        <div class="line handwritten" style="flex: 1; white-space: nowrap; overflow: hidden;">
                                            ${escapeHtml(ownerThirdLine)}
                                        </div>
                                    </div>
                                    ` : ''}
                                </div>
                                
                                <!-- Отступ перед "состоящим на учете" -->
                                <div style="margin-top: 15px;"></div>
                                
                                <!-- Состоящим на учете -->
                                <div class="flex-row" style="margin-top:5px;">
                                    <div class="nowrap">состоящим на учете</div>
                                    <div class="line handwritten" style="flex: 2;">${escapeHtml(protocol?.vehicle_registered_info || '')}</div>
                                </div>
                            </div>
                        `;
                    })()}
                    
                    <!-- Дата, время и место правонарушения -->
                    ${(() => {
                       const offenseDateTime = protocol?.offense_datetime || '';
                        let offenseDay = '', offenseMonth = '', offenseYear = '', offenseHour = '', offenseMinute = '';

                        if (offenseDateTime) {
                            const [datePart, timePart] = offenseDateTime.split('T');
                            if (datePart) {
                                const [year, month, day] = datePart.split('-');
                                offenseDay = day || '';
                                offenseMonth = month ? getMonthGenitive(parseInt(month) - 1) : '';
                                offenseYear = year ? year.slice(-2) : '';
                            }
                            if (timePart) {
                                const [hour, minute] = timePart.split(':');
                                offenseHour = hour || '';
                                offenseMinute = minute || '';
                            }
                        }
                        
                        return `
                        <div class="block" style="width: 100%; margin: 10px 0;">
                            <div class="flex-row" style="gap: 10px;">
                                <div class="flex-row" style="flex: 1.7; flex-wrap: wrap;">
                                    <span>"</span>
                                    <div class="line handwritten" style="width: 26px; text-align:left;">${offenseDay}</div>
                                    <span>"</span>
                                    <div class="line handwritten" style="width: 81px; text-align:left;">${offenseMonth}</div>
                                    <span>20</span>
                                    <div class="line handwritten" style="width: 26px; text-align:left;">${offenseYear}</div>
                                    <span> г. в "</span>
                                    <div class="line handwritten" style="width: 26px; text-align:left;">${offenseHour}</div>
                                    <span>" час. "</span>
                                    <div class="line handwritten" style="width: 26px; text-align:left;">${offenseMinute}</div>
                                    <span>" мин.</span>
                                </div>
                                
                                <div class="flex-row" style="flex: 1;">
                                    <span>на</span>
                                    <div class="line handwritten" style="flex: 1;">${escapeHtml(protocol?.offense_place || '')}</div>
                                </div>
                            </div>
                            
                            <div class="offense-note-row">
                                <div class="offense-note-left">
                                    (дата, время совершения административного правонарушения)
                                </div>
                                <div class="offense-note-right">
                                    (место совершения административного правонарушения)
                                </div>
                            </div>
                        </div>
                        `;
                    })()}
                    
                    <!-- Существо нарушения -->
                    ${(() => {
                        const combinedText = [
                            protocol?.offense_violation_point,
                            protocol?.offense_description,
                            protocol?.offense_special_equipment
                        ]
                        .filter(Boolean)
                        .join(', ');

                        const maxLength = 60;

                        const part1 = combinedText.substring(0, maxLength);
                        const part2 = combinedText.length > maxLength
                            ? combinedText.substring(maxLength)
                            : '';

                        return `
                            <!-- 1 строка -->
                            <div class="flex-row">
                                <div class="nowrap">совершил(а) нарушение</div>
                                <div class="line handwritten" style="flex: 3; white-space: nowrap; overflow: hidden;">
                                    ${escapeHtml(part1)}
                                </div>
                            </div>

                            <div class="note note-center">
                                (пункт нормативного правового акта, существо нарушения,
                            </div>

                            <!-- 2 строка -->
                            <div class="line-row" style="height: 1.35em; margin: 5px 0;">
                                <div class="line handwritten" style="flex: 1; white-space: nowrap; overflow: hidden;">
                                    ${escapeHtml(part2)}
                                </div>
                            </div>

                            <div class="note note-center">
                                при применении спец. тех. средств указываются их показания, наименование, номер)
                            </div>
                        `;
                    })()}
                    
                    <div class="flex-row" style="gap: 5px; flex-wrap: wrap; width: 100%; margin-top: 10px;">
                        <span>ответственность за которое предусмотрена частью</span>
                        <div class="line handwritten" style="width: 50px; text-align:center;">${escapeHtml(protocol?.offense_article_part || '')}</div>
                        <span>статьи</span>
                        <div class="line handwritten" style="width: 50px; text-align:center;">${escapeHtml(protocol?.offense_article_number || '')}</div>
                        <span>Кодекса Республики Провинция об административных правонарушениях.</span>
                    </div>
                    
                    <div class="block">
                        Лицу, в отношении которого возбуждено дело об административном
                        правонарушении, разъяснены права, предусмотренные статьей 30 Конституции Республики Провинция.
                    </div>
                    
                    <div class="block">
                        Лицо, в отношении которого возбуждено дело об административном
                        правонарушении, ознакомлено с протоколом.
                    </div>
                    
                    ${(() => {
                        const fullText = protocol?.explanatory_note || '';

                        // разные лимиты для каждой линии
                        const maxLength1 = 35;
                        const maxLength2 = 83; 
                        const maxLength3 = 83; 

                        // первая линия
                        const line1 = fullText.substring(0, maxLength1);

                        // вторая линия — начинается после первой
                        const line2 = fullText.length > maxLength1
                            ? fullText.substring(maxLength1, maxLength1 + maxLength2)
                            : '';

                        // третья линия — начинается после первой+второй
                        const line3 = fullText.length > (maxLength1 + maxLength2)
                            ? fullText.substring(maxLength1 + maxLength2, maxLength1 + maxLength2 + maxLength3)
                            : '';

                        return `
                            <!-- 1 строка -->
                            <div class="flex-row">
                                <div class="nowrap">Объяснения и замечания по содержанию протокола:</div>
                                <div class="line handwritten" style="flex: 2; white-space: nowrap; overflow: hidden;">
                                    ${escapeHtml(line1)}
                                </div>
                            </div>

                            <!-- 2 строка -->
                            <div class="line-row" style="height: 1.35em; margin-top:5px;">
                                <div class="line handwritten" style="flex: 1; white-space: nowrap; overflow: hidden;">
                                    ${escapeHtml(line2)}
                                </div>
                            </div>

                            <!-- 3 строка -->
                            <div class="line-row" style="height: 1.35em; margin-top:5px;">
                                <div class="line handwritten" style="flex: 1; white-space: nowrap; overflow: hidden;">
                                    ${escapeHtml(line3)}
                                </div>
                            </div>
                        `;
                    })()}
                    
                    <div class="block" style="margin: 15px 0; text-align: center;">
                        Подпись лица, в отношении которого возбуждено дело об административном правонарушении
                    </div>
                    
                    <div class="flex-row" style="justify-content: flex-end; margin-top: 40px;">
                        <div class="line handwritten" style="width: 250px;"></div>
                    </div>
                    
                    <!-- Подпись должностного лица, составившего протокол -->
                    <div class="block" style="margin: 15px 0; margin-top: 40px;">
                        <div style="display: flex; align-items: baseline; justify-content: flex-end; flex-wrap: wrap; gap: 10px;">
                            <span style="white-space: nowrap;">Подпись должностного лица, составившего протокол</span>
                            <div style="position: relative; width: 250px; height: 40px; border-bottom: 1px solid #000;">
                                ${protocol?.signature_data ? `
                                <img src="${escapeHtml(protocol.signature_data)}" 
                                     style="position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); max-width: 250px; max-height: 70px; display: block;">
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="block" style="margin: 15px 0; margin-top: 40px; text-align: right;">
                        <div class="flex-row" style="justify-content: flex-end;">
                            <span>Копию протокола получил(а)</span>
                            <div class="line handwritten" style="width: 300px; margin-left: 10px;"></div>
                        </div>
                        <div class="note" style="text-align: right;">
                            (подпись лица, в отношении которого<br>
                            возбуждено дело об адм. правонарушении)
                        </div>
                    </div>
                </div>
                
                <!-- Кнопки управления -->
                <div class="protocol-view-buttons" style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" id="exportPngBtn" class="secondary">📸 Сохранить протокол</button>
                    <button type="button" id="closeProtocolBtn" class="secondary">Закрыть</button>
                </div>
            </div>
        </div>
        `;
        
        document.body.appendChild(modal);

        // Обработчики закрытия
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.onclick = () => modal.remove();
        
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
        
        // Для режима просмотра
        const closeViewBtn = document.getElementById('closeProtocolBtn');
        if (closeViewBtn) closeViewBtn.onclick = () => modal.remove();
        
        const exportPngBtn = document.getElementById('exportPngBtn');
        if (exportPngBtn) {
            exportPngBtn.onclick = () => {
                exportProtocol(id, 'png');
            };
        }
    }
}
	
    // Создание нового протокола
    async function createProtocol() {
        Auth.ping();
        
        const user = Auth.getCurrentUser();
        if (!user) {
            UI.showNotification('Не авторизован', 'error');
            return false;
        }

        // Собираем данные из формы (только нужные поля)
        const formData = {
            protocol_number: document.getElementById('protocol_number')?.value,
            protocol_date: document.getElementById('protocol_date')?.value,
            protocol_time: document.getElementById('protocol_time')?.value,
            protocol_place: document.getElementById('protocol_place')?.value?.trim(),
            
            // Должностное лицо (все в одном поле)
            official_name: document.getElementById('official_name')?.value?.trim(),
            
            // Нарушитель
            violator_lastname: document.getElementById('violator_lastname')?.value?.trim(),
            violator_firstname: document.getElementById('violator_firstname')?.value?.trim(),
            violator_patronymic: document.getElementById('violator_patronymic')?.value?.trim() || null,
            violator_birth_date: document.getElementById('violator_birth_date')?.value || null,
            violator_birth_place: document.getElementById('violator_birth_place')?.value?.trim() || null,
            violator_russian_language_skill: document.getElementById('violator_russian_language_skill')?.value || null,
            
            // Водительское удостоверение
            violator_driver_license: document.getElementById('violator_driver_license')?.value?.trim() || null,
            
            // Транспорт
            vehicle_make_model: document.getElementById('vehicle_make_model')?.value?.trim() || null,
            vehicle_license_plate: document.getElementById('vehicle_license_plate')?.value?.trim() || null,
            vehicle_owner: document.getElementById('vehicle_owner')?.value?.trim() || null,
            vehicle_registered_info: document.getElementById('vehicle_registered_info')?.value?.trim() || null,
            
            // Правонарушение
            offense_datetime: document.getElementById('offense_datetime')?.value,
            offense_place: document.getElementById('offense_place')?.value?.trim(),
            offense_description: document.getElementById('offense_description')?.value?.trim(),
            offense_violation_point: document.getElementById('offense_violation_point')?.value?.trim() || null,
            offense_special_equipment: document.getElementById('offense_special_equipment')?.value?.trim() || null,
            offense_article_number: document.getElementById('offense_article_number')?.value?.trim(),
            offense_article_part: document.getElementById('offense_article_part')?.value?.trim(),
            
            // Объяснения
            explanatory_note: document.getElementById('explanatory_note')?.value?.trim() || null,
			signature_data: document.getElementById('signature_data')?.value || null, 
            
            // Статус
            status: document.getElementById('status')?.value || 'active',
            
            // Служебные поля
            created_by_id: user.auth_user_id,
            created_by_name: user.nickname,
            updated_by_id: user.auth_user_id,
            updated_by_name: user.nickname
        };

        // Валидация обязательных полей
        const requiredFields = [
			'protocol_date', 'protocol_time', 'protocol_place',
			'official_name',
			'violator_lastname', 'violator_firstname', 'violator_driver_license',
			'vehicle_make_model', 'vehicle_license_plate',
			'offense_datetime', 'offense_description', 'offense_violation_point',
			'offense_article_number', 'offense_article_part'
		];

        for (const field of requiredFields) {
            if (!formData[field]) {
                const fieldNames = {
					'protocol_date': 'Дата составления',
					'protocol_time': 'Время составления',
					'protocol_place': 'Место составления',
					'official_name': 'Данные должностного лица',
					'violator_lastname': 'Фамилия нарушителя',
					'violator_firstname': 'Имя нарушителя',
					'violator_driver_license': 'Водительское удостоверение',
					'vehicle_make_model': 'Марка и модель ТС',
					'vehicle_license_plate': 'Государственный номер',
					'offense_datetime': 'Дата и время правонарушения',
					'offense_description': 'Описание правонарушения',
					'offense_violation_point': 'Пункт нормативного акта',
					'offense_article_number': 'Статья КоАП',
					'offense_article_part': 'Часть статьи'
				};
                UI.showNotification(`Заполните обязательное поле: ${fieldNames[field] || field}`, 'error');
                return false;
            }
        }

        try {
            // Показываем индикатор загрузки
            const saveBtn = document.getElementById('saveProtocolBtn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '⏳ Сохранение...';
            saveBtn.disabled = true;

            // Сохраняем в БД
            const { data, error } = await supabaseClient
                .from('protocols')
                .insert([formData])
                .select();

            if (error) {
                console.error('Insert error:', error);
                if (error.code === '42501') {
                    UI.showNotification('Ошибка прав доступа: вы не можете создавать протоколы', 'error');
                } else if (error.code === '23505') {
                    UI.showNotification('Протокол с таким номером уже существует', 'error');
                } else {
                    UI.showNotification('Ошибка при создании протокола: ' + error.message, 'error');
                }
                return false;
            }

            // Логируем создание протокола
            if (Logger && Logger.ACTION_TYPES) {
                Logger.log(Logger.ACTION_TYPES.PROTOCOL_CREATE || 'protocol_create', {
                    protocol_number: formData.protocol_number,
                    violator: `${formData.violator_lastname} ${formData.violator_firstname}`,
                    article: `ст.${formData.offense_article_number} ч.${formData.offense_article_part}`,
                    created_by: user.nickname
                }, 'protocol', formData.protocol_number);
            }

            UI.showNotification('Протокол успешно создан', 'success');
            
            // Обновляем список
            await loadProtocolsList();
            filterAndRenderProtocols();
            
            return true;

        } catch (error) {
            console.error('Error in createProtocol:', error);
            UI.showNotification('Ошибка при создании протокола: ' + error.message, 'error');
            return false;
        } finally {
            const saveBtn = document.getElementById('saveProtocolBtn');
            if (saveBtn) {
                saveBtn.disabled = false;
            }
        }
    }

    // Обновление протокола
    async function updateProtocol(id) {
        Auth.ping();
        
        const user = Auth.getCurrentUser();
        if (!user) {
            UI.showNotification('Не авторизован', 'error');
            return false;
        }

        const oldProtocol = protocolsCache.find(p => p.id == id);
        if (!oldProtocol) {
            UI.showNotification('Протокол не найден', 'error');
            return false;
        }

        // Собираем данные из формы (только нужные поля)
        const formData = {
            protocol_number: document.getElementById('protocol_number')?.value,
            protocol_date: document.getElementById('protocol_date')?.value,
            protocol_time: document.getElementById('protocol_time')?.value,
            protocol_place: document.getElementById('protocol_place')?.value?.trim(),
            
            official_name: document.getElementById('official_name')?.value?.trim(),
            
            violator_lastname: document.getElementById('violator_lastname')?.value?.trim(),
            violator_firstname: document.getElementById('violator_firstname')?.value?.trim(),
            violator_patronymic: document.getElementById('violator_patronymic')?.value?.trim() || null,
            violator_birth_date: document.getElementById('violator_birth_date')?.value || null,
            violator_birth_place: document.getElementById('violator_birth_place')?.value?.trim() || null,
            violator_russian_language_skill: document.getElementById('violator_russian_language_skill')?.value || null,
            
            violator_driver_license: document.getElementById('violator_driver_license')?.value?.trim() || null,
            
            vehicle_make_model: document.getElementById('vehicle_make_model')?.value?.trim() || null,
            vehicle_license_plate: document.getElementById('vehicle_license_plate')?.value?.trim() || null,
            vehicle_owner: document.getElementById('vehicle_owner')?.value?.trim() || null,
            vehicle_registered_info: document.getElementById('vehicle_registered_info')?.value?.trim() || null,
            
            offense_datetime: document.getElementById('offense_datetime')?.value,
            offense_place: document.getElementById('offense_place')?.value?.trim(),
            offense_description: document.getElementById('offense_description')?.value?.trim(),
            offense_violation_point: document.getElementById('offense_violation_point')?.value?.trim() || null,
            offense_special_equipment: document.getElementById('offense_special_equipment')?.value?.trim() || null,
            offense_article_number: document.getElementById('offense_article_number')?.value?.trim(),
            offense_article_part: document.getElementById('offense_article_part')?.value?.trim(),
            
            explanatory_note: document.getElementById('explanatory_note')?.value?.trim() || null,
			signature_data: document.getElementById('signature_data')?.value || null,
            
            status: document.getElementById('status')?.value || 'active',
            
            // Обновляем информацию о редакторе
            updated_by_id: user.auth_user_id,
            updated_by_name: user.nickname
        };

        // Валидация обязательных полей
        const requiredFields = [
			'protocol_date', 'protocol_time', 'protocol_place',
			'official_name',
			'violator_lastname', 'violator_firstname', 'violator_driver_license',
			'vehicle_make_model', 'vehicle_license_plate',
			'offense_datetime', 'offense_description', 'offense_violation_point',
			'offense_article_number', 'offense_article_part'
		];

        for (const field of requiredFields) {
            if (!formData[field]) {
                const fieldNames = {
					'protocol_date': 'Дата составления',
					'protocol_time': 'Время составления',
					'protocol_place': 'Место составления',
					'official_name': 'Данные должностного лица',
					'violator_lastname': 'Фамилия нарушителя',
					'violator_firstname': 'Имя нарушителя',
					'violator_driver_license': 'Водительское удостоверение',
					'vehicle_make_model': 'Марка и модель ТС',
					'vehicle_license_plate': 'Государственный номер',
					'offense_datetime': 'Дата и время правонарушения',
					'offense_description': 'Описание правонарушения',
					'offense_violation_point': 'Пункт нормативного акта',
					'offense_article_number': 'Статья КоАП',
					'offense_article_part': 'Часть статьи'
				};
                UI.showNotification(`Заполните обязательное поле: ${fieldNames[field] || field}`, 'error');
                return false;
            }
        }

        try {
            const saveBtn = document.getElementById('saveProtocolBtn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '⏳ Сохранение...';
            saveBtn.disabled = true;

            const { error } = await supabaseClient
                .from('protocols')
                .update(formData)
                .eq('id', id);

            if (error) {
                console.error('Update error:', error);
                if (error.code === '42501') {
                    UI.showNotification('Ошибка прав доступа: вы не можете редактировать этот протокол', 'error');
                } else {
                    UI.showNotification('Ошибка при обновлении протокола: ' + error.message, 'error');
                }
                return false;
            }

            // Логируем изменения
            if (Logger && Logger.ACTION_TYPES) {
                Logger.log(Logger.ACTION_TYPES.PROTOCOL_UPDATE || 'protocol_update', {
                    protocol_number: formData.protocol_number,
                    updated_by: user.nickname
                }, 'protocol', formData.protocol_number);
            }

            UI.showNotification('Протокол обновлен', 'success');
            
            await loadProtocolsList();
            filterAndRenderProtocols();
            
            return true;

        } catch (error) {
            console.error('Error in updateProtocol:', error);
            UI.showNotification('Ошибка при обновлении протокола: ' + error.message, 'error');
            return false;
        } finally {
            const saveBtn = document.getElementById('saveProtocolBtn');
            if (saveBtn) {
                saveBtn.disabled = false;
            }
        }
    }
    
    // Удаление протокола
    async function deleteProtocol(id) {
        Auth.ping();
        
        if (!canDeleteProtocol()) {
            UI.showNotification('У вас нет прав на удаление протоколов', 'error');
            return;
        }

        const protocol = protocolsCache.find(p => p.id == id);
        if (!protocol) {
            UI.showNotification('Протокол не найден', 'error');
            return;
        }

        // Создаем модальное окно подтверждения
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal-overlay';
        confirmModal.innerHTML = `
            <div class="modal-container" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>Подтверждение удаления</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-content">
                    <p>Вы уверены, что хотите удалить протокол <strong>№${escapeHtml(protocol.protocol_number)}</strong>?</p>
                    <p style="color: #dc3545; font-size: 0.9rem;">Это действие необратимо. Все данные будут потеряны.</p>
                    
                    <div style="background: #f5f9ff; padding: 12px; border-radius: 8px; margin: 15px 0;">
                        <p style="margin: 5px 0;"><strong>Нарушитель:</strong> ${escapeHtml(protocol.violator_lastname)} ${escapeHtml(protocol.violator_firstname)}</p>
                        <p style="margin: 5px 0;"><strong>Статья:</strong> ст. ${escapeHtml(protocol.offense_article_number)} ч. ${escapeHtml(protocol.offense_article_part)}</p>
                        <p style="margin: 5px 0;"><strong>Дата:</strong> ${UI.formatDate(protocol.offense_datetime)}</p>
                    </div>
                    
                    <div class="flex-row" style="justify-content: flex-end;">
                        <button id="cancelDeleteBtn" class="secondary">Отмена</button>
                        <button id="confirmDeleteBtn" style="background: #dc3545;">🗑️ Удалить</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);

        // Обработчики закрытия
        const closeBtn = confirmModal.querySelector('.modal-close');
        closeBtn.onclick = () => confirmModal.remove();
        
        confirmModal.onclick = (e) => {
            if (e.target === confirmModal) confirmModal.remove();
        };

        document.getElementById('cancelDeleteBtn').onclick = () => confirmModal.remove();
        
        // Обработчик подтверждения удаления
        document.getElementById('confirmDeleteBtn').onclick = async () => {
            try {
                // Показываем индикатор загрузки на кнопке
                const deleteBtn = document.getElementById('confirmDeleteBtn');
                const originalText = deleteBtn.textContent;
                deleteBtn.textContent = '⏳ Удаление...';
                deleteBtn.disabled = true;

                // Логируем удаление перед фактическим удалением
                if (Logger && Logger.ACTION_TYPES) {
                    Logger.log(Logger.ACTION_TYPES.PROTOCOL_DELETE || 'protocol_delete', {
                        protocol_number: protocol.protocol_number,
                        violator: `${protocol.violator_lastname} ${protocol.violator_firstname}`,
                        article: `ст.${protocol.offense_article_number} ч.${protocol.offense_article_part}`,
                        deleted_by: Auth.getCurrentUser()?.nickname
                    }, 'protocol', protocol.protocol_number);
                }
                
                // Выполняем удаление
                const { error } = await supabaseClient
                    .from('protocols')
                    .delete()
                    .eq('id', id);

                if (error) {
                    console.error('Delete error:', error);
                    if (error.code === '42501') {
                        UI.showNotification('Ошибка прав доступа: вы не можете удалять протоколы', 'error');
                    } else {
                        UI.showNotification('Ошибка при удалении: ' + error.message, 'error');
                    }
                    return;
                }

                UI.showNotification('Протокол удален', 'success');
                confirmModal.remove();
                
                // Обновляем список
                await loadProtocolsList();
                filterAndRenderProtocols();
                
            } catch (error) {
                console.error('Error in deleteProtocol:', error);
                UI.showNotification('Ошибка при удалении: ' + error.message, 'error');
            }
        };
    }
	
	// Экспорт протокола в PNG
async function exportProtocol(id, format = 'png') {
    Auth.ping();
    
    const protocol = protocolsCache.find(p => p.id == id);
    if (!protocol) {
        UI.showNotification('Протокол не найден', 'error');
        return;
    }

    // Создаем временный контейнер
    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'fixed';
    exportContainer.style.left = '-9999px';
    exportContainer.style.top = '0';
    exportContainer.style.width = '800px';
    exportContainer.style.backgroundColor = 'white';
    exportContainer.style.padding = '40px';
    exportContainer.style.zIndex = '9999';
    exportContainer.style.fontFamily = '"Courier New", monospace';
    exportContainer.style.fontSize = '14px';
    exportContainer.style.lineHeight = '1.35';
    
    // Копируем основные стили
    const styles = document.querySelector('link[href*="styles.css"]');
    if (styles) {
        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = styles.href;
        exportContainer.appendChild(styleLink);
    }

    // Добавляем дополнительные стили для экспорта
    const exportStyles = document.createElement('style');
    exportStyles.textContent = `
        * {
            font-family: "Courier New", monospace !important;
            box-sizing: border-box;
        }
        .protocol-document {
            font-family: "Courier New", monospace;
            width: 100%;
        }
        .grid td {
            font-family: "Courier New", monospace !important;
        }
        .line, .line-row .line {
            border-bottom: 1px solid #000 !important;
        }
        .note {
            font-size: 11px !important;
            color: #666 !important;
        }
        .title-line {
            border-bottom: 1px solid #000 !important;
        }
    `;
    exportContainer.appendChild(exportStyles);

    // Используем ТУ ЖЕ САМУЮ СТРУКТУРУ, что и в режиме просмотра
    exportContainer.innerHTML += `
        <div class="protocol-document">
            <!-- Заголовок -->
            <div class="center title">
                <div>ПРОТОКОЛ</div>
                <div>об административном правонарушении</div>
                <div class="title-line handwritten" style="font-size: 24px !important;">№ ${escapeHtml(protocol.protocol_number || '_______________')}</div>
                <div class="note note-center">(регистрационный номер)</div>
            </div>
            
            <!-- Дата / Время / Место -->
            <div class="date-container">
                <div class="date-item date-left">
                    <div class="date-field">
                        <div class="date-row">
                            <span>"</span>
                            <div class="line handwritten" style="width: 26px; text-align:left;">${protocol.protocol_date ? new Date(protocol.protocol_date).getDate().toString().padStart(2,'0') : ''}</div>
                            <span>"</span>
                            <div class="line handwritten" style="width: 81px; text-align:left;">
                              ${protocol.protocol_date ? (() => {
                                    const date = new Date(protocol.protocol_date);
                                    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                                                    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
                                    return months[date.getMonth()];
                                  })() : ''}
                            </div>
                            <span>20</span>
                            <div class="line handwritten" style="width: 26px; text-align:left;">${protocol.protocol_date ? new Date(protocol.protocol_date).getFullYear().toString().slice(-2) : ''}</div>
                            <span>г.</span>
                        </div>
                        <div class="note">(дата составления)</div>
                    </div>
                </div>
                
                <div class="date-item date-center">
                    <div class="date-field">
                        <div class="date-row">
                            <div class="line handwritten" style="width: 26px; text-align:left;">${protocol.protocol_time ? protocol.protocol_time.split(':')[0] : ''}</div>
                            <span>час. </span>
                            <div class="line handwritten" style="width: 26px; text-align:left;">${protocol.protocol_time ? protocol.protocol_time.split(':')[1] : ''}</div>
                            <span>мин.</span>
                        </div>
                        <div class="note">(время составления)</div>
                    </div>
                </div>
                
                <div class="date-item date-right">
                    <div class="date-field" style="width: 100%;">
                        <div class="date-row">
                            <div class="line handwritten">${escapeHtml(protocol.protocol_place || '')}</div>
                        </div>
                        <div class="note">(место составления)</div>
                    </div>
                </div>
            </div>
            
            <!-- Я, ... -->
            <div class="block block-narrow">
                <div class="line-row">
                    <span>Я,</span>
                    <span class="line handwritten">${escapeHtml(protocol.official_name || '')}</span>
                </div>
                <div class="note note-center">
                    (должность, специальное звание, подразделение, фамилия, инициалы<br>
                    должностного лица, составившего протокол)
                </div>
            </div>
            
            <div class="block">
                в соответствии со статьей 58 Административный регламент ГИБДД составил настоящий протокол о том, что гражданин(ка)
            </div>
            
            <!-- Клетки для ФИО -->
            ${(() => {
                const violatorName = [protocol.violator_lastname || '', protocol.violator_firstname || '', protocol.violator_patronymic || ''].join(' ');
                const truncatedName = violatorName.length > 35 ? violatorName.substring(0, 35) : violatorName;
                const nameChars = truncatedName.split('');
                const cells = [];
                for (let i = 0; i < 35; i++) {
                    cells.push(nameChars[i] || '');
                }
                return `
                <div class="grid">
                    <table>
                        <tr>
                            ${cells.map(char => `<td class="handwritten">${escapeHtml(char)}</td>`).join('')}
                        </tr>
                    </table>
                    <div class="note note-center">фамилия имя отчество</div>
                </div>
                `;
            })()}
            
            <!-- Дата и место рождения / владение русским языком -->
            <div class="block">
				<div class="flex-row" style="flex-wrap: wrap; gap: 5px;">
					<div class="line handwritten" style="flex: 2;">
						${protocol.violator_birth_date ? new Date(protocol.violator_birth_date).toLocaleDateString('ru-RU') + ', ' : ''}${escapeHtml(protocol.violator_birth_place || '')}
					</div>
					<div class="nowrap">, русским языком</div>
					<div class="line handwritten" style="flex: 1;">${protocol.violator_russian_language_skill || ''}</div>
				</div>
				<div class="note flex-space-between">
					<span>(дата и место рождения)</span>
					<span>(владеет/не владеет)</span>
				</div>
			</div>
            
            <!-- Водительское удостоверение и транспорт -->
            ${(() => {
                const licenseText = protocol.violator_driver_license || '';
                const licenseMaxLength = 19;
                
                let licenseFirstLine = licenseText;
                let licenseSecondLine = '';
                
                if (licenseText.length > licenseMaxLength) {
                    let cutIndex = licenseText.lastIndexOf(' ', licenseMaxLength);
                    if (cutIndex === -1) cutIndex = licenseMaxLength;
                    
                    licenseFirstLine = licenseText.substring(0, cutIndex);
                    licenseSecondLine = licenseText.substring(cutIndex).trim();
                }
                
                const ownerText = protocol.vehicle_owner || '';
                const ownerMaxLength1 = 68;
                const ownerMaxLength2 = 83;
                
                let ownerFirstLine = ownerText;
                let ownerSecondLine = '';
                let ownerThirdLine = '';
                
                if (ownerText.length > ownerMaxLength1) {
                    let cutIndex1 = ownerText.lastIndexOf(' ', ownerMaxLength1);
                    if (cutIndex1 === -1) cutIndex1 = ownerMaxLength1;
                    
                    ownerFirstLine = ownerText.substring(0, cutIndex1);
                    
                    const remainingText = ownerText.substring(cutIndex1).trim();
                    
                    if (remainingText.length > ownerMaxLength2) {
                        let cutIndex2 = remainingText.lastIndexOf(' ', ownerMaxLength2);
                        if (cutIndex2 === -1) cutIndex2 = ownerMaxLength2;
                        
                        ownerSecondLine = remainingText.substring(0, cutIndex2);
                        ownerThirdLine = remainingText.substring(cutIndex2).trim();
                    } else {
                        ownerSecondLine = remainingText;
                    }
                }
                
                return `
                    <div class="block">
                        <!-- Водительское удостоверение -->
                        <div class="flex-row">
                            <div class="nowrap">водительское удостоверение (документ, удостоверяющий личность)</div>
                            <div class="line handwritten" style="flex: 3;">${escapeHtml(licenseFirstLine)}</div>
                        </div>
                        
                        ${licenseSecondLine ? `
                        <div class="line-row" style="margin-top: 5px;">
                            <div class="line handwritten" style="flex: 1;">${escapeHtml(licenseSecondLine)}</div>
                        </div>
                        ` : `
                        <div class="line-row" style="margin-top: 5px;">
                            <div class="line handwritten" style="flex: 1;">&nbsp;</div>
                        </div>
                        `}
                        <div class="note note-center">(серия, номер, когда и кем выдан)</div>
                        
                        <!-- Управляя транспортным средством -->
                        <div style="margin-top:15px;">
                            <div class="flex-row">
                                <div class="nowrap">управляя транспортным средством</div>
                                <div class="line handwritten" style="flex: 2;">
                                    ${escapeHtml(protocol.vehicle_make_model || '')} 
                                    ${protocol.vehicle_license_plate ? '(' + escapeHtml(protocol.vehicle_license_plate) + ')' : ''}
                                </div>
                            </div>
                            <div class="note note-center">(марка, гос. регистрационный знак)</div>
                        </div>
                        
                        <!-- Принадлежащим -->
                        <div style="margin-top:15px;">
                            <div class="flex-row">
                                <div class="nowrap">принадлежащим</div>
                                <div class="line handwritten" style="flex: 2; white-space: nowrap; overflow: hidden;">
                                    ${escapeHtml(ownerFirstLine)}
                                </div>
                            </div>
                            
                            <div class="note note-center" style="margin-top: 2px;">(фамилия, имя, отчество, организация)</div>
                            
                            <div class="line-row" style="margin-top: 8px;">
                                <div class="line handwritten" style="flex: 1; white-space: nowrap; overflow: hidden;">
                                    ${ownerSecondLine ? escapeHtml(ownerSecondLine) : '&nbsp;'}
                                </div>
                            </div>
                            
                            ${ownerThirdLine ? `
                            <div class="line-row" style="margin-top: 5px;">
                                <div class="line handwritten" style="flex: 1; white-space: nowrap; overflow: hidden;">
                                    ${escapeHtml(ownerThirdLine)}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        
                        <!-- Отступ перед "состоящим на учете" -->
                        <div style="margin-top: 15px;"></div>
                        
                        <!-- Состоящим на учете -->
                        <div class="flex-row" style="margin-top:5px;">
                            <div class="nowrap">состоящим на учете</div>
                            <div class="line handwritten" style="flex: 2;">${escapeHtml(protocol.vehicle_registered_info || '')}</div>
                        </div>
                    </div>
                `;
            })()}
            
            <!-- Дата, время и место правонарушения -->
            ${(() => {
                const offenseDateTime = protocol.offense_datetime || '';
				let offenseDay = '', offenseMonth = '', offenseYear = '', offenseHour = '', offenseMinute = '';

				if (offenseDateTime) {
					const [datePart, timePart] = offenseDateTime.split('T');
					if (datePart) {
						const [year, month, day] = datePart.split('-');
						offenseDay = day || '';
						offenseMonth = month ? getMonthGenitive(parseInt(month) - 1) : '';
						offenseYear = year ? year.slice(-2) : '';
					}
					if (timePart) {
						const [hour, minute] = timePart.split(':');
						offenseHour = hour || '';
						offenseMinute = minute || '';
					}
				}
                
                return `
                <div class="block" style="width: 100%; margin: 10px 0;">
                    <div class="flex-row" style="gap: 10px;">
                        <div class="flex-row" style="flex: 1.7; flex-wrap: wrap;">
                            <span>"</span>
                            <div class="line handwritten" style="width: 26px; text-align:left;">${offenseDay}</div>
                            <span>"</span>
                            <div class="line handwritten" style="width: 81px; text-align:left;">${offenseMonth}</div>
                            <span>20</span>
                            <div class="line handwritten" style="width: 26px; text-align:left;">${offenseYear}</div>
                            <span> г. в "</span>
                            <div class="line handwritten" style="width: 26px; text-align:left;">${offenseHour}</div>
                            <span>" час. "</span>
                            <div class="line handwritten" style="width: 26px; text-align:left;">${offenseMinute}</div>
                            <span>" мин.</span>
                        </div>
                        
                        <div class="flex-row" style="flex: 1;">
                            <span>на</span>
                            <div class="line handwritten" style="flex: 1;">${escapeHtml(protocol.offense_place || '')}</div>
                        </div>
                    </div>
                    
                    <div class="offense-note-row">
                        <div class="offense-note-left">(дата, время совершения административного правонарушения)</div>
                        <div class="offense-note-right">(место совершения административного правонарушения)</div>
                    </div>
                </div>
                `;
            })()}
            
            <!-- Существо нарушения -->
            ${(() => {
                const combinedText = [
                    protocol.offense_violation_point,
                    protocol.offense_description,
                    protocol.offense_special_equipment
                ]
                .filter(Boolean)
                .join(', ');

                const maxLength = 60;

                const part1 = combinedText.substring(0, maxLength);
                const part2 = combinedText.length > maxLength
                    ? combinedText.substring(maxLength)
                    : '';

                return `
                    <div class="flex-row">
                        <div class="nowrap">совершил(а) нарушение</div>
                        <div class="line handwritten" style="flex: 3; white-space: nowrap; overflow: hidden;">
                            ${escapeHtml(part1)}
                        </div>
                    </div>

                    <div class="note note-center">
                        (пункт нормативного правового акта, существо нарушения,
                    </div>

                    <div class="line-row" style="height: 1.35em; margin: 5px 0;">
                        <div class="line handwritten" style="flex: 1; white-space: nowrap; overflow: hidden;">
                            ${escapeHtml(part2)}
                        </div>
                    </div>

                    <div class="note note-center">
                        при применении спец. тех. средств указываются их показания, наименование, номер)
                    </div>
                `;
            })()}
            
            <div class="flex-row" style="gap: 5px; flex-wrap: wrap; width: 100%; margin-top: 10px;">
                <span>ответственность за которое предусмотрена частью</span>
                <div class="line handwritten" style="width: 50px; text-align:center;">${escapeHtml(protocol.offense_article_part || '')}</div>
                <span>статьи</span>
                <div class="line handwritten" style="width: 50px; text-align:center;">${escapeHtml(protocol.offense_article_number || '')}</div>
                <span>Кодекса Республики Провинция об административных правонарушениях.</span>
            </div>
            
            <div class="block">
                Лицу, в отношении которого возбуждено дело об административном
                правонарушении, разъяснены права, предусмотренные статьей 30 Конституции Республики Провинция.
            </div>
            
            <div class="block">
                Лицо, в отношении которого возбуждено дело об административном
                правонарушении, ознакомлено с протоколом.
            </div>
            
            ${(() => {
                const fullText = protocol.explanatory_note || '';

                const maxLength1 = 35;
                const maxLength2 = 83; 
                const maxLength3 = 83; 

                const line1 = fullText.substring(0, maxLength1);
                const line2 = fullText.length > maxLength1
                    ? fullText.substring(maxLength1, maxLength1 + maxLength2)
                    : '';
                const line3 = fullText.length > (maxLength1 + maxLength2)
                    ? fullText.substring(maxLength1 + maxLength2, maxLength1 + maxLength2 + maxLength3)
                    : '';

                return `
                    <div class="flex-row">
                        <div class="nowrap">Объяснения и замечания по содержанию протокола:</div>
                        <div class="line handwritten" style="flex: 2; white-space: nowrap; overflow: hidden;">
                            ${escapeHtml(line1)}
                        </div>
                    </div>

                    <div class="line-row" style="height: 1.35em; margin-top:5px;">
                        <div class="line handwritten" style="flex: 1; white-space: nowrap; overflow: hidden;">
                            ${escapeHtml(line2)}
                        </div>
                    </div>

                    <div class="line-row" style="height: 1.35em; margin-top:5px;">
                        <div class="line handwritten" style="flex: 1; white-space: nowrap; overflow: hidden;">
                            ${escapeHtml(line3)}
                        </div>
                    </div>
                `;
            })()}
            
            <div class="block" style="margin: 15px 0; text-align: center;">
                Подпись лица, в отношении которого возбуждено дело об административном правонарушении
            </div>
            
            <div class="flex-row" style="justify-content: flex-end; margin-top: 40px;">
                <div class="line handwritten" style="width: 250px;"></div>
            </div>
            
            <!-- Подпись должностного лица, составившего протокол -->
			<div class="block" style="margin: 15px 0; margin-top: 40px;">
				<div style="display: flex; align-items: baseline; justify-content: flex-end; flex-wrap: wrap; gap: 10px;">
					<span style="white-space: nowrap;">Подпись должностного лица, составившего протокол</span>
					<div style="position: relative; width: 250px; height: 40px; border-bottom: 1px solid #000;">
						${protocol?.signature_data ? `
						<img src="${escapeHtml(protocol.signature_data)}" 
							style="position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); max-width: 250px; max-height: 70px; display: block;">
						` : ''}
					</div>
				</div>
			</div>
            
            <div class="block" style="margin: 15px 0; margin-top: 40px; text-align: right;">
                <div class="flex-row" style="justify-content: flex-end;">
                    <span>Копию протокола получил(а)</span>
                    <div class="line handwritten" style="width: 300px; margin-left: 10px;"></div>
                </div>
                <div class="note" style="text-align: right;">
                    (подпись лица, в отношении которого<br>
                    возбуждено дело об адм. правонарушении)
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(exportContainer);

    try {
        if (format === 'png') {
            // Даем время на загрузку стилей
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const canvas = await html2canvas(exportContainer, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                allowTaint: false,
                useCORS: true,
                windowWidth: 800,
                onclone: (clonedDoc) => {
                    // Дополнительные стили для клонированного документа
                    const style = clonedDoc.createElement('style');
                    style.textContent = `
                        * { 
                            font-family: 'Courier New', monospace !important; 
                            box-sizing: border-box;
                        }
                        .protocol-document, .grid td { 
                            font-family: 'Courier New', monospace !important; 
                        }
                        .line, .line-row .line {
                            border-bottom: 1px solid #000 !important;
                        }
                        .grid td {
                            border: 1px solid #000 !important;
                        }
                    `;
                    clonedDoc.head.appendChild(style);
                }
            });
            
            const link = document.createElement('a');
            link.download = `protocol-${protocol.protocol_number}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            UI.showNotification('Протокол сохранён как PNG', 'success');
            
            if (Logger && Logger.ACTION_TYPES) {
                Logger.log('protocol_export', {
                    protocol_number: protocol.protocol_number,
                    format: format,
                    exported_by: Auth.getCurrentUser()?.nickname
                }, 'protocol', protocol.protocol_number);
            }
        }
    } catch (error) {
        console.error('Error exporting protocol:', error);
        UI.showNotification('Ошибка при экспорте протокола: ' + error.message, 'error');
    } finally {
        document.body.removeChild(exportContainer);
    }
}
	
    return {
        initProtocolsList,
        loadProtocolsList,
        generateProtocolNumber,
        canEditProtocol,
        canDeleteProtocol,
        filterProtocolsList,
        renderProtocolsList,
        filterAndRenderProtocols,
        openProtocolModal,
        deleteProtocol,
        exportProtocol,       
        PROTOCOL_STATUS
    };
})();


window.Protocol = Protocol;
