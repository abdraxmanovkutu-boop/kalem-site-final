const STORAGE_KEY = 'kalemAnalytics';
const ADMIN_TOKEN = 'kalemAdminAuth';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'Kalem2026!';

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getPageKey() {
  return location.hash || location.pathname || 'index';
}

function ensureStructure(data) {
  data.visits = Number(data.visits || 0);
  data.clicks = Number(data.clicks || 0);
  data.favorites = Number(data.favorites || 0);
  data.orders = Number(data.orders || 0);
  data.pageViews = data.pageViews || {};
  data.dailyVisits = data.dailyVisits || {};
  data.products = data.products || {};
  data.surveyEntries = data.surveyEntries || [];
  data.messages = data.messages || [];
  return data;
}

function trackVisit() {
  const sessionKey = 'kalemVisitTracked';
  const data = ensureStructure(loadData());
  const day = todayKey();

  data.pageViews[getPageKey()] = Number(data.pageViews[getPageKey()] || 0) + 1;

  if (!sessionStorage.getItem(sessionKey)) {
    data.visits += 1;
    data.dailyVisits[day] = Number(data.dailyVisits[day] || 0) + 1;
    sessionStorage.setItem(sessionKey, 'yes');
  }
  saveData(data);
}

function trackClick(productName, type = 'views') {
  const data = ensureStructure(loadData());
  data.clicks += 1;
  data.products[productName] = data.products[productName] || { views: 0, favorites: 0, orders: 0 };
  data.products[productName][type] = Number(data.products[productName][type] || 0) + 1;
  if (type === 'favorites') data.favorites += 1;
  if (type === 'orders') data.orders += 1;
  saveData(data);
  renderDashboardIfOpen();
}

function sumValues(obj = {}) {
  return Object.values(obj).reduce((acc, val) => acc + Number(val || 0), 0);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateMetrics(data) {
  const visits = Number(data.visits || 0);
  const pageViews = sumValues(data.pageViews || {});
  const clicks = Number(data.clicks || 0);
  const favorites = Number(data.favorites || 0);
  const orders = Number(data.orders || 0);
  const productCount = Object.keys(data.products || {}).length;
  const surveyCount = (data.surveyEntries || []).length;
  const conversion = visits ? ((orders / visits) * 100).toFixed(1) : '0.0';

  setText('visitsValue', visits);
  setText('pageViewsValue', pageViews);
  setText('clicksValue', clicks);
  setText('favoritesValue', favorites);
  setText('ordersValue', orders);
  setText('productsCountValue', productCount);
  setText('surveyCount', surveyCount);
  setText('conversionValue', `${conversion}%`);
}

function getLastDaysMap(data, days = 7) {
  const map = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map[key] = Number((data.dailyVisits || {})[key] || 0);
  }
  return map;
}

function renderVisitsChart(data) {
  const svg = document.getElementById('visitsChart');
  if (!svg) return;
  const pointsMap = getLastDaysMap(data, 7);
  const entries = Object.entries(pointsMap);
  const values = entries.map(([, v]) => v);
  const max = Math.max(...values, 5);
  const width = 700;
  const height = 240;
  const padX = 40;
  const padY = 28;
  const stepX = (width - padX * 2) / (entries.length - 1 || 1);
  const points = entries.map(([, value], index) => {
    const x = padX + index * stepX;
    const y = height - padY - ((value / max) * (height - padY * 2));
    return `${x},${y}`;
  }).join(' ');

  const grid = [0, 1, 2, 3, 4].map(i => {
    const y = padY + i * ((height - padY * 2) / 4);
    return `<line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
  }).join('');

  const labels = entries.map(([day], index) => {
    const x = padX + index * stepX;
    const label = day.slice(5);
    return `<text x="${x}" y="226" fill="rgba(255,255,255,0.6)" font-size="12" text-anchor="middle">${label}</text>`;
  }).join('');

  const dots = entries.map(([, value], index) => {
    const x = padX + index * stepX;
    const y = height - padY - ((value / max) * (height - padY * 2));
    return `<circle cx="${x}" cy="${y}" r="5" fill="#29d5bd" stroke="#6fa8ff" stroke-width="3"/>`;
  }).join('');

  svg.innerHTML = `
    ${grid}
    <polyline fill="none" stroke="url(#gradient)" stroke-width="4" points="${points}" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${dots}
    ${labels}
    <defs>
      <linearGradient id="gradient" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stop-color="#6fa8ff"/>
        <stop offset="100%" stop-color="#29d5bd"/>
      </linearGradient>
    </defs>
  `;
}

function renderAge(data) {
  const entries = data.surveyEntries || [];
  const groups = { 'до 18': 0, '18–24': 0, '25–34': 0, '35+': 0 };
  entries.forEach(item => {
    const age = Number(item.age || 0);
    if (age < 18) groups['до 18'] += 1;
    else if (age <= 24) groups['18–24'] += 1;
    else if (age <= 34) groups['25–34'] += 1;
    else groups['35+'] += 1;
  });

  const total = Object.values(groups).reduce((a, b) => a + b, 0) || 1;
  const colors = ['#6fa8ff', '#29d5bd', '#ffc84d', '#f77ca1'];
  const segments = Object.values(groups).map(v => (v / total) * 100);
  let cumulative = 0;
  const pieces = segments.map((value, i) => {
    const start = cumulative;
    cumulative += value;
    return `${colors[i]} ${start}% ${cumulative}%`;
  }).join(', ');

  const donut = document.getElementById('ageDonut');
  if (donut) donut.style.background = `conic-gradient(${pieces})`;

  const legend = document.getElementById('ageLegend');
  if (legend) {
    legend.innerHTML = Object.entries(groups).map(([label, val], i) => `
      <div class="legend-item">
        <div><span class="dot" style="background:${colors[i]}"></span>${label}</div>
        <strong>${val}</strong>
      </div>
    `).join('');
  }
}

function renderRegions(data) {
  const regionCounts = {};
  (data.surveyEntries || []).forEach(item => {
    const key = item.region || 'Не указано';
    regionCounts[key] = (regionCounts[key] || 0) + 1;
  });
  const sorted = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(...sorted.map(([, v]) => v), 1);
  const wrap = document.getElementById('regionBars');
  if (!wrap) return;
  wrap.innerHTML = sorted.length ? sorted.map(([label, value]) => `
    <div class="bar-row">
      <div class="bar-label"><span>${label}</span><strong>${value}</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(value / max) * 100}%"></div></div>
    </div>
  `).join('') : '<p style="color:var(--admin-muted)">Пока нет данных по регионам.</p>';
}

function renderProducts(data) {
  const body = document.getElementById('productsTableBody');
  if (!body) return;
  const rows = Object.entries(data.products || {}).sort((a, b) => {
    const scoreA = Number(a[1].views || 0) + Number(a[1].orders || 0) * 2 + Number(a[1].favorites || 0);
    const scoreB = Number(b[1].views || 0) + Number(b[1].orders || 0) * 2 + Number(b[1].favorites || 0);
    return scoreB - scoreA;
  });
  body.innerHTML = rows.length ? rows.map(([name, stat]) => `
    <tr>
      <td>${name}</td>
      <td>${stat.views || 0}</td>
      <td>${stat.favorites || 0}</td>
      <td>${stat.orders || 0}</td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="color:var(--admin-muted)">Пока нет статистики по товарам.</td></tr>';
}

function renderDashboardIfOpen() {
  if (!sessionStorage.getItem(ADMIN_TOKEN)) return;
  const data = ensureStructure(loadData());
  updateMetrics(data);
  renderVisitsChart(data);
  renderAge(data);
  renderRegions(data);
  renderProducts(data);
}

function openAnalytics() {
  document.getElementById('analyticsLoginCard')?.classList.add('hidden');
  document.getElementById('analyticsDashboard')?.classList.remove('hidden');
  renderDashboardIfOpen();
}

function closeAnalytics() {
  document.getElementById('analyticsLoginCard')?.classList.remove('hidden');
  document.getElementById('analyticsDashboard')?.classList.add('hidden');
}

function bindAnalyticsLogin() {
  const openBtn = document.getElementById('openAdminLogin');
  const modal = document.getElementById('adminLoginModal');
  const closeBtn = document.getElementById('closeAdminLogin');
  const form = document.getElementById('adminLoginForm');
  const analyticsSection = document.getElementById('analytics');
  const logoutBtn = document.getElementById('logoutBtn');
  const resetBtn = document.getElementById('resetDataBtn');

  function openModal() {
    modal && modal.classList.remove('hidden');
  }

  function closeModal() {
    modal && modal.classList.add('hidden');
  }

  function openAnalytics() {
    analyticsSection && analyticsSection.classList.remove('hidden');
    renderDashboardIfOpen();
    analyticsSection && analyticsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeAnalytics() {
    analyticsSection && analyticsSection.classList.add('hidden');
  }

  openBtn && openBtn.addEventListener('click', () => {
    openModal();
  });

  closeBtn && closeBtn.addEventListener('click', () => {
    closeModal();
  });

  modal && modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  form && form.addEventListener('submit', (e) => {
    e.preventDefault();

    const user = document.getElementById('adminUser').value.trim();
    const pass = document.getElementById('adminPass').value.trim();

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      sessionStorage.setItem(ADMIN_TOKEN, 'ok');
      closeModal();
      openAnalytics();
      form.reset();
    } else {
      alert('Неверный логин или пароль');
    }
  });

  logoutBtn && logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem(ADMIN_TOKEN);
    closeAnalytics();
  });

  resetBtn && resetBtn.addEventListener('click', () => {
    if (confirm('Удалить все сохранённые данные аналитики?')) {
      localStorage.removeItem(STORAGE_KEY);
      renderDashboardIfOpen();
    }
  });

  if (sessionStorage.getItem(ADMIN_TOKEN) === 'ok') {
    openAnalytics();
  } else {
    closeAnalytics();
  }
}

function bindSurvey() {
  const modal = document.getElementById('surveyModal');
  const openBtn = document.getElementById('openSurveyFloating');
  const closeBtn = document.getElementById('closeSurvey');
  const form = document.getElementById('surveyForm');

  openBtn && openBtn.addEventListener('click', () => modal && modal.classList.remove('hidden'));
  closeBtn && closeBtn.addEventListener('click', () => modal && modal.classList.add('hidden'));

  modal && modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  form && form.addEventListener('submit', (e) => {
    e.preventDefault();
    const age = Number(document.getElementById('ageInput').value);
    const regionSelect = document.getElementById('regionInput').value;
    const other = document.getElementById('otherInput').value.trim();
    const region = regionSelect === 'Другое' && other ? other : regionSelect;

    const data = ensureStructure(loadData());
    data.surveyEntries.push({ age, region, date: new Date().toISOString() });
    saveData(data);
    modal.classList.add('hidden');
    form.reset();
    alert('Спасибо! Ваш ответ сохранён.');
    renderDashboardIfOpen();
  });
}

function bindProductCards() {
  const modal = document.getElementById('productModal');
  const closeBtn = document.getElementById('closeProductModal');
  const title = document.getElementById('modalTitle');
  const desc = document.getElementById('modalDesc');
  const image = document.getElementById('modalImage');
  const favBtn = document.getElementById('modalFavBtn');
  const orderBtn = document.getElementById('modalOrderBtn');
  let currentProduct = '';

  document.querySelectorAll('.searchable-card').forEach(card => {
    const productName = card.dataset.product || card.dataset.name || 'Товар';
    const cardImage = card.querySelector('img')?.getAttribute('src') || '';
    const productDesc = card.dataset.desc || card.querySelector('p')?.textContent || '';

    card.querySelectorAll('.track-view').forEach(btn => {
      btn.addEventListener('click', () => {
        currentProduct = productName;
        trackClick(productName, 'views');
        title.textContent = productName;
        desc.textContent = productDesc;
        image.src = cardImage;
        modal?.classList.remove('hidden');
      });
    });

    card.querySelectorAll('.track-fav').forEach(btn => {
      btn.addEventListener('click', () => {
        trackClick(productName, 'favorites');
        alert('Добавлено в избранное');
      });
    });

    card.querySelectorAll('.track-order').forEach(btn => {
      btn.addEventListener('click', () => {
        trackClick(productName, 'orders');
        alert('Заявка на заказ сохранена в аналитике');
      });
    });
  });

  favBtn?.addEventListener('click', () => {
    if (currentProduct) {
      trackClick(currentProduct, 'favorites');
      alert('Добавлено в избранное');
    }
  });

  orderBtn?.addEventListener('click', () => {
    if (currentProduct) {
      trackClick(currentProduct, 'orders');
      alert('Заявка на заказ сохранена в аналитике');
    }
  });

  closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
}

function bindFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const filter = btn.dataset.filter;
      const grid = document.getElementById(targetId);
      if (!grid) return;
      document.querySelectorAll(`.filter-btn[data-target="${targetId}"]`).forEach(item => item.classList.remove('active'));
      btn.classList.add('active');
      grid.querySelectorAll('.searchable-card').forEach(card => {
        const visible = filter === 'all' || card.dataset.type === filter;
        card.classList.toggle('card-hidden', !visible);
      });
    });
  });
}

function bindSearch() {
  const bind = (inputId, gridId) => {
    const input = document.getElementById(inputId);
    const grid = document.getElementById(gridId);
    input?.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      grid?.querySelectorAll('.searchable-card').forEach(card => {
        const text = `${card.dataset.name || ''} ${card.dataset.desc || ''} ${card.textContent}`.toLowerCase();
        card.classList.toggle('card-hidden', query && !text.includes(query));
      });
    });
  };
  bind('bookSearch', 'booksGrid');
  bind('trainerSearch', 'trainersGrid');
}

function bindFaq() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.faq-item')?.classList.toggle('open'));
  });
}

function bindMenu() {
  const btn = document.getElementById('menuToggle');
  const nav = document.getElementById('topNav');
  btn?.addEventListener('click', () => nav?.classList.toggle('open'));
  nav?.querySelectorAll('a, button').forEach(item => item.addEventListener('click', () => nav.classList.remove('open')));
}

function bindContactForm() {
  const form = document.getElementById('contactForm');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = ensureStructure(loadData());
    data.messages.push({
      name: document.getElementById('contactName').value.trim(),
      phone: document.getElementById('contactPhone').value.trim(),
      message: document.getElementById('contactMessage').value.trim(),
      date: new Date().toISOString()
    });
    saveData(data);
    form.reset();
    alert('Спасибо! Заявка сохранена.');
    renderDashboardIfOpen();
  });
}

trackVisit();
bindMenu();
bindSurvey();
bindProductCards();
bindFilters();
bindSearch();
bindFaq();
bindContactForm();
bindAnalyticsLogin();
renderDashboardIfOpen();
