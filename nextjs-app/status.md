# Aware Circle - Status del Proyecto

**Fecha de actualizacion**: 6 de Enero, 2026
**Branch actual**: `feature/circle-widgets-proxy`
**Ultimo commit**: `ca47be7` - feat: Add Custom SSO for Circle Enterprise and iframe widgets

---

## Resumen

PoC de integracion de Circle.so con una aplicacion Next.js para Leadership Academy. La aplicacion permite a los usuarios acceder a cursos, comunidad y anuncios usando widgets de Circle embebidos via iframe.

---

## Estado Actual

### Funcionalidades Completadas

| Funcionalidad | Estado | Descripcion |
|---------------|--------|-------------|
| Autenticacion propia | Completado | Login/registro con JWT y PostgreSQL |
| Integracion Circle Headless API | Completado | Tokens de miembro, posts, comentarios |
| Widgets Circle via iframe | Completado | Cursos, Comunidad, Anuncios |
| Custom SSO para Circle | Completado | Endpoints OAuth2 listos |

### Pendiente

| Tarea | Prioridad | Descripcion |
|-------|-----------|-------------|
| Desplegar SSO a produccion | Alta | Subir codigo a Railway |
| Configurar SSO en Circle Admin | Alta | Ya configurado, falta probar |
| Probar flujo SSO completo | Alta | Verificar activacion automatica |
| Widget de solo comentarios | Media | Circle muestra post completo, investigar |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App (Railway)                     │
│                 app.thenextlevelplay.co                      │
├─────────────────────────────────────────────────────────────┤
│  Frontend                                                    │
│  ├── /login          - Pagina de login con soporte SSO      │
│  ├── MainApp.tsx     - App principal con navegacion         │
│  └── Iframes         - Widgets de Circle embebidos          │
├─────────────────────────────────────────────────────────────┤
│  API Routes                                                  │
│  ├── /api/auth/*     - Autenticacion propia (JWT)           │
│  ├── /api/circle/*   - Proxy a Circle Headless API          │
│  └── /api/sso/*      - Custom SSO endpoints (OAuth2)        │
├─────────────────────────────────────────────────────────────┤
│  Base de Datos (PostgreSQL)                                  │
│  ├── users           - Usuarios de la app                   │
│  ├── sso_codes       - Codigos de autorizacion SSO          │
│  └── sso_tokens      - Tokens de acceso SSO                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Circle.so                               │
│              community.thenextlevelplay.co                   │
├─────────────────────────────────────────────────────────────┤
│  Spaces                                                      │
│  ├── leadership-academy  - Cursos (ID: 2402535)             │
│  ├── space-aware         - Comunidad (ID: 2369738)          │
│  └── anuncios            - Anuncios (ID: 2401965)           │
├─────────────────────────────────────────────────────────────┤
│  SSO Custom                                                  │
│  └── Callback: https://community.thenextlevelplay.co/       │
│                oauth2/callback                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Endpoints SSO

Los siguientes endpoints implementan OAuth2 para Circle Custom SSO:

| Endpoint | Metodo | URL | Descripcion |
|----------|--------|-----|-------------|
| Authorization | GET | `/api/sso/authorize` | Inicia flujo SSO, redirige a login si no autenticado |
| Token | POST | `/api/sso/token` | Intercambia codigo por access token |
| Profile | GET | `/api/sso/profile` | Retorna info del usuario autenticado |

### Configuracion Circle Admin

```
Provider Name:        Aware
Client ID:            aware-circle-sso
Secret Key:           dev-sso-secret-change-in-production
Scope:                profile email
Authorization URL:    https://app.thenextlevelplay.co/api/sso/authorize
Token Fetch URL:      https://app.thenextlevelplay.co/api/sso/token
Profile Info API URL: https://app.thenextlevelplay.co/api/sso/profile

Response Paths:
- User ID:            id
- User Email:         email
- User Name:          name
- Profile Image URL:  avatar_url
```

---

## Variables de Entorno

```bash
# Circle API
CIRCLE_ADMIN_TOKEN=xxx
CIRCLE_HEADLESS_TOKEN=xxx
CIRCLE_COMMUNITY_ID=380432
CIRCLE_SPACE_CURSO=2402535
CIRCLE_SPACE_COMUNIDAD=2369738
CIRCLE_SPACE_ANUNCIOS=2401965
CIRCLE_DOMAIN=fuxion-aware.circle.so
NEXT_PUBLIC_CIRCLE_DOMAIN=fuxion-aware.circle.so

# JWT
JWT_SECRET=xxx

# SSO
SSO_CLIENT_ID=aware-circle-sso
SSO_CLIENT_SECRET=xxx

# Database
DATABASE_URL=postgresql://...
```

---

## Estructura de Archivos Relevantes

```
nextjs-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/           # Autenticacion propia
│   │   │   ├── circle/         # Proxy Circle API
│   │   │   │   ├── auth-url/
│   │   │   │   ├── comments/[commentId]/like/
│   │   │   │   ├── curso/posts/
│   │   │   │   ├── member-token/
│   │   │   │   ├── posts/[postId]/comments/
│   │   │   │   ├── posts/[postId]/like/
│   │   │   │   └── spaces/[spaceId]/posts/
│   │   │   └── sso/            # Custom SSO
│   │   │       ├── authorize/
│   │   │       ├── token/
│   │   │       └── profile/
│   │   ├── login/              # Pagina de login
│   │   └── page.tsx            # Pagina principal
│   ├── components/
│   │   ├── AuthForms.tsx
│   │   └── MainApp.tsx         # App con iframes de Circle
│   ├── context/
│   │   └── AuthContext.tsx
│   └── lib/
│       ├── auth.ts
│       ├── circle.ts
│       └── db.ts               # Incluye tablas SSO
├── .env.example
├── .env.local
└── status.md                   # Este archivo
```

---

## Proximos Pasos

1. **Desplegar a Railway**
   ```bash
   git push origin feature/circle-widgets-proxy
   ```
   - Configurar variables de entorno SSO en Railway
   - Verificar que las tablas SSO se creen en produccion

2. **Probar flujo SSO**
   - Ir a Circle community y hacer clic en "Continue with Aware"
   - Verificar que redirige a nuestra app
   - Verificar que al loguearse, regresa a Circle autenticado

3. **Investigar widget de solo comentarios**
   - Actualmente el iframe muestra el post completo
   - Investigar si Circle tiene parametros para mostrar solo comentarios

---

## Notas Tecnicas

- **Circle Headless API URL**: `https://app.circle.so/api/headless/v1`
- **Circle Community Domain**: `fuxion-aware.circle.so` (dev) / `community.thenextlevelplay.co` (prod)
- **SSO Callback de Circle**: `https://community.thenextlevelplay.co/oauth2/callback`
- **Duracion codigo SSO**: 10 minutos
- **Duracion token SSO**: 24 horas
