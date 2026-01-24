#!/usr/bin/env node
/**
 * Script para importar usuarios masivamente a Circle
 *
 * Uso:
 *   node scripts/bulk-import-users.js --file=usuarios.csv
 *   node scripts/bulk-import-users.js --file=usuarios.json
 *   node scripts/bulk-import-users.js --file=usuarios.csv --dry-run
 *   node scripts/bulk-import-users.js --file=usuarios.csv --delay=500
 *   node scripts/bulk-import-users.js --file=usuarios.csv --skip-access-group
 *
 * Formato CSV esperado:
 *   email,name
 *   usuario1@email.com,Juan Perez
 *   usuario2@email.com,Maria Garcia
 *
 * Formato JSON esperado:
 *   [
 *     { "email": "usuario1@email.com", "name": "Juan Perez" },
 *     { "email": "usuario2@email.com", "name": "Maria Garcia" }
 *   ]
 *
 * Rate Limits de Circle:
 *   - 2000 requests por 5 minutos (~6.6 req/seg)
 *   - Con delay de 300ms podemos hacer ~3.3 req/seg (seguro)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Configuración
const ADMIN_BASE_URL = 'https://app.circle.so/api/admin/v2';
const ADMIN_TOKEN = process.env.CIRCLE_ADMIN_TOKEN;
const COMMUNITY_ID = process.env.CIRCLE_COMMUNITY_ID;
const DEFAULT_ACCESS_GROUP_ID = process.env.CIRCLE_DEFAULT_ACCESS_GROUP_ID;

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

// Parsear argumentos
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value === undefined ? true : value;
    }
  });
  return args;
}

// Helper para hacer requests a Circle API
async function circleRequest(endpoint, options = {}) {
  const url = `${ADMIN_BASE_URL}${endpoint}`;

  const headers = {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.message || `Circle API error: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// Buscar miembro por email
async function findMemberByEmail(email) {
  try {
    const response = await circleRequest(
      `/community_members?community_id=${COMMUNITY_ID}&email=${encodeURIComponent(email)}`
    );

    if (response.records?.length > 0) {
      const exactMatch = response.records.find(
        m => m.email && m.email.toLowerCase() === email.toLowerCase()
      );
      return exactMatch || null;
    }
    return null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

// Crear miembro
async function createMember({ email, name }) {
  const response = await circleRequest('/community_members', {
    method: 'POST',
    body: JSON.stringify({
      community_id: parseInt(COMMUNITY_ID),
      email,
      name: name || email.split('@')[0],
      skip_invitation: true
    })
  });

  return response.community_member || response;
}

// Agregar miembro a access group
async function addMemberToAccessGroup(email, accessGroupId) {
  const response = await circleRequest(`/access_groups/${accessGroupId}/community_members`, {
    method: 'POST',
    body: JSON.stringify({
      community_id: parseInt(COMMUNITY_ID),
      email
    })
  });
  return response;
}

// Parsear archivo CSV
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const emailIndex = headers.indexOf('email');
  const nameIndex = headers.indexOf('name');

  if (emailIndex === -1) {
    throw new Error('CSV debe tener columna "email"');
  }

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return {
      email: values[emailIndex],
      name: nameIndex !== -1 ? values[nameIndex] : null
    };
  }).filter(u => u.email); // Filtrar líneas vacías
}

// Parsear archivo JSON
function parseJSON(content) {
  const data = JSON.parse(content);
  return Array.isArray(data) ? data : [data];
}

// Leer y parsear archivo de usuarios
function loadUsers(filePath) {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Archivo no encontrado: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    return parseCSV(content);
  } else if (ext === '.json') {
    return parseJSON(content);
  } else {
    throw new Error(`Formato no soportado: ${ext}. Usa .csv o .json`);
  }
}

// Guardar progreso
function saveProgress(progressFile, processed) {
  fs.writeFileSync(progressFile, JSON.stringify(processed, null, 2));
}

// Cargar progreso previo
function loadProgress(progressFile) {
  if (fs.existsSync(progressFile)) {
    return JSON.parse(fs.readFileSync(progressFile, 'utf8'));
  }
  return { successful: [], failed: [], skipped: [] };
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Función principal
async function main() {
  const args = parseArgs();

  // Validar argumentos
  if (!args.file) {
    console.log(`
${colors.cyan}╔════════════════════════════════════════════════════════════╗
║         Bulk Import Users to Circle                        ║
╚════════════════════════════════════════════════════════════╝${colors.reset}

${colors.yellow}Uso:${colors.reset}
  node scripts/bulk-import-users.js --file=usuarios.csv

${colors.yellow}Opciones:${colors.reset}
  --file=<path>         Archivo CSV o JSON con usuarios (requerido)
  --delay=<ms>          Delay entre usuarios en ms (default: 300)
  --dry-run             Solo mostrar qué se haría, sin ejecutar
  --skip-access-group   No agregar usuarios al access group
  --access-group=<id>   ID del access group (default: env CIRCLE_DEFAULT_ACCESS_GROUP_ID)
  --resume              Continuar desde el último progreso guardado

${colors.yellow}Formato CSV:${colors.reset}
  email,name
  usuario1@email.com,Juan Perez
  usuario2@email.com,Maria Garcia

${colors.yellow}Formato JSON:${colors.reset}
  [
    { "email": "usuario1@email.com", "name": "Juan Perez" },
    { "email": "usuario2@email.com" }
  ]
`);
    process.exit(1);
  }

  // Validar configuración
  if (!ADMIN_TOKEN || !COMMUNITY_ID) {
    console.error(`${colors.red}Error: Faltan variables de entorno CIRCLE_ADMIN_TOKEN y/o CIRCLE_COMMUNITY_ID${colors.reset}`);
    process.exit(1);
  }

  const delay = parseInt(args.delay) || 300;
  const dryRun = args['dry-run'] || false;
  const skipAccessGroup = args['skip-access-group'] || false;
  const accessGroupId = args['access-group'] || DEFAULT_ACCESS_GROUP_ID;
  const resume = args.resume || false;

  // Cargar usuarios
  console.log(`\n${colors.cyan}Cargando usuarios desde: ${args.file}${colors.reset}`);
  let users;
  try {
    users = loadUsers(args.file);
  } catch (error) {
    console.error(`${colors.red}Error cargando archivo: ${error.message}${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.green}✓ ${users.length} usuarios encontrados${colors.reset}`);

  // Archivo de progreso
  const progressFile = `${args.file}.progress.json`;
  let progress = resume ? loadProgress(progressFile) : { successful: [], failed: [], skipped: [] };

  // Filtrar usuarios ya procesados si estamos resumiendo
  if (resume && progress.successful.length > 0) {
    const processedEmails = new Set([
      ...progress.successful.map(u => u.email),
      ...progress.skipped.map(u => u.email)
    ]);
    const originalCount = users.length;
    users = users.filter(u => !processedEmails.has(u.email));
    console.log(`${colors.yellow}↺ Resumiendo: ${originalCount - users.length} ya procesados, ${users.length} pendientes${colors.reset}`);
  }

  if (users.length === 0) {
    console.log(`${colors.green}✓ Todos los usuarios ya fueron procesados${colors.reset}`);
    process.exit(0);
  }

  // Mostrar configuración
  console.log(`
${colors.cyan}Configuración:${colors.reset}
  - Community ID: ${COMMUNITY_ID}
  - Access Group: ${skipAccessGroup ? 'No agregar' : accessGroupId || 'No configurado'}
  - Delay entre usuarios: ${delay}ms
  - Modo: ${dryRun ? 'DRY RUN (simulación)' : 'PRODUCCIÓN'}
  - Tiempo estimado: ~${Math.ceil((users.length * delay) / 1000 / 60)} minutos
`);

  if (dryRun) {
    console.log(`${colors.yellow}═══ DRY RUN - No se ejecutarán cambios ═══${colors.reset}\n`);
  }

  // Procesar usuarios
  const startTime = Date.now();
  let created = 0;
  let existing = 0;
  let failed = 0;
  let addedToGroup = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const index = i + 1;
    const percent = Math.round((index / users.length) * 100);

    process.stdout.write(`\r${colors.dim}[${percent}%]${colors.reset} Procesando ${index}/${users.length}: ${user.email.substring(0, 30).padEnd(30)} `);

    if (dryRun) {
      console.log(`${colors.blue}[DRY RUN]${colors.reset}`);
      continue;
    }

    try {
      // 1. Buscar si existe
      let member = await findMemberByEmail(user.email);

      if (member) {
        process.stdout.write(`${colors.yellow}[Ya existe]${colors.reset}`);
        existing++;
        progress.skipped.push({ email: user.email, reason: 'already_exists', memberId: member.id });
      } else {
        // 2. Crear miembro
        member = await createMember({
          email: user.email,
          name: user.name
        });
        process.stdout.write(`${colors.green}[Creado]${colors.reset}`);
        created++;
        progress.successful.push({ email: user.email, memberId: member.id, created: true });
      }

      // 3. Agregar a access group
      if (!skipAccessGroup && accessGroupId) {
        try {
          await addMemberToAccessGroup(user.email, parseInt(accessGroupId));
          process.stdout.write(` ${colors.green}[+AG]${colors.reset}`);
          addedToGroup++;
        } catch (agError) {
          // Puede fallar si ya está en el grupo
          if (agError.message?.includes('already')) {
            process.stdout.write(` ${colors.dim}[AG existente]${colors.reset}`);
          } else {
            process.stdout.write(` ${colors.yellow}[AG error]${colors.reset}`);
          }
        }
      }

      console.log(); // Nueva línea

    } catch (error) {
      failed++;
      const errorMsg = error.message || 'Unknown error';
      console.log(`${colors.red}[Error: ${errorMsg.substring(0, 50)}]${colors.reset}`);
      progress.failed.push({ email: user.email, error: errorMsg });

      // Si es rate limit, esperar más
      if (error.status === 429) {
        console.log(`${colors.yellow}⚠ Rate limit alcanzado. Esperando 60 segundos...${colors.reset}`);
        await sleep(60000);
      }
    }

    // Guardar progreso cada 10 usuarios
    if (index % 10 === 0) {
      saveProgress(progressFile, progress);
    }

    // Delay entre usuarios
    if (i < users.length - 1) {
      await sleep(delay);
    }
  }

  // Guardar progreso final
  if (!dryRun) {
    saveProgress(progressFile, progress);
  }

  // Resumen
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`
${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}
${colors.cyan}                    RESUMEN                                 ${colors.reset}
${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}
  Total procesados:    ${users.length}
  ${colors.green}Creados:             ${created}${colors.reset}
  ${colors.yellow}Ya existían:         ${existing}${colors.reset}
  ${colors.red}Fallidos:            ${failed}${colors.reset}
  ${colors.green}Agregados a grupo:   ${addedToGroup}${colors.reset}
  Tiempo total:        ${elapsed} segundos

  Progreso guardado en: ${progressFile}
${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}
`);

  if (failed > 0) {
    console.log(`${colors.yellow}Para ver los usuarios fallidos:${colors.reset}`);
    console.log(`  cat ${progressFile} | jq '.failed'`);
  }
}

// Ejecutar
main().catch(error => {
  console.error(`${colors.red}Error fatal: ${error.message}${colors.reset}`);
  process.exit(1);
});
