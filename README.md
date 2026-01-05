# PoC v3 - Circle.so WebView Integration

Prueba de concepto para integrar Circle.so como WebView en aplicaciones web/mobile para la comunidad **Fuxion Aware**.

## Concepto

Este PoC demuestra cómo integrar Circle.so en una aplicación propia usando WebView, con:
- **Auto-login**: El usuario se registra/logea en tu app y automáticamente está autenticado en Circle
- **Deeplinks**: Navegación directa a posts específicos en Circle desde tu app
- **Experiencia nativa**: Circle se muestra como parte de tu aplicación

## Arquitectura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │    Backend      │     │  Circle.so      │
│  (Web/WebView)  │────▶│   (Express)     │────▶│  Headless SDK   │
│  localhost:3000 │     │  localhost:3001 │     │  + Admin API    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │
         │                      ▼
         │              ┌─────────────────┐
         └──────────────│    SQLite DB    │
                        └─────────────────┘
```

## Flujo de Usuario

1. **Registro/Login** en la app propia
   - Al registrarse, se crea automáticamente un miembro en Circle.so
   - Se guarda la relación `user.id` ↔ `circle_member_id`

2. **Sección Cursos**
   - Lista de módulos y lecciones (contenido propio)
   - Botón "Ir a la discusión" que lleva a Circle con deeplink

3. **Sección Comunidad**
   - WebView completa de Circle.so
   - Usuario ya autenticado automáticamente
   - Soporte para deeplinks a posts específicos

## Configuración

### 1. Variables de entorno

```bash
cd backend
cp .env.example .env
```

Editar `.env`:
```
CIRCLE_ADMIN_TOKEN=tu_admin_token
CIRCLE_HEADLESS_TOKEN=tu_headless_token
CIRCLE_COMMUNITY_ID=380432
CIRCLE_SPACE_CURSO=2402535
CIRCLE_SPACE_COMUNIDAD=2369738
CIRCLE_DOMAIN=fuxion-aware.circle.so
JWT_SECRET=tu_secret_aleatorio
FRONTEND_URL=http://localhost:3000
```

### 2. Instalar y ejecutar

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (en otra terminal)
cd frontend
python3 -m http.server 3000
```

## Endpoints del Backend

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/register` | Registrar usuario (crea miembro en Circle) |
| POST | `/auth/login` | Iniciar sesión |
| POST | `/auth/logout` | Cerrar sesión |
| GET | `/auth/me` | Usuario actual |

### Circle API
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/circle/auth-url` | URL para auto-login en Circle WebView |
| GET | `/api/circle/auth-url?return_path=/c/post` | Con deeplink a post específico |
| GET | `/api/circle/curso/posts` | Posts del espacio Curso |
| GET | `/api/circle/health` | Estado de conexión |

## Estructura del Proyecto

```
aware-circle/
├── backend/
│   ├── index.js           # Entry point
│   ├── db.js              # SQLite
│   ├── circleClient.js    # Circle API + Headless SDK
│   ├── middleware/
│   │   └── auth.js        # JWT middleware
│   └── routes/
│       ├── auth.js        # Autenticación
│       └── circle.js      # Circle API
├── frontend/
│   ├── index.html         # UI con 2 secciones
│   ├── app.js             # Lógica de WebView
│   └── styles.css
└── README.md
```

## Cómo funciona el Auto-Login

1. Frontend solicita URL de auth: `GET /api/circle/auth-url`
2. Backend genera token con Headless SDK
3. Backend retorna URL: `https://circle.so/session/cookies?access_token=...`
4. Frontend carga esa URL en el iframe/webview
5. Circle autentica y el usuario ve la comunidad logueado

## Para Mobile (WebView)

El mismo flujo funciona en apps mobile:

```swift
// iOS (Swift)
let authUrl = await api.getCircleAuthUrl()
webView.load(URLRequest(url: authUrl))
```

```kotlin
// Android (Kotlin)
val authUrl = api.getCircleAuthUrl()
webView.loadUrl(authUrl)
```

## Notas Técnicas

- **Headless SDK**: Genera tokens de miembro para auth automática
- **Cookie Injection**: Circle usa cookies para sesión, el access_token las inyecta
- **Deeplinks**: Pasar `return_path` al auth-url para navegar a posts específicos
- **Cache de Tokens**: Los tokens se cachean en memoria (5 min buffer antes de expirar)
