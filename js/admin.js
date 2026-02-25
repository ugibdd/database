// Модуль администратора
const Admin = (function() {
    let employeesCache = [];

	// Функция экранирования HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Загрузка списка сотрудников
    async function loadEmployeesList() {
        const { data } = await supabaseClient
            .from('employees')
            .select('*')
            .order('nickname');
        
        employeesCache = data || [];
        return employeesCache;
    }

    // Переключение на вкладку логов
    function switchToLogsTab() {
        const manageSection = document.getElementById('manageAccountsSection');
        const createSection = document.getElementById('createAccountSection');
        const logsSection = document.getElementById('logsSection');
        const manageBtn = document.getElementById('manageTabBtn');
        const createBtn = document.getElementById('createTabBtn');
        const logsBtn = document.getElementById('logsTabBtn');

        if (!manageSection || !createSection || !logsSection || !manageBtn || !createBtn || !logsBtn) return;

        manageSection.classList.add('hidden');
        createSection.classList.add('hidden');
        logsSection.classList.remove('hidden');
        
        manageBtn.classList.remove('active');
        createBtn.classList.remove('active');
        logsBtn.classList.add('active');
        
        renderLogsList();
    }

    // Отображение логов
	async function renderLogsList() {
		const container = document.getElementById('logsList');
		if (!container) return;

		const actionFilter = document.getElementById('logFilterAction')?.value || '';
		const dateFilter = document.getElementById('logFilterDate')?.value || '';

		const filters = {};
		if (actionFilter) filters.action_type = actionFilter;
		if (dateFilter) {
			const startDate = new Date(dateFilter);
			startDate.setHours(0, 0, 0, 0);
			const endDate = new Date(dateFilter);
			endDate.setHours(23, 59, 59, 999);
			filters.date_from = startDate.toISOString();
			filters.date_to = endDate.toISOString();
		}
		filters.limit = 100;

		const logs = await Logger.getLogs(filters);
		
		if (logs.length === 0) {
			container.innerHTML = '<div class="list-item" style="justify-content: center; color: #6b7f99;">Нет записей в журнале</div>';
			return;
		}

		container.innerHTML = '';
		
		logs.forEach(log => {
			const formatted = Logger.formatLogForDisplay(log);
			const div = document.createElement('div');
			div.className = 'list-item';
			div.style.flexDirection = 'column';
			div.style.alignItems = 'flex-start';
			div.style.gap = '8px';
			
			// Форматируем детали для читаемости
			let detailsHtml = '';
			if (log.action_details) {
				if (log.action_details.changes) {
					// Для изменений показываем таблицу
					detailsHtml = '<div style="font-size: 0.85rem; background: #f0f5ff; padding: 12px; border-radius: 8px; width: 100%;">';
					detailsHtml += '<details>';
					detailsHtml += '<summary style="cursor: pointer; color: #1e3a5f; font-weight: 600;">📋 Детали изменений</summary>';
					detailsHtml += '<div style="margin-top: 12px;">';
					
					Object.entries(log.action_details.changes).forEach(([field, value]) => {
						detailsHtml += `
							<div style="margin-bottom: 10px; border-bottom: 1px solid #d0e0ff; padding-bottom: 8px;">
								<div style="font-weight: 600; color: #0b2b4a;">${field}</div>
								<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 5px;">
									<div style="background: #ffe6e6; padding: 6px; border-radius: 4px;">
										<span style="color: #dc3545;">Было:</span> ${escapeHtml(value.было)}
									</div>
									<div style="background: #e6ffe6; padding: 6px; border-radius: 4px;">
										<span style="color: #28a745;">Стало:</span> ${escapeHtml(value.стало)}
									</div>
								</div>
							</div>
						`;
					});
					
					detailsHtml += '</div></details></div>';
				} else {
					// Для других действий показываем обычный JSON
					detailsHtml = `
						<div style="font-size: 0.85rem; color: #5d7186; background: #f0f5ff; padding: 8px; border-radius: 8px; width: 100%;">
							<details>
								<summary style="cursor: pointer; color: #1e3a5f;">Детали</summary>
								<pre style="margin-top: 8px; white-space: pre-wrap; font-family: monospace; font-size: 0.8rem;">${JSON.stringify(log.action_details, null, 2)}</pre>
							</details>
						</div>
					`;
				}
			}
			
			div.innerHTML = `
				<div style="display: flex; justify-content: space-between; width: 100%;">
					<span style="font-weight: 600; color: #1e3a5f;">${formatted.formattedUser}</span>
					<span style="color: #6b7f99; font-size: 0.85rem;">${formatted.formattedDate}</span>
				</div>
				<div style="color: #0e2b42;">${formatted.formattedAction}</div>
				${detailsHtml}
				${log.ip_address ? `
					<div style="font-size: 0.8rem; color: #8a9bb0;">🌐 IP: ${log.ip_address}</div>
				` : ''}
			`;
			container.appendChild(div);
		});
	}

    // Экспорт логов в CSV
    async function exportLogs() {
        const logs = await Logger.getLogs({ limit: 1000 });
        
        const csv = [
            ['Дата', 'Пользователь', 'Категория', 'Действие', 'Детали', 'IP'],
            ...logs.map(log => [
                new Date(log.created_at).toLocaleString('ru-RU'),
                log.user_name,
                log.user_category || '',
                log.action_type,
                JSON.stringify(log.action_details || {}),
                log.ip_address || ''
            ])
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `logs_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        
        UI.showNotification('Логи экспортированы', 'success');
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

		const currentUser = Auth.getCurrentUser();

		employeesCache.forEach(emp => {
			const div = document.createElement('div');
			div.className = 'list-item';
			
			const canDelete = Auth.canDeleteUser(emp);
			const canEdit = Auth.canEditUser(emp);
			const isSelf = currentUser && currentUser.id === emp.id;
			
			div.innerHTML = `
				<div style="flex:1;">
					<div class="item-title">${emp.nickname} ${isSelf ? '(Вы)' : ''}</div>
					<div class="item-meta">${emp.rank} · ${emp.department} · ${emp.category}</div>
				</div>
				<div class="flex-row" style="gap: 8px;">
					${canEdit ? `<button class="small" data-id="${emp.id}" data-action="edit">✏️ Редактировать</button>` : ''}
					${canDelete && !isSelf ? `<button class="small secondary" data-id="${emp.id}" data-action="delete">🗑️ Удалить</button>` : ''}
				</div>
			`;
			container.appendChild(div);
		});

		container.querySelectorAll('button[data-action="edit"]').forEach(btn => {
			btn.onclick = () => openEditEmployeeModal(btn.dataset.id);
		});

		container.querySelectorAll('button[data-action="delete"]').forEach(btn => {
			btn.onclick = () => deleteEmployee(btn.dataset.id);
		});
	}

    // Открыть модальное окно для редактирования сотрудника
	async function openEditEmployeeModal(id) {
		Auth.ping();
		
		const employee = employeesCache.find(emp => emp.id === id);
		if (!employee) return;

		if (!Auth.canEditUser(employee)) {
			UI.showNotification('У вас нет прав для редактирования этого сотрудника', 'error');
			return;
		}

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
				<div class="form-group">
					<label for="edit_nickname">Логин <span class="required">*</span></label>
					<input id="edit_nickname" type="text" placeholder="Введите логин" value="${employee.nickname}">
					<small class="field-hint">Внимание: при смене логина изменится email для входа</small>
				</div>
				
				<div class="form-group">
					<label for="edit_password">Новый пароль</label>
					<input id="edit_password" type="text" placeholder="Оставьте пустым, если не меняете"> 
					<small class="field-hint">Минимальная длина: 6 символов</small>
				</div>
				
				<div class="form-group">
					<label for="edit_rank">Звание <span class="required">*</span></label>
					<input id="edit_rank" placeholder="Например: старший лейтенант" value="${employee.rank || ''}">
				</div>
				
				<div class="form-group">
					<label for="edit_department">Подразделение <span class="required">*</span></label>
					<input id="edit_department" placeholder="Например: ОБ" value="${employee.department || ''}">
				</div>
				
				<div class="form-group">
					<label for="edit_category">Категория <span class="required">*</span></label>
					<select id="edit_category">
						<option value="МС" ${employee.category === 'МС' ? 'selected' : ''}>Младший состав (МС)</option>
						<option value="РС" ${employee.category === 'РС' ? 'selected' : ''}>Руководящий состав (РС)</option>
						<option value="ВРС" ${employee.category === 'ВРС' ? 'selected' : ''}>Высший руководящий состав (ВРС)</option>
						<option value="Администратор" ${employee.category === 'Администратор' ? 'selected' : ''}>Администрация</option>
					</select>
				</div>
				
				<div class="flex-row" style="justify-content: flex-end; margin-top: 24px;">
					<button id="cancelEditBtn" class="secondary">Отмена</button>
					<button id="saveEditBtn">Сохранить изменения</button>
				</div>
			</div>
		</div>
		`;

		document.body.appendChild(modal);

		modal.querySelector('.modal-close').onclick = () => modal.remove();
		modal.onclick = (e) => {
			if (e.target === modal) modal.remove();
		};

		document.getElementById('cancelEditBtn').onclick = () => modal.remove();

		document.getElementById('saveEditBtn').onclick = async () => {
			Auth.ping();
			
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
				const { data: { session: adminSession } } = await supabaseClient.auth.getSession();
				
				if (!adminSession) {
					throw new Error('Сессия администратора не найдена');
				}

				// Логируем смену пароля, если она есть
				if (password) {
					await SupabaseAdmin.updateUserPassword(employee.auth_user_id, password);
					UI.showNotification('Пароль успешно изменен', 'success');
					
					Logger.log(Logger.ACTION_TYPES.EMPLOYEE_PASSWORD_CHANGE, {
						nickname: employee.nickname,
						changed_by: Auth.getCurrentUser()?.nickname
					}, 'employee', id);
				}

				// Обновляем email в auth, если изменился ник
				if (nickname !== employee.nickname) {
					const newEmail = `${nickname}@app.local`;
					
					// Обновляем email пользователя в auth
					await SupabaseAdmin.updateUserEmail(employee.auth_user_id, newEmail);
					
					// Обновляем метаданные
					await SupabaseAdmin.updateUserMetadata(employee.auth_user_id, {
						nickname: nickname,
						rank: rank,
						department: department,
						category: category
					});
					
					UI.showNotification(`Email изменён на ${newEmail}`, 'success');
				} else {
					// Если ник не менялся, просто обновляем метаданные
					await SupabaseAdmin.updateUserMetadata(employee.auth_user_id, {
						nickname: nickname,
						rank: rank,
						department: department,
						category: category
					});
				}

				// Восстанавливаем сессию администратора
				await supabaseClient.auth.setSession({
					access_token: adminSession.access_token,
					refresh_token: adminSession.refresh_token
				});

				// Обновляем данные в таблице employees
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

				// ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ИЗМЕНЕНИЙ
				// Собираем только измененные поля
				const changes = {};
				if (nickname !== employee.nickname) changes.логин = { было: employee.nickname, стало: nickname };
				if (rank !== employee.rank) changes.звание = { было: employee.rank, стало: rank };
				if (department !== employee.department) changes.подразделение = { было: employee.department, стало: department };
				if (category !== employee.category) changes.категория = { было: employee.category, стало: category };

				// Если были изменения данных
				if (Object.keys(changes).length > 0) {
					Logger.log(Logger.ACTION_TYPES.EMPLOYEE_UPDATE, {
						employee: nickname,
						changes: changes,
						changed_by: Auth.getCurrentUser()?.nickname
					}, 'employee', id);
				}

				UI.showNotification('Данные сотрудника обновлены', 'success');
				modal.remove();
				await loadEmployeesList();
				renderEmployeesManagementList();
				renderEmployeesCreateList();
				
			} catch (error) {
				console.error('Update error:', error);
				ErrorHandler.showError(error, 'Ошибка при обновлении данных');
				
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
		Auth.ping();
		
		const employee = employeesCache.find(emp => emp.id === id);
		if (!employee) return;

		if (!Auth.canDeleteUser(employee)) {
			UI.showNotification('У вас нет прав для удаления этого сотрудника', 'error');
			return;
		}

		const currentUser = Auth.getCurrentUser();
		if (currentUser && currentUser.id === id) {
			UI.showNotification('Вы не можете удалить свой собственный аккаунт', 'error');
			return;
		}

		console.log('Attempting to delete employee:', {
			id: employee.id,
			auth_user_id: employee.auth_user_id,
			nickname: employee.nickname
		});

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
				Auth.ping();
				
				const currentUserCheck = Auth.getCurrentUser();
				if (currentUserCheck && currentUserCheck.id === id) {
					UI.showNotification('Вы не можете удалить свой собственный аккаунт', 'error');
					confirmModal.remove();
					return;
				}
				
				try {
					// Получаем текущую сессию для диагностики
					const { data: { session: currentSession }, error: sessionError } = await supabaseClient.auth.getSession();
					console.log('Current session:', currentSession?.user?.email, sessionError);

					// ШАГ 1: Обновляем все записи КУСП, где сотрудник был received_by_id
					// Сначала проверяем, есть ли такие записи
					const { data: receivedKusps, error: checkError } = await supabaseClient
						.from('kusps')
						.select('id, kusp_number')
						.eq('received_by_id', employee.auth_user_id);

					if (checkError) {
						console.error('Error checking received kusps:', checkError);
					} else {
						console.log(`Found ${receivedKusps?.length || 0} kusps where employee is received_by`);
						
						if (receivedKusps && receivedKusps.length > 0) {
							const { error: receivedUpdateError } = await supabaseClient
								.from('kusps')
								.update({
									received_by_id: null,
									received_by_name_archived: employee.nickname,
									received_by_rank_archived: employee.rank,
									received_by_deleted_at: new Date().toISOString()
								})
								.eq('received_by_id', employee.auth_user_id);

							if (receivedUpdateError) {
								console.error('Error updating received_by references:', receivedUpdateError);
								// Если ошибка из-за NOT NULL, пробуем другой подход
								if (receivedUpdateError.code === '23502') { // NOT NULL violation
									console.log('NOT NULL constraint detected, trying alternative approach');
									
									// Альтернативный подход: обновляем каждую запись отдельно с concat_notes
									for (const kusp of receivedKusps) {
										const { error: singleUpdateError } = await supabaseClient
											.from('kusps')
											.update({
												received_by_name_archived: employee.nickname,
												received_by_rank_archived: employee.rank,
												received_by_deleted_at: new Date().toISOString(),
												notes: supabaseClient.rpc('concat_notes', {
													current_notes: kusp.notes,
													new_note: `[Сотрудник "${employee.nickname}" (принявший) удален ${new Date().toLocaleString('ru-RU')}]`
												})
											})
											.eq('id', kusp.id);
										
										if (singleUpdateError) {
											console.error(`Error updating kusp ${kusp.kusp_number}:`, singleUpdateError);
										}
									}
								}
							}
						}
					}

					// ШАГ 2: Обновляем все записи КУСП, где сотрудник был assigned_by_id
					const { data: assignedByKusps, error: checkByError } = await supabaseClient
						.from('kusps')
						.select('id, kusp_number')
						.eq('assigned_by_id', employee.auth_user_id);

					if (checkByError) {
						console.error('Error checking assigned_by kusps:', checkByError);
					} else {
						console.log(`Found ${assignedByKusps?.length || 0} kusps where employee is assigned_by`);
						
						if (assignedByKusps && assignedByKusps.length > 0) {
							const { error: assignedByUpdateError } = await supabaseClient
								.from('kusps')
								.update({
									assigned_by_id: null,
									assigned_by_name_archived: employee.nickname,
									assigned_by_deleted_at: new Date().toISOString()
								})
								.eq('assigned_by_id', employee.auth_user_id);

							if (assignedByUpdateError) {
								console.error('Error updating assigned_by references:', assignedByUpdateError);
							}
						}
					}

					// ШАГ 3: Обновляем все записи КУСП, где сотрудник был assigned_to_id
					const { data: assignedToKusps, error: checkToError } = await supabaseClient
						.from('kusps')
						.select('id, kusp_number')
						.eq('assigned_to_id', employee.auth_user_id);

					if (checkToError) {
						console.error('Error checking assigned_to kusps:', checkToError);
					} else {
						console.log(`Found ${assignedToKusps?.length || 0} kusps where employee is assigned_to`);
						
						if (assignedToKusps && assignedToKusps.length > 0) {
							const { error: assignedToUpdateError } = await supabaseClient
								.from('kusps')
								.update({
									assigned_to_id: null,
									assigned_to_name_archived: employee.nickname,
									assigned_to_deleted_at: new Date().toISOString()
								})
								.eq('assigned_to_id', employee.auth_user_id);

							if (assignedToUpdateError) {
								console.error('Error updating assigned_to references:', assignedToUpdateError);
							}
						}
					}

					// ШАГ 4: Логируем перед удалением из auth
					Logger.log(Logger.ACTION_TYPES.EMPLOYEE_DELETE, {
						nickname: employee.nickname,
						rank: employee.rank,
						department: employee.department,
						category: employee.category,
						deleted_by: currentUserCheck?.nickname,
						affected_kusps: {
							received: receivedKusps?.length || 0,
							assigned_by: assignedByKusps?.length || 0,
							assigned_to: assignedToKusps?.length || 0
						}
					}, 'employee', id);
					
					// ШАГ 5: Пытаемся удалить пользователя из auth
					console.log('Attempting to delete auth user:', employee.auth_user_id);
					
					const { data: { session: adminSession } } = await supabaseClient.auth.getSession();
					
					if (!adminSession) {
						throw new Error('Сессия администратора не найдена');
					}
					
					console.log('Admin session found, calling deleteUser function');
					
					try {
						await SupabaseAdmin.deleteUser(employee.auth_user_id);
						console.log('Auth user deleted successfully');
					} catch (authError) {
						console.error('Auth deletion error details:', authError);
						
						// Проверяем, может пользователь уже удален?
						if (authError.message && authError.message.includes('not found')) {
							console.log('User might already be deleted, continuing with employee table deletion');
						} else {
							throw authError;
						}
					}
					
					// Восстанавливаем сессию администратора
					await supabaseClient.auth.setSession({
						access_token: adminSession.access_token,
						refresh_token: adminSession.refresh_token
					});
					
					// ШАГ 6: Удаляем запись из таблицы employees
					console.log('Deleting employee record from database');
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
					console.error('Delete error stack:', error.stack);
					ErrorHandler.showError(error, 'Ошибка при удалении сотрудника');
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
            
            let badgeClass = 'badge-new';
            if (emp.category === 'Администратор') {
                badgeClass = 'badge-progress';
            } else if (emp.category === 'ВРС') {
                badgeClass = 'badge-vrs';
            } else if (emp.category === 'РС') {
                badgeClass = 'badge-rs';
            }
            
            li.innerHTML = `
                <span>${emp.nickname} · ${emp.rank} · ${emp.department}</span>
                <span class="badge ${badgeClass}">${emp.category}</span>
            `;
            ul.appendChild(li);
        });
    }

    // Создание нового сотрудника
	async function createEmployee() {
		Auth.ping();
		
		if (!Auth.canManageUsers()) {
            UI.showNotification('У вас нет прав для создания сотрудников', 'error');
            return false;
        }

		const nickname = document.getElementById('nickname')?.value.trim();
		const password = document.getElementById('newPassword')?.value.trim();
		const rank = document.getElementById('rank')?.value.trim();
		const department = document.getElementById('department')?.value.trim();
		const category = document.getElementById('category')?.value;

		if (!nickname || !password || !rank || !department) {
			UI.showNotification('Заполните все обязательные поля', 'error');
			return false;
		}

		if (password.length < 6) {
			UI.showNotification('Пароль должен содержать не менее 6 символов', 'error');
			
			const passwordInput = document.getElementById('newPassword');
			passwordInput.style.borderColor = '#dc3545';
			passwordInput.focus();
			
			setTimeout(() => {
				passwordInput.style.borderColor = '';
			}, 3000);
			
			return false;
		}

		if (nickname.length < 3) {
			UI.showNotification('Логин должен содержать не менее 3 символов', 'error');
			return false;
		}

		try {
			const { data: { session: adminSession } } = await supabaseClient.auth.getSession();
			
			if (!adminSession) {
				throw new Error('Сессия администратора не найдена');
			}

			const createBtn = document.getElementById('createUserBtn');
			const originalText = createBtn.textContent;
			createBtn.textContent = '⏳ Создание...';
			createBtn.disabled = true;

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
			
			await supabaseClient.auth.setSession({
				access_token: adminSession.access_token,
				refresh_token: adminSession.refresh_token
			});

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
				
				try {
					await SupabaseAdmin.deleteUser(authData.user.id);
					await supabaseClient.auth.setSession({
						access_token: adminSession.access_token,
						refresh_token: adminSession.refresh_token
					});
				} catch (cleanupError) {
					console.error('Cleanup error:', cleanupError);
				}
				
				throw new Error(insertError.message);
			}

			console.log('Сотрудник создан:', insertData);
			
			// Логируем создание сотрудника
			Logger.log(Logger.ACTION_TYPES.EMPLOYEE_CREATE, {
				nickname: nickname,
				rank: rank,
				department: department,
				category: category,
				created_by: Auth.getCurrentUser()?.nickname
			}, 'employee', authData.user.id);
			
			UI.showNotification('Сотрудник успешно создан', 'success');
			
			document.getElementById('nickname').value = '';
			document.getElementById('newPassword').value = '';
			document.getElementById('rank').value = '';
			document.getElementById('department').value = '';
			document.getElementById('category').value = 'МС';
			
			await loadEmployeesList();
			renderEmployeesManagementList();
			renderEmployeesCreateList();
			
			createBtn.textContent = originalText;
			createBtn.disabled = false;
			
			return true;
			
		} catch (error) {
			console.error('Create employee error:', error);
			
			const createBtn = document.getElementById('createUserBtn');
			if (createBtn) {
				createBtn.textContent = '➕ Создать учётную запись';
				createBtn.disabled = false;
			}
			
			ErrorHandler.showError(error, 'Ошибка при создании сотрудника');
			
			if (error.message && error.message.toLowerCase().includes('password')) {
				const passwordInput = document.getElementById('newPassword');
				passwordInput.style.borderColor = '#dc3545';
				passwordInput.focus();
				
				setTimeout(() => {
					passwordInput.style.borderColor = '';
				}, 3000);
			}
			
			return false;
		}
	}

    // Инициализация панели администратора
    async function initAdminPanel() {
        if (!Auth.canManageUsers()) {
            UI.showNotification('У вас нет прав для доступа к этому разделу', 'error');
            window.location.hash = 'home';
            return;
        }

        Auth.ping();

        const clone = UI.loadTemplate('admin');
        UI.clearMain();
        document.getElementById('mainApp').appendChild(clone);

        await loadEmployeesList();

        const title = document.querySelector('#mainApp h2');
        if (title) title.textContent = 'Управление сотрудниками';

        const manageBtn = document.getElementById('manageTabBtn');
        const createBtn = document.getElementById('createTabBtn');
        const logsBtn = document.getElementById('logsTabBtn');
        const manageSection = document.getElementById('manageAccountsSection');
        const createSection = document.getElementById('createAccountSection');
        const logsSection = document.getElementById('logsSection');

        if (!manageBtn || !createBtn || !logsBtn || !manageSection || !createSection || !logsSection) return;

        function switchTab(tab) {
            if (tab === 'manage') {
                manageSection.classList.remove('hidden');
                createSection.classList.add('hidden');
                logsSection.classList.add('hidden');
                manageBtn.classList.add('active');
                createBtn.classList.remove('active');
                logsBtn.classList.remove('active');
                renderEmployeesManagementList();
               
                
            } else if (tab === 'create') {
                manageSection.classList.add('hidden');
                createSection.classList.remove('hidden');
                logsSection.classList.add('hidden');
                createBtn.classList.add('active');
                manageBtn.classList.remove('active');
                logsBtn.classList.remove('active');
             
                
            } else if (tab === 'logs') {
                manageSection.classList.add('hidden');
                createSection.classList.add('hidden');
                logsSection.classList.remove('hidden');
                logsBtn.classList.add('active');
                manageBtn.classList.remove('active');
                createBtn.classList.remove('active');
                renderLogsList();
                
            }
        }

        switchTab('manage');

        manageBtn.onclick = () => switchTab('manage');
        createBtn.onclick = () => switchTab('create');
        logsBtn.onclick = () => switchTab('logs');

        document.getElementById('refreshLogsBtn')?.addEventListener('click', renderLogsList);
        document.getElementById('exportLogsBtn')?.addEventListener('click', exportLogs);
        document.getElementById('logFilterAction')?.addEventListener('change', renderLogsList);
        document.getElementById('logFilterDate')?.addEventListener('change', renderLogsList);

        document.getElementById('createUserBtn').onclick = createEmployee;

        renderEmployeesCreateList();

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