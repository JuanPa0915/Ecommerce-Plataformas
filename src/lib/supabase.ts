// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// ─── Tipos ──────────────────────────────────────────────────────────────────
// Contrato de datos compartido entre frontend admin, catalogo SSR y detalle.

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string | null;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductsResponse {
  data: Product[];
  count: number;
  error: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

// ─── Variables de entorno ────────────────────────────────────────────────────
// Se permite fallback entre prefijo PUBLIC_ y variables sin prefijo para
// cubrir desarrollo local, build SSR y runtime en Cloudflare Workers.

const SUPABASE_URL =
  (import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL || "") as string;
const SUPABASE_ANON_KEY =
  (import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || "") as string;

const MISSING_ENV_ERROR =
  "Faltan variables de entorno de Supabase (PUBLIC_SUPABASE_URL/PUBLIC_SUPABASE_ANON_KEY o SUPABASE_URL/SUPABASE_ANON_KEY).";

type RuntimeEnv = {
  PUBLIC_SUPABASE_URL?: string;
  PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

type BrowserRuntimeEnv = {
  __PUBLIC_SUPABASE_URL__?: string;
  __PUBLIC_SUPABASE_ANON_KEY__?: string;
};

function readBrowserEnvFromDom() {
  if (typeof document === "undefined") return { url: "", anonKey: "" };

  const metaUrl = document
    .querySelector('meta[name="public-supabase-url"]')
    ?.getAttribute("content")
    ?.trim() || "";
  const metaAnonKey = document
    .querySelector('meta[name="public-supabase-anon-key"]')
    ?.getAttribute("content")
    ?.trim() || "";

  const runtimeRoot = document.getElementById("runtime-env");
  const dataUrl = runtimeRoot?.getAttribute("data-public-supabase-url")?.trim() || "";
  const dataAnonKey = runtimeRoot?.getAttribute("data-public-supabase-anon-key")?.trim() || "";

  return {
    url: dataUrl || metaUrl,
    anonKey: dataAnonKey || metaAnonKey,
  };
}

// Prioriza runtimeEnv (Workers) y luego import.meta.env (build/runtime local).
function resolveSupabaseEnv(runtimeEnv?: RuntimeEnv) {
  const url =
    runtimeEnv?.PUBLIC_SUPABASE_URL ||
    runtimeEnv?.SUPABASE_URL ||
    SUPABASE_URL ||
    "";
  const anonKey =
    runtimeEnv?.PUBLIC_SUPABASE_ANON_KEY ||
    runtimeEnv?.SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY ||
    "";

  return { url, anonKey };
}

// Valida que existan variables en contexto browser antes de instanciar cliente.
function hasSupabaseEnv(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function resolveBrowserRuntimeEnv() {
  if (typeof window === "undefined") {
    return { url: "", anonKey: "" };
  }

  const w = window as Window & BrowserRuntimeEnv;
  const domEnv = readBrowserEnvFromDom();
  return {
    url: w.__PUBLIC_SUPABASE_URL__ || domEnv.url || "",
    anonKey: w.__PUBLIC_SUPABASE_ANON_KEY__ || domEnv.anonKey || "",
  };
}

// ─── Cliente SSR (Server-Side) ───────────────────────────────────────────────
// Se usa en las páginas Astro con `output: 'server'` o en endpoints de API.
// NO persiste sesión entre requests — stateless by design.

export function createServerClient(runtimeEnv?: RuntimeEnv) {
  const { url, anonKey } = resolveSupabaseEnv(runtimeEnv);

  // Si faltan variables, devolvemos null para que el caller maneje el estado
  // sin romper el render SSR con excepciones.
  if (!(url && anonKey)) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        // Principio de mínimo privilegio: solo anon key en el servidor público
        "x-client-info": "ecommerce-ssr/1.0",
      },
    },
  });
}

// ─── Cliente Browser (Client-Side) ──────────────────────────────────────────
// Singleton para el portal admin — persiste sesión en localStorage.

let _browserClient: ReturnType<typeof createClient> | null = null;

export function getBrowserClient() {
  const browserEnv = resolveBrowserRuntimeEnv();
  const url = SUPABASE_URL || browserEnv.url;
  const anonKey = SUPABASE_ANON_KEY || browserEnv.anonKey;

  // En cliente preferimos error explicito para detectar mala configuracion temprano.
  if (!(url && anonKey)) {
    throw new Error(MISSING_ENV_ERROR);
  }

  if (_browserClient) return _browserClient;

  _browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "ecommerce-admin-session",
    },
  });

  return _browserClient;
}

// ─── Helpers de Catálogo (SSR) ───────────────────────────────────────────────

export interface CatalogFilters {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchProducts(
  filters: CatalogFilters = {},
  runtimeEnv?: RuntimeEnv
): Promise<ProductsResponse> {
  // La capa de paginas recibe una respuesta uniforme (data/count/error)
  // para simplificar el render de estados en SSR.
  const supabase = createServerClient(runtimeEnv);
  if (!supabase) {
    return {
      data: [],
      count: 0,
      error: MISSING_ENV_ERROR,
    };
  }

  const { search, category, page = 1, pageSize = 12 } = filters;

  // Query base: solo productos activos y orden mas reciente primero.
  let query = supabase
    .from("products")
    .select("id, name, description, price, category, image_url, stock, is_active, created_at, updated_at", {
      count: "exact",
    })
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (search) {
    // Busqueda parcial case-insensitive sobre el nombre del producto.
    query = query.ilike("name", `%${search}%`);
  }

  if (category && category !== "all") {
    // Filtro por categoria solo cuando se solicita explicitamente.
    query = query.eq("category", category);
  }

  // Paginacion por rango para evitar traer todo el catalogo en cada request.
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  return {
    data: data ?? [],
    count: count ?? 0,
    error: error?.message ?? null,
  };
}

export async function fetchProductById(id: string, runtimeEnv?: RuntimeEnv): Promise<Product | null> {
  // Consulta segura para detalle: solo productos activos y unicos por id.
  const supabase = createServerClient(runtimeEnv);
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error) return null;
  return data;
}

export async function fetchCategories(runtimeEnv?: RuntimeEnv): Promise<string[]> {
  // Obtiene categorias desde productos activos y elimina duplicados en memoria.
  const supabase = createServerClient(runtimeEnv);
  if (!supabase) return [];

  const { data } = await supabase
    .from("products")
    .select("category")
    .eq("is_active", true);

  if (!data) return [];
  const unique = [...new Set(data.map((r) => r.category).filter(Boolean))];
  return unique.sort();
}

// ─── Helpers de Storage ──────────────────────────────────────────────────────

export function getProductImageUrl(path: string | null): string {
  // Regresa placeholder cuando no hay imagen o falta configuracion.
  if (!path) return "/placeholder-product.svg";
  if (path.startsWith("http")) return path;

  if (!hasSupabaseEnv()) {
    return "/placeholder-product.svg";
  }

  // Normaliza la ruta para evitar dobles slashes en la URL publica final.
  const cleanPath = path.replace(/^\/+/, "");
  return `${SUPABASE_URL}/storage/v1/object/public/products/${cleanPath}`;
}
