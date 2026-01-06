'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

const CIRCLE_DOMAIN = process.env.NEXT_PUBLIC_CIRCLE_DOMAIN || 'community.thenextlevelplay.co';

// Circle space slugs - these match the spaces in Circle
const CIRCLE_SPACES = {
  curso: 'leadership-academy',
  comunidad: 'space-aware',
  anuncios: 'anuncios'
};

// Embed parameters to hide Circle's navigation
const EMBED_PARAMS = '?hide_community_sidebar=true&hide_header=false';

interface Post {
  id: number;
  name: string;
  slug: string;
  space_id?: number;
  url?: string;
}

export function MainApp() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<'cursos' | 'comunidad' | 'anuncios'>('cursos');
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [circleLoading, setCircleLoading] = useState(false);
  const [circleAuthenticated, setCircleAuthenticated] = useState(false);
  const [currentCirclePath, setCurrentCirclePath] = useState('');
  const [circlePendingActivation, setCirclePendingActivation] = useState(false);

  useEffect(() => {
    loadPosts();
    // Check if already authenticated with Circle
    setCircleAuthenticated(sessionStorage.getItem('circleAuthenticated') === 'true');
    // Note: Don't auto-link here - registration should handle Circle member creation
  }, []);

  async function loadPosts() {
    try {
      const res = await fetch('/api/circle/curso/posts');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  }

  async function initCircleWebview(path = '') {
    setCircleLoading(true);
    setCirclePendingActivation(false);

    // Add embed parameter to hide sidebar
    const pathWithEmbed = path ? `${path}?hide_community_sidebar=true` : '?hide_community_sidebar=true';

    try {
      // Always try to get fresh auth URL to ensure user is authenticated
      const res = await fetch(`/api/circle/auth-url?return_path=${encodeURIComponent(pathWithEmbed)}`);

      const data = await res.json();

      // Check for inactive member error
      if (data.code === 'MEMBER_INACTIVE') {
        console.log('Circle member pending activation');
        setCircleLoading(false);
        setCirclePendingActivation(true);
        return;
      }

      if (!res.ok) {
        console.log('Auth URL failed, loading directly');
        loadCircleDirectly(path);
        return;
      }

      const { authUrl, debug } = data;
      console.log('Got auth URL, loading in iframe');
      console.log('Auth URL:', authUrl);
      console.log('Debug info:', debug);

      // Load auth URL directly in iframe (same TLD = cookies work)
      const iframe = document.getElementById('circle-webview') as HTMLIFrameElement;
      if (iframe) {
        iframe.src = authUrl;
        iframe.onload = () => {
          setCircleLoading(false);
          setCircleAuthenticated(true);
          sessionStorage.setItem('circleAuthenticated', 'true');
        };
      }
    } catch (error) {
      console.error('Error initializing Circle:', error);
      loadCircleDirectly(path);
    }
  }

  function loadCircleDirectly(path = '') {
    const iframe = document.getElementById('circle-webview') as HTMLIFrameElement;
    if (iframe) {
      const baseUrl = `https://${CIRCLE_DOMAIN}${path}`;
      const separator = path.includes('?') ? '&' : '?';
      iframe.src = `${baseUrl}${separator}hide_community_sidebar=true`;
      iframe.onload = () => setCircleLoading(false);
    }
  }

  function handleSectionChange(section: 'cursos' | 'comunidad' | 'anuncios') {
    setActiveSection(section);

    if (section === 'comunidad') {
      const path = `/c/${CIRCLE_SPACES.comunidad}`;
      setCurrentCirclePath(path);
      initCircleWebview(path);
    } else if (section === 'anuncios') {
      const path = `/c/${CIRCLE_SPACES.anuncios}`;
      setCurrentCirclePath(path);
      initCircleWebview(path);
    }
  }

  function goToPostDiscussion(post: Post) {
    // Deep link to the specific post in the curso space
    const path = `/c/${CIRCLE_SPACES.curso}/${post.slug}`;
    setCurrentCirclePath(path);
    setActiveSection('comunidad');
    initCircleWebview(path);
  }

  // Organize posts
  const cursoGeneral = posts.filter(p =>
    p.name.toLowerCase().includes('curso') ||
    p.name.toLowerCase().includes('bienvenid')
  );
  const modulos = posts.filter(p => p.name.toLowerCase().includes('modulo'));
  const lecciones = posts.filter(p => p.name.toLowerCase().includes('leccion'));

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-4 px-6 sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Leadership Academy</h1>
          <div className="flex items-center gap-4">
            <span className="font-medium">{user?.name || user?.email}</span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              Cerrar Sesion
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b flex gap-2 px-4 py-3">
        <button
          onClick={() => handleSectionChange('cursos')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors ${
            activeSection === 'cursos'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>📚</span> Cursos
        </button>
        <button
          onClick={() => handleSectionChange('comunidad')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors ${
            activeSection === 'comunidad'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>💬</span> Comunidad
        </button>
        <button
          onClick={() => handleSectionChange('anuncios')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors ${
            activeSection === 'anuncios'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>📢</span> Anuncios
        </button>
      </nav>

      {/* Content */}
      <main>
        {/* Cursos Section */}
        {activeSection === 'cursos' && (
          <div className="max-w-7xl mx-auto p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Leadership Academy</h2>
              <p className="text-gray-600">Selecciona un modulo o leccion para ver el contenido</p>
            </div>

            <div className="grid md:grid-cols-[280px_1fr] gap-6">
              {/* Sidebar */}
              <aside className="bg-white rounded-xl p-4 shadow-sm h-fit sticky top-24">
                {posts.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Cargando...</p>
                ) : (
                  <div className="space-y-2">
                    {cursoGeneral.map(post => (
                      <button
                        key={post.id}
                        onClick={() => setSelectedPost(post)}
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
                          selectedPost?.id === post.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:opacity-90'
                        }`}
                      >
                        <span>🎓</span> {post.name}
                      </button>
                    ))}

                    {cursoGeneral.length > 0 && <hr className="my-3" />}

                    {modulos.map((modulo, idx) => (
                      <div key={modulo.id}>
                        <button
                          onClick={() => setSelectedPost(modulo)}
                          className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
                            selectedPost?.id === modulo.id
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-800 hover:bg-indigo-100'
                          }`}
                        >
                          <span>📦</span> {modulo.name}
                        </button>
                        {/* Lecciones del módulo */}
                        <div className="ml-4 mt-1 space-y-1">
                          {lecciones
                            .filter(l => l.name.startsWith(`Leccion ${idx + 1}.`))
                            .map(leccion => (
                              <button
                                key={leccion.id}
                                onClick={() => setSelectedPost(leccion)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                                  selectedPost?.id === leccion.id
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <span>📖</span> {leccion.name}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </aside>

              {/* Content */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                {!selectedPost ? (
                  <div className="text-center py-20 text-gray-400">
                    <div className="text-6xl mb-4">👈</div>
                    <p>Selecciona un modulo o leccion del menu</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-6 pb-4 border-b">
                      {selectedPost.name}
                    </h3>

                    {/* Video placeholder */}
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-12 text-center text-white mb-6">
                      <div className="text-5xl mb-4">🎬</div>
                      <p className="text-lg">Contenido del curso aqui</p>
                      <p className="text-gray-400 text-sm">(Video, texto, recursos, etc.)</p>
                    </div>

                    {/* Go to discussion button */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 text-center border border-indigo-100">
                      <p className="text-gray-600 mb-4">
                        ¿Tienes preguntas o comentarios sobre este curso?
                      </p>
                      <button
                        onClick={() => goToPostDiscussion(selectedPost)}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors text-lg"
                      >
                        💬 Ir a la discusion en Comunidad
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Circle Webview Section (Comunidad or Anuncios) */}
        {(activeSection === 'comunidad' || activeSection === 'anuncios') && (
          <div className="h-[calc(100vh-120px)]">
            {circleLoading && (
              <div className="flex flex-col items-center justify-center h-full bg-white">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500">Conectando con Circle...</p>
              </div>
            )}
            {circlePendingActivation && (
              <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-amber-50 to-orange-50">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
                  <div className="text-6xl mb-4">📧</div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    Activa tu cuenta de Circle
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Para acceder a la comunidad, revisa tu email y haz clic en el enlace de invitacion de Circle.
                  </p>
                  <div className="bg-amber-100 rounded-lg p-4 text-amber-800 text-sm mb-6">
                    <strong>Nota:</strong> El email puede tardar unos minutos en llegar. Revisa tu carpeta de spam si no lo ves.
                  </div>
                  <button
                    onClick={() => initCircleWebview(currentCirclePath)}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Ya active mi cuenta - Reintentar
                  </button>
                </div>
              </div>
            )}
            <iframe
              id="circle-webview"
              className={`w-full h-full border-0 ${circleLoading || circlePendingActivation ? 'hidden' : ''}`}
              allow="clipboard-write"
            />
          </div>
        )}
      </main>
    </div>
  );
}
