import { getBrowserClient, getProductImageUrl, type Product } from "../lib/supabase";

// Estado global del panel admin
const supabase = getBrowserClient();
let allProducts: Product[] = [];
let deleteTargetId: string | null = null;
let existingImagePath: string | null = null;

// Helpers DOM para reducir repeticion y mantener el codigo legible
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string) => $(id).classList.remove("hidden");
const hide = (id: string) => $(id).classList.add("hidden");

// Toast reutilizable para feedback de acciones
function showToast(message: string, type: "success" | "error" = "success") {
  const container = $("toast-container");
  const toast = document.createElement("div");

  toast.className = `
    flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl animate-slide-up pointer-events-auto
    ${type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-accent-50 border-accent-200 text-accent-800"}
  `;

  const icon =
    type === "success"
      ? '<svg class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>'
      : '<svg class="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>';

  toast.innerHTML = `${icon}<p class="text-sm font-medium">${message}</p>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "all 300ms ease-in";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

(window as any).showToast = showToast;

// Valida sesion antes de mostrar el dashboard
async function guardAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.replace("/admin");
    return false;
  }

  $("user-email").textContent = session.user.email ?? "";
  hide("auth-check");
  show("dashboard");
  return true;
}

async function handleLogout() {
  await supabase.auth.signOut();
  window.location.replace("/admin");
}

// Renderiza tarjetas de productos y estados (vacio/cargado)
function renderProducts(products: Product[]) {
  const grid = $("products-grid");
  const empty = $("products-empty");

  if (products.length === 0) {
    hide("products-grid");
    show("products-empty");
    return;
  }

  hide("products-empty");

  grid.innerHTML = products
    .map(
      (p) => `
      <div class="card p-4 group" data-id="${p.id}">
        <div class="aspect-video rounded-xl overflow-hidden bg-surface-100 mb-4">
          ${
            p.image_url
              ? `<img src="${getProductImageUrl(p.image_url)}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />`
              : `<div class="w-full h-full flex items-center justify-center">
                  <svg class="w-10 h-10 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>`
          }
        </div>
        <div class="flex items-start justify-between gap-2 mb-2">
          <h3 class="font-medium text-surface-800 text-sm line-clamp-2 flex-1">${p.name}</h3>
          ${p.is_active ? '<span class="badge-green flex-shrink-0">Activo</span>' : '<span class="badge-red flex-shrink-0">Inactivo</span>'}
        </div>
        ${p.category ? `<span class="badge-brand mb-3">${p.category}</span>` : ""}
        <div class="flex items-center justify-between mt-3 pt-3 border-t border-surface-200/60">
          <span class="font-display font-semibold text-accent-600">$${p.price.toLocaleString("es-CO")}</span>
          <span class="text-xs text-surface-500">${p.stock} en stock</span>
        </div>
        <div class="flex gap-2 mt-3">
          <button onclick="openEditModal('${p.id}')" class="btn-secondary flex-1 justify-center !py-1.5 text-xs">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Editar
          </button>
          <button onclick="openDeleteModal('${p.id}', '${p.name.replace(/'/g, "\\'")}')" class="btn-danger flex-1 justify-center !py-1.5 text-xs">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Eliminar
          </button>
        </div>
      </div>
    `
    )
    .join("");

  show("products-grid");
}

// Consulta productos y rellena filtros auxiliares
async function loadProducts() {
  show("products-loading");
  hide("products-grid");
  hide("products-empty");

  const { data, error, count } = await supabase
    .from("products")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  hide("products-loading");

  if (error) {
    showToast("Error al cargar productos: " + error.message, "error");
    return;
  }

  allProducts = data ?? [];
  $("products-count").textContent = String(count ?? 0);

  const categories = [...new Set(allProducts.map((p) => p.category).filter(Boolean))] as string[];
  $("categories-datalist").innerHTML = categories.map((c) => `<option value="${c}">`).join("");

  renderProducts(allProducts);
}

function openModal() {
  hide("form-error");
  show("product-modal");
  document.body.style.overflow = "hidden";
}

function clearForm() {
  ("form-id,form-name,form-description,form-price,form-stock,form-category,form-image-url".split(",") as string[]).forEach((id) => {
    (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value = "";
  });
  (document.getElementById("form-active") as HTMLInputElement).checked = true;
  (document.getElementById("image-input") as HTMLInputElement).value = "";
  hide("image-preview-container");
  hide("upload-progress");
  existingImagePath = null;
}

function closeModal() {
  hide("product-modal");
  document.body.style.overflow = "";
  existingImagePath = null;
  clearForm();
}

function openNewModal() {
  $("modal-title").textContent = "Nuevo producto";
  $("form-submit").textContent = "Crear producto";
  clearForm();
  openModal();
}

(window as any).openEditModal = (id: string) => {
  const p = allProducts.find((item) => item.id === id);
  if (!p) return;

  $("modal-title").textContent = "Editar producto";
  $("form-submit").textContent = "Guardar cambios";

  (document.getElementById("form-id") as HTMLInputElement).value = p.id;
  (document.getElementById("form-name") as HTMLInputElement).value = p.name;
  (document.getElementById("form-description") as HTMLTextAreaElement).value = p.description ?? "";
  (document.getElementById("form-price") as HTMLInputElement).value = String(p.price);
  (document.getElementById("form-stock") as HTMLInputElement).value = String(p.stock);
  (document.getElementById("form-category") as HTMLInputElement).value = p.category ?? "";
  (document.getElementById("form-active") as HTMLInputElement).checked = p.is_active;
  (document.getElementById("form-image-url") as HTMLInputElement).value = p.image_url ?? "";

  existingImagePath = p.image_url;

  if (p.image_url) {
    (document.getElementById("image-preview") as HTMLImageElement).src = getProductImageUrl(p.image_url);
    show("image-preview-container");
  } else {
    hide("image-preview-container");
  }

  openModal();
};

(window as any).openDeleteModal = (id: string, name: string) => {
  deleteTargetId = id;
  $("delete-product-name").textContent = name;
  show("delete-modal");
  document.body.style.overflow = "hidden";
};

(window as any).showTab = (tab: string) => {
  document.querySelectorAll('[id^="tab-"]').forEach((el) => el.classList.add("hidden"));
  document.getElementById(`tab-${tab}`)?.classList.remove("hidden");
  document.querySelectorAll(".sidebar-link").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-tab") === tab);
  });
};

// Upload de imagen con validacion de tamano y preview inmediato
async function handleImageFile(file: File) {
  if (file.size > 5 * 1024 * 1024) {
    showToast("La imagen no puede superar 5MB.", "error");
    return;
  }

  const progress = $("upload-progress");
  const bar = $("progress-bar") as HTMLDivElement;
  show("upload-progress");
  bar.style.width = "20%";

  try {
    const ext = file.name.split(".").pop();
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    bar.style.width = "50%";

    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) throw uploadError;

    bar.style.width = "90%";

    const { data } = supabase.storage.from("products").getPublicUrl(path);
    (document.getElementById("form-image-url") as HTMLInputElement).value = data.publicUrl;
    (document.getElementById("image-preview") as HTMLImageElement).src = data.publicUrl;

    show("image-preview-container");
    bar.style.width = "100%";
    setTimeout(() => hide("upload-progress"), 800);
    showToast("Imagen subida correctamente.", "success");
  } catch (err: any) {
    hide("upload-progress");
    showToast("Error al subir la imagen: " + err.message, "error");
  }
}

// Inicializa listeners y flujo principal del panel
function wireEvents() {
  document.getElementById("logout-btn")?.addEventListener("click", handleLogout);
  document.getElementById("logout-btn-mobile")?.addEventListener("click", handleLogout);

  document.getElementById("admin-search")?.addEventListener("input", (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    renderProducts(allProducts.filter((p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q)));
  });

  document.getElementById("new-product-btn")?.addEventListener("click", openNewModal);
  document.getElementById("new-product-empty-btn")?.addEventListener("click", openNewModal);

  document.getElementById("modal-close")?.addEventListener("click", closeModal);
  document.getElementById("modal-cancel")?.addEventListener("click", closeModal);
  document.getElementById("modal-backdrop")?.addEventListener("click", closeModal);

  const imageInput = document.getElementById("image-input") as HTMLInputElement;
  const dropZone = $("drop-zone");

  dropZone.addEventListener("click", () => imageInput.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("border-brand-500");
  });
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

  document.getElementById("remove-image")?.addEventListener("click", () => {
    (document.getElementById("form-image-url") as HTMLInputElement).value = "";
    hide("image-preview-container");
    existingImagePath = null;
  });

  document.getElementById("delete-cancel")?.addEventListener("click", () => {
    hide("delete-modal");
    document.body.style.overflow = "";
    deleteTargetId = null;
  });

  document.getElementById("delete-confirm")?.addEventListener("click", async () => {
    if (!deleteTargetId) return;

    const btn = document.getElementById("delete-confirm") as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "Eliminando…";

    const { error } = await (supabase.from("products") as any).delete().eq("id", deleteTargetId);

    btn.disabled = false;
    btn.textContent = "Eliminar";
    hide("delete-modal");
    document.body.style.overflow = "";

    if (error) {
      showToast("Error al eliminar: " + error.message, "error");
      return;
    }

    showToast("Producto eliminado.", "success");
    deleteTargetId = null;
    loadProducts();
  });

  document.getElementById("form-submit")?.addEventListener("click", async () => {
    const id = (document.getElementById("form-id") as HTMLInputElement).value;
    const name = (document.getElementById("form-name") as HTMLInputElement).value.trim();
    const description = (document.getElementById("form-description") as HTMLTextAreaElement).value.trim();
    const price = parseFloat((document.getElementById("form-price") as HTMLInputElement).value);
    const stock = parseInt((document.getElementById("form-stock") as HTMLInputElement).value, 10);
    const category = (document.getElementById("form-category") as HTMLInputElement).value.trim();
    const is_active = (document.getElementById("form-active") as HTMLInputElement).checked;
    const image_url = (document.getElementById("form-image-url") as HTMLInputElement).value || null;

    const errEl = $("form-error");

    if (!name) {
      errEl.textContent = "El nombre del producto es obligatorio.";
      show("form-error");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      errEl.textContent = "Ingresa un precio valido.";
      show("form-error");
      return;
    }
    if (Number.isNaN(stock) || stock < 0) {
      errEl.textContent = "Ingresa un stock valido.";
      show("form-error");
      return;
    }

    hide("form-error");

    const btn = document.getElementById("form-submit") as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = '<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Guardando…';

    const payload = { name, description, price, stock, category, is_active, image_url };

    const { error } = id
      ? await (supabase.from("products") as any)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", id)
      : await (supabase.from("products") as any).insert(payload);

    btn.disabled = false;
    btn.textContent = id ? "Guardar cambios" : "Crear producto";

    if (error) {
      errEl.textContent = "Error: " + error.message;
      show("form-error");
      return;
    }

    showToast(id ? "Producto actualizado." : "Producto creado.", "success");
    closeModal();
    loadProducts();
  });
}

(async () => {
  wireEvents();

  const authed = await guardAuth();
  if (authed) loadProducts();
})();

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") window.location.replace("/admin");
});
