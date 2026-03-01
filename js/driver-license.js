// Модуль для работы с водительскими удостоверениями (гостевой доступ)
const DriverLicense = (function() {

    const guestSupabaseClient = supabase.createClient(
        CONFIG.SUPABASE_URL, 
        CONFIG.SUPABASE_KEY, 
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            }
        }
    );
    
    // Поиск протоколов по точному номеру ВУ (6 цифр)
    async function findProtocolsByLicenseNumber(licenseNumber) {
        try {
            if (!licenseNumber || licenseNumber.trim() === '') {
                return { error: 'Введите номер водительского удостоверения' };
            }

            // Очищаем номер от лишних символов и оставляем только цифры
            const cleanNumber = licenseNumber.trim().replace(/\D/g, '');
            
            // Проверяем, что номер состоит ровно из 6 цифр
            if (cleanNumber.length !== 6) {
                return { error: 'Номер водительского удостоверения должен содержать ровно 6 цифр' };
            }
            
            // Ищем протоколы по точному совпадению номера
            const { data, error } = await supabaseClient
                .from('protocols')
                .select(`
                    id,
                    protocol_number,
                    protocol_date,
                    protocol_time,
                    protocol_place,
                    official_name,
                    violator_lastname,
                    violator_firstname,
                    violator_patronymic,
                    violator_birth_date,
                    violator_birth_place,
                    violator_russian_language_skill,
                    violator_driver_license,
                    violator_driver_license_number,
                    vehicle_make_model,
                    vehicle_license_plate,
                    vehicle_owner,
                    vehicle_registered_info,
                    offense_datetime,
                    offense_place,
                    offense_description,
                    offense_article_number,
                    offense_article_part,
                    offense_violation_point,
                    offense_special_equipment,
                    explanatory_note,
                    status,
                    signature_data,
                    created_at,
                    updated_at,
                    created_by_id,
                    created_by_name,
                    updated_by_id,
                    updated_by_name
                `)
                .eq('violator_driver_license_number', cleanNumber)
                .order('offense_datetime', { ascending: false });

            if (error) {
                console.error('Error finding protocols:', error);
                return { error: 'Ошибка при поиске протоколов' };
            }

            return { data: data || [] };

        } catch (error) {
            console.error('Error in findProtocolsByLicenseNumber:', error);
            return { error: 'Ошибка при поиске протоколов' };
        }
    }

    // Форматирование ФИО нарушителя
    function formatViolatorName(protocol) {
        return [protocol.violator_lastname, protocol.violator_firstname, protocol.violator_patronymic]
            .filter(Boolean)
            .join(' ');
    }

    // Форматирование даты и времени для отображения (исправлено)
    function formatDateTime(datetime) {
        if (!datetime) return '—';
        const date = new Date(datetime);
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    }

    // Форматирование даты без времени (исправлено)
    function formatDate(date) {
        if (!date) return '—';
        const d = new Date(date);
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}.${month}.${year}`;
    }

    // Получение месяца в родительном падеже
    function getMonthGenitive(monthIndex) {
        const months = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        return months[monthIndex] || '';
    }

    // Функция экранирования HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Открыть модальное окно с протоколом для гостя (полная версия как у сотрудников)
    function openProtocolForGuest(protocol) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'protocolGuestModal';
        
        modal.innerHTML = `
            <div class="modal-container protocol-document-modal" style="max-width: 900px; width: 95%;">
                <div class="modal-header">
                    <h3>Протокол об АП №${escapeHtml(protocol.protocol_number || '')}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-content protocol-document-content">
                    <!-- Документ протокола по шаблону (полная версия как у сотрудников) -->
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
                                        <div class="line handwritten" style="width: 26px; text-align:left;">${protocol.protocol_date ? new Date(protocol.protocol_date).getUTCDate().toString().padStart(2,'0') : ''}</div>
                                        <span>"</span>
                                        <div class="line handwritten" style="width: 81px; text-align:left;">
                                          ${protocol.protocol_date ? (() => {
                                                const date = new Date(protocol.protocol_date);
                                                const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                                                                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
                                                return months[date.getUTCMonth()];
                                              })() : ''}
                                        </div>
                                        <span>20</span>
                                        <div class="line handwritten" style="width: 26px; text-align:left;">${protocol.protocol_date ? new Date(protocol.protocol_date).getUTCFullYear().toString().slice(-2) : ''}</div>
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
                            
                            <div class="date-item date-right" style="display: flex; justify-content: flex-end; width: 100%;">
                                <div class="date-field" style="width: 100%;">
                                    <div class="date-row" style="display: flex; justify-content: flex-end; width: 100%;">
                                        <div class="line handwritten" style="width: 100%; text-align: right;">${escapeHtml(protocol.protocol_place || '')}</div>
                                    </div>
                                    <div class="note" style="text-align: right;">(место составления)</div>
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
                                    ${protocol.violator_birth_date ? formatDate(protocol.violator_birth_date) + ', ' : ''}${escapeHtml(protocol.violator_birth_place || '')}
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
                                    ${protocol.signature_data ? `
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
                        <button type="button" id="closeGuestProtocolBtn" class="secondary">Закрыть</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики закрытия
        modal.querySelector('.modal-close').onclick = () => modal.remove();
        document.getElementById('closeGuestProtocolBtn').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    // Отображение результатов поиска
    function renderResults(protocols, container, violatorInfoContainer) {
        if (!protocols || protocols.length === 0) {
            document.getElementById('noProtocolsMessage').style.display = 'block';
            document.getElementById('driverLicenseResults').style.display = 'none';
            return;
        }

        // Получаем информацию о нарушителе из первого протокола (они должны быть одинаковыми)
        const firstProtocol = protocols[0];
        const violatorName = formatViolatorName(firstProtocol);
        
        // Отображаем информацию о нарушителе
        violatorInfoContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                <div>
                    <strong style="font-size: 1.2rem;">${escapeHtml(violatorName)}</strong>
                </div>
                <div>
                    <span class="badge badge-new">Найдено протоколов: ${protocols.length}</span>
                </div>
            </div>
            ${firstProtocol.violator_birth_date ? `
            <div style="margin-top: 10px;">
                <span style="color: #4a6f8f;">Дата рождения:</span> ${formatDate(firstProtocol.violator_birth_date)}
            </div>
            ` : ''}
            ${firstProtocol.violator_driver_license ? `
            <div>
                <span style="color: #4a6f8f;">Водительское удостоверение:</span> ${escapeHtml(firstProtocol.violator_driver_license)}
            </div>
            ` : ''}
        `;

        // Отображаем список протоколов
        const protocolsContainer = document.getElementById('protocolsList');
        protocolsContainer.innerHTML = '';

        protocols.forEach(protocol => {
            const card = document.createElement('div');
            card.className = 'list-item';
            card.style.cursor = 'pointer';
            
            const statusClass = protocol.status === 'active' ? 'badge-new' : 'badge-closed';
            const statusText = protocol.status === 'active' ? 'Действующий' : 'Архивный';
            
            card.innerHTML = `
                <div style="flex:1;">
                    <div class="item-title">
                        Протокол №${escapeHtml(protocol.protocol_number || 'б/н')} 
                        <span class="badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="item-meta">
                        <strong>${formatDateTime(protocol.offense_datetime)}</strong> · 
                        ${escapeHtml(protocol.offense_place || '—')}<br>
                        <small>Ст. ${escapeHtml(protocol.offense_article_number || '')} ч.${escapeHtml(protocol.offense_article_part || '')} · 
                        ТС: ${escapeHtml(protocol.vehicle_make_model || '—')} (${escapeHtml(protocol.vehicle_license_plate || '—')})</small>
                    </div>
                </div>
                <button class="small" data-protocol-id="${protocol.id}">👁️ Просмотр</button>
            `;

            // Добавляем обработчик для просмотра
            const viewBtn = card.querySelector('button');
            viewBtn.onclick = (e) => {
                e.stopPropagation();
                openProtocolForGuest(protocol);
            };

            // Клик по карточке тоже открывает протокол
            card.onclick = () => openProtocolForGuest(protocol);

            protocolsContainer.appendChild(card);
        });

        document.getElementById('driverLicenseResults').style.display = 'block';
        document.getElementById('noProtocolsMessage').style.display = 'none';
    }

    // Инициализация страницы пробива по ВУ
    function initDriverLicensePage() {
        const clone = UI.loadTemplate('guestDriverLicense');
        if (!clone) {
            console.error('Driver license template not found');
            UI.showNotification('Ошибка загрузки страницы', 'error');
            return;
        }

        UI.clearMain();
        document.getElementById('mainApp').appendChild(clone);

        // Устанавливаем активную вкладку
        const elements = UI.getElements();
        if (elements.guestNavDriverLicense) {
            UI.setActiveTab(elements.guestNavDriverLicense);
        }

        // Назначаем обработчик на кнопку поиска
        const findBtn = document.getElementById('findDriverLicenseBtn');
        const input = document.getElementById('driverLicenseNumber');

        if (findBtn) {
            findBtn.onclick = async () => {
                const licenseNumber = input.value.trim();
                if (!licenseNumber) {
                    UI.showNotification('Введите номер водительского удостоверения', 'warning');
                    return;
                }

                // Показываем индикатор загрузки
                findBtn.textContent = '⏳ Поиск...';
                findBtn.disabled = true;

                try {
                    const result = await findProtocolsByLicenseNumber(licenseNumber);
                    
                    if (result.error) {
                        UI.showNotification(result.error, 'error');
                        document.getElementById('driverLicenseResults').style.display = 'none';
                        document.getElementById('noProtocolsMessage').style.display = 'block';
                        document.getElementById('noProtocolsMessage').innerHTML = `
                            <div style="background:#fff3cd; padding:20px; border-radius:12px; color:#856404;">
                                ${result.error}
                            </div>
                        `;
                    } else {
                        const violatorInfo = document.getElementById('violatorInfo');
                        renderResults(result.data, document.getElementById('protocolsList'), violatorInfo);
                    }
                } catch (error) {
                    console.error('Error searching:', error);
                    UI.showNotification('Ошибка при поиске', 'error');
                } finally {
                    findBtn.textContent = '🔍 Найти протоколы';
                    findBtn.disabled = false;
                }
            };
        }

        // Добавляем возможность поиска по Enter
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    findBtn.click();
                }
            });
            
            // Добавляем маску ввода для номера ВУ (только цифры)
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').substring(0, 6);
            });
        }
    }

    return {
        initDriverLicensePage,
        findProtocolsByLicenseNumber,
        openProtocolForGuest
    };
})();


window.DriverLicense = DriverLicense;
