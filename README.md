# Web POC - Circle.so Integration

Prueba de concepto de una aplicación web propia integrada con Circle.so para la comunidad **Fuxion Aware**.

## Arquitectura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │    Backend      │     │  Circle.so      │
│  (HTML/JS/CSS)  │────▶│   (Express)     │────▶│  Admin API v2   │
│  localhost:3000 │     │  localhost:3001 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │
         │                      ▼
         │              ┌─────────────────┐
         │              │    SQLite DB    │
         │              │  (users table)  │
         └──────────────└─────────────────┘
```

## Obtener IDs de Circle.so

### 1. CIRCLE_ADMIN_TOKEN

1. Inicia sesión en tu comunidad Circle.so
2. Ve a **Admin** → **Developers** → **Tokens**
3. Crea un nuevo token **Admin v2**
4. Copia el token generado

### 2. CIRCLE_COMMUNITY_ID

**Desde la API Admin v2:**

```bash
curl -H "Authorization: Bearer TU_ADMIN_TOKEN" \
     "https://app.circle.so/api/admin/v2/spaces?community_id=TU_COMMUNITY_ID"
```

Para Fuxion Aware el Community ID es: `380432`

### 3. CIRCLE_SPACE_ID

**Opción A: Desde la API Admin v2**

```bash
curl -H "Authorization: Bearer TU_ADMIN_TOKEN" \
     "https://app.circle.so/api/admin/v2/spaces?community_id=380432"
```

Esto listará todos los spaces con sus IDs. Busca el campo `id` del space deseado.

**Opción B: Desde la URL (menos confiable)**

1. Entra al Space donde quieres publicar
2. La URL será algo como: `https://fuxion-aware.circle.so/c/space-aware`
3. El ID no está en la URL en v2, usa la API

Para Fuxion Aware el Space ID de "space-aware" es: `2369738`

## Configuración

### 1. Clonar y configurar el backend

```bash
cd backend

# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env con tus valores
# CIRCLE_ADMIN_TOKEN=tu_token_aqui
# CIRCLE_COMMUNITY_ID=380432
# CIRCLE_SPACE_ID=2369738
# JWT_SECRET=... (genera un string aleatorio)
```

### 2. Instalar dependencias

```bash
cd backend
npm install
```

### 3. Inicializar la base de datos

La base de datos se inicializa automáticamente al arrancar el servidor, pero también puedes hacerlo manualmente:

```bash
node db.js
```

## Ejecución

### Backend (Terminal 1)

```bash
cd backend
npm run dev   # Con nodemon (hot-reload)
# o
npm start     # Sin hot-reload
```

El servidor arranca en `http://localhost:3001`

### Frontend (Terminal 2)

```bash
cd frontend

# Opción 1: Con Python
python3 -m http.server 3000

# Opción 2: Con Node (npx)
npx serve -p 3000

# Opción 3: Con PHP
php -S localhost:3000
```

Abre `http://localhost:3000` en tu navegador.

## Flujo de Prueba

### 1. Registro de Usuario

1. Abre `http://localhost:3000`
2. Haz clic en "Registrarse"
3. Ingresa tu email y contraseña
4. Al registrarte:
   - Se crea un usuario en la DB local
   - Se crea automáticamente un miembro en Circle.so
   - Se vincula el `circle_member_id`

### 2. Verificar en Circle

1. Ve a tu comunidad en Circle.so
2. Navega a **Admin** → **Members**
3. Deberías ver el nuevo miembro registrado

### 3. Crear un Post

1. En la Web POC, ingresa un título y contenido
2. Haz clic en "Publicar"
3. El post aparecerá en el feed

### 4. Verificar Post en Circle

1. Ve al Space configurado en Circle.so
2. El post debería aparecer, publicado por el usuario creado

### 5. Comentarios y Likes

1. Haz clic en un post para ver detalles
2. Escribe un comentario y envíalo
3. Haz clic en "Me gusta"

**Nota:** Los comentarios y likes pueden tener restricciones en la API Admin v2. Si fallan, deberán hacerse directamente en Circle.

## Endpoints del Backend

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/register` | Registrar usuario |
| POST | `/auth/login` | Iniciar sesión |
| POST | `/auth/logout` | Cerrar sesión |
| GET | `/auth/me` | Usuario actual |

### Circle API (requieren autenticación)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/circle/feed` | Obtener feed de posts |
| POST | `/api/circle/posts` | Crear post |
| GET | `/api/circle/posts/:id` | Obtener post específico |
| GET | `/api/circle/posts/:id/comments` | Listar comentarios |
| POST | `/api/circle/posts/:id/comments` | Crear comentario* |
| POST | `/api/circle/posts/:id/like` | Dar like* |
| GET | `/api/circle/spaces` | Listar spaces |
| GET | `/api/circle/health` | Verificar conexión |

*Estos endpoints pueden tener restricciones en la API Admin v2.

## Estructura del Proyecto

```
aware-circle/
├── backend/
│   ├── index.js           # Entry point del servidor
│   ├── db.js              # Configuración SQLite
│   ├── circleClient.js    # Cliente API de Circle (Admin v2)
│   ├── package.json
│   ├── .env.example
│   ├── middleware/
│   │   └── auth.js        # Middleware JWT
│   └── routes/
│       ├── auth.js        # Rutas de autenticación
│       └── circle.js      # Rutas de Circle API
├── frontend/
│   ├── index.html         # Página principal
│   ├── app.js             # Lógica JavaScript
│   └── styles.css         # Estilos
└── README.md
```

## Modelo de Datos

### Tabla `users`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER | Primary key |
| email | TEXT | Email único |
| password_hash | TEXT | Hash bcrypt |
| name | TEXT | Nombre del usuario |
| circle_member_id | INTEGER | ID en Circle.so |
| created_at | DATETIME | Fecha de creación |
| updated_at | DATETIME | Última actualización |

## Notas sobre Circle Admin API v2

### URL Base

```
https://app.circle.so/api/admin/v2
```

**Importante:** NO es `/api/v2/` ni `/api/v1/`, es `/api/admin/v2/`

### Autenticación

Esta PoC usa el **Admin v2 Token** para todas las operaciones:

```bash
Authorization: Bearer TU_TOKEN
```

El token actúa como "super admin" y puede:

- Crear miembros sin invitación
- Publicar en nombre de cualquier miembro usando `community_member_id`
- Leer todo el contenido de la comunidad

### Publicar como Usuario

Al crear posts, se envía el `community_member_id` del miembro (no `user_id`):

```javascript
{
  community_id: 380432,
  space_id: 2369738,
  community_member_id: 73170712,  // ID del miembro en Circle
  name: "Título del post",
  body: "<p>Contenido HTML</p>",
  status: "published"
}
```

### Formato de Respuesta v2

Las listas en v2 tienen esta estructura:

```javascript
{
  page: 1,
  per_page: 20,
  has_next_page: false,
  count: 5,
  records: [...]  // Los datos están aquí
}
```

### Limitaciones Conocidas

- **Comentarios**: El endpoint POST `/comments` puede devolver "You cannot perform this action"
- **Likes/Reactions**: Puede tener restricciones similares
- La API tiene rate limits
- Algunas funciones requieren permisos adicionales

## Troubleshooting

### Error: "CIRCLE_ADMIN_TOKEN not configured"

Asegúrate de tener el archivo `.env` con el token correcto.

### Error: "User is not linked to Circle"

El usuario no tiene `circle_member_id`. Esto puede ocurrir si:
- El registro falló al crear el miembro en Circle
- Se creó el usuario directamente en la DB

Solución: Eliminar el usuario y registrarlo de nuevo.

### Error 401/Unauthorized en Circle API

- Verifica que el token no haya expirado
- Asegúrate de usar un **Admin v2** token
- Confirma que usas `Bearer` (no `Token`) en el header

### Error "Page not found" en Circle API

Verifica que estás usando la URL correcta:
- ✅ Correcto: `https://app.circle.so/api/admin/v2/...`
- ❌ Incorrecto: `https://app.circle.so/api/v2/...`
- ❌ Incorrecto: `https://app.circle.so/api/v1/...`

### CORS errors

Verifica que `FRONTEND_URL` en `.env` coincida con la URL del frontend.

## Próximos Pasos (No implementados)

- [ ] Sincronización bidireccional con webhooks
- [ ] Notificaciones en tiempo real
- [ ] Perfil de usuario editable
- [ ] Subida de imágenes
- [ ] Búsqueda de posts
- [ ] Paginación en el feed
- [ ] Usar Member API para comentarios/likes (requiere JWT por miembro)
