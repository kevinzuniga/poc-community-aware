# Integración Circle.so - Guía para App Nativa

Esta guía documenta cómo integrar Circle.so en una aplicación nativa usando WebView con auto-login.

## Variables de Entorno Necesarias

```bash
CIRCLE_ADMIN_TOKEN=tu_admin_token_de_circle      # Para crear/buscar miembros
CIRCLE_HEADLESS_TOKEN=tu_headless_token_de_circle # Para generar tokens de sesión
CIRCLE_COMMUNITY_ID=123456                        # ID de tu comunidad
CIRCLE_DOMAIN=tu-comunidad.circle.so              # Dominio de tu comunidad
```

---

## Parte 1: Buscar/Crear Usuario en Circle (Durante Registro)

### Helper para Circle API Admin v2

```typescript
const ADMIN_BASE_URL = 'https://app.circle.so/api/admin/v2';
const ADMIN_TOKEN = process.env.CIRCLE_ADMIN_TOKEN!;
const COMMUNITY_ID = process.env.CIRCLE_COMMUNITY_ID!;

async function circleRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${ADMIN_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `Circle API error: ${response.status}`);
  }

  return data;
}
```

### Buscar Miembro por Email

```typescript
async function findMemberByEmail(email: string) {
  try {
    const response = await circleRequest(
      `/community_members?community_id=${COMMUNITY_ID}&email=${encodeURIComponent(email)}`
    );

    if (response.records?.length > 0) {
      // STRICT: Only return if email matches EXACTLY
      const exactMatch = response.records.find(
        (m: any) => m.email && m.email.toLowerCase() === email.toLowerCase()
      );
      return exactMatch || null;
    }

    return null;
  } catch (error: any) {
    if (error.status === 404) return null;
    throw error;
  }
}
```

### Crear Nuevo Miembro

```typescript
async function createMember({ email, name }: { email: string; name: string }) {
  const nameParts = (name || email.split('@')[0]).split(' ');
  const firstName = nameParts[0] || 'Usuario';
  const lastName = nameParts.slice(1).join(' ') || '';

  const response = await circleRequest('/community_members', {
    method: 'POST',
    body: JSON.stringify({
      community_id: parseInt(COMMUNITY_ID),
      email,
      name: name || email.split('@')[0],
      first_name: firstName,
      last_name: lastName,
      skip_invitation: true,  // No enviar email de invitación
      skip_onboarding: true,  // Intentar saltar onboarding
    }),
  });

  return response.community_member || response;
}
```

### Flujo de Registro

```typescript
// Durante el registro de usuario en tu app:

let circleMemberId: number | undefined;

// 1. Buscar si ya existe en Circle
let circleMember = await findMemberByEmail(email);

// 2. Si no existe, crear nuevo miembro
if (!circleMember) {
  circleMember = await createMember({ email, name });
}

// 3. Guardar el circle_member_id en tu base de datos
if (circleMember && circleMember.id) {
  circleMemberId = circleMember.id;
}

// 4. Crear usuario local con referencia a Circle
await createUser({
  email,
  password_hash,
  name,
  circle_member_id: circleMemberId
});
```

---

## Parte 2: Auto-Login en WebView

### Obtener Token de Sesión

```typescript
const HEADLESS_TOKEN = process.env.CIRCLE_HEADLESS_TOKEN!;

async function getMemberTokenByEmail(email: string) {
  const response = await fetch('https://app.circle.so/api/v1/headless/auth_token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HEADLESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Auth failed: ${response.status}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.access_token_expires_at,
    communityMemberId: data.community_member_id,
  };
}
```

### Construir URL para WebView

```typescript
const CIRCLE_DOMAIN = process.env.CIRCLE_DOMAIN!;

function getCookieInjectionUrl(accessToken: string, returnUrl?: string) {
  let url = `https://${CIRCLE_DOMAIN}/session/cookies?access_token=${accessToken}`;
  if (returnUrl) {
    url += `&return_to=${encodeURIComponent(returnUrl)}`;
  }
  return url;
}
```

### URL Final para el WebView

```
https://tu-comunidad.circle.so/session/cookies?access_token=TOKEN_AQUI
```

Con redirección a un lugar específico:

```
https://tu-comunidad.circle.so/session/cookies?access_token=TOKEN_AQUI&return_to=/c/comunidad
```

---

## Flujo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    REGISTRO DE USUARIO                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Usuario hace Registro en tu App                             │
│              ↓                                               │
│  findMemberByEmail(email)                                    │
│              ↓                                               │
│         ¿Existe?                                             │
│         /      \                                             │
│        NO      SÍ                                            │
│        ↓        ↓                                            │
│  createMember()  usar member.id existente                    │
│        ↓        ↓                                            │
│      Obtener member.id                                       │
│              ↓                                               │
│  Guardar circle_member_id en tu DB local                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  ABRIR COMUNIDAD EN WEBVIEW                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Usuario abre sección "Comunidad" en tu app               │
│              ↓                                               │
│  2. Backend: getMemberTokenByEmail(user.email)               │
│              ↓                                               │
│  3. Backend retorna: { accessToken: "xxxxx" }                │
│              ↓                                               │
│  4. Construir URL:                                           │
│     https://tu-comunidad.circle.so/session/cookies?          │
│       access_token=xxxxx                                     │
│              ↓                                               │
│  5. WebView carga esa URL                                    │
│              ↓                                               │
│  6. Circle inyecta cookies y redirige al home                │
│              ↓                                               │
│  7. Usuario ve la comunidad YA LOGUEADO                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Notas Importantes

1. **CIRCLE_ADMIN_TOKEN**: Se obtiene en Circle Admin → Settings → API. Permite crear y gestionar miembros.

2. **CIRCLE_HEADLESS_TOKEN**: Se obtiene en Circle Admin → Settings → Headless. Permite generar tokens de sesión para auto-login.

3. **Usar email es más confiable**: El endpoint de Headless con email auto-crea/activa el miembro si no existe, lo cual es más robusto.

4. **El token expira**: Los tokens de sesión tienen expiración. Considera implementar cache y refresh.

5. **skip_invitation**: Evita que Circle envíe emails de invitación al crear miembros.

6. **skip_onboarding**: Intenta saltar el formulario de onboarding de Circle (puede requerir configuración adicional en Circle Admin).
