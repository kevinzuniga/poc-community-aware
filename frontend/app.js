/**
 * PoC v2 - Circle Widgets Frontend
 * Integra widgets de Circle.so con autenticacion local
 */

const API_URL = 'http://localhost:3001';
const CIRCLE_DOMAIN = 'fuxion-aware.circle.so';

// Estado de la aplicacion
const state = {
  user: null,
  token: null,
  circleAuthUrl: null,
  widgetConfig: null,
  cursoPosts: [],
  currentSection: 'curso',
  isAdmin: false // Para demo, se activa con email que contenga "admin"
};

// ===================
// API Helper
// ===================

async function api(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Error: ${response.status}`);
  }

  return data;
}

// ===================
// Auth Functions
// ===================

function saveAuth(token, user) {
  state.token = token;
  state.user = user;
  state.isAdmin = user.email?.includes('admin') || user.email?.includes('kevin');
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function loadAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');

  if (token && user) {
    state.token = token;
    state.user = JSON.parse(user);
    state.isAdmin = state.user.email?.includes('admin') || state.user.email?.includes('kevin');
    return true;
  }
  return false;
}

function clearAuth() {
  state.token = null;
  state.user = null;
  state.circleAuthUrl = null;
  state.isAdmin = false;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  // Limpiar auth de Circle para forzar re-autenticación
  sessionStorage.removeItem('circleAuthComplete');
  sessionStorage.removeItem('pendingCircleAuth');
}

async function register(email, password, name) {
  const data = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name })
  });

  saveAuth(data.token, data.user);
  return data;
}

async function login(email, password) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  saveAuth(data.token, data.user);
  return data;
}

async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (e) {
    // Ignorar errores
  }
  clearAuth();
}

// ===================
// Circle Widget Functions
// ===================

async function getCircleAuthUrl() {
  try {
    const data = await api('/api/circle/auth-url');
    state.circleAuthUrl = data.authUrl;
    return data.authUrl;
  } catch (error) {
    console.error('Error getting Circle auth URL:', error);
    return null;
  }
}

// Funciones de autenticación con Circle eliminadas - ahora usamos el flujo manual con banner

async function loadWidgetConfig() {
  try {
    const config = await api('/api/circle/widget-config');
    state.widgetConfig = config;
    return config;
  } catch (error) {
    console.error('Error loading widget config:', error);
    return null;
  }
}

async function loadCursoPosts() {
  try {
    const data = await api('/api/circle/curso/posts');
    state.cursoPosts = data.posts || [];
    return state.cursoPosts;
  } catch (error) {
    console.error('Error loading curso posts:', error);
    return [];
  }
}

function initializeWidgets() {
  // Widget de Comunidad (Space completo)
  const comunidadWidget = document.getElementById('comunidad-widget');
  if (comunidadWidget) {
    comunidadWidget.src = `https://${CIRCLE_DOMAIN}/c/space-aware?iframe=true`;
  }

  // Widget de Anuncios (Space completo)
  const anunciosWidget = document.getElementById('anuncios-widget');
  if (anunciosWidget) {
    anunciosWidget.src = `https://${CIRCLE_DOMAIN}/c/anuncios?iframe=true`;
  }

  // Widget Admin de Anuncios (mismo space pero para admin)
  const adminAnunciosWidget = document.getElementById('admin-anuncios-widget');
  if (adminAnunciosWidget) {
    adminAnunciosWidget.src = `https://${CIRCLE_DOMAIN}/c/anuncios?iframe=true`;
  }
}

function loadCursoCommentsWidget(postSlug) {
  const widget = document.getElementById('curso-comments-widget');
  const link = document.getElementById('curso-comments-link');
  if (postSlug) {
    const url = `https://${CIRCLE_DOMAIN}/c/leadership-academy/${postSlug}`;
    // Cargar el post especifico para ver sus comentarios
    if (widget) {
      widget.src = url + '?iframe=true';
    }
    // Actualizar link directo
    if (link) {
      link.href = url;
    }
  }
}

// ===================
// UI Functions
// ===================

function showError(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    element.classList.remove('hidden');
    setTimeout(() => element.classList.add('hidden'), 5000);
  }
}

function showLoading(show) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.toggle('hidden', !show);
  }
}

function showAuthSection() {
  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('main-content').classList.add('hidden');
  document.getElementById('user-info').classList.add('hidden');
}

async function showMainContent() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('main-content').classList.remove('hidden');
  document.getElementById('user-info').classList.remove('hidden');
  document.getElementById('user-name').textContent = state.user?.name || state.user?.email || 'Usuario';

  // Mostrar tab de admin si corresponde
  const adminTab = document.querySelector('.admin-only');
  if (adminTab) {
    adminTab.classList.toggle('hidden', !state.isAdmin);
  }

  // Verificar si venimos de una autenticación de Circle
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('circle_auth') === 'success') {
    sessionStorage.setItem('circleAuthComplete', 'true');
    // Limpiar URL
    window.history.replaceState({}, '', window.location.pathname);
    console.log('Circle auth successful via redirect');
  }

  // Verificar si necesita conectar con Circle
  if (!sessionStorage.getItem('circleAuthComplete')) {
    console.log('Circle auth not complete - showing banner');
    showCircleAuthBanner();
  } else {
    hideCircleAuthBanner();
  }

  // Inicializar widgets (se mostrarán aunque requieran login)
  initializeWidgets();

  // Cargar posts del curso
  await loadCursoPosts();
  renderCursoNav();

  // Mostrar seccion por defecto
  switchSection('curso');
}

// Función para conectar con Circle - abre en nueva pestaña
async function connectToCircle() {
  const authUrl = await getCircleAuthUrl();
  if (!authUrl) {
    alert('Error obteniendo URL de autenticación. Por favor recarga la página.');
    return;
  }

  // Abrir en nueva pestaña completa
  const newTab = window.open(authUrl, '_blank');

  if (!newTab) {
    alert('Por favor permite las ventanas emergentes para este sitio.');
    return;
  }

  // Actualizar banner
  const banner = document.getElementById('circle-auth-banner');
  if (banner) {
    const textDiv = banner.querySelector('.auth-banner-text');
    textDiv.innerHTML = `
      <strong>Conexion en progreso...</strong>
      <p>Se ha abierto una nueva pestaña. Una vez que veas la comunidad Circle, cierra esa pestaña y haz clic en el boton.</p>
    `;
    const btn = banner.querySelector('#connect-circle-btn');
    btn.textContent = 'Ya conecte, recargar widgets';
    btn.onclick = () => {
      sessionStorage.setItem('circleAuthComplete', 'true');
      banner.classList.add('hidden');
      // Recargar widgets
      reloadWidgets();
    };
  }
}

// Función para reconectar con Circle manualmente
async function reconnectCircle() {
  // Limpiar estado de auth de Circle
  sessionStorage.removeItem('circleAuthComplete');

  // Mostrar banner
  showCircleAuthBanner();

  // Iniciar conexión
  await connectToCircle();
}

// Mostrar banner de autenticación requerida
function showCircleAuthBanner() {
  const banner = document.getElementById('circle-auth-banner');
  if (banner) {
    banner.classList.remove('hidden');
  }
}

// Ocultar banner
function hideCircleAuthBanner() {
  const banner = document.getElementById('circle-auth-banner');
  if (banner) {
    banner.classList.add('hidden');
  }
}

// Recargar todos los widgets
function reloadWidgets() {
  console.log('Reloading widgets...');

  // Recargar widget de comunidad
  const comunidadWidget = document.getElementById('comunidad-widget');
  if (comunidadWidget && comunidadWidget.src) {
    comunidadWidget.src = comunidadWidget.src;
  }

  // Recargar widget de anuncios
  const anunciosWidget = document.getElementById('anuncios-widget');
  if (anunciosWidget && anunciosWidget.src) {
    anunciosWidget.src = anunciosWidget.src;
  }

  // Recargar widget de admin
  const adminWidget = document.getElementById('admin-anuncios-widget');
  if (adminWidget && adminWidget.src) {
    adminWidget.src = adminWidget.src;
  }

  // Recargar widget de comentarios del curso
  const cursoWidget = document.getElementById('curso-comments-widget');
  if (cursoWidget && cursoWidget.src) {
    cursoWidget.src = cursoWidget.src;
  }
}

async function switchSection(sectionName) {
  state.currentSection = sectionName;

  // Ocultar todas las secciones
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.add('hidden');
  });

  // Mostrar seccion seleccionada
  const section = document.getElementById(`section-${sectionName}`);
  if (section) {
    section.classList.remove('hidden');
  }

  // Actualizar tabs activos
  document.querySelectorAll('.section-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.section === sectionName);
  });

  // Cargar datos especificos de la seccion
  if (sectionName === 'admin-anuncios') {
    const posts = await loadAnnouncements();
    renderAnnouncementsList(posts);
  }
}

function renderCursoNav() {
  const nav = document.getElementById('curso-nav');
  if (!nav || state.cursoPosts.length === 0) {
    nav.innerHTML = '<p class="empty-state">No hay contenido disponible</p>';
    return;
  }

  // Organizar posts
  const cursoGeneral = [];
  const modulos = [];
  const lecciones = {};

  state.cursoPosts.forEach(post => {
    const name = post.name.toLowerCase();
    if (name.includes('modulo')) {
      modulos.push(post);
    } else if (name.includes('leccion')) {
      // Extraer numero de modulo de la leccion (ej: "Leccion 1.1" -> modulo 1)
      const match = post.name.match(/(\d+)\./);
      const moduloNum = match ? match[1] : '1';
      if (!lecciones[moduloNum]) lecciones[moduloNum] = [];
      lecciones[moduloNum].push(post);
    } else if (name.includes('curso') || name.includes('general') || name.includes('bienvenid')) {
      // Post del curso general
      cursoGeneral.push(post);
    }
  });

  // Ordenar
  modulos.sort((a, b) => a.name.localeCompare(b.name));

  let html = '';

  // Primero mostrar el curso general
  if (cursoGeneral.length > 0) {
    html += `
      <div class="curso-nav-item curso-nav-general">
        ${cursoGeneral.map(post => `
          <button class="curso-nav-curso" data-post-id="${post.id}" data-slug="${post.slug}">
            <span class="curso-icon">🎓</span>
            ${post.name}
          </button>
        `).join('')}
      </div>
      <hr class="curso-nav-divider">
    `;
  }

  // Luego los modulos y lecciones
  modulos.forEach((modulo, index) => {
    const moduloNum = (index + 1).toString();
    const moduloLecciones = lecciones[moduloNum] || [];
    moduloLecciones.sort((a, b) => a.name.localeCompare(b.name));

    html += `
      <div class="curso-nav-item">
        <button class="curso-nav-modulo" data-post-id="${modulo.id}" data-slug="${modulo.slug}">
          <span class="modulo-icon">📦</span>
          ${modulo.name}
        </button>
        ${moduloLecciones.length > 0 ? `
          <div class="curso-nav-lecciones">
            ${moduloLecciones.map(leccion => `
              <button class="curso-nav-leccion" data-post-id="${leccion.id}" data-slug="${leccion.slug}">
                <span class="leccion-icon">📖</span>
                ${leccion.name}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  });

  nav.innerHTML = html;
}

function showCursoDetail(postId, postSlug, postName) {
  document.getElementById('curso-content-placeholder').classList.add('hidden');
  document.getElementById('curso-detail').classList.remove('hidden');
  document.getElementById('curso-detail-title').textContent = postName;

  // Cargar widget de comentarios para este post
  loadCursoCommentsWidget(postSlug);

  // Marcar item activo
  document.querySelectorAll('.curso-nav-modulo, .curso-nav-leccion').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.postId === postId.toString());
  });
}

// ===================
// Admin Functions
// ===================

async function createAnnouncement(title, body) {
  return await api('/api/circle/admin/announcements', {
    method: 'POST',
    body: JSON.stringify({ title, body })
  });
}

async function loadAnnouncements() {
  try {
    const data = await api('/api/circle/announcements');
    return data.posts || [];
  } catch (error) {
    console.error('Error loading announcements:', error);
    return [];
  }
}

function renderAnnouncementsList(posts) {
  const container = document.getElementById('announcements-list');
  if (!container) return;

  if (posts.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay anuncios publicados</p>';
    return;
  }

  container.innerHTML = posts.map(post => `
    <div class="announcement-card">
      <h4>${post.name}</h4>
      <p>${post.body?.content?.[0]?.content?.[0]?.text || 'Sin contenido'}</p>
      <small>Publicado: ${new Date(post.created_at).toLocaleDateString('es-ES')}</small>
    </div>
  `).join('');
}

function showAnnouncementStatus(message, isError = false) {
  const status = document.getElementById('announcement-status');
  if (status) {
    status.textContent = message;
    status.className = `status-msg ${isError ? 'error' : 'success'}`;
    status.classList.remove('hidden');
    setTimeout(() => status.classList.add('hidden'), 5000);
  }
}

// ===================
// Event Handlers
// ===================

function setupEventListeners() {
  // Auth tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
      document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
    });
  });

  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      await login(email, password);
      await showMainContent();
    } catch (error) {
      showError('login-error', error.message);
    }
  });

  // Register form
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    try {
      await register(email, password, name);
      await showMainContent();
    } catch (error) {
      showError('register-error', error.message);
    }
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await logout();
    showAuthSection();
  });

  // Reconnect to Circle (header button)
  document.getElementById('reconnect-circle-btn').addEventListener('click', async () => {
    await reconnectCircle();
  });

  // Connect to Circle (banner button)
  const connectBtn = document.getElementById('connect-circle-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      await connectToCircle();
    });
  }

  // Section tabs
  document.querySelectorAll('.section-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const section = tab.dataset.section;
      switchSection(section);
    });
  });

  // Curso navigation (delegated)
  document.getElementById('curso-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.curso-nav-curso, .curso-nav-modulo, .curso-nav-leccion');
    if (btn) {
      const postId = btn.dataset.postId;
      const postSlug = btn.dataset.slug;
      const postName = btn.textContent.trim();
      showCursoDetail(postId, postSlug, postName);
    }
  });

  // Admin announcement form
  const announcementForm = document.getElementById('create-announcement-form');
  if (announcementForm) {
    announcementForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const titleInput = document.getElementById('announcement-title');
      const bodyInput = document.getElementById('announcement-body');
      const submitBtn = announcementForm.querySelector('button[type="submit"]');

      const title = titleInput.value.trim();
      const body = bodyInput.value.trim();

      if (!title || !body) {
        showAnnouncementStatus('Titulo y contenido son requeridos', true);
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Publicando...';

        await createAnnouncement(title, body);

        showAnnouncementStatus('Anuncio publicado exitosamente');
        titleInput.value = '';
        bodyInput.value = '';

        // Recargar lista de anuncios
        const posts = await loadAnnouncements();
        renderAnnouncementsList(posts);
      } catch (error) {
        showAnnouncementStatus(error.message || 'Error al publicar anuncio', true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publicar Anuncio';
      }
    });
  }
}

// ===================
// Initialization
// ===================

async function init() {
  setupEventListeners();

  if (loadAuth()) {
    try {
      await api('/auth/me');
      await showMainContent();
    } catch {
      clearAuth();
      showAuthSection();
    }
  } else {
    showAuthSection();
  }
}

// Iniciar
init();
