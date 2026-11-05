const SUPABASE_URL = "https://iqtdgbkymsilzxdjwpdl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5qb3UiLzJT0xzSO8O5V-rQ_2s30obcN";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================================================
   YORDAMCHI FUNKSIYALAR
   ============================================================ */
function formatSum(summa) {
  const n = Number(summa) || 0;
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
}
// Tovar narxiga 30 000 qo'shib ko'rsatish funksiyasi
function formatNarx(narx) {
  const qoshimcha = 30000;
  const jami = (Number(narx) || 0) + qoshimcha;
  return formatSum(jami);
}
function xatoKorsatish(xabar) { toast(xabar, "qizil"); }
function muvaffaqiyatKorsatish(xabar) { toast(xabar, "yashil"); }

function toast(xabar, tur) {
  const el = document.createElement("div");
  el.className = `toast toast-${tur}`;
  el.textContent = xabar;
  document.getElementById("toast-konteyner").appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

let _tasdiqResolve = null;
function tasdiqlash(xabar) {
  return new Promise((resolve) => {
    _tasdiqResolve = resolve;
    document.getElementById("modal-xabar").textContent = xabar;
    document.getElementById("modal-overlay").classList.remove("yashirin");
  });
}

/* ============================================================
   SAVAT KESHI (localStorage)
   ============================================================ */
const SAVAT_KALIT = "qidiruv_savat_v1";

function savatniOlish() {
  try {
    const raw = localStorage.getItem(SAVAT_KALIT);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Savat o'qishda xato:", e);
    return [];
  }
}

function savatniSaqlash(savat) {
  try {
    localStorage.setItem(SAVAT_KALIT, JSON.stringify(savat));
  } catch (e) {
    console.error("Savat saqlashda xato:", e);
    xatoKorsatish("Savatni saqlashda xato");
  }
}

function savatKeshniTozalash() {
  try {
    localStorage.removeItem(SAVAT_KALIT);
  } catch (e) {
    console.error(e);
  }
}

/* ============================================================
   SAVAT HOLATI
   ============================================================ */
let _savat = savatniOlish();
let _tovarlarKesh = [];
let _turlarKesh = [];

/* ============================================================
   SAVAT AMALLARI
   ============================================================ */
function savatgaQoshish(tovar) {
  const mavjud = _savat.find((t) => String(t.id) === String(tovar.id));

  if (mavjud) {
    if (mavjud.soni >= tovar.soni) {
      xatoKorsatish(`Omborda faqat ${tovar.soni} ta mavjud`);
      return;
    }
    mavjud.soni += 1;
    mavjud.mavjud_soni = tovar.soni;
  } else {
    if (tovar.soni <= 0) {
      xatoKorsatish("Omborda bu tovar qolmagan");
      return;
    }
    _savat.push({
      id: tovar.id,
      model_kodi: tovar.model_kodi,
      model: tovar.model,
      marka: tovar.marka || "",
      narx: tovar.narx,
      soni: 1,
      mavjud_soni: tovar.soni,
    });
  }

  savatniSaqlash(_savat);
  savatniYangilash();
  muvaffaqiyatKorsatish(`${tovar.model_kodi} savatga qo'shildi`);
}

function savatdanOlish(id) {
  _savat = _savat.filter((t) => String(t.id) !== String(id));
  savatniSaqlash(_savat);
  savatniYangilash();
}

function savatSoniOzgartirish(id, yangiSoni) {
  const item = _savat.find((t) => String(t.id) === String(id));
  if (!item) return;

  if (yangiSoni <= 0) {
    savatdanOlish(id);
    return;
  }

  if (yangiSoni > item.mavjud_soni) {
    xatoKorsatish(`Omborda faqat ${item.mavjud_soni} ta mavjud`);
    savatniYangilash();
    return;
  }

  item.soni = yangiSoni;
  savatniSaqlash(_savat);
  savatniYangilash();
}

/* ============================================================
   SAVAT UI YANGILASH
   ============================================================ */
function savatniYangilash() {
  const jamiDona = _savat.reduce((s, t) => s + t.soni, 0);

  // Header badge
  const badge = document.getElementById("savat-badge");
  badge.textContent = jamiDona;
  badge.classList.toggle("yashirin", jamiDona === 0);

  // Savat sarlavhasi
  document.getElementById("savat-soni-text").textContent = `(${jamiDona} ta)`;

  // Savat ro'yxati
  const royxat = document.getElementById("savat-royxat");
  if (!_savat.length) {
    royxat.innerHTML = `
      <div class="savat-bosh">
        <div class="savat-bosh-icon">🛒</div>
        <div>Savat bo'sh</div>
        <div class="savat-bosh-matn">Qidiruvdan tovar qo'shing</div>
      </div>`;
  } else {
    royxat.innerHTML = _savat.map((t) => `
      <div class="savat-item">
        <div class="savat-item-info">
          <div class="savat-item-kod">${t.model_kodi}</div>
          <div class="savat-item-model">${t.model}${t.marka ? ` <span class="savat-item-marka">(${t.marka})</span>` : ""}</div>
          <div class="savat-item-narx">${formatNarx(t.narx)}</div>
        </div>
        <div class="savat-item-amallar">
          <div class="savat-soni-boshqarish">
            <button class="savat-soni-btn" data-kamaytir="${t.id}">−</button>
            <input type="number" class="savat-soni-input" data-soni-input="${t.id}" value="${t.soni}" min="1" max="${t.mavjud_soni}">
            <button class="savat-soni-btn" data-kopaytir="${t.id}">+</button>
          </div>
          <button class="savat-ochirish" data-savat-ochirish="${t.id}" title="O'chirish">🗑️</button>
        </div>
      </div>
    `).join("");
  }

  // Jami summa
  const jamiSumma = _savat.reduce((s, t) => s + ((t.narx + 30000) * t.soni), 0);
  document.getElementById("savat-jami").textContent = formatSum(jamiSumma);

  // Tugmalar
  const sotishBtn = document.getElementById("savat-sotish");
  const tozalashBtn = document.getElementById("savat-tozalash");
  if (sotishBtn) sotishBtn.disabled = _savat.length === 0;
  if (tozalashBtn) tozalashBtn.disabled = _savat.length === 0;
}

/* ============================================================
   SUPABASE
   ============================================================ */
async function turlarniOlish() {
  if (_turlarKesh.length) return _turlarKesh;
  const { data, error } = await supabaseClient.from("tovar_turlari").select("*").order("id");
  if (error) throw error;
  _turlarKesh = data || [];
  return _turlarKesh;
}

async function barchaTovarlar() {
  const { data, error } = await supabaseClient
    .from("tovarlar")
    .select("*, tovar_turlari(nomi)")
    .eq("arxivlangan", false)
    .order("model");
  if (error) throw error;
  _tovarlarKesh = data || [];
  return _tovarlarKesh;
}

async function mijozlarniOlish() {
  const { data, error } = await supabaseClient.from("mijozlar").select("*").order("yaratilgan_vaqt", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function sotuvQoshish(sotuv) {
  const { data: tovar, error: e1 } = await supabaseClient.from("tovarlar").select("soni").eq("id", sotuv.tovar_id).single();
  if (e1) throw e1;
  if ((tovar.soni || 0) < sotuv.soni) throw new Error("Omborda yetarli tovar yo'q");

  const { error: e2 } = await supabaseClient.from("tovarlar").update({ soni: tovar.soni - sotuv.soni }).eq("id", sotuv.tovar_id);
  if (e2) throw e2;

  const { data: sotuvData, error: e3 } = await supabaseClient.from("sotuvlar").insert(sotuv).select().single();
  if (e3) throw e3;

  if (sotuv.tolov_turi === "nasiya" && sotuv.mijoz_id) {
    await supabaseClient.from("nasiyalar").insert({
      mijoz_id: sotuv.mijoz_id,
      sotuv_id: sotuvData.id,
      summa: sotuv.sotuv_narxi * sotuv.soni,
      tolov_summasi: 0,
      tolangan: false,
    });
  }
  return sotuvData;
}

/* ============================================================
   QIDIRUV
   ============================================================ */
let qidiruvNatijalari = [];
let joriySahifa = 1;
const sahifadagiSoni = 20;

async function yuklaQidiruv() {
  try {
    const turlar = await turlarniOlish();
    const turSel = document.getElementById("qidiruv-tur");
    turSel.innerHTML =
      '<option value="Hammasi">Hammasi</option>' +
      turlar.map((t) => `<option value="${t.id}">${t.nomi}</option>`).join("");

    await barchaTovarlar();
    const modelSel = document.getElementById("qidiruv-model");
    const unikalModellar = [...new Set(_tovarlarKesh.map((t) => t.model))];
    modelSel.innerHTML =
      '<option value="Hammasi">Hammasi</option>' +
      unikalModellar.map((m) => `<option value="${m}">${m}</option>`).join("");

    qidiruvIshla();
  } catch (e) {
    xatoKorsatish("Qidiruv yuklashda xato: " + e.message);
  }
}

function qidiruvIshla() {
  const turVal = document.getElementById("qidiruv-tur").value;
  const modelVal = document.getElementById("qidiruv-model").value;
  const matn = document.getElementById("qidiruv-matn").value.toLowerCase().trim();

  let natija = _tovarlarKesh;

  if (turVal !== "Hammasi") natija = natija.filter((t) => String(t.tur_id) === turVal);
  if (modelVal !== "Hammasi") natija = natija.filter((t) => t.model === modelVal);

  if (matn) {
    const qismlar = matn.split(/\s+/);
    natija = natija.filter((t) => {
      const birlashgan = `${t.model_kodi} ${t.model} ${t.marka || ""}`.toLowerCase();
      return qismlar.every((q) => birlashgan.includes(q));
    });
  }

  qidiruvNatijalari = natija;
  joriySahifa = 1;

  document.getElementById("qidiruv-soni").textContent = `${natija.length} ta`;

  natijalarniChizish();
  mosModellarniKorsat(matn);
}

function natijalarniChizish() {
  const tbody = document.getElementById("qidiruv-tbody");
  if (!tbody) return;

  if (!qidiruvNatijalari.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="bosh-qator">Natija topilmadi</td></tr>';
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  const boshi = (joriySahifa - 1) * sahifadagiSoni;
  const oxiri = boshi + sahifadagiSoni;
  const joriy = qidiruvNatijalari.slice(boshi, oxiri);

  tbody.innerHTML = joriy.map((t) => `
    <tr>
      <td data-label="Kod">${t.model_kodi}</td>
      <td data-label="Model">${t.model}</td>
      <td data-label="Marka">${t.marka || "—"}</td>
      <td data-label="Narx">${formatNarx(t.narx)}</td>
      <td data-label="Soni">${t.soni} ta</td>
      <td data-label="Amal">
        <button class="btn btn-savat" data-savatga="${t.id}">🛒 Qo'shish</button>
      </td>
    </tr>
  `).join("");

  // Event listener — JSON.stringify o'rniga xavfsiz yondashuv
  tbody.querySelectorAll("[data-savatga]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.savatga;
      const tovar = qidiruvNatijalari.find((t) => String(t.id) === String(id));
      if (tovar) savatgaQoshish(tovar);
    });
  });

  sahifalashniChizish();
}

function sahifalashniChizish() {
  const pagEl = document.getElementById("pagination");
  if (!pagEl) return;

  const jami = Math.ceil(qidiruvNatijalari.length / sahifadagiSoni);
  if (jami <= 1) { pagEl.innerHTML = ""; return; }

  let html = "";
  if (joriySahifa > 1) html += `<button class="page-btn" data-sahifa="${joriySahifa - 1}">⬅️</button>`;
  for (let i = 1; i <= jami; i++) {
    html += `<button class="page-btn ${i === joriySahifa ? "faol" : ""}" data-sahifa="${i}">${i}</button>`;
  }
  if (joriySahifa < jami) html += `<button class="page-btn" data-sahifa="${joriySahifa + 1}">➡️</button>`;

  pagEl.innerHTML = html;

  pagEl.querySelectorAll("[data-sahifa]").forEach((btn) => {
    btn.addEventListener("click", () => {
      joriySahifa = Number(btn.dataset.sahifa);
      natijalarniChizish();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

async function mosModellarniKorsat(matn = "") {
  const tbody = document.getElementById("mos-modellar-tbody");
  if (!tbody) return;

  if (!matn) {
    tbody.innerHTML = '<tr><td colspan="6" class="bosh-qator">Mos modellar yo\'q</td></tr>';
    return;
  }

  try {
    const qismlar = matn.split(/\s+/);
    const orFilters = qismlar
      .map((q) => `model.ilike.%${q}%,marka.ilike.%${q}%,model_kodi.ilike.%${q}%`)
      .join(",");

    const { data: topilgan, error: qx } = await supabaseClient
      .from("tovarlar")
      .select("id")
      .or(orFilters);

    if (qx) throw qx;

    if (!topilgan || !topilgan.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="bosh-qator">Mos modellar topilmadi</td></tr>';
      return;
    }

    const ids = topilgan.map((t) => t.id);

    const { data, error } = await supabaseClient
      .from("mosliklar")
      .select(`
        asosiy_tovar_id,
        mos_tovar_id,
        asosiy:tovarlar!mosliklar_asosiy_tovar_id_fkey(id, model_kodi, model, marka, narx, soni, arxivlangan),
        mos:tovarlar!mosliklar_mos_tovar_id_fkey(id, model_kodi, model, marka, narx, soni, arxivlangan)
      `)
      .or(`asosiy_tovar_id.in.(${ids.join(",")}),mos_tovar_id.in.(${ids.join(",")})`);

    if (error) throw error;

    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="bosh-qator">Mosliklar topilmadi</td></tr>';
      return;
    }

    const unikal = new Map();
    data.forEach((r) => {
      if (ids.includes(r.asosiy_tovar_id) && r.mos && r.mos.arxivlangan === false) {
        unikal.set(r.mos.model_kodi, r.mos);
      }
      if (ids.includes(r.mos_tovar_id) && r.asosiy && r.asosiy.arxivlangan === false) {
        unikal.set(r.asosiy.model_kodi, r.asosiy);
      }
    });

    if (!unikal.size) {
      tbody.innerHTML = '<tr><td colspan="6" class="bosh-qator">Haqiqiy mos modellar topilmadi</td></tr>';
      return;
    }

    const royxat = [...unikal.values()];

    tbody.innerHTML = royxat.map((t) => `
      <tr>
        <td data-label="Kod">${t.model_kodi}</td>
        <td data-label="Model">${t.model}</td>
        <td data-label="Marka">${t.marka || "—"}</td>
        <td data-label="Narx">${formatNarx(t.narx)}</td>
        <td data-label="Soni">${t.soni} ta</td>
        <td data-label="Amal">
          <button class="btn btn-savat" data-savatga-mos="${t.id}">🛒 Qo'shish</button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll("[data-savatga-mos]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.savatgaMos;
        const tovar = royxat.find((t) => String(t.id) === String(id));
        if (tovar) savatgaQoshish(tovar);
      });
    });

  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="6" class="bosh-qator">Xato: ${e.message}</td></tr>`;
  }
}

/* ============================================================
   SAVAT PANEL
   ============================================================ */
function savatPanelOch() {
  document.getElementById("savat-panel").classList.remove("yashirin");
  document.getElementById("savat-overlay").classList.remove("yashirin");
  document.body.classList.add("savat-ochiq");
}

function savatPanelYop() {
  document.getElementById("savat-panel").classList.add("yashirin");
  document.getElementById("savat-overlay").classList.add("yashirin");
  document.body.classList.remove("savat-ochiq");
}

/* ============================================================
   SOTUV
   ============================================================ */
async function sotuvModalOch() {
  if (!_savat.length) return xatoKorsatish("Savat bo'sh");

  const jamiSumma = _savat.reduce((s, t) => s + (t.narx + 30000) * t.soni, 0);
  document.getElementById("modal-jami-summa").textContent = formatSum(jamiSumma);

  try {
    const mijozlar = await mijozlarniOlish();
    const mSel = document.getElementById("savat-mijoz");
    mSel.innerHTML =
      '<option value="">— Mijoz tanlang —</option>' +
      mijozlar.map((m) => `<option value="${m.id}">${m.ism} (${m.telefon || ""})</option>`).join("");
    document.getElementById("sotuv-modal-overlay").classList.remove("yashirin");
  } catch (e) {
    xatoKorsatish("Mijozlarni yuklashda xato: " + e.message);
  }
}

async function sotuvniYakunlash() {
  const tolov_turi = document.querySelector('input[name="savat-tolov"]:checked').value;
  const mijoz_id = document.getElementById("savat-mijoz").value;

  if (tolov_turi === "nasiya" && !mijoz_id) {
    return xatoKorsatish("Nasiya uchun mijoz tanlanishi shart");
  }

  const tugma = document.getElementById("sotuv-tasdiq");
  tugma.disabled = true;
  tugma.textContent = "⏳ Saqlanmoqda...";

  try {
    for (const item of _savat) {
      await sotuvQoshish({
        tovar_id: item.id,
        soni: item.soni,
        sotuv_narxi: item.narx,
        tolov_turi,
        mijoz_id: tolov_turi === "nasiya" ? Number(mijoz_id) : null,
      });
    }

    muvaffaqiyatKorsatish("Sotuv muvaffaqiyatli yakunlandi");
    _savat = [];
    savatKeshniTozalash();
    savatniYangilash();
    document.getElementById("sotuv-modal-overlay").classList.add("yashirin");
    savatPanelYop();

    // Tovarlar soni o'zgargani uchun qayta yuklaymiz
    await barchaTovarlar();
    qidiruvIshla();
  } catch (e) {
    xatoKorsatish(e.message);
  } finally {
    tugma.disabled = false;
    tugma.textContent = "✅ Sotishni yakunlash";
  }
}

/* ============================================================
   EVENTLAR
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  // Savat panel ochish/yopish
  document.getElementById("savat-tugma").addEventListener("click", () => {
    const panel = document.getElementById("savat-panel");
    if (panel.classList.contains("yashirin")) savatPanelOch();
    else savatPanelYop();
  });
  document.getElementById("savat-yopish").addEventListener("click", savatPanelYop);
  document.getElementById("savat-overlay").addEventListener("click", savatPanelYop);

  // Savat tozalash
  document.getElementById("savat-tozalash").addEventListener("click", async () => {
    if (!_savat.length) return;
    const ok = await tasdiqlash("Savatdagi barcha tovarlarni o'chirishni tasdiqlaysizmi?");
    if (!ok) return;
    _savat = [];
    savatKeshniTozalash();
    savatniYangilash();
    muvaffaqiyatKorsatish("Savat tozalandi");
  });

  // Savat sotish
  document.getElementById("savat-sotish").addEventListener("click", sotuvModalOch);

  // Savat ichidagi amallar (event delegation)
  document.getElementById("savat-royxat").addEventListener("click", (e) => {
    const kamaytir = e.target.dataset.kamaytir;
    const kopaytir = e.target.dataset.kopaytir;
    const ochirish = e.target.dataset.savatOchirish;

    if (kamaytir) {
      const item = _savat.find((t) => String(t.id) === String(kamaytir));
      if (item) savatSoniOzgartirish(kamaytir, item.soni - 1);
    }
    if (kopaytir) {
      const item = _savat.find((t) => String(t.id) === String(kopaytir));
      if (item) savatSoniOzgartirish(kopaytir, item.soni + 1);
    }
    if (ochirish) {
      savatdanOlish(ochirish);
    }
  });

  // Savat soni input
  document.getElementById("savat-royxat").addEventListener("change", (e) => {
    const inputId = e.target.dataset.soniInput;
    if (!inputId) return;
    const yangiSoni = Number(e.target.value);
    if (!yangiSoni || yangiSoni < 1) {
      savatniYangilash();
      return;
    }
    savatSoniOzgartirish(inputId, yangiSoni);
  });

  // Sotuv modal — to'lov turi
  document.querySelectorAll('input[name="savat-tolov"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      document.getElementById("savat-mijoz-guruh").classList.toggle("yashirin", e.target.value !== "nasiya");
    });
  });

  // Sotuv modal — bekor
  document.getElementById("sotuv-bekor").addEventListener("click", () => {
    document.getElementById("sotuv-modal-overlay").classList.add("yashirin");
  });

  // Sotuv modal — tasdiq
  document.getElementById("sotuv-tasdiq").addEventListener("click", sotuvniYakunlash);

  // Tasdiqlash modal
  document.getElementById("modal-bekor").addEventListener("click", () => {
    document.getElementById("modal-overlay").classList.add("yashirin");
    if (_tasdiqResolve) { _tasdiqResolve(false); _tasdiqResolve = null; }
  });
  document.getElementById("modal-tasdiq").addEventListener("click", () => {
    document.getElementById("modal-overlay").classList.add("yashirin");
    if (_tasdiqResolve) { _tasdiqResolve(true); _tasdiqResolve = null; }
  });

  // Qidiruv eventlari
  document.getElementById("qidiruv-tur").addEventListener("change", qidiruvIshla);
  document.getElementById("qidiruv-model").addEventListener("change", qidiruvIshla);
  document.getElementById("qidiruv-matn").addEventListener("input", qidiruvIshla);

  // Boshlash
  savatniYangilash();
  yuklaQidiruv();



  /* ============================================================
   PWA — SERVICE WORKER RO'YXATDAN O'TKAZISH
   ============================================================ */
function pwaRoyxatdanOtish() {
  if (!("serviceWorker" in navigator)) {
    console.warn("[PWA] Service Worker qo'llab-quvvatlanmaydi");
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .then((reg) => {
        console.log("[PWA] SW ro'yxatdan o'tdi:", reg.scope);

        // Yangilanish bormi?
        reg.addEventListener("updatefound", () => {
          const yangiWorker = reg.installing;
          yangiWorker.addEventListener("statechange", () => {
            if (yangiWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("[PWA] Yangi versiya mavjud");
              // Ixtiyoriy: foydalanuvchiga bildirishnoma
              toast("🔄 Yangi versiya mavjud. Yangilash uchun sahifani yangilang.", "yashil");
            }
          });
        });
      })
      .catch((err) => console.error("[PWA] SW xato:", err));

    // Controller o'zgarsa (yangi SW faollashsa) — sahifani yangilash
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

// DOMContentLoaded ichida chaqirish
document.addEventListener("DOMContentLoaded", () => {
  pwaRoyxatdanOtish();
  // ... qolgan kod
});


});