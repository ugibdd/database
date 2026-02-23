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
        Auth.ping(); // Сбрасываем таймер
        
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
            Auth.ping(); // Сбрасываем таймер при сохранении
            
            const nickname = document.getElementById('edit_nickname')?.value.trim();
            const password = document.getElementById('edit_password')?.value.trim();
            const rank = document.getElementById('edit_rank')?.value.trim();
            const department = document.getElementById('edit_department')?.value.trim();
            const category = document.getElementById('edit_category')?.value;

            if (!nickname || !rank || !department) {
                UI.showNotification('Заполните все обязательные поля', 'error');
                return;
            }

            try {
                // Сохраняем текущую сессию администратора для восстановления
                const { data: { session: adminSession } } = await supabaseClient.auth.getSession();
                
                if (!adminSession) {
                    throw new Error('Сессия администратора не найдена');
                }

                // 1. Если меняется пароль
                if (password) {
                    try {
                        await SupabaseAdmin.updateUserPassword(employee.auth_user_id, password);
                        UI.showNotification('Пароль успешно изменен', 'success');
                    } catch (error) {
                        console.error('Password update error:', error);
                        throw new Error('Ошибка при обновлении пароля: ' + error.message);
                    }
                }

                // 2. Если меняется никнейм
                if (nickname !== employee.nickname) {
                    try {
                        await SupabaseAdmin.updateUserMetadata(employee.auth_user_id, {
                            nickname: nickname,
                            rank: rank,
                            department: department,
                            category: category
                        });
                    } catch (error) {
                        console.error('Metadata update error:', error);
                        throw new Error('Ошибка при обновлении логина: ' + error.message);
                    }
                }

                // 3. Восстанавливаем сессию администратора
                await supabaseClient.auth.setSession({
                    access_token: adminSession.access_token,
                    refresh_token: adminSession.refresh_token
                });

                // 4. Обновляем данные в таблице employees
                const updateData = { 
                    nickname, 
                    rank, 
                    department, 
                    category 
                };
                
                const { error: dbError } = await supabaseClient
                    .from('employees')
                    .update(updateData)
                    .eq('id', id);

                if (dbError) {
                    throw new Error('Ошибка при обновлении данных: ' + dbError.message);
                }

                UI.showNotification('Данные сотрудника обновлены', 'success');
                modal.remove();
                await loadEmployeesList();
                renderEmployeesManagementList();
                renderEmployeesCreateList();
                
            } catch (error) {
                console.error('Update error:', error);
                UI.showNotification(error.message, 'error');
                
                // Пытаемся восстановить сессию в случае ошибки
                try {
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    if (!session) {
                        const currentUser = Auth.getCurrentUser();
                        if (currentUser) {
                            window.location.hash = '';
                            UI.showAuthMode();
                        }
                    }
                } catch (e) {
                    console.error('Session recovery error:', e);
                }
            }
        };
    }

    // Удаление сотрудника
    async function deleteEmployee(id) {
        Auth.ping(); // Сбрасываем таймер
        
        const employee = employeesCache.find(emp => emp.id === id);
        if (!employee) return;

        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal-overlay';
        confirmModal.innerHTML = `
            <div class="modal-container" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>Подтверждение удаления</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-content">
                    <p style="margin-bottom: 20px;">Вы уверены, что хотите удалить сотрудника <strong>${employee.nickname}</strong>?</p>
                    <div class="flex-row" style="justify-content: flex-end;">
                        <button id="cancelDeleteBtn" class="secondary">Отмена</button>
                        <button id="confirmDeleteBtn" style="background: #dc3545;">Удалить</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);

        // Обработчики
        const closeBtn = confirmModal.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancelDeleteBtn');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        
        closeBtn.onclick = () => confirmModal.remove();
        
        confirmModal.onclick = (e) => {
            if (e.target === confirmModal) confirmModal.remove();
        };
        
        if (cancelBtn) {
            cancelBtn.onclick = () => confirmModal.remove();
        }
        
        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                Auth.ping(); // Сбрасываем таймер при подтверждении
                
                try {
                    // Сохраняем текущую сессию администратора
                    const { data: { session: adminSession } } = await supabaseClient.auth.getSession();
                    
                    if (!adminSession) {
                        throw new Error('Сессия администратора не найдена');
                    }
                    
                    // 1. Удаляем пользователя из Auth через Edge Function
                    await SupabaseAdmin.deleteUser(employee.auth_user_id);
                    
                    // 2. Восстанавливаем сессию администратора
                    await supabaseClient.auth.setSession({
                        access_token: adminSession.access_token,
                        refresh_token: adminSession.refresh_token
                    });
                    
                    // 3. Удаляем из базы данных
                    const { error } = await supabaseClient
                        .from('employees')
                        .delete()
                        .eq('id', id);

                    if (error) {
                        throw new Error('Ошибка при удалении из базы: ' + error.message);
                    }

                    UI.showNotification('Сотрудник удалён', 'success');
                    confirmModal.remove();
                    await loadEmployeesList();
                    renderEmployeesManagementList();
                    renderEmployeesCreateList();
                    
                } catch (error) {
                    console.error('Delete error:', error);
                    UI.showNotification('Ошибка при удалении: ' + error.message, 'error');
                    confirmModal.remove();
                }
            };
        }
    }

    // Отображение списка сотрудников для создания
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
        Auth.ping(); // Сбрасываем таймер
        
        if (!Auth.isAdmin()) return false;

        const nickname = document.getElementById('nickname')?.value.trim();
        const password = document.getElementById('newPassword')?.value.trim();
        const rank = document.getElementById('rank')?.value.trim();
        const department = document.getElementById('department')?.value.trim();
        const category = document.getElementById('category')?.value;

        if (!nickname || !password || !rank || !department) {
            UI.showNotification('Заполните все поля', 'error');
            return false;
        }

        try {
            // Сохраняем текущую сессию администратора
            const { data: { session: adminSession } } = await supabaseClient.auth.getSession();
            
            if (!adminSession) {
                throw new Error('Сессия администратора не найдена');
            }

            // 1. Создаем пользователя через Edge Function
            const authData = await SupabaseAdmin.createUser({
                email: `${nickname}@app.local`,
                password: password,
                metadata: {
                    nickname: nickname,
                    rank: rank,
                    department: department,
                    category: category
                }
            });

            console.log('Пользователь создан в Auth:', authData.user.id);
            
            // 2. Восстанавливаем сессию администратора
            await supabaseClient.auth.setSession({
                access_token: adminSession.access_token,
                refresh_token: adminSession.refresh_token
            });

            // 3. Создаем запись в employees
            const { error: insertError, data: insertData } = await supabaseClient
                .from('employees')
                .insert([{
                    nickname: nickname,
                    rank: rank,
                    department: department,
                    category: category,
                    auth_user_id: authData.user.id
                }])
                .select();

            if (insertError) {
                console.error('Insert error:', insertError);
                throw new Error(insertError.message);
            }

            console.log('Сотрудник создан:', insertData);
            UI.showNotification('Сотрудник успешно создан', 'success');
            
            // Очищаем форму
            document.getElementById('nickname').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('rank').value = '';
            document.getElementById('department').value = '';
            document.getElementById('category').value = 'Руководство';
            
            // Обновляем списки
            await loadEmployeesList();
            renderEmployeesManagementList();
            renderEmployeesCreateList();
            
            return true;
            
        } catch (error) {
            console.error('Create employee error:', error);
            UI.showNotification('Ошибка при создании: ' + error.message, 'error');
            return false;
        }
    }

    // Переключение между вкладками управления
    function switchManagementTab(tab) {
        const manageSection = document.getElementById('manageAccountsSection');
        const createSection = document.getElementById('createAccountSection');
        const manageBtn = document.getElementById('manageTabBtn');
        const createBtn = document.getElementById('createTabBtn');

        if (!manageSection || !createSection || !manageBtn || !createBtn) return;

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
        Auth.ping(); // Сбрасываем таймер при входе в админку

        // Загружаем шаблон админки
        const clone = UI.loadTemplate('admin');
        UI.clearMain();
        document.getElementById('mainApp').appendChild(clone);

        // Загружаем список сотрудников
        await loadEmployeesList();

        const title = document.querySelector('#mainApp h2');
        if (title) title.textContent = 'Управление сотрудниками';

        const manageBtn = document.getElementById('manageTabBtn');
        const createBtn = document.getElementById('createTabBtn');
        const manageSection = document.getElementById('manageAccountsSection');
        const createSection = document.getElementById('createAccountSection');

        if (!manageBtn || !createBtn || !manageSection || !createSection) return;

        // Локальная функция для безопасного переключения вкладок
        function switchTab(tab) {
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

        // Ставим «Управление» по умолчанию
        switchTab('manage');

        // Обработчики для кнопок вкладок
        manageBtn.onclick = () => switchTab('manage');
        createBtn.onclick = () => switchTab('create');

        // Обработчик кнопки создания сотрудника
        document.getElementById('createUserBtn').onclick = createEmployee;

        // Рендер списка создания (для быстрого переключения)
        renderEmployeesCreateList();

        // Подсвечиваем кнопку "Управление" в главной навигации
        UI.setActiveTab(UI.getElements().navAdmin);
    }

    function getEmployeesCache() {
        return employeesCache;
    }

    return {
        initAdminPanel,
        loadEmployeesList,
        getEmployeesCache
    };
})();