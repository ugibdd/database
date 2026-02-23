// Модуль КУСП
const KUSP = (function() {
    let kuspListCache = [];

    // Загрузка списка КУСП
    async function loadKuspList() {
        const { data } = await supabaseClient
            .from('kusps')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);
        
        kuspListCache = data || [];
        return kuspListCache;
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
                k.kusp_number?.toLowerCase().includes(search) || 
                k.reporter_name?.toLowerCase().includes(search)
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
                    <div class="item-title">${k.kusp_number || 'б/н'} ${UI.getStatusBadge(k.status)}</div>
                    <div class="item-meta">${k.reporter_name || '—'} · ${k.type || ''}</div>
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
        const { data, error } = await supabaseClient
            .from('kusps')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error || !data) return;

        const employees = Admin.getEmployeesCache();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'kuspModal';
        
        modal.innerHTML = `
            <div class="modal-container modal-large">
                <div class="modal-header">
                    <h3>КУСП №${data.kusp_number || ''}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-content">
                    <div class="modal-grid">
                        <div class="modal-main">
                            <div class="info-row"><span class="info-label">Статус</span><span class="info-value">${UI.getStatusBadge(data.status)}</span></div>
                            <div class="info-row"><span class="info-label">Заявитель</span><span class="info-value">${data.reporter_name || ''}</span></div>
                            <div class="info-row"><span class="info-label">Контакт</span><span class="info-value">${data.contact || ''}</span></div>
                            <div class="info-row"><span class="info-label">Тип</span><span class="info-value">${data.type || ''}</span></div>
                            <div class="info-row"><span class="info-label">Место</span><span class="info-value">${data.location || ''}</span></div>
                            <div class="info-row"><span class="info-label">Приоритет</span><span class="info-value">${data.priority || ''}</span></div>
                            <div class="info-row"><span class="info-label">Описание</span><span class="info-value">${data.description || ''}</span></div>
                            <div class="info-row"><span class="info-label">Ответственный</span><span class="info-value" id="detailAssigned">${data.assigned_to || '—'}</span></div>
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
        document.getElementById('statusSelect').value = data.status || 'new';

        const assignSelect = document.getElementById('assignSelect');
        assignSelect.innerHTML = '<option value="">— не назначен —</option>';
        employees.forEach(emp => {
            const opt = new Option(emp.nickname, emp.nickname);
            if (emp.nickname === data.assigned_to) opt.selected = true;
            assignSelect.appendChild(opt);
        });

        // Отображение истории
        const historyEl = document.getElementById('kuspHistory');
        historyEl.innerHTML = '';
        (data.history || []).slice().reverse().forEach(h => {
            historyEl.innerHTML += `<div style="border-bottom:1px solid #edf2f8; padding:8px 0;">
                <b>${h.action}</b> ${h.user} · ${UI.formatDate(h.ts)}<br>${h.note || ''}
            </div>`;
        });

        // Обработчики
        modal.querySelector('.modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };

        document.getElementById('saveKuspChanges').onclick = async () => {
            const assigned = assignSelect.value || null;
            const status = document.getElementById('statusSelect').value;
            const note = `Обновление: статус ${status}, ответственный ${assigned || '—'}`;
            const newEntry = {
                ts: new Date().toISOString(),
                user: Auth.getCurrentUser().nickname,
                action: 'Обновление',
                note
            };
            const updatedHistory = [...(data.history || []), newEntry];
            
            await supabaseClient
                .from('kusps')
                .update({ assigned_to: assigned, status, history: updatedHistory })
                .eq('id', id);
            
            await loadKuspList();
            filterAndRenderKusp();
            modal.remove();
        };

        document.getElementById('addNoteBtn').onclick = async () => {
            const note = document.getElementById('noteText').value.trim();
            if (!note) return;
            
            const newEntry = {
                ts: new Date().toISOString(),
                user: Auth.getCurrentUser().nickname,
                action: 'Заметка',
                note
            };
            const updatedHistory = [...(data.history || []), newEntry];
            
            await supabaseClient
                .from('kusps')
                .update({ history: updatedHistory })
                .eq('id', id);
            
            await loadKuspList();
            filterAndRenderKusp();
            
            // Обновить историю в модалке
            const updatedHistoryEl = document.getElementById('kuspHistory');
            if (updatedHistoryEl) {
                updatedHistoryEl.innerHTML = '';
                [...updatedHistory].reverse().forEach(h => {
                    updatedHistoryEl.innerHTML += `<div style="border-bottom:1px solid #edf2f8; padding:8px 0;">
                        <b>${h.action}</b> ${h.user} · ${UI.formatDate(h.ts)}<br>${h.note || ''}
                    </div>`;
                });
            }
            document.getElementById('noteText').value = '';
        };
    }

    // Создание новой записи КУСП
    async function createKusp() {
        const reporter = document.getElementById('new_reporter')?.value.trim();
        const contact = document.getElementById('new_contact')?.value.trim();
        const type = document.getElementById('new_type')?.value;
        const location = document.getElementById('new_location')?.value.trim();
        const priority = document.getElementById('new_priority')?.value;
        const description = document.getElementById('new_description')?.value.trim();
        const currentUser = Auth.getCurrentUser();

        if (!reporter || !description) {
            alert('Заявитель и описание обязательны');
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
            history: [{
                ts: new Date().toISOString(),
                user: currentUser.nickname,
                action: 'Создан',
                note: description
            }]
        };

        const { error } = await supabaseClient
            .from('kusps')
            .insert([payload]);

        if (error) {
            alert('Ошибка при создании записи');
            return false;
        }

        await loadKuspList();
        filterAndRenderKusp();
        
        return true;
    }

    // Фильтрация и отображение списка
    function filterAndRenderKusp() {
        const search = document.getElementById('kuspSearch')?.value.toLowerCase() || '';
        const status = document.getElementById('kuspFilterStatus')?.value || '';
        const filtered = filterKuspList(search, status);
        renderKuspList(filtered);
    }

    // Инициализация списка КУСП
    async function initKuspList() {
        const clone = UI.loadTemplate('kuspList');
        UI.clearMain();
        document.getElementById('mainApp').appendChild(clone);
        UI.setActiveTab(UI.getElements().navKusp);

        await Admin.loadEmployeesList();
        await loadKuspList();
        filterAndRenderKusp();

        document.getElementById('kuspSearch').addEventListener('input', filterAndRenderKusp);
        document.getElementById('kuspFilterStatus').addEventListener('change', filterAndRenderKusp);
        document.getElementById('kuspCreateOpen').onclick = openCreateModal;
    }

    return {
        initKuspList
    };
})();