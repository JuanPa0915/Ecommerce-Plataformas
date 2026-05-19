import { getBrowserClient, getProductImageUrl, type Product } from "../lib/supabase";

// Cliente autenticado para operaciones CRUD y storage dentro del panel admin.
const supabase = getBrowserClient();
// Cache local de productos para renderizar, filtrar y abrir modales sin refetch constante.
let allProducts: Product[] = [];
// ID temporal del producto seleccionado antes de confirmar eliminacion.
let deleteTargetId: string | null = null;

// Helpers DOM minimos para mantener el archivo compacto y evitar repeticion.
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const show = (id: string) => $(id)?.classList.remove("hidden");
const hide = (id: string) => $(id)?.classList.add("hidden");
const setText = (id: string, text: string) => {
  const el = $(id);
  if (el) el.textContent = text;
};
const setValue = (id: string, value: string) => {
  const el = $<HTMLInputElement | HTMLTextAreaElement>(id);
  if (el) el.value = value;
};
const on = (id: string, event: keyof HTMLElementEventMap, handler: EventListenerOrEventListenerObject) =>
  $(id)?.addEventListener(event, handler);
const esc = (s: string) => s.replace(/'/g, "\\'");

// Iconografia inyectada en tarjetas/toasts para evitar SVGs repetidos en cada render.
const TOAST_ICON = {
  success:
    '<svg class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>',
  error:
    '<svg class="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>',
};

const EMPTY_IMG =
  '<div class="w-full h-full flex items-center justify-center"><svg class="w-10 h-10 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>';
const EDIT_ICON =
  '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>';
const DELETE_ICON =
  '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';

// Toast visual para confirmar operaciones o reportar errores de red/validacion.
function showToast(message: string, type: "success" | "error" = "success") {
  const container = $("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl animate-slide-up pointer-events-auto ${type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-accent-50 border-accent-200 text-accent-800"}`;
  toast.innerHTML = `${TOAST_ICON[type]}<p class="text-sm font-medium">${message}</p>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "all 300ms ease-in";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

(window as any).showToast = showToast;

// Protege la ruta: si no hay sesion valida, redirige a /admin.
async function guardAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return void window.location.replace("/admin");
  setText("user-email", session.user.email ?? "");
  hide("auth-check");
  show("dashboard");
  return true;
}

// Cierre de sesion centralizado para desktop y mobile.
const handleLogout = async () => {
  await supabase.auth.signOut();
  window.location.replace("/admin");
};

// Fragmentos de UI reutilizables para construir cada tarjeta de producto.
const imageHtml = (p: Product) =>
  p.image_url
    ? `<img src="${getProductImageUrl(p.image_url)}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />`
    : EMPTY_IMG;
const statusBadge = (p: Product) => (p.is_active ? '<span class="badge-green flex-shrink-0">Activo</span>' : '<span class="badge-red flex-shrink-0">Inactivo</span>');

// Template HTML de una tarjeta de producto (grid principal del dashboard).
const productCard = (p: Product) =>
  `<div class="card p-4 group" data-id="${p.id}"><div class="aspect-video rounded-xl overflow-hidden bg-surface-100 mb-4">${imageHtml(p)}</div><div class="flex items-start justify-between gap-2 mb-2"><h3 class="font-medium text-surface-800 text-sm line-clamp-2 flex-1">${p.name}</h3>${statusBadge(p)}</div>${p.category ? `<span class="badge-brand mb-3">${p.category}</span>` : ""}<div class="flex items-center justify-between mt-3 pt-3 border-t border-surface-200/60"><span class="font-display font-semibold text-accent-600">$${p.price.toLocaleString("es-CO")}</span><span class="text-xs text-surface-500">${p.stock} en stock</span></div><div class="flex gap-2 mt-3"><button onclick="openEditModal('${p.id}')" class="btn-secondary flex-1 justify-center !py-1.5 text-xs">${EDIT_ICON}Editar</button><button onclick="openDeleteModal('${p.id}', '${esc(p.name)}')" class="btn-danger flex-1 justify-center !py-1.5 text-xs">${DELETE_ICON}Eliminar</button></div></div>`;

// Render condicional: estado vacio o listado completo.
function renderProducts(products: Product[]) {
  const grid = $("products-grid");
  if (!grid) return;
  if (!products.length) return hide("products-grid"), show("products-empty");
  hide("products-empty");
  grid.innerHTML = products.map(productCard).join("");
  show("products-grid");
}

// Carga inicial/recarga de productos + sincronizacion de contador y categorias sugeridas.
async function loadProducts() {
  show("products-loading");
  hide("products-grid");
  hide("products-empty");
  const { data, error, count } = await supabase.from("products").select("*", { count: "exact" }).order("created_at", { ascending: false });
  hide("products-loading");
  if (error) return showToast("Error al cargar productos: " + error.message, "error");
  allProducts = data ?? [];
  setText("products-count", String(count ?? 0));
  const categories = [...new Set(allProducts.map((p) => p.category).filter(Boolean))] as string[];
  const datalist = $("categories-datalist");
  if (datalist) datalist.innerHTML = categories.map((c) => `<option value="${c}">`).join("");
  renderProducts(allProducts);
}

// Normaliza el formulario para modo crear/editar con una unica funcion.
const resetForm = (p?: Product) => {
  const base = p ?? ({ id: "", name: "", description: "", price: "", stock: "", category: "", is_active: true, image_url: "" } as any);
  setValue("form-id", String(base.id ?? ""));
  setValue("form-name", String(base.name ?? ""));
  setValue("form-description", String(base.description ?? ""));
  setValue("form-price", p ? String(base.price) : "");
  setValue("form-stock", p ? String(base.stock) : "");
  setValue("form-category", String(base.category ?? ""));
  setValue("form-image-url", String(base.image_url ?? ""));
  setValue("image-input", "");
  const active = $<HTMLInputElement>("form-active");
  if (active) active.checked = Boolean(base.is_active);
  const img = $<HTMLImageElement>("image-preview");
  if (img && p?.image_url) img.src = getProductImageUrl(p.image_url);
  p?.image_url ? show("image-preview-container") : hide("image-preview-container");
  hide("upload-progress");
};

// Helpers de apertura/cierre del modal principal.
const openModal = () => (hide("form-error"), show("product-modal"), (document.body.style.overflow = "hidden"));
const closeModal = () => (hide("product-modal"), (document.body.style.overflow = ""), resetForm());
const openNewModal = () => (setText("modal-title", "Nuevo producto"), setText("form-submit", "Crear producto"), resetForm(), openModal());

// Expuesto a window para que los botones inline del HTML puedan abrir el modo edicion.
(window as any).openEditModal = (id: string) => {
  const p = allProducts.find((item) => item.id === id);
  if (!p) return;
  setText("modal-title", "Editar producto");
  setText("form-submit", "Guardar cambios");
  resetForm(p);
  openModal();
};

// Expuesto a window para abrir confirmacion de eliminacion con contexto de producto.
(window as any).openDeleteModal = (id: string, name: string) => {
  deleteTargetId = id;
  setText("delete-product-name", name);
  show("delete-modal");
  document.body.style.overflow = "hidden";
};

// Navegacion de tabs del sidebar (actualmente solo productos, preparado para crecer).
(window as any).showTab = (tab: string) => {
  document.querySelectorAll('[id^="tab-"]').forEach((el) => el.classList.add("hidden"));
  document.getElementById(`tab-${tab}`)?.classList.remove("hidden");
  document.querySelectorAll(".sidebar-link").forEach((el) => el.classList.toggle("active", el.getAttribute("data-tab") === tab));
};

// Subida a Supabase Storage con barra de progreso simulada + preview inmediato.
async function handleImageFile(file: File) {
  if (file.size > 5 * 1024 * 1024) return showToast("La imagen no puede superar 5MB.", "error");
  const bar = $<HTMLDivElement>("progress-bar");
  if (!bar) return;
  show("upload-progress");
  bar.style.width = "20%";
  try {
    const ext = file.name.split(".").pop();
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    bar.style.width = "50%";
    const { error } = await supabase.storage.from("products").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    bar.style.width = "90%";
    const { data } = supabase.storage.from("products").getPublicUrl(path);
    setValue("form-image-url", data.publicUrl);
    const img = $<HTMLImageElement>("image-preview");
    if (img) img.src = data.publicUrl;
    show("image-preview-container");
    bar.style.width = "100%";
    setTimeout(() => hide("upload-progress"), 800);
    showToast("Imagen subida correctamente.");
  } catch (err: any) {
    hide("upload-progress");
    showToast("Error al subir la imagen: " + err.message, "error");
  }
}

// Registra listeners de UI y concentra los flujos de accion del dashboard.
function wireEvents() {
  on("logout-btn", "click", handleLogout);
  on("logout-btn-mobile", "click", handleLogout);
  on("new-product-btn", "click", openNewModal);
  on("new-product-empty-btn", "click", openNewModal);
  ["modal-close", "modal-cancel", "modal-backdrop"].forEach((id) => on(id, "click", closeModal));

  on("admin-search", "input", (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    renderProducts(allProducts.filter((p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q)));
  });

  const imageInput = $<HTMLInputElement>("image-input");
  const dropZone = $("drop-zone");
  if (imageInput && dropZone) {
    dropZone.addEventListener("click", () => imageInput.click());
    dropZone.addEventListener("dragover", (e) => (e.preventDefault(), dropZone.classList.add("border-brand-500")));
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("border-brand-500"));
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("border-brand-500");
      const file = e.dataTransfer?.files?.[0];
      if (file) handleImageFile(file);
    });
    imageInput.addEventListener("change", () => {
      const file = imageInput.files?.[0];
      if (file) handleImageFile(file);
    });
  }

  on("remove-image", "click", () => (setValue("form-image-url", ""), hide("image-preview-container")));
  on("delete-cancel", "click", () => (hide("delete-modal"), (document.body.style.overflow = ""), (deleteTargetId = null)));

  on("delete-confirm", "click", async () => {
    if (!deleteTargetId) return;
    const btn = $<HTMLButtonElement>("delete-confirm");
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = "Eliminando…";
    const { error } = await (supabase.from("products") as any).delete().eq("id", deleteTargetId);
    btn.disabled = false;
    btn.textContent = "Eliminar";
    hide("delete-modal");
    document.body.style.overflow = "";
    if (error) return showToast("Error al eliminar: " + error.message, "error");
    showToast("Producto eliminado.");
    deleteTargetId = null;
    loadProducts();
  });

  on("form-submit", "click", async () => {
    // Lectura y normalizacion de campos del formulario.
    const id = $<HTMLInputElement>("form-id")?.value ?? "";
    const name = ($<HTMLInputElement>("form-name")?.value ?? "").trim();
    const description = ($<HTMLTextAreaElement>("form-description")?.value ?? "").trim();
    const price = Number(($<HTMLInputElement>("form-price")?.value ?? "").trim());
    const stock = Number.parseInt(($<HTMLInputElement>("form-stock")?.value ?? "").trim(), 10);
    const category = ($<HTMLInputElement>("form-category")?.value ?? "").trim();
    const is_active = $<HTMLInputElement>("form-active")?.checked ?? true;
    const image_url = $<HTMLInputElement>("form-image-url")?.value || null;
    const errEl = $("form-error");
    const btn = $<HTMLButtonElement>("form-submit");
    if (!errEl || !btn) return;

    // Validaciones minimas antes de enviar al backend.
    if (!name) return (errEl.textContent = "El nombre del producto es obligatorio."), show("form-error");
    if (Number.isNaN(price) || price < 0) return (errEl.textContent = "Ingresa un precio valido."), show("form-error");
    if (Number.isNaN(stock) || stock < 0) return (errEl.textContent = "Ingresa un stock valido."), show("form-error");
    hide("form-error");

    // Estado de guardado para prevenir doble submit.
    btn.disabled = true;
    btn.innerHTML = '<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Guardando…';
    const payload = { name, description, price, stock, category, is_active, image_url };
    // Upsert manual: update cuando existe id, insert cuando es producto nuevo.
    const { error } = id
      ? await (supabase.from("products") as any).update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id)
      : await (supabase.from("products") as any).insert(payload);
    btn.disabled = false;
    btn.textContent = id ? "Guardar cambios" : "Crear producto";
    if (error) return (errEl.textContent = "Error: " + error.message), show("form-error");
    showToast(id ? "Producto actualizado." : "Producto creado.");
    closeModal();
    loadProducts();
  });
}

// Punto de entrada del modulo en cliente.
(async () => {
  wireEvents();
  if (await guardAuth()) loadProducts();
})();

// Si la sesion expira/cierra en otra pestaña, forzamos salida inmediata del dashboard.
supabase.auth.onAuthStateChange((event) => event === "SIGNED_OUT" && window.location.replace("/admin"));
