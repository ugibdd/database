// Модуль КУСП (БЕЗОПАСНАЯ ВЕРСИЯ)
const KUSP = (function() {
    let kuspListCache = [];

    // Загрузка списка КУСП через secureRequest
    async function loadKuspList() {
        try {
            Auth.ping(); // Сбрасываем таймер
            
            const { data, error } = await Auth.secureRequest('kusps', 'select');
            
            if (error) {
                console.error('Error loading kusps:', error);
                UI.showNotification('Ошибка загрузки КУСП: ' + error.message, 'error');
                return [];
            }
            
            // Сортируем по дате создания (новые сверху)
            kuspListCache = (data || []).sort((a, b) => 
                new Date(b.created_at) - new Date(a.created_at)
            ).slice(0, 200);
            
            return kuspListCache;
        } catch (error) {
            console.error('Error in loadKuspList:', error);
            UI.showNotification('Ошибка загрузки КУСП: ' + error.message, 'error');
            return [];
        }
    }

    // Генерация номера КУСП
    function generateKuspNumber() {
        const d = new Date();
        return `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}-${String(d.getTime()).slice(-6)}`;
    }

    // Фильтрация списка
    function filterKuspList(search, status) {
        return kuspListCache.filter(k => 
            (!status || k.status === status) &&
            (!search || (
                k.kusp_number?.toLowerCase().includes(search.toLowerCase()) || 
                k.reporter_name?.toLowerCase().includes(search.toLowerCase())
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
            div.innerHTML = `
                <div>
                    <div class="item-title">${escapeHtml(k.kusp_number || 'б/н')} ${UI.getStatusBadge(k.status)}</div>
                    <div class="item-meta">${escapeHtml(k.reporter_name || '—')} · ${escapeHtml(k.type || '')}</div>
                </div>
                <button class="small" data-id="${k.id}" data-action="view">Открыть</button>
            `;
            container.appendChild(div);
        });

        container.querySelectorAll('button[data-action="view"]').forEach(btn => {
            btn.onclick = () => openKuspModal(btn.dataset.id);
        });
    }

    // Открыть модальное окно с формой создания
    function openCreateModal() {
        Auth.ping(); // Сбрасываем таймер при открытии модалки
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'kuspModal';
        
        const form = UI.loadTemplate('kuspCreate');
        
        modal.innerHTML = `
            <div class="modal-container">
                <div class="modal-header">
                    <h3>Новая запись КУСП</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-content"></div>
            </div>
        `;
        
        modal.querySelector('.modal-content').appendChild(form);
        document.body.appendChild(modal);
        
        // Обработчики
        modal.querySelector('.modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
        
        document.getElementById('cancelCreateBtn').onclick = () => modal.remove();
        document.getElementById('createKuspBtn').onclick = async () => {
            const success = await createKusp();
            if (success) {
                modal.remove();
            }
        };
    }

    // Открыть модальное окно с деталями КУСП
    async function openKuspModal(id) {
        Auth.ping(); // Сбрасываем таймер при открытии модалки
        
        try {
            // Используем secureRequest для получения конкретной записи
            const { data, error } = await Auth.secureRequest('kusps', 'select');
            
            if (error || !data) {
                UI.showNotification('Ошибка загрузки записи', 'error');
                return;
            }

            const kusp = data.find(k => k.id == id);
            if (!kusp) return;

            const employees = Admin.getEmployeesCache();
            
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.id = 'kuspModal';
            
            modal.innerHTML = `
                <div class="modal-container modal-large">
                    <div class="modal-header">
                        <h3>КУСП №${escapeHtml(kusp.kusp_number || '')}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-content">
                        <div class="modal-grid">
                            <div class="modal-main">
                                <div class="info-row"><span class="info-label">Статус</span><span class="info-value">${UI.getStatusBadge(kusp.status)}</span></div>
                                <div class="info-row"><span class="info-label">Заявитель</span><span class="info-value">${escapeHtml(kusp.reporter_name || '')}</span></div>
                                <div class="info-row"><span class="info-label">Контакт</span><span class="info-value">${escapeHtml(kusp.contact || '')}</span></div>
                                <div class="info-row"><span class="info-label">Тип</span><span class="info-value">${escapeHtml(kusp.type || '')}</span></div>
                                <div class="info-row"><span class="info-label">Место</span><span class="info-value">${escapeHtml(kusp.location || '')}</span></div>
                                <div class="info-row"><span class="info-label">Приоритет</span><span class="info-value">${escapeHtml(kusp.priority || '')}</span></div>
                                <div class="info-row"><span class="info-label">Описание</span><span class="info-value">${escapeHtml(kusp.description || '')}</span></div>
                                <div class="info-row"><span class="info-label">Ответственный</span><span class="info-value" id="detailAssigned">${escapeHtml(kusp.assigned_to || '—')}</span></div>
                                <div class="info-row"><span class="info-label">Создал</span><span class="info-value">${escapeHtml(kusp.created_by || '—')}</span></div>
                                <div class="info-row"><span class="info-label">Дата</span><span class="info-value">${UI.formatDate(kusp.created_at)}</span></div>
                            </div>
                            <div class="modal-sidebar">
                                <h4>Управление</h4>
                                <select id="assignSelect" style="margin-bottom:12px;"></select>
                                <select id="statusSelect" style="margin-bottom:12px;">
                                    <option value="new">Новая</option>
                                    <option value="in_progress">В работе</option>
                                    <option value="closed">Закрыта</option>
                                </select>
                                <textarea id="noteText" placeholder="Заметка" rows="3"></textarea>
                                <div class="flex-row" style="margin-top:12px;">
                                    <button id="saveKuspChanges" class="small">Сохранить</button>
                                    <button id="addNoteBtn" class="secondary small">Заметка</button>
                                </div>
                                
                                <h4 style="margin:20px 0 12px;">История</h4>
                                <div id="kuspHistory" class="history-log"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Заполнение селектов
            document.getElementById('statusSelect').value = kusp.status || 'new';

            const assignSelect = document.getElementById('assignSelect');
            assignSelect.innerHTML = '<option value="">— не назначен —</option>';
            employees.forEach(emp => {
                const opt = new Option(emp.nickname, emp.nickname);
                if (emp.nickname === kusp.assigned_to) opt.selected = true;
                assignSelect.appendChild(opt);
            });

            // Отображение истории
            const historyEl = document.getElementById('kuspHistory');
            historyEl.innerHTML = '';
            (kusp.history || []).slice().reverse().forEach(h => {
                const historyDiv = document.createElement('div');
                historyDiv.style.borderBottom = '1px solid #edf2f8';
                historyDiv.style.padding = '8px 0';
                historyDiv.innerHTML = `
                    <b>${escapeHtml(h.action)}</b> ${escapeHtml(h.user)} · ${UI.formatDate(h.ts)}<br>
                    ${escapeHtml(h.note || '')}
                `;
                historyEl.appendChild(historyDiv);
            });

            // Обработчики
            modal.querySelector('.modal-close').onclick = () => modal.remove();
            modal.onclick = (e) => {
                if (e.target === modal) modal.remove();
            };

            document.getElementById('saveKuspChanges').onclick = async () => {
                Auth.ping(); // Сбрасываем таймер при сохранении
                
                const assigned = assignSelect.value || null;
                const status = document.getElementById('statusSelect').value;
                const note = `Обновление: статус ${status}, ответственный ${assigned || '—'}`;
                const newEntry = {
                    ts: new Date().toISOString(),
                    user: Auth.getCurrentUser().nickname,
                    action: 'Обновление',
                    note
                };
                const updatedHistory = [...(kusp.history || []), newEntry];
                
                try {
                    const { error } = await Auth.secureRequest('kusps', 'update', 
                        { assigned_to: assigned, status, history: updatedHistory }, 
                        id
                    );
                    
                    if (error) {
                        UI.showNotification('Ошибка при сохранении: ' + error.message, 'error');
                        return;
                    }
                    
                    UI.showNotification('Изменения сохранены', 'success');
                    await loadKuspList();
                    filterAndRenderKusp();
                    modal.remove();
                } catch (error) {
                    UI.showNotification('Ошибка при сохранении: ' + error.message, 'error');
                }
            };

            document.getElementById('addNoteBtn').onclick = async () => {
                Auth.ping(); // Сбрасываем таймер при добавлении заметки
                
                const note = document.getElementById('noteText').value.trim();
                if (!note) return;
                
                const newEntry = {
                    ts: new Date().toISOString(),
                    user: Auth.getCurrentUser().nickname,
                    action: 'Заметка',
                    note
                };
                const updatedHistory = [...(kusp.history || []), newEntry];
                
                try {
                    const { error } = await Auth.secureRequest('kusps', 'update',
                        { history: updatedHistory },
                        id
                    );
                    
                    if (error) {
                        UI.showNotification('Ошибка при добавлении заметки: ' + error.message, 'error');
                        return;
                    }
                    
                    UI.showNotification('Заметка добавлена', 'success');
                    await loadKuspList();
                    filterAndRenderKusp();
                    
                    // Обновить историю в модалке
                    const updatedHistoryEl = document.getElementById('kuspHistory');
                    if (updatedHistoryEl) {
                        updatedHistoryEl.innerHTML = '';
                        [...updatedHistory].reverse().forEach(h => {
                            const historyDiv = document.createElement('div');
                            historyDiv.style.borderBottom = '1px solid #edf2f8';
                            historyDiv.style.padding = '8px 0';
                            historyDiv.innerHTML = `
                                <b>${escapeHtml(h.action)}</b> ${escapeHtml(h.user)} · ${UI.formatDate(h.ts)}<br>
                                ${escapeHtml(h.note || '')}
                            `;
                            updatedHistoryEl.appendChild(historyDiv);
                        });
                    }
                    document.getElementById('noteText').value = '';
                    
                    // Обновляем кэш
                    kusp.history = updatedHistory;
                    
                } catch (error) {
                    UI.showNotification('Ошибка при добавлении заметки: ' + error.message, 'error');
                }
            };
        } catch (error) {
            console.error('Error in openKuspModal:', error);
            UI.showNotification('Ошибка при открытии записи', 'error');
        }
    }

    // Создание новой записи КУСП
    async function createKusp() {
        Auth.ping(); // Сбрасываем таймер при создании
        
        const reporter = document.getElementById('new_reporter')?.value.trim();
        const contact = document.getElementById('new_contact')?.value.trim();
        const type = document.getElementById('new_type')?.value;
        const location = document.getElementById('new_location')?.value.trim();
        const priority = document.getElementById('new_priority')?.value;
        const description = document.getElementById('new_description')?.value.trim();
        const currentUser = Auth.getCurrentUser();

        if (!reporter || !description) {
            UI.showNotification('Заявитель и описание обязательны', 'error');
            return false;
        }

        const kusp_number = generateKuspNumber();
        const payload = {
            kusp_number,
            created_by: currentUser.nickname,
            reporter_name: reporter,
            contact,
            type,
            location,
            priority,
            description,
            status: 'new',
            created_at: new Date().toISOString(),
            history: [{
                ts: new Date().toISOString(),
                user: currentUser.nickname,
                action: 'Создан',
                note: description
            }]
        };

        try {
            const { error } = await Auth.secureRequest('kusps', 'insert', [payload]);

            if (error) {
                UI.showNotification('Ошибка при создании записи: ' + error.message, 'error');
                return false;
            }

            UI.showNotification('Запись КУСП создана', 'success');
            await loadKuspList();
            filterAndRenderKusp();
            
            return true;
        } catch (error) {
            UI.showNotification('Ошибка при создании записи: ' + error.message, 'error');
            return false;
        }
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
            Auth.ping(); // Сбрасываем таймер при входе в раздел
            
            const clone = UI.loadTemplate('kuspList');
            UI.clearMain();
            document.getElementById('mainApp').appendChild(clone);
            UI.setActiveTab(UI.getElements().navKusp);

            await Admin.loadEmployeesList();
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
                createBtn.onclick = openCreateModal;
            }

        } catch (error) {
            console.error('Error in initKuspList:', error);
            UI.showNotification('Ошибка при загрузке раздела КУСП', 'error');
        }
    }

    return {
        initKuspList
    };
})();

window.KUSP = KUSP;