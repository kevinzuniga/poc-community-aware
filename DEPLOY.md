# Deploy Guide - Circle WebView PoC

## Arquitectura de Producción

```
app.thenextlevelplay.co      → Frontend (Vercel)
api.thenextlevelplay.co      → Backend (Railway)
community.thenextlevelplay.co → Circle (Custom Domain)
```

## Paso 1: Configurar Custom Domain en Circle

1. Ve a tu Circle Admin: https://fuxion-aware.circle.so/settings
2. Settings → Custom Domain
3. Ingresa: `community.thenextlevelplay.co`
4. Circle te dará un CNAME record, algo como:
   ```
   CNAME: community → proxy-ssl.webflow.com (o similar)
   ```
5. Anota este valor para configurar en tu DNS

## Paso 2: Deploy Backend en Railway

### 2.1 Crear cuenta y proyecto
1. Ve a https://railway.app
2. Crea cuenta con GitHub
3. New Project → Deploy from GitHub repo
4. Selecciona el repo (o haz fork primero)
5. Selecciona la carpeta `backend`

### 2.2 Configurar variables de entorno
En Railway → Variables, agrega:

```
CIRCLE_ADMIN_TOKEN=tu_token_aqui
CIRCLE_HEADLESS_TOKEN=tu_token_aqui
CIRCLE_COMMUNITY_ID=380432
CIRCLE_SPACE_CURSO=2402535
CIRCLE_SPACE_COMUNIDAD=2369738
CIRCLE_SPACE_ANUNCIOS=2401965
CIRCLE_DOMAIN=community.thenextlevelplay.co
JWT_SECRET=genera-un-secret-seguro-32-chars
FRONTEND_URL=https://app.thenextlevelplay.co
```

### 2.3 Configurar dominio
1. En Railway → Settings → Domains
2. Add Custom Domain: `api.thenextlevelplay.co`
3. Railway te dará un CNAME record

## Paso 3: Deploy Frontend en Vercel

### 3.1 Crear proyecto
1. Ve a https://vercel.com
2. Import Git Repository
3. Selecciona el repo
4. **Root Directory**: `frontend`
5. Framework Preset: Other
6. Deploy

### 3.2 Configurar dominio
1. En Vercel → Project Settings → Domains
2. Add: `app.thenextlevelplay.co`
3. Vercel te dará un CNAME o A record

## Paso 4: Configurar DNS

En tu proveedor de DNS (Cloudflare, Namecheap, etc.), agrega estos records:

| Type | Name | Value |
|------|------|-------|
| CNAME | app | cname.vercel-dns.com |
| CNAME | api | [valor de Railway] |
| CNAME | community | [valor de Circle] |

**Nota**: Los valores exactos te los da cada servicio. Pueden variar.

### Ejemplo con Cloudflare:
```
app.thenextlevelplay.co       CNAME → cname.vercel-dns.com
api.thenextlevelplay.co       CNAME → railway-app-xxx.up.railway.app
community.thenextlevelplay.co CNAME → custom-domain-proxy.circle.so
```

## Paso 5: Verificar

1. Espera 5-10 minutos para propagación DNS
2. Visita https://app.thenextlevelplay.co
3. Regístrate o inicia sesión
4. Ve a Comunidad
5. **Debería cargar Circle sin popup, ya logueado**

## Troubleshooting

### "CORS error"
- Verifica que `FRONTEND_URL` en Railway sea exactamente `https://app.thenextlevelplay.co`

### "Circle muestra login"
- Verifica que el custom domain en Circle esté activo
- El DNS puede tardar hasta 24h en propagarse
- Prueba en modo incógnito

### "API no responde"
- Verifica que Railway esté corriendo: https://api.thenextlevelplay.co/health

## Desarrollo Local

Para seguir desarrollando localmente:

```bash
# Backend
cd backend
npm run dev  # usa localhost:3001

# Frontend
cd frontend
python3 -m http.server 3000  # usa localhost:3000
```

El código detecta automáticamente si está en localhost y usa los dominios de desarrollo.
