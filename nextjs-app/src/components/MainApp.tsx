'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

const CIRCLE_DOMAIN = process.env.NEXT_PUBLIC_CIRCLE_DOMAIN || 'fuxion-aware.circle.so';

// Circle space slugs
const CIRCLE_SPACES = {
  curso: 'leadership-academy',
  comunidad: 'space-aware',
  anuncios: 'anuncios'
};

interface Post {
  id: number;
  name: string;
  slug: string;
}

export function MainApp() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<'cursos' | 'comunidad' | 'anuncios'>('cursos');
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [circleAuthUrl, setCircleAuthUrl] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    loadPosts();
    authenticateWithCircle();
  }, []);

  async function authenticateWithCircle() {
    // Check if already authenticated
    if (sessionStorage.getItem('circleAuthenticated') === 'true') {
      return;
    }

    setIsAuthenticating(true);
    try {
      const res = await fetch('/api/circle/auth-url?return_path=/');
      const data = await res.json();

      if (data.authUrl) {
        // Use hidden iframe instead of popup for silent cookie injection
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = data.authUrl;

        iframe.onload = () => {
          // Give Circle a moment to set cookies
          setTimeout(() => {
            document.body.removeChild(iframe);
            sessionStorage.setItem('circleAuthenticated', 'true');
            setIsAuthenticating(false);
            console.log('[Circle] Authentication complete via hidden iframe');
          }, 2000);
        };

        iframe.onerror = () => {
          document.body.removeChild(iframe);
          sessionStorage.setItem('circleAuthenticated', 'true');
          setIsAuthenticating(false);
        };

        document.body.appendChild(iframe);

        // Timeout fallback
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          sessionStorage.setItem('circleAuthenticated', 'true');
          setIsAuthenticating(false);
        }, 10000);
      }
    } catch (error) {
      console.error('Auth error:', error);
      setIsAuthenticating(false);
    }
  }

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

  function handleSectionChange(section: 'cursos' | 'comunidad' | 'anuncios') {
    setActiveSection(section);
    setShowComments(false);
  }

  // Build Circle embed URL for a space
  function getSpaceEmbedUrl(spaceSlug: string) {
    return `https://${CIRCLE_DOMAIN}/c/${spaceSlug}?hide_community_sidebar=true`;
  }

  // Build Circle embed URL for post comments
  function getPostCommentsUrl(postSlug: string) {
    return `https://${CIRCLE_DOMAIN}/c/${CIRCLE_SPACES.curso}/${postSlug}?hide_community_sidebar=true`;
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
          📚 Cursos
        </button>
        <button
          onClick={() => handleSectionChange('comunidad')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors ${
            activeSection === 'comunidad'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          💬 Comunidad
        </button>
        <button
          onClick={() => handleSectionChange('anuncios')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors ${
            activeSection === 'anuncios'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          📢 Anuncios
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
                        onClick={() => { setSelectedPost(post); setShowComments(false); }}
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
                          selectedPost?.id === post.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:opacity-90'
                        }`}
                      >
                        🎓 {post.name}
                      </button>
                    ))}

                    {cursoGeneral.length > 0 && <hr className="my-3" />}

                    {modulos.map((modulo, idx) => (
                      <div key={modulo.id}>
                        <button
                          onClick={() => { setSelectedPost(modulo); setShowComments(false); }}
                          className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
                            selectedPost?.id === modulo.id
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-800 hover:bg-indigo-100'
                          }`}
                        >
                          📦 {modulo.name}
                        </button>
                        <div className="ml-4 mt-1 space-y-1">
                          {lecciones
                            .filter(l => l.name.startsWith(`Leccion ${idx + 1}.`))
                            .map(leccion => (
                              <button
                                key={leccion.id}
                                onClick={() => { setSelectedPost(leccion); setShowComments(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                                  selectedPost?.id === leccion.id
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                📖 {leccion.name}
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

                    {/* Comments Widget (Circle iframe) */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      {!showComments ? (
                        <div className="p-6 text-center bg-gradient-to-r from-indigo-50 to-purple-50">
                          <p className="text-gray-600 mb-4">
                            ¿Tienes preguntas o comentarios sobre este curso?
                          </p>
                          <button
                            onClick={() => setShowComments(true)}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors text-lg"
                          >
                            💬 Ver comentarios
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="px-4 py-3 bg-indigo-100 border-b flex items-center justify-between">
                            <h4 className="font-semibold text-indigo-800">Comentarios</h4>
                            <button
                              onClick={() => setShowComments(false)}
                              className="text-indigo-600 hover:text-indigo-800 text-sm"
                            >
                              Ocultar
                            </button>
                          </div>
                          {/* Circle Comments Widget */}
                          <iframe
                            src={getPostCommentsUrl(selectedPost.slug)}
                            className="w-full h-[500px] border-0"
                            allow="clipboard-write"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Comunidad Section - Circle Widget */}
        {activeSection === 'comunidad' && (
          <div className="h-[calc(100vh-120px)]">
            <iframe
              src={getSpaceEmbedUrl(CIRCLE_SPACES.comunidad)}
              className="w-full h-full border-0"
              allow="clipboard-write"
            />
          </div>
        )}

        {/* Anuncios Section - Circle Widget */}
        {activeSection === 'anuncios' && (
          <div className="h-[calc(100vh-120px)]">
            <iframe
              src={getSpaceEmbedUrl(CIRCLE_SPACES.anuncios)}
              className="w-full h-full border-0"
              allow="clipboard-write"
            />
          </div>
        )}
      </main>

      {/* Auth Popup Indicator */}
      {isAuthenticating && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Conectando con Circle...</span>
        </div>
      )}
    </div>
  );
}
