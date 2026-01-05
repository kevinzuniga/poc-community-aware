/**
 * PoC v3 - Circle WebView Integration
 * Integra Circle.so como webview completa con auto-login
 */

// Detectar entorno: producción vs desarrollo
const isProduction = window.location.hostname !== 'localhost';
const API_URL = isProduction
  ? 'https://api.thenextlevelplay.co'
  : 'http://localhost:3001';
const CIRCLE_DOMAIN = isProduction
  ? 'community.thenextlevelplay.co'
  : 'fuxion-aware.circle.so';

// Estado de la aplicacion
const state = {
  user: null,
  token: null,
  circleAuthUrl: null,
  cursoPosts: [],
  currentSection: 'curso',
  currentCursoSlug: null,
  circleWebviewLoaded: false
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
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function loadAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');

  if (token && user) {
    state.token = token;
    state.user = JSON.parse(user);
    return true;
  }
  return false;
}

function clearAuth() {
  state.token = null;
  state.user = null;
  state.circleAuthUrl = null;
  state.circleWebviewLoaded = false;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('circleAuthComplete');
  sessionStorage.removeItem('circleAuthenticated');
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
// Circle WebView Functions
// ===================

async function getCircleAuthUrl(returnPath = '') {
  try {
    const data = await api('/api/circle/auth-url' + (returnPath ? `?return_path=${encodeURIComponent(returnPath)}` : ''));
    state.circleAuthUrl = data.authUrl;
    return data.authUrl;
  } catch (error) {
    console.error('Error getting Circle auth URL:', error);
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

/**
 * Inicializa la webview de Circle con auto-login
 * En producción (mismo TLD): carga directo con cookies
 * En desarrollo (diferente TLD): usa popup para autenticación
 * @param {string} path - Path opcional dentro de Circle (para deeplinks)
 */
async function initCircleWebview(path = '') {
  const webview = document.getElementById('circle-webview');
  const loading = document.getElementById('comunidad-loading');

  if (!webview) return;

  // Mostrar loading
  if (loading) loading.classList.remove('hidden');

  // Si ya está autenticado en Circle, cargar directamente
  if (sessionStorage.getItem('circleAuthenticated')) {
    loadCircleDirectly(webview, loading, path);
    return;
  }

  try {
    // Obtener URL de autenticacion
    const authUrl = await getCircleAuthUrl(path);

    if (!authUrl) {
      loadCircleDirectly(webview, loading, path);
      return;
    }

    // En PRODUCCIÓN (mismo TLD): cargar auth URL directamente en el iframe
    // Las cookies se establecen porque comparten el mismo dominio raíz
    if (isProduction) {
      console.log('[Circle Auth] Producción: cargando auth URL directamente (mismo TLD)');
      webview.src = authUrl;
      webview.onload = () => {
        if (loading) loading.classList.add('hidden');
        state.circleWebviewLoaded = true;
        sessionStorage.setItem('circleAuthenticated', 'true');
        console.log('Circle webview loaded (producción)');
      };
      return;
    }

    // En DESARROLLO (diferente TLD): usar popup para autenticación
    console.log('[Circle Auth] Desarrollo: usando popup (diferente TLD)');
    const popup = window.open(authUrl, 'circleAuth', 'width=500,height=600,scrollbars=yes');

    if (!popup) {
      showAuthPopupBlocked(webview, loading, path);
      return;
    }

    // Monitorear el popup
    const checkPopup = setInterval(() => {
      try {
        if (popup.location.hostname === CIRCLE_DOMAIN) {
          clearInterval(checkPopup);
          setTimeout(() => {
            popup.close();
            sessionStorage.setItem('circleAuthenticated', 'true');
            loadCircleDirectly(webview, loading, path);
          }, 1000);
        }
      } catch (e) {
        // Cross-origin - esperamos
      }

      if (popup.closed) {
        clearInterval(checkPopup);
        sessionStorage.setItem('circleAuthenticated', 'true');
        loadCircleDirectly(webview, loading, path);
      }
    }, 500);

    setTimeout(() => {
      clearInterval(checkPopup);
      if (!popup.closed) popup.close();
      loadCircleDirectly(webview, loading, path);
    }, 30000);

  } catch (error) {
    console.error('Error initializing Circle webview:', error);
    loadCircleDirectly(webview, loading, path);
  }
}

/**
 * Carga Circle directamente en el iframe
 */
function loadCircleDirectly(webview, loading, path = '') {
  const circleUrl = path
    ? `https://${CIRCLE_DOMAIN}${path}`
    : `https://${CIRCLE_DOMAIN}`;

  webview.src = circleUrl;
  webview.onload = () => {
    if (loading) loading.classList.add('hidden');
    state.circleWebviewLoaded = true;
    console.log('Circle webview loaded:', circleUrl);
  };
}

/**
 * Muestra mensaje cuando el popup está bloqueado
 */
function showAuthPopupBlocked(webview, loading, path) {
  if (loading) {
    loading.innerHTML = `
      <div class="auth-required-message">
        <p>Para ver la comunidad, necesitas autenticarte en Circle.</p>
        <button class="btn btn-primary" onclick="retryCircleAuth('${path}')">
          Conectar con Circle
        </button>
        <p class="small-text">Se abrirá una ventana para autenticarte</p>
      </div>
    `;
  }
}

/**
 * Reintenta autenticación con Circle
 */
async function retryCircleAuth(path = '') {
  sessionStorage.removeItem('circleAuthenticated');
  await initCircleWebview(path);
}

/**
 * Navega a un post especifico en la comunidad (para comentarios de cursos)
 * @param {string} postSlug - Slug del post en Circle
 */
function navigateToCommunityPost(postSlug) {
  const path = `/c/leadership-academy/${postSlug}`;

  // Cambiar a la seccion comunidad
  switchSection('comunidad');

  // Cargar webview con el deeplink
  const webview = document.getElementById('circle-webview');
  if (webview && state.circleWebviewLoaded) {
    // Si ya esta cargada, navegar directamente
    webview.src = `https://${CIRCLE_DOMAIN}${path}`;
  } else {
    // Si no, inicializar con el path
    initCircleWebview(path);
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

  // Cargar posts del curso
  await loadCursoPosts();
  renderCursoNav();

  // Mostrar seccion por defecto
  switchSection('curso');
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

  // Si es comunidad, inicializar webview si no esta cargada
  if (sectionName === 'comunidad' && !state.circleWebviewLoaded) {
    await initCircleWebview();
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
      const match = post.name.match(/(\d+)\./);
      const moduloNum = match ? match[1] : '1';
      if (!lecciones[moduloNum]) lecciones[moduloNum] = [];
      lecciones[moduloNum].push(post);
    } else if (name.includes('curso') || name.includes('general') || name.includes('bienvenid')) {
      cursoGeneral.push(post);
    }
  });

  modulos.sort((a, b) => a.name.localeCompare(b.name));

  let html = '';

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

  // Guardar el slug actual para el boton de comentarios
  state.currentCursoSlug = postSlug;

  // Marcar item activo
  document.querySelectorAll('.curso-nav-modulo, .curso-nav-leccion, .curso-nav-curso').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.postId === postId.toString());
  });
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

  // Go to comments button (deeplink to community)
  document.getElementById('go-to-comments-btn').addEventListener('click', () => {
    if (state.currentCursoSlug) {
      navigateToCommunityPost(state.currentCursoSlug);
    } else {
      // Si no hay curso seleccionado, ir a la comunidad general
      switchSection('comunidad');
    }
  });
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
