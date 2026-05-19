// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// ─── Tipos ──────────────────────────────────────────────────────────────────

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

function hasSupabaseEnv(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// ─── Cliente SSR (Server-Side) ───────────────────────────────────────────────
// Se usa en las páginas Astro con `output: 'server'` o en endpoints de API.
// NO persiste sesión entre requests — stateless by design.

export function createServerClient(runtimeEnv?: RuntimeEnv) {
  const { url, anonKey } = resolveSupabaseEnv(runtimeEnv);

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
  if (!hasSupabaseEnv()) {
    throw new Error(MISSING_ENV_ERROR);
  }

  if (_browserClient) return _browserClient;

  _browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
  const supabase = createServerClient(runtimeEnv);
  if (!supabase) {
    return {
      data: [],
      count: 0,
      error: MISSING_ENV_ERROR,
    };
  }

  const { search, category, page = 1, pageSize = 12 } = filters;

  let query = supabase
    .from("products")
    .select("id, name, description, price, category, image_url, stock, is_active, created_at, updated_at", {
      count: "exact",
    })
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

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
  if (!path) return "/placeholder-product.svg";
  if (path.startsWith("http")) return path;

  if (!hasSupabaseEnv()) {
    return "/placeholder-product.svg";
  }

  const cleanPath = path.replace(/^\/+/, "");
  return `${SUPABASE_URL}/storage/v1/object/public/products/${cleanPath}`;
}
