# Luxe Commerce — E-commerce Híbrido

> Astro (Hybrid SSR/SSG) · Cloudflare Pages + Workers · Supabase · Tailwind CSS

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                  CLOUDFLARE PAGES + WORKERS              │
│                                                          │
│  SSR (Cloudflare Worker)          SSG (Static Files)     │
│  ┌────────────────────┐           ┌──────────────────┐  │
│  │  /                 │           │  /admin          │  │
│  │  /catalog          │──────────▶│  /admin/dashboard│  │
│  │  /catalog/[id]     │  build    └──────────────────┘  │
│  └────────────┬───────┘   time         │                 │
│               │                        │ runtime         │
│               ▼                        ▼                 │
│         SUPABASE DB               SUPABASE AUTH          │
│         (por request)             (client-side)          │
└─────────────────────────────────────────────────────────┘
```

### Decisiones de diseño

| Ruta | Modo | Motivo |
|------|------|--------|
| `/` | SSR | Productos frescos en cada visita |
| `/catalog` | SSR | Filtros/paginación dinámicos por URL |
| `/catalog/[id]` | SSR | Datos de producto siempre actualizados |
| `/admin` | SSG | Login page estática, auth en cliente |
| `/admin/dashboard` | SSG | CRUD completo vía Supabase JS SDK |

---

## Instalación y setup

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

Ejecuta `supabase-migration.sql` en el **SQL Editor** de tu proyecto Supabase:

1. Abre [supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **SQL Editor** → **New query**
4. Pega el contenido de `supabase-migration.sql` y ejecuta

El script crea:
- Tabla `products` con RLS activado
- Políticas de seguridad (mínimo privilegio)
- Bucket de Storage `products` (público para lecturas)
- 6 productos de ejemplo

### 3. Variables de entorno

El archivo `.env` ya está configurado:
```env
PUBLIC_SUPABASE_URL=https://uvwgamkxedomthvialnp.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_7mqcdI_slSXwFMr-qkinlw__OA9mmdw
```

### 4. Crear usuario admin

En Supabase Dashboard → **Authentication** → **Users** → **Add user**:
- Email: tu correo
- Password: contraseña segura
- Auto Confirm User: ✓

---

## Desarrollo local

```bash
npm run dev
# → http://localhost:4321
```

---

## Despliegue en Cloudflare

### Opción A: Cloudflare Pages (recomendado)

1. Conecta tu repo en [pages.cloudflare.com](https://pages.cloudflare.com)
2. Configura:
   - **Build command**: `npm run build`
   - **Build output**: `dist`
   - **Node version**: `20`
3. Añade las variables de entorno en **Settings > Environment variables**

### Opción B: Wrangler CLI

```bash
npm run build
npm run deploy
```

---

## Estructura del proyecto

```
ecommerce/
├── astro.config.mjs          # Configuración Astro + Cloudflare adapter
├── tailwind.config.mjs       # Tema personalizado
├── wrangler.toml             # Config Cloudflare Pages
├── supabase-migration.sql    # Migración BD (ejecutar en Supabase)
├── .env                      # Variables de entorno
└── src/
    ├── layouts/
    │   ├── BaseLayout.astro  # Layout SSR (catálogo)
    │   └── AdminLayout.astro # Layout SSG (admin)
    ├── lib/
    │   └── supabase.ts       # Clientes SSR/browser + helpers
    ├── middleware/
    │   └── index.ts          # Headers de seguridad (SSR)
    ├── pages/
    │   ├── index.astro       # Home (SSR)
    │   ├── 404.astro         # Not found
    │   ├── catalog/
    │   │   ├── index.astro   # Catálogo con filtros y paginación (SSR)
    │   │   └── [id].astro    # Detalle de producto (SSR)
    │   └── admin/
    │       ├── index.astro   # Login (SSG)
    │       └── dashboard.astro # CRUD productos (SSG)
    └── styles/
        └── global.css        # Estilos globales + Tailwind
```

---

## Seguridad

- **Mínimo privilegio**: La `anon key` solo puede leer productos activos (RLS)
- **Admin auth**: Supabase Auth con sesión persistida en localStorage
- **Rutas admin**: Protección client-side con redirección automática
- **Storage**: Solo usuarios autenticados pueden subir/eliminar imágenes
- **Headers**: X-Content-Type-Options, X-Frame-Options en SSR

---

## Funcionalidades

### Catálogo público (SSR)
- ✅ Grid de productos con imágenes, nombre y precio
- ✅ Búsqueda por nombre (case-insensitive)
- ✅ Filtrado por categoría
- ✅ Paginación (12 productos por página)
- ✅ Página de detalle de producto
- ✅ Estados de carga y error

### Portal Admin (SSG + Client)
- ✅ Login/Logout con Supabase Auth
- ✅ Rutas protegidas (redirección automática)
- ✅ Listado de todos los productos
- ✅ Búsqueda en tiempo real
- ✅ Crear producto con imagen
- ✅ Editar producto
- ✅ Eliminar producto (con confirmación)
- ✅ Upload de imágenes a Supabase Storage
- ✅ Estados de carga y error
- ✅ Notificaciones toast
- ✅ Diseño responsive (sidebar en desktop, header en mobile)