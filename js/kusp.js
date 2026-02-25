// Модуль КУСП
const KUSP = (function() {
    let kuspListCache = [];

    // Статусы КУСП
    const KUSP_STATUS = {
        NEW: 'new',
        IN_PROGRESS: 'in_progress',
        UNDER_REVIEW: 'under_review',
        CLOSED: 'closed'
    };

    // Загрузка списка КУСП
    async function loadKuspList() {
        try {
            Auth.ping();
            
            const { data, error } = await supabaseClient
                .from('kusps')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error loading kusps:', error);
                UI.showNotification('Ошибка загрузки КУСП: ' + error.message, 'error');
                return [];
            }
            
            kuspListCache = data || [];
            return kuspListCache;
        } catch (error) {
            console.error('Error in loadKuspList:', error);
            ErrorHandler.showError(error, 'Ошибка загрузки КУСП');
            return [];
        }
    }

    // Генерация номера КУСП
    async function generateKuspNumber() {
		const today = new Date();
		const currentYear = today.getFullYear();
		
		// Получаем все записи КУСП за текущий год
		const startOfYear = `${currentYear}-01-01T00:00:00`;
		const endOfYear = `${currentYear}-12-31T23:59:59`;
		
		const { data } = await supabaseClient
			.from('kusps')
			.select('kusp_number')
			.gte('created_at', startOfYear)
			.lte('created_at', endOfYear);
		
		let maxNumber = 0;
		if (data && data.length > 0) {
			data.forEach(item => {
				if (item.kusp_number) {
					const parts = item.kusp_number.split('-');
					if (parts.length === 4) {
						const num = parseInt(parts[3]);
						if (!isNaN(num) && num > maxNumber) maxNumber = num;
					}
				}
			});
		}
		
		const nextNumber = (maxNumber + 1).toString().padStart(3, '0');
		return `${currentYear}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}-${nextNumber}`;
	}

    // Проверка прав на редактирование КУСП
    function canEditKusp(kusp) {
        const user = Auth.getCurrentUser();
        if (!user) return false;
        
        if (user.category === 'РС' || user.category === 'ВРС' || user.category === 'Администратор') {
            return true;
        }
        
        return kusp.created_by_id === user.id;
    }

    // Проверка прав на удаление КУСП
    function canDeleteKusp() {
        const user = Auth.getCurrentUser();
        if (!user) return false;
        
        return user.category === 'РС' || user.category === 'ВРС' || user.category === 'Администратор';
    }

    // Фильтрация списка
    function filterKuspList(search, status) {
        return kuspListCache.filter(k => 
            (!status || k.status === status) &&
            (!search || (
                k.kusp_number?.toLowerCase().includes(search.toLowerCase()) ||
                k.reporter_name?.toLowerCase().includes(search.toLowerCase()) ||
                k.short_content?.toLowerCase().includes(search.toLowerCase())
            ))
        );
    }

    // Отображение списка КУСП
    function renderKuspList(filteredList) {
        const container = document.getElementById('kuspList');
        if (!container) return;

        container.innerHTML = '';
        
        if (!filteredList.length) {
            container.innerHTML = '<div class="list-item">Нет записей</div>';
            return;
        }

        filteredList.forEach(k => {
            const div = document.createElement('div');
            div.className = 'list-item';
            
            const canEdit = canEditKusp(k);
            const canDelete = canDeleteKusp();
            
            div.innerHTML = `
                <div style="flex:1;">
                    <div class="item-title">
                        КУСП №${escapeHtml(k.kusp_number || 'б/н')} ${UI.getStatusBadge(k.status)}
                    </div>
                    <div class="item-meta">
                        ${escapeHtml(k.reporter_name || '—')} · ${UI.formatDate(k.received_datetime)}<br>
                        <small>Принял: ${escapeHtml(k.received_by_name || '—')}</small>
                    </div>
                </div>
                <div class="flex-row" style="gap: 8px;">
                    <button class="small" data-id="${k.id}" data-action="view">👁️ Просмотр</button>
                    ${canEdit ? `<button class="small" data-id="${k.id}" data-action="edit">✏️ Редактировать</button>` : ''}
                    ${canDelete ? `<button class="small secondary" data-id="${k.id}" data-action="delete">🗑️ Удалить</button>` : ''}
                </div>
            `;
            container.appendChild(div);
        });

        container.querySelectorAll('button[data-action="view"]').forEach(btn => {
            btn.onclick = () => openKuspModal(btn.dataset.id, 'view');
        });
        
        container.querySelectorAll('button[data-action="edit"]').forEach(btn => {
            btn.onclick = () => openKuspModal(btn.dataset.id, 'edit');
        });
        
        container.querySelectorAll('button[data-action="delete"]').forEach(btn => {
            btn.onclick = () => deleteKusp(btn.dataset.id);
        });
    }

    // Сохранение талона как PNG
    async function saveTicketAsPNG(kuspId, ticketType) {
        const kusp = kuspListCache.find(k => k.id == kuspId);
        if (!kusp) return;
        
        const ticketContainer = document.createElement('div');
        ticketContainer.style.position = 'fixed';
        ticketContainer.style.left = '-9999px';
        ticketContainer.style.top = '0';
        ticketContainer.style.width = '500px';
        ticketContainer.style.backgroundColor = 'white';
        ticketContainer.style.padding = '30px';
        ticketContainer.style.fontFamily = "'Courier New', monospace";
        ticketContainer.style.borderRadius = '8px';
        ticketContainer.style.boxShadow = '0 0 20px rgba(0,0,0,0.2)';
        
        const now = new Date().toLocaleString();
        
        if (ticketType === 'notification') {
            ticketContainer.innerHTML = `
                <div style="border: 3px solid #28a745; padding: 25px;">
                    <h2 style="text-align: center; color: #28a745; margin-bottom: 20px;">УГИБДД МВД по Республике Провинция</h2>
                    <h3 style="text-align: center; margin-bottom: 25px;">ТАЛОН-УВЕДОМЛЕНИЕ</h3>
                    
                    <p><strong>Номер талона:</strong> ${escapeHtml(kusp.ticket_number || kusp.kusp_number)}</p>
                    <p><strong>Оперативный дежурный:</strong> ${escapeHtml(kusp.received_by_name)}</p>
                    <p><strong>Регистрационный номер КУСП:</strong> ${escapeHtml(kusp.kusp_number)}</p>
                    <p><strong>Наименование органа:</strong> УГИБДД МВД по Республике Провинция</p>
                    <p><strong>Адрес:</strong> г. Мирный, Кутузовская набережная, д. 2</p>
                    <p><strong>Телефон дежурной части:</strong> 8 (222) 555-58-48</p>
                    <p><strong>Дата и время приема:</strong> ${UI.formatDate(kusp.received_datetime)}</p>
                    
                    <hr style="border: 1px dashed #28a745; margin: 20px 0;">
                    
                    <p><strong>Подпись оперативного дежурного:</strong> ____________________</p>
                    <p><strong>М.П.</strong></p>
                    
                    <div style="margin-top: 30px; font-size: 0.8em; color: #666;">
                        <p>Талон действителен при предъявлении документа, удостоверяющего личность</p>
                        <p>Дата печати: ${now}</p>
                    </div>
                </div>
            `;
        } else {
            ticketContainer.innerHTML = `
                <div style="border: 3px solid #dc3545; padding: 25px;">
                    <h2 style="text-align: center; color: #dc3545; margin-bottom: 20px;">УГИБДД МВД по Республике Провинция</h2>
                    <h3 style="text-align: center; margin-bottom: 25px;">ТАЛОН-КОРЕШОК</h3>
                    
                    <p><strong>Номер талона:</strong> ${escapeHtml(kusp.ticket_number || kusp.kusp_number)}</p>
                    <p><strong>Сведения о заявителе:</strong> ${escapeHtml(kusp.reporter_name)}</p>
                    <p><strong>Краткое содержание:</strong> ${escapeHtml(kusp.short_content)}</p>
                    <p><strong>Регистрационный номер КУСП:</strong> ${escapeHtml(kusp.kusp_number)}</p>
                    <p><strong>Сотрудник, принявший заявление:</strong> ${escapeHtml(kusp.received_by_name)}</p>
                    <p><strong>Дата и время приема:</strong> ${UI.formatDate(kusp.received_datetime)}</p>
                    
                    <hr style="border: 1px dashed #dc3545; margin: 20px 0;">
                    
                    <p><strong>Подпись сотрудника:</strong> ____________________</p>
                    <p><strong>Дата:</strong> ${now}</p>
                </div>
            `;
        }
        
        document.body.appendChild(ticketContainer);
        
        try {
            const canvas = await html2canvas(ticketContainer, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                allowTaint: false,
                useCORS: true
            });
            
            const link = document.createElement('a');
            link.download = `talon-${ticketType === 'notification' ? 'uvedomlenie' : 'koreshok'}-${kusp.kusp_number}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            UI.showNotification('Талон сохранён как PNG', 'success');
        } catch (error) {
            console.error('Error saving ticket as PNG:', error);
            UI.showNotification('Ошибка при сохранении талона', 'error');
        } finally {
            document.body.removeChild(ticketContainer);
        }
    }

    // Открыть модальное окно
    async function openKuspModal(id = null, mode = 'create') {
        Auth.ping();
        
        const user = Auth.getCurrentUser();
        let kusp = null;
        let employees = [];
        
        if (id) {
            kusp = kuspListCache.find(k => k.id == id);
            if (!kusp) return;
            
            if (mode === 'edit' && !canEditKusp(kusp)) {
                UI.showNotification('У вас нет прав на редактирование этой записи', 'error');
                return;
            }
        }
        
        const { data: empData } = await supabaseClient
            .from('employees')
            .select('id, auth_user_id, nickname, rank')
            .order('nickname');
        employees = empData || [];
        
        console.log('Employees loaded:', employees);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'kuspModal';
        
        const title = mode === 'create' ? 'Новая запись КУСП' : 
                     (mode === 'edit' ? `Редактирование КУСП №${kusp.kusp_number}` : 
                      `Просмотр КУСП №${kusp.kusp_number}`);
        
        const isReadOnly = mode === 'view';
        
        modal.innerHTML = `
        <div class="modal-container modal-large">
            <div class="modal-header">
                <h3>${escapeHtml(title)}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-content">
                <form id="kuspForm" style="max-height: 70vh; overflow-y: auto; padding-right: 10px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div>
                            <h4>Основная информация</h4>
                            
                            <div class="form-group">
                                <label>Номер КУСП</label>
                                <input type="text" id="kusp_number" readonly value="${kusp ? escapeHtml(kusp.kusp_number) : '(будет сгенерирован)'}">
                            </div>
                            
                            <div class="form-group">
                                <label>Номер талона-уведомления</label>
                                <input type="text" id="ticket_number" ${isReadOnly ? 'readonly' : ''} 
                                    value="${kusp ? escapeHtml(kusp.ticket_number || '') : ''}" 
                                    placeholder="Заполните или оставьте пустым для автогенерации">
                            </div>
                            
                            <div class="form-group">
                                <label>Дата и время поступления <span class="required">*</span></label>
                                <input type="datetime-local" id="received_datetime" ${isReadOnly ? 'readonly' : 'required'} 
                                    value="${kusp && kusp.received_datetime ? kusp.received_datetime.slice(0,16) : new Date().toISOString().slice(0,16)}">
                            </div>
                            
                            <div class="form-group">
                                <label>Форма поступления <span class="required">*</span></label>
                                <select id="received_form" ${isReadOnly ? 'disabled' : 'required'}>
                                    <option value="электронное заявление" ${kusp?.received_form === 'электронное заявление' ? 'selected' : ''}>Электронное заявление</option>
                                    <option value="письменное заявление" ${kusp?.received_form === 'письменное заявление' ? 'selected' : ''}>Письменное заявление</option>
                                    <option value="устное сообщение" ${kusp?.received_form === 'устное сообщение' ? 'selected' : ''}>Устное сообщение</option>
                                    <option value="рапорт" ${kusp?.received_form === 'рапорт' ? 'selected' : ''}>Рапорт</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Сотрудник, принявший заявление <span class="required">*</span></label>
                                ${isReadOnly ? 
                                    `<input type="text" value="${kusp ? escapeHtml(kusp.received_by_name || '') : ''}" readonly>` :
                                    `<select id="received_by_id" required>
                                        <option value="">Выберите сотрудника</option>
                                        ${employees.map(emp => 
                                            `<option value="${emp.auth_user_id}" ${kusp?.received_by_id === emp.auth_user_id ? 'selected' : ''}>
                                                ${escapeHtml(emp.rank || '')} ${escapeHtml(emp.nickname)}
                                            </option>`
                                        ).join('')}
                                    </select>`
                                }
                            </div>
                        </div>
                        
                        <div>
                            <h4>Содержание</h4>
                            
                            <div class="form-group">
								<label>Содержание заявления<span class="required">*</span></label>
								<textarea id="short_content" rows="19" style="resize: none;" ${isReadOnly ? 'readonly' : 'required'} 
									placeholder="Описание произошедшего">${kusp ? escapeHtml(kusp.short_content || '') : ''}</textarea>
							</div>
                        </div>
                    </div>
                    
                    <hr style="margin: 20px 0;">
                    
                    <h4>Данные о заявителе</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div>
                            <div class="form-group">
                                <label>ФИО заявителя <span class="required">*</span></label>
                                <input type="text" id="reporter_name" ${isReadOnly ? 'readonly' : 'required'} 
                                    value="${kusp ? escapeHtml(kusp.reporter_name || '') : ''}" 
                                    placeholder="Иванов Иван Иванович">
                            </div>
                            
                            <div class="form-group">
                                <label>Дата рождения</label>
                                <input type="date" id="reporter_birth_date" ${isReadOnly ? 'readonly' : ''} 
                                    value="${kusp?.reporter_birth_date ? kusp.reporter_birth_date.slice(0,10) : ''}">
                            </div>
                            
                            <div class="form-group">
                                <label>Адрес регистрации</label>
                                <input type="text" id="reporter_address" ${isReadOnly ? 'readonly' : ''} 
                                    value="${kusp ? escapeHtml(kusp.reporter_address || '') : ''}" 
                                    placeholder="г. Мирный, Левобережный пр-кт, д. 49, кв. 15">
                            </div>
                        </div>
                        
                        <div>
                            <div class="form-group">
                                <label>Паспортные данные</label>
                                <input type="text" id="reporter_passport" ${isReadOnly ? 'readonly' : ''} 
                                    value="${kusp ? escapeHtml(kusp.reporter_passport || '') : ''}" 
                                    placeholder="Серия, номер, дата выдачи">
                            </div>
                            
                            <div class="form-group">
                                <label>Способ связи (VK, Telegram, соцсети)</label>
                                <input type="text" id="reporter_contact_link" ${isReadOnly ? 'readonly' : ''} 
                                    value="${kusp ? escapeHtml(kusp.reporter_contact_link || '') : ''}" 
                                    placeholder="Ссылка на соц.сеть">
                            </div>
                        </div>
                    </div>
                    
                    <hr style="margin: 20px 0;">
                    
                    <h4>Результаты работы и проверки</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div>
                            <div class="form-group">
								<label>Результаты расследования</label>
								<textarea id="team_results" rows="20" style="resize: vertical;" ${isReadOnly ? 'readonly' : ''} 
									placeholder="Результаты осмотра, выявлено и т.д.">${kusp ? escapeHtml(kusp.team_results || '') : ''}</textarea>
							</div>
                            
                            <div class="form-group">
                                <label>Руководитель, поручивший проверку</label>
                                ${isReadOnly ? 
                                    `<input type="text" value="${kusp ? escapeHtml(kusp.assigned_by_name || '') : ''}" readonly>` :
                                    `<select id="assigned_by_id">
                                        <option value="">Не выбран</option>
                                        ${employees.map(emp => 
                                            `<option value="${emp.auth_user_id}" ${kusp?.assigned_by_id === emp.auth_user_id ? 'selected' : ''}>
                                                ${escapeHtml(emp.rank || '')} ${escapeHtml(emp.nickname)}
                                            </option>`
                                        ).join('')}
                                    </select>`
                                }
                            </div>
                            
                            <div class="form-group">
                                <label>Сотрудник, которому поручена проверка</label>
                                ${isReadOnly ? 
                                    `<input type="text" value="${kusp ? escapeHtml(kusp.assigned_to_name || '') : ''}" readonly>` :
                                    `<select id="assigned_to_id">
                                        <option value="">Не выбран</option>
                                        ${employees.map(emp => 
                                            `<option value="${emp.auth_user_id}" ${kusp?.assigned_to_id === emp.auth_user_id ? 'selected' : ''}>
                                                ${escapeHtml(emp.rank || '')} ${escapeHtml(emp.nickname)}
                                            </option>`
                                        ).join('')}
                                    </select>`
                                }
                            </div>
                        </div>
                        
                        <div>
                            <div class="form-group">
                                <label>Срок проверки (установленный)</label>
                                <input type="date" id="review_deadline" ${isReadOnly ? 'readonly' : ''} 
                                    value="${kusp?.review_deadline ? kusp.review_deadline.slice(0,10) : ''}">
                            </div>
                            
                            <div class="form-group">
                                <label>Фактический срок рассмотрения</label>
                                <input type="date" id="review_completed_date" ${isReadOnly ? 'readonly' : ''} 
                                    value="${kusp?.review_completed_date ? kusp.review_completed_date.slice(0,10) : ''}">
                            </div>
                            
                            <div class="form-group">
                                <label>Должностные лица, продлившие срок</label>
                                <input type="text" id="extended_by" ${isReadOnly ? 'readonly' : ''} 
                                    value="${kusp ? escapeHtml(kusp.extended_by || '') : ''}" 
                                    placeholder="ФИО продливших срок">
                            </div>
                        </div>
                    </div>
                    
                    <hr style="margin: 20px 0;">
                    
                    <h4>Статус и результаты</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="form-group">
                            <label>Статус</label>
                            <select id="status" ${isReadOnly ? 'disabled' : ''}>
                                <option value="new" ${kusp?.status === 'new' ? 'selected' : ''}>Новая</option>
                                <option value="in_progress" ${kusp?.status === 'in_progress' ? 'selected' : ''}>В работе</option>
                                <option value="under_review" ${kusp?.status === 'under_review' ? 'selected' : ''}>На проверке</option>
                                <option value="closed" ${kusp?.status === 'closed' ? 'selected' : ''}>Закрыта</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Результаты рассмотрения</label>
                            <select id="review_result" ${isReadOnly ? 'disabled' : ''}>
                                <option value="">Не определено</option>
                                <option value="возбуждено_уголовное" ${kusp?.review_result === 'возбуждено_уголовное' ? 'selected' : ''}>Возбуждено уголовное дело</option>
                                <option value="отказ_в_возбуждении" ${kusp?.review_result === 'отказ_в_возбуждении' ? 'selected' : ''}>Отказ в возбуждении</option>
                                <option value="административное" ${kusp?.review_result === 'административное' ? 'selected' : ''}>Административное правонарушение</option>
                                <option value="передано_по_подследственности" ${kusp?.review_result === 'передано_по_подследственности' ? 'selected' : ''}>Передано по подследственности</option>
                                <option value="приобщено_к_другому" ${kusp?.review_result === 'приобщено_к_другому' ? 'selected' : ''}>Приобщено к другому делу</option>
                            </select>
                        </div>
                        
                        <div class="form-group" style="grid-column: span 2;">
							<label>Дополнительные заметки</label>
							<textarea id="notes" rows="2" style="resize: vertical;" ${isReadOnly ? 'readonly' : ''}>${kusp ? escapeHtml(kusp.notes || '') : ''}</textarea>
						</div>
                    </div>
                    
                    ${!isReadOnly ? `
                        <div class="flex-row" style="justify-content: flex-end; margin-top: 20px;">
                            <button type="button" id="cancelKuspBtn" class="secondary">Отмена</button>
                            <button type="submit" id="saveKuspBtn">${mode === 'create' ? 'Создать' : 'Сохранить'}</button>
                        </div>
                    ` : `
                        <div class="flex-row" style="justify-content: flex-end; margin-top: 20px;">
                            <button type="button" id="closeKuspBtn" class="secondary">Закрыть</button>
                        </div>
                    `}
                </form>
                
                ${kusp && mode !== 'create' ? `
                    <div style="margin-top: 30px; border-top: 2px dashed #28a745; padding-top: 20px;">
                        <h4 style="color: #28a745;">🎫 Талон-уведомление (для заявителя)</h4>
                        <div style="background: #f0fff0; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; font-family: monospace;">
                            <p><strong>УГИБДД МВД по Республике Провинция</strong></p>
                            <p><strong>ТАЛОН-УВЕДОМЛЕНИЕ № ${escapeHtml(kusp.ticket_number || kusp.kusp_number)}</strong></p>
                            <hr>
                            <p><strong>Заявление принято:</strong> ${UI.formatDate(kusp.received_datetime)}</p>
                            <p><strong>Регистрационный номер КУСП:</strong> ${escapeHtml(kusp.kusp_number)}</p>
                            <p><strong>Оперативный дежурный:</strong> ${escapeHtml(kusp.received_by_name)}</p>
                            <p><strong>Наименование органа:</strong> УГИБДД МВД по Республике Провинция</p>
                            <p><strong>Адрес:</strong> г. Мирный, Кутузовская набережная,д. 2</p>
                            <p><strong>Телефон дежурной части:</strong> 8 (222) 555-58-48</p>
                            <hr>
                            <p><strong>Подпись оперативного дежурного:</strong> ____________________</p>
                            <p style="font-size: 0.8em; color: #666;">Талон действителен при предъявлении документа, удостоверяющего личность</p>
                        </div>
                        <button class="small secondary" onclick="KUSP.saveTicketAsPNG('${kusp.id}', 'notification')" style="margin-top: 10px;">
                            💾 Сохранить талон-уведомление
                        </button>
                    </div>
                ` : ''}
                
                ${kusp && mode !== 'create' ? `
                    <div style="margin-top: 30px; border-top: 2px dashed #dc3545; padding-top: 20px;">
                        <h4 style="color: #dc3545;">📋 Талон-корешок (остается в деле)</h4>
                        <div style="background: #fff0f0; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545; font-family: monospace;">
                            <p><strong>УГИБДД МВД по Республике Провинция</strong></p>
                            <p><strong>ТАЛОН-КОРЕШОК № ${escapeHtml(kusp.ticket_number || kusp.kusp_number)}</strong></p>
                            <hr>
                            <p><strong>Сведения о заявителе:</strong> ${escapeHtml(kusp.reporter_name)}</p>
                            <p><strong>Краткое содержание:</strong> ${escapeHtml(kusp.short_content)}</p>
                            <p><strong>Регистрационный номер КУСП:</strong> ${escapeHtml(kusp.kusp_number)}</p>
                            <p><strong>Сотрудник, принявший заявление:</strong> ${escapeHtml(kusp.received_by_name)}</p>
                            <p><strong>Дата и время приема:</strong> ${UI.formatDate(kusp.received_datetime)}</p>
                            <hr>
                            <p><strong>Подпись сотрудника:</strong> ____________________</p>
                        </div>
                        <button class="small secondary" onclick="KUSP.saveTicketAsPNG('${kusp.id}', 'stub')" style="margin-top: 10px;">
                            💾 Сохранить талон-корешок
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

        document.body.appendChild(modal);

        modal.querySelector('.modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };

        if (mode === 'create' || mode === 'edit') {
            const cancelBtn = document.getElementById('cancelKuspBtn');
            if (cancelBtn) {
                cancelBtn.onclick = () => modal.remove();
            }
            
            document.getElementById('kuspForm').onsubmit = async (e) => {
                e.preventDefault();
                
                if (mode === 'create') {
                    await createKusp();
                } else {
                    await updateKusp(kusp.id);
                }
                modal.remove();
            };
        } else {
            const closeBtn = document.getElementById('closeKuspBtn');
            if (closeBtn) closeBtn.onclick = () => modal.remove();
        }
    }
    
    // Создание новой записи КУСП
    async function createKusp() {
        Auth.ping();
        
        const kuspNumber = await generateKuspNumber();
        
        const receivedByAuthId = document.getElementById('received_by_id')?.value;
        
        console.log('Selected received_by auth_user_id:', receivedByAuthId);
        
        if (!receivedByAuthId) {
            UI.showNotification('Выберите сотрудника, принявшего заявление', 'error');
            return false;
        }
        
        const { data: employee, error: empError } = await supabaseClient
            .from('employees')
            .select('id, auth_user_id, nickname, rank')
            .eq('auth_user_id', receivedByAuthId)
            .single();
        
        console.log('Found employee:', employee);
        
        if (empError || !employee) {
            console.error('Employee fetch error:', empError);
            UI.showNotification('Выбранный сотрудник не найден в базе', 'error');
            return false;
        }
        
        const receivedByName = `${employee.rank || ''} ${employee.nickname}`.trim();
        
        const assignedByAuthId = document.getElementById('assigned_by_id')?.value || null;
        const assignedToAuthId = document.getElementById('assigned_to_id')?.value || null;
        
        let assignedByName = null;
        let assignedToName = null;
        let assignedById = null;
        let assignedToId = null;
        
        if (assignedByAuthId) {
            const { data: assignedByData } = await supabaseClient
                .from('employees')
                .select('id, nickname, rank')
                .eq('auth_user_id', assignedByAuthId)
                .single();
            
            if (assignedByData) {
                assignedById = assignedByData.id;
                assignedByName = `${assignedByData.rank || ''} ${assignedByData.nickname}`.trim();
            }
        }
        
        if (assignedToAuthId) {
            const { data: assignedToData } = await supabaseClient
                .from('employees')
                .select('id, nickname, rank')
                .eq('auth_user_id', assignedToAuthId)
                .single();
            
            if (assignedToData) {
                assignedToId = assignedToData.id;
                assignedToName = `${assignedToData.rank || ''} ${assignedToData.nickname}`.trim();
            }
        }
        
        const formData = {
            kusp_number: kuspNumber,
            ticket_number: document.getElementById('ticket_number')?.value.trim() || kuspNumber,
            received_datetime: document.getElementById('received_datetime')?.value,
            received_form: document.getElementById('received_form')?.value,
            received_by_id: receivedByAuthId,
            received_by_name: receivedByName,
            reporter_name: document.getElementById('reporter_name')?.value.trim(),
            reporter_birth_date: document.getElementById('reporter_birth_date')?.value || null,
            reporter_address: document.getElementById('reporter_address')?.value.trim() || null,
            reporter_passport: document.getElementById('reporter_passport')?.value.trim() || null,
            reporter_contact_link: document.getElementById('reporter_contact_link')?.value.trim() || null,
            short_content: document.getElementById('short_content')?.value.trim(),
            team_results: document.getElementById('team_results')?.value.trim() || null,
            assigned_by_id: assignedByAuthId,
            assigned_by_name: assignedByName,
            assigned_to_id: assignedToAuthId,
            assigned_to_name: assignedToName,
            review_deadline: document.getElementById('review_deadline')?.value || null,
            review_completed_date: document.getElementById('review_completed_date')?.value || null,
            extended_by: document.getElementById('extended_by')?.value.trim() || null,
            review_result: document.getElementById('review_result')?.value || null,
            status: document.getElementById('status')?.value || 'new',
            notes: document.getElementById('notes')?.value.trim() || null
        };

        console.log('Form data to insert:', formData);

        if (!formData.received_datetime || !formData.received_form || !formData.received_by_id || 
            !formData.reporter_name || !formData.short_content) {
            UI.showNotification('Заполните все обязательные поля', 'error');
            return false;
        }

        try {
            const { error } = await supabaseClient
                .from('kusps')
                .insert([formData]);

            if (error) {
                console.error('Insert error:', error);
                if (error.code === '42501') {
                    UI.showNotification('Ошибка прав доступа: вы не можете создавать записи', 'error');
                } else if (error.code === '23503') {
                    UI.showNotification(`Ошибка внешнего ключа: сотрудник с auth_user_id ${receivedByAuthId} не существует`, 'error');
                } else {
                    UI.showNotification('Ошибка при создании записи: ' + error.message, 'error');
                }
                return false;
            }

            // Логируем создание записи КУСП
            Logger.log(Logger.ACTION_TYPES.KUSP_CREATE, {
				kusp_number: kuspNumber,
				reporter_name: formData.reporter_name,
				received_by_name: receivedByName
			}, 'kusp', kuspNumber);

            UI.showNotification('Запись КУСП создана', 'success');
            await loadKuspList();
            filterAndRenderKusp();
            
            return true;
        } catch (error) {
            console.error('Error in createKusp:', error);
            UI.showNotification('Ошибка при создании записи: ' + error.message, 'error');
            return false;
        }
    }

    // Обновление записи КУСП
	async function updateKusp(id) {
		Auth.ping();
		
		const kusp = kuspListCache.find(k => k.id == id);
		if (!kusp) return false;

		// Сохраняем старые значения для сравнения
		const oldKusp = {...kusp};

		const receivedByAuthId = document.getElementById('received_by_id')?.value;
		
		if (!receivedByAuthId) {
			UI.showNotification('Выберите сотрудника, принявшего заявление', 'error');
			return false;
		}
		
		const { data: employee, error: empError } = await supabaseClient
			.from('employees')
			.select('id, auth_user_id, nickname, rank')
			.eq('auth_user_id', receivedByAuthId)
			.single();
		
		if (empError || !employee) {
			console.error('Employee fetch error:', empError);
			UI.showNotification('Выбранный сотрудник не найден в базе', 'error');
			return false;
		}
		
		const receivedByName = `${employee.rank || ''} ${employee.nickname}`.trim();
		
		const assignedByAuthId = document.getElementById('assigned_by_id')?.value || null;
		const assignedToAuthId = document.getElementById('assigned_to_id')?.value || null;
		
		let assignedByName = null;
		let assignedToName = null;
		
		if (assignedByAuthId) {
			const { data: assignedByData } = await supabaseClient
				.from('employees')
				.select('nickname, rank')
				.eq('auth_user_id', assignedByAuthId)
				.single();
			
			if (assignedByData) {
				assignedByName = `${assignedByData.rank || ''} ${assignedByData.nickname}`.trim();
			}
		}
		
		if (assignedToAuthId) {
			const { data: assignedToData } = await supabaseClient
				.from('employees')
				.select('nickname, rank')
				.eq('auth_user_id', assignedToAuthId)
				.single();
			
			if (assignedToData) {
				assignedToName = `${assignedToData.rank || ''} ${assignedToData.nickname}`.trim();
			}
		}

		const formData = {
			ticket_number: document.getElementById('ticket_number')?.value.trim() || kusp.kusp_number,
			received_datetime: document.getElementById('received_datetime')?.value,
			received_form: document.getElementById('received_form')?.value,
			received_by_id: receivedByAuthId,
			received_by_name: receivedByName,
			reporter_name: document.getElementById('reporter_name')?.value.trim(),
			reporter_birth_date: document.getElementById('reporter_birth_date')?.value || null,
			reporter_address: document.getElementById('reporter_address')?.value.trim() || null,
			reporter_passport: document.getElementById('reporter_passport')?.value.trim() || null,
			reporter_contact_link: document.getElementById('reporter_contact_link')?.value.trim() || null,
			short_content: document.getElementById('short_content')?.value.trim(),
			team_results: document.getElementById('team_results')?.value.trim() || null,
			assigned_by_id: assignedByAuthId,
			assigned_by_name: assignedByName,
			assigned_to_id: assignedToAuthId,
			assigned_to_name: assignedToName,
			review_deadline: document.getElementById('review_deadline')?.value || null,
			review_completed_date: document.getElementById('review_completed_date')?.value || null,
			extended_by: document.getElementById('extended_by')?.value.trim() || null,
			review_result: document.getElementById('review_result')?.value || null,
			status: document.getElementById('status')?.value || 'new',
			notes: document.getElementById('notes')?.value.trim() || null
		};

		if (!formData.received_datetime || !formData.received_form || !formData.received_by_id || 
			!formData.reporter_name || !formData.short_content) {
			UI.showNotification('Заполните все обязательные поля', 'error');
			return false;
		}

		try {
			const { error } = await supabaseClient
				.from('kusps')
				.update(formData)
				.eq('id', id);

			if (error) {
				console.error('Update error:', error);
				if (error.code === '42501') {
					UI.showNotification('Ошибка прав доступа: вы не можете редактировать эту запись', 'error');
				} else if (error.code === '23503') {
					UI.showNotification('Ошибка внешнего ключа: выбранный сотрудник не существует', 'error');
				} else {
					UI.showNotification('Ошибка при обновлении записи: ' + error.message, 'error');
				}
				return false;
			}

			// ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ВСЕХ ИЗМЕНЕНИЙ
			// Полный список всех полей КУСП с человеко-читаемыми названиями
			const allFields = {
				// Основная информация
				kusp_number: 'Номер КУСП',
				ticket_number: 'Номер талона-уведомления',
				received_datetime: 'Дата и время поступления',
				received_form: 'Форма поступления',
				received_by_id: 'Принявший сотрудник (ID)',
				received_by_name: 'Принявший сотрудник (ФИО)',
				
				// Данные о заявителе
				reporter_name: 'ФИО заявителя',
				reporter_birth_date: 'Дата рождения заявителя',
				reporter_address: 'Адрес заявителя',
				reporter_passport: 'Паспортные данные',
				reporter_contact_link: 'Способ связи',
				
				// Содержание
				short_content: 'Содержание заявления',
				
				// Результаты работы
				team_results: 'Результаты расследования',
				assigned_by_id: 'Поручивший руководитель (ID)',
				assigned_by_name: 'Поручивший руководитель (ФИО)',
				assigned_to_id: 'Исполнитель (ID)',
				assigned_to_name: 'Исполнитель (ФИО)',
				review_deadline: 'Срок проверки',
				review_completed_date: 'Дата завершения',
				extended_by: 'Продлившие срок',
				
				// Статус и результаты
				review_result: 'Результат рассмотрения',
				status: 'Статус',
				notes: 'Дополнительные заметки'
			};

			const changes = {};
			
			// Сравниваем все поля из списка allFields
			Object.entries(allFields).forEach(([field, label]) => {
				// Пропускаем поля, которые не должны меняться или являются служебными
				if (field === 'kusp_number') return; // Номер КУСП не должен меняться
				
				const oldValue = oldKusp[field];
				const newValue = formData[field];
				
				// Функция для форматирования значения для отображения
				const formatValue = (value) => {
					if (value === null || value === undefined || value === '') return 'Не указано';
					
					// Для дат форматируем красиво
					if (field.includes('date') || field.includes('datetime')) {
						if (field === 'received_datetime' && value) {
							return new Date(value).toLocaleString('ru-RU');
						}
						if (value && value.includes('T')) {
							return value.split('T')[0];
						}
					}
					
					// Для ID полей добавляем пояснение
					if (field.includes('_id')) {
						return 'ID: ' + value;
					}
					
					return String(value);
				};
				
				// Сравниваем значения (с учетом null/undefined/пустых строк)
				const normalizedOld = oldValue === null || oldValue === undefined ? '' : oldValue;
				const normalizedNew = newValue === null || newValue === undefined ? '' : newValue;
				
				if (String(normalizedOld) !== String(normalizedNew)) {
					changes[label] = {
						было: formatValue(oldValue),
						стало: formatValue(newValue)
					};
				}
			});

			// Проверяем также изменения в архивированных полях (на случай удаления сотрудников)
			if (oldKusp.received_by_name_archived !== formData.received_by_name_archived) {
				changes['Архивированный принявший'] = {
					было: oldKusp.received_by_name_archived || 'Не указано',
					стало: formData.received_by_name_archived || 'Не указано'
				};
			}
			
			if (oldKusp.assigned_by_name_archived !== formData.assigned_by_name_archived) {
				changes['Архивированный поручитель'] = {
					было: oldKusp.assigned_by_name_archived || 'Не указано',
					стало: formData.assigned_by_name_archived || 'Не указано'
				};
			}
			
			if (oldKusp.assigned_to_name_archived !== formData.assigned_to_name_archived) {
				changes['Архивированный исполнитель'] = {
					было: oldKusp.assigned_to_name_archived || 'Не указано',
					стало: formData.assigned_to_name_archived || 'Не указано'
				};
			}

			// Логируем, если были изменения
			if (Object.keys(changes).length > 0) {
				await Logger.log(Logger.ACTION_TYPES.KUSP_UPDATE, {
					kusp_number: kusp.kusp_number,
					changes: changes,
					updated_by: Auth.getCurrentUser()?.nickname,
					changes_count: Object.keys(changes).length
				}, 'kusp', kusp.kusp_number);
				
				console.log(`Логирование КУСП: обнаружено ${Object.keys(changes).length} изменений`, changes);
			} else {
				// Если изменений нет, но пользователь нажал сохранить
				await Logger.log('kusp_update_attempt', {
					kusp_number: kusp.kusp_number,
					message: 'Попытка сохранения без изменений',
					updated_by: Auth.getCurrentUser()?.nickname
				}, 'kusp', kusp.kusp_number);
			}

			UI.showNotification('Запись КУСП обновлена', 'success');
			await loadKuspList();
			filterAndRenderKusp();
			
			return true;
		} catch (error) {
			console.error('Error in updateKusp:', error);
			UI.showNotification('Ошибка при обновлении записи: ' + error.message, 'error');
			return false;
		}
	}

    // Удаление записи КУСП
    async function deleteKusp(id) {
        Auth.ping();
        
        if (!canDeleteKusp()) {
            UI.showNotification('У вас нет прав на удаление записей', 'error');
            return;
        }

        const kusp = kuspListCache.find(k => k.id == id);
        if (!kusp) return;

        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal-overlay';
        confirmModal.innerHTML = `
            <div class="modal-container" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>Подтверждение удаления</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-content">
                    <p>Вы уверены, что хотите удалить запись КУСП <strong>№${escapeHtml(kusp.kusp_number)}</strong>?</p>
                    <p style="color: #dc3545; font-size: 0.9rem;">Это действие необратимо.</p>
                    <div class="flex-row" style="justify-content: flex-end;">
                        <button id="cancelDeleteBtn" class="secondary">Отмена</button>
                        <button id="confirmDeleteBtn" style="background: #dc3545;">Удалить</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);

        confirmModal.querySelector('.modal-close').onclick = () => confirmModal.remove();
        confirmModal.onclick = (e) => {
            if (e.target === confirmModal) confirmModal.remove();
        };

        document.getElementById('cancelDeleteBtn').onclick = () => confirmModal.remove();
        
        document.getElementById('confirmDeleteBtn').onclick = async () => {
            try {
                // Логируем удаление перед фактическим удалением
                Logger.log(Logger.ACTION_TYPES.KUSP_DELETE, {
					kusp_number: kusp.kusp_number,
					reporter_name: kusp.reporter_name,
					received_by_name: kusp.received_by_name
				}, 'kusp', kusp.kusp_number);
                
                const { error } = await supabaseClient
                    .from('kusps')
                    .delete()
                    .eq('id', id);

                if (error) {
                    UI.showNotification('Ошибка при удалении: ' + error.message, 'error');
                    return;
                }

                UI.showNotification('Запись удалена', 'success');
                confirmModal.remove();
                await loadKuspList();
                filterAndRenderKusp();
            } catch (error) {
                UI.showNotification('Ошибка при удалении: ' + error.message, 'error');
            }
        };
    }

    // Фильтрация и отображение списка
    function filterAndRenderKusp() {
        const search = document.getElementById('kuspSearch')?.value.toLowerCase() || '';
        const status = document.getElementById('kuspFilterStatus')?.value || '';
        const filtered = filterKuspList(search, status);
        renderKuspList(filtered);
    }

    // Функция экранирования HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Инициализация списка КУСП
    async function initKuspList() {
        try {
            Auth.ping();
            
            const clone = UI.loadTemplate('kuspList');
            UI.clearMain();
            document.getElementById('mainApp').appendChild(clone);
            UI.setActiveTab(UI.getElements().navKusp);

            await loadKuspList();
            filterAndRenderKusp();

            const searchInput = document.getElementById('kuspSearch');
            const filterSelect = document.getElementById('kuspFilterStatus');
            const createBtn = document.getElementById('kuspCreateOpen');

            if (searchInput) {
                searchInput.addEventListener('input', filterAndRenderKusp);
            }
            
            if (filterSelect) {
                filterSelect.addEventListener('change', filterAndRenderKusp);
            }
            
            if (createBtn) {
                createBtn.onclick = () => openKuspModal(null, 'create');
            }

        } catch (error) {
            console.error('Error in initKuspList:', error);
            UI.showNotification('Ошибка при загрузке раздела КУСП', 'error');
        }
    }

    return {
        initKuspList,
        saveTicketAsPNG
    };
})();

window.KUSP = KUSP;