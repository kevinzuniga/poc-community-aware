# Circle WebView PoC - Next.js

Prueba de concepto para integrar Circle.so como WebView con auto-login.

## Arquitectura

```
app.thenextlevelplay.co       → Next.js App (Vercel)
  ├── /                       → Frontend React
  └── /api/*                  → API Routes
community.thenextlevelplay.co → Circle (Custom Domain)
```

## Deploy en Vercel (Un solo click)

### 1. Configurar Circle Custom Domain

1. Ve a Circle Admin → Settings → Custom Domain
2. Configura: `community.thenextlevelplay.co`
3. Anota el CNAME record que te da Circle

### 2. Crear proyecto en Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Import Git Repository → selecciona este repo
3. **Root Directory**: `nextjs-app`
4. Deploy

### 3. Agregar Vercel Postgres

1. En Vercel Dashboard → Storage → Create Database
2. Selecciona **Postgres**
3. Crea la base de datos
4. Conecta al proyecto

Las variables de `POSTGRES_*` se agregan automáticamente.

### 4. Agregar variables de entorno

En Vercel → Project Settings → Environment Variables:

```
CIRCLE_ADMIN_TOKEN=tu_admin_token
CIRCLE_HEADLESS_TOKEN=tu_headless_token
CIRCLE_COMMUNITY_ID=380432
CIRCLE_SPACE_CURSO=2402535
CIRCLE_SPACE_COMUNIDAD=2369738
CIRCLE_SPACE_ANUNCIOS=2401965
CIRCLE_DOMAIN=community.thenextlevelplay.co
NEXT_PUBLIC_CIRCLE_DOMAIN=community.thenextlevelplay.co
JWT_SECRET=genera-un-secret-seguro-de-32-chars
```

### 5. Configurar dominio personalizado

1. En Vercel → Project Settings → Domains
2. Agrega: `app.thenextlevelplay.co`
3. Configura el CNAME en tu DNS

### 6. Configurar DNS

En tu proveedor de DNS:

| Type | Name | Value |
|------|------|-------|
| CNAME | app | cname.vercel-dns.com |
| CNAME | community | [valor de Circle] |

## Desarrollo Local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores

# Ejecutar
npm run dev
```

Abrir http://localhost:3000

**Nota**: En desarrollo local (localhost), se usa un popup para autenticación porque los dominios son diferentes. En producción (mismo TLD), la autenticación es automática sin popup.

## Estructura

```
src/
├── app/
│   ├── api/
│   │   ├── auth/        → Login, Register, Logout, Me
│   │   └── circle/      → Auth URL, Posts, Health
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── AuthForms.tsx    → Formularios de auth
│   └── MainApp.tsx      → App principal con tabs
├── context/
│   └── AuthContext.tsx  → Estado de autenticación
└── lib/
    ├── auth.ts          → JWT y cookies
    ├── circle.ts        → Circle API client
    └── db.ts            → Vercel Postgres
```

## Flujo de autenticación

1. Usuario se registra/logea en la app
2. Al registrarse, se crea automáticamente en Circle
3. Al ir a "Comunidad", se genera token de Circle
4. El iframe carga Circle con el token → cookies se establecen
5. Usuario ve Circle logueado automáticamente

## Por qué funciona sin popup en producción

En producción, `app.thenextlevelplay.co` y `community.thenextlevelplay.co` comparten el mismo TLD (`.thenextlevelplay.co`). Las cookies no son "third-party" y los navegadores las aceptan.

En desarrollo (`localhost` vs `circle.so`), son dominios diferentes → necesita popup.
