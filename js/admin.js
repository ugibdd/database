// Модуль администратора
const Admin = (function() {
    let employeesCache = [];

    // Загрузка списка сотрудников
    async function loadEmployeesList() {
        const { data } = await supabaseClient
            .from('employees')
            .select('*')
            .order('nickname');
        
        employeesCache = data || [];
        return employeesCache;
    }

    // Отображение списка сотрудников для управления
    function renderEmployeesManagementList() {
        const container = document.getElementById('employeesManageList');
        if (!container) return;

        container.innerHTML = '';
        
        if (!employeesCache.length) {
            container.innerHTML = '<div class="list-item">Нет сотрудников</div>';
            return;
        }

        employeesCache.forEach(emp => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div style="flex:1;">
                    <div class="item-title">${emp.nickname}</div>
                    <div class="item-meta">${emp.rank} · ${emp.department} · ${emp.category}</div>
                </div>
                <div class="flex-row" style="gap: 8px;">
                    <button class="small" data-id="${emp.id}" data-action="edit">✏️ Редактировать</button>
                    ${emp.category !== 'Администратор' ? 
                        `<button class="small secondary" data-id="${emp.id}" data-action="delete">🗑️ Удалить</button>` : 
                        ''}
                </div>
            `;
            container.appendChild(div);
        });

        // Обработчики для кнопок
        container.querySelectorAll('button[data-action="edit"]').forEach(btn => {
            btn.onclick = () => openEditEmployeeModal(btn.dataset.id);
        });

        container.querySelectorAll('button[data-action="delete"]').forEach(btn => {
            btn.onclick = () => deleteEmployee(btn.dataset.id);
        });
    }

    // Открыть модальное окно для редактирования сотрудника
    async function openEditEmployeeModal(id) {
        const employee = employeesCache.find(emp => emp.id === id);
        if (!employee) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'editEmployeeModal';
        
        modal.innerHTML = `
            <div class="modal-container">
                <div class="modal-header">
                    <h3>Редактирование сотрудника</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-content">
                    <input id="edit_nickname" type="text" placeholder="Логин" value="${employee.nickname}">
                    <input id="edit_password" type="password" placeholder="Новый пароль (оставьте пустым, если не меняете)">
                    <input id="edit_rank" placeholder="Звание" value="${employee.rank || ''}">
                    <input id="edit_department" placeholder="Подразделение" value="${employee.department || ''}">
                    <select id="edit_category">
                        <option value="Руководство" ${employee.category === 'Руководство' ? 'selected' : ''}>Руководство</option>
                        <option value="Оперативный" ${employee.category === 'Оперативный' ? 'selected' : ''}>Оперативный</option>
                        <option value="Администратор" ${employee.category === 'Администратор' ? 'selected' : ''}>Администратор</option>
                    </select>
                    <div class="flex-row" style="justify-content: flex-end; margin-top: 20px;">
                        <button id="cancelEditBtn" class="secondary">Отмена</button>
                        <button id="saveEditBtn">Сохранить</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики
        modal.querySelector('.modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };

        document.getElementById('cancelEditBtn').onclick = () => modal.remove();

        document.getElementById('saveEditBtn').onclick = async () => {
            const nickname = document.getElementById('edit_nickname')?.value.trim();
            const password = document.getElementById('edit_password')?.value.trim();
            const rank = document.getElementById('edit_rank')?.value.trim();
            const department = document.getElementById('edit_department')?.value.trim();
            const category = document.getElementById('edit_category')?.value;

            if (!nickname || !rank || !department) {
                alert('Заполните все обязательные поля');
                return;
            }

            const updateData = { nickname, rank, department, category };
            if (password) {
                updateData.password = password;
            }

            const { error } = await supabaseClient
                .from('employees')
                .update(updateData)
                .eq('id', id);

            if (error) {
                alert('Ошибка при обновлении: ' + error.message);
                return;
            }

            alert('Данные сотрудника обновлены');
            modal.remove();
            await loadEmployeesList();
            renderEmployeesManagementList();
            renderEmployeesCreateList(); // Обновляем и список создания
        };
    }

    // Удаление сотрудника
    async function deleteEmployee(id) {
        const employee = employeesCache.find(emp => emp.id === id);
        if (!employee) return;

        if (!confirm(`Вы уверены, что хотите удалить сотрудника ${employee.nickname}?`)) {
            return;
        }

        const { error } = await supabaseClient
            .from('employees')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Ошибка при удалении: ' + error.message);
            return;
        }

        alert('Сотрудник удалён');
        await loadEmployeesList();
        renderEmployeesManagementList();
        renderEmployeesCreateList();
    }

    // Отображение списка сотрудников для создания (упрощённый вид)
    function renderEmployeesCreateList() {
        const ul = document.getElementById('employeesList');
        if (!ul) return;

        ul.innerHTML = '';
        employeesCache.forEach(emp => {
            const li = document.createElement('li');
            li.style.padding = '8px 0';
            li.style.borderBottom = '1px solid #dbe4ee';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            
            li.innerHTML = `
                <span>${emp.nickname} · ${emp.rank} · ${emp.department}</span>
                <span class="badge ${emp.category === 'Администратор' ? 'badge-progress' : 'badge-new'}">${emp.category}</span>
            `;
            ul.appendChild(li);
        });
    }

    // Создание нового сотрудника
    async function createEmployee() {
        if (!Auth.isAdmin()) return;

        const nickname = document.getElementById('nickname')?.value.trim();
        const password = document.getElementById('newPassword')?.value.trim();
        const rank = document.getElementById('rank')?.value.trim();
        const department = document.getElementById('department')?.value.trim();
        const category = document.getElementById('category')?.value;

        if (!nickname || !password || !rank || !department) {
            alert('Заполните все поля');
            return false;
        }

        const { error } = await supabaseClient
            .from('employees')
            .insert([{ nickname, password, rank, department, category }]);

        if (error) {
            alert(error.message);
            return false;
        }

        alert('Сотрудник добавлен');
        
        // Очистка формы
        document.getElementById('nickname').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('rank').value = '';
        document.getElementById('department').value = '';
        document.getElementById('category').value = 'Руководство';
        
        await loadEmployeesList();
        renderEmployeesManagementList();
        renderEmployeesCreateList();
        
        return true;
    }

    // Переключение между вкладками управления
    function switchManagementTab(tab) {
        const manageSection = document.getElementById('manageAccountsSection');
        const createSection = document.getElementById('createAccountSection');
        const manageBtn = document.getElementById('manageTabBtn');
        const createBtn = document.getElementById('createTabBtn');

        if (tab === 'manage') {
            manageSection.classList.remove('hidden');
            createSection.classList.add('hidden');
            manageBtn.classList.add('active');
            createBtn.classList.remove('active');
            renderEmployeesManagementList();
        } else {
            manageSection.classList.add('hidden');
            createSection.classList.remove('hidden');
            createBtn.classList.add('active');
            manageBtn.classList.remove('active');
        }
    }

    // Инициализация панели администратора
    async function initAdminPanel() {
        const clone = UI.loadTemplate('admin');
        UI.clearMain();
        document.getElementById('mainApp').appendChild(clone);
        
        await loadEmployeesList();
        
        // Переименовываем заголовок
        const title = document.querySelector('#mainApp h2');
        if (title) title.textContent = 'Управление персоналом';
        
        // Инициализация вкладок
        renderEmployeesManagementList();
        renderEmployeesCreateList();
        
        // Обработчики для вкладок
        document.getElementById('manageTabBtn').onclick = () => switchManagementTab('manage');
        document.getElementById('createTabBtn').onclick = () => switchManagementTab('create');
        
        // Обработчик создания сотрудника
        document.getElementById('createUserBtn').onclick = createEmployee;
        
        // Устанавливаем активную вкладку
        UI.setActiveTab(UI.getElements().navAdmin);
    }

    // Получить кэш сотрудников
    function getEmployeesCache() {
        return employeesCache;
    }

    return {
        initAdminPanel,
        loadEmployeesList,
        getEmployeesCache
    };
})();