// === 1. Утилиты ===

// Переключение страниц (скрываем все, показываем нужную)
const showPage = id => document.querySelectorAll('.page').forEach(p => p.classList.toggle('hidden', p.id !== id));

// Показать уведомление (Toast)
const toast = msg => {
  const t = document.getElementById('toast');
  t.textContent = typeof msg === 'object' ? Object.values(msg)[0] : msg; // Если объект, берем текст
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
};

// Показать ошибку под полем
const setErr = (id, msg) => document.getElementById(id).textContent = msg || '';

// === 2. Слайдер (Авто 3 сек) ===
let sIdx = 0, sInt; 
const slides = () => document.querySelectorAll('.slider img');

const showSlide = n => {
  const s = slides();
  if (n >= s.length) sIdx = 0; // Зацикливание вперед
  if (n < 0) sIdx = s.length - 1; // Зацикливание назад
  s.forEach(i => i.classList.remove('active'));
  s[sIdx].classList.add('active');
};

window.moveSlide = n => { sIdx += n; showSlide(sIdx); resetS(); };

const resetS = () => { clearInterval(sInt); sInt = setInterval(() => { sIdx++; showSlide(sIdx); }, 3000); };
if (document.querySelector('.slider')) resetS(); // Запуск при загрузке

// === 3. API (Отправка данных на сервер) ===
const api = async (action, data = {}) => {
  try {
    // POST запрос в api.php?a=действие
    const r = await fetch(`api.php?a=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const j = await r.json();

    if (j.err) return toast(j.err); // Если ошибка

    // Обработка успешных действий
    if (action === 'login') {
      localStorage.setItem('role', j.role); // Запомнить роль
      localStorage.setItem('fio', j.fio || 'User'); // Запомнить имя
      document.getElementById('userName').textContent = j.fio || 'User';
      document.getElementById('logoutBtn').style.display = 'inline';
      showPage(j.role === 'admin' ? 'admin' : 'user');
      j.role === 'admin' ? renderAdmin() : renderApps();
    }
    if (action === 'reg') { toast('Успех'); showPage('login'); }
    if (action === 'newapp') { toast('Заявка отправлена'); renderApps(); }
    if (action === 'setstatus' || action === 'feedback') toast('Сохранено');
    return j;
  } catch { toast('Ошибка сети'); }
};

// === 4. Сбор данных из форм ===
window.doLogin = () => api('login', {
  login: document.getElementById('l_login').value,
  pass: document.getElementById('l_pass').value
});

window.doReg = () => api('reg', {
  login: document.getElementById('r_login').value,
  pass: document.getElementById('r_pass').value,
  fio: document.getElementById('r_fio').value,
  phone: document.getElementById('r_phone').value,
  email: document.getElementById('r_email').value
});

window.doNewApp = () => api('newapp', {
  course: document.getElementById('a_course').value,
  date: document.getElementById('a_date').value,
  pay: document.getElementById('a_pay').value
});

// === 5. Рендер (Отрисовка списков) ===

// Заявки пользователя
const renderApps = async () => {
  const apps = await fetch('api.php?a=myapps').then(r => r.json());
  const list = document.getElementById('appsList');
  list.innerHTML = apps.map(a => `
        <div class="app-card">
            <b>${a.course}</b> | ${a.start_date}<br>
            Статус: <span style="color:${a.status === 'Новая' ? 'orange' : 'green'}">${a.status}</span>
            ${a.status === 'Обучение завершено' ?
      `<br><input placeholder="Ваш отзыв" id="fb_${a.id}">
                 <button onclick="api('feedback',{id:${a.id},fb:document.getElementById('fb_${a.id}').value})">Отправить отзыв</button>` : ''}
        </div>`).join('');
};

// Заявки администратора (Фильтр + Пагинация)
let admPage = 1;
window.renderAdmin = async () => {
  const filter = document.getElementById('adminFilter').value;
  // Загружаем с фильтром
  const apps = await fetch(`api.php?a=adminapps&f=${filter}`).then(r => r.json());

  // Пагинация (по 5 штук)
  const perPage = 5;
  const start = (admPage - 1) * perPage;
  const chunk = apps.slice(start, start + perPage);

  document.getElementById('adminList').innerHTML = chunk.map(a => `
        <div class="app-card">
            <b>${a.fio}</b> (${a.email})<br>
            Курс: ${a.course} | ${a.start_date}<br>
            <select onchange="api('setstatus',{id:${a.id},status:this.value})">
                <option ${a.status === 'Новая' ? 'selected' : ''}>Новая</option>
                <option ${a.status === 'Идет обучение' ? 'selected' : ''}>Идет обучение</option>
                <option ${a.status === 'Обучение завершено' ? 'selected' : ''}>Обучение завершено</option>
            </select>
        </div>`).join('');

  // Кнопки пагинации
  const total = Math.ceil(apps.length / perPage);
  document.getElementById('pag').innerHTML = total > 1 ?
    `<button onclick="admPage--;renderAdmin()" ${admPage == 1 ? 'disabled' : ''}>←</button> 
         <span style="margin:0 10px">${admPage}/${total}</span> 
         <button onclick="admPage++;renderAdmin()" ${admPage == total ? 'disabled' : ''}>→</button>` : '';
};

// Выход
window.logout = () => {
  localStorage.clear();
  location.reload(); // Перезагрузка страницы для сброса
};