const SUPABASE_URL = "https://iqtdgbkymsilzxdjwpdl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5qb3UiLzJT0xzSO8O5V-rQ_2s30obcN";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============ YORDAMCHI FUNKSIYALAR ============ */
function formatSum(summa) {
  const n = Number(summa) || 0;
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
}

function sanaVaqt(d = new Date()) {
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function bugunBoshi() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function validatsiyaTekshir(maydonlar) {
  for (const m of maydonlar) {
    if (m.majburiy && (m.qiymat === "" || m.qiymat === null || m.qiymat === undefined)) {
      xatoKorsatish(`"${m.nomi}" maydoni to'ldirilishi shart`);
      return false;
    }
  }
  return true;
}

let _tasdiqResolve = null;
function tasdiqlash(xabar) {
  return new Promise((resolve) => {
    _tasdiqResolve = resolve;
    document.getElementById("modal-xabar").textContent = xabar;
    document.getElementById("modal-overlay").classList.remove("yashirin");
  });
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

function navigatsiyaYukla(sahifaId) {
  document.querySelectorAll(".sahifa").forEach((s) => s.classList.remove("faol"));
  const target = document.getElementById(sahifaId);
  if (target) target.classList.add("faol");

  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("faol", b.dataset.sahifa === sahifaId);
  });
  document.querySelectorAll(".bnav-btn").forEach((b) => {
    b.classList.toggle("faol", b.dataset.sahifa === sahifaId);
  });

  const yuklashlar = {
    "sahifa-01": yuklaBoshSahifa,
    "sahifa-02": yuklaQidiruv,
    "sahifa-03": yuklaTovarQoshish,
    "sahifa-04": yuklaOmborKirim,
    "sahifa-05": yuklaTahrirlash,
    "sahifa-06": yuklaTovarSotuvi,
    "sahifa-06-1": yuklaXizmatSotuvi,
    "sahifa-07": yuklaXarajat,
    "sahifa-08": yuklaMoslik,
    "sahifa-09": yuklaMijozlar,
  };
  if (yuklashlar[sahifaId]) yuklashlar[sahifaId]();
}

/* ============ SUPABASE CRUD ============ */
async function tovarlarniOlish(filtr = {}) {
  let q = supabaseClient.from("tovarlar").select("*, tovar_turlari(nomi)").eq("arxivlangan", false);
  if (filtr.tur_id) q = q.eq("tur_id", filtr.tur_id);
  if (filtr.model_kodi) q = q.eq("model_kodi", filtr.model_kodi);
  const { data, error } = await q.order("yaratilgan_vaqt", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function tovarQoshish(tovar) {
  const { data: mavjud } = await supabaseClient.from("tovarlar").select("id").eq("model_kodi", tovar.model_kodi).maybeSingle();
  if (mavjud) throw new Error("Bu model kodi allaqachon mavjud");
  const { data, error } = await supabaseClient.from("tovarlar").insert(tovar).select().single();
  if (error) throw error;
  return data;
}

async function tovarTahrirlash(id, malumot) {
  const { data, error } = await supabaseClient.from("tovarlar").update(malumot).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

async function tovarOchirish(id) {
  const { error } = await supabaseClient.from("tovarlar").update({ arxivlangan: true }).eq("id", id);
  if (error) throw error;
}

async function kirimQoshish(kirim) {
  const { data: tovar, error: e1 } = await supabaseClient.from("tovarlar").select("soni").eq("id", kirim.tovar_id).single();
  if (e1) throw e1;

  const yangiSoni = (tovar.soni || 0) + kirim.soni;
  const { error: e2 } = await supabaseClient.from("tovarlar").update({ soni: yangiSoni }).eq("id", kirim.tovar_id);
  if (e2) throw e2;

  const { data, error } = await supabaseClient.from("kirimlar").insert(kirim).select().single();
  if (error) throw error;
  return data;
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

async function xizmatSotuvQoshish(xizmat) {
  const { data: xizmatData, error } = await supabaseClient.from("xizmat_sotuvlari").insert(xizmat).select().single();
  if (error) throw error;

  if (xizmat.tolov_turi === "nasiya" && xizmat.mijoz_id) {
    await supabaseClient.from("nasiyalar").insert({
      mijoz_id: xizmat.mijoz_id,
      xizmat_sotuv_id: xizmatData.id,
      summa: xizmat.narxi,
      tolov_summasi: 0,
      tolangan: false,
    });
  }
  return xizmatData;
}

async function xarajatQoshish(xarajat) {
  const { data, error } = await supabaseClient.from("xarajatlar").insert(xarajat).select().single();
  if (error) throw error;
  return data;
}

async function mijozlarniOlish() {
  const { data, error } = await supabaseClient.from("mijozlar").select("*").order("yaratilgan_vaqt", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function mijozQoshish(mijoz) {
  const { data, error } = await supabaseClient.from("mijozlar").insert(mijoz).select().single();
  if (error) throw error;
  return data;
}

async function mijozTahrirlash(id, malumot) {
  const { data, error } = await supabaseClient.from("mijozlar").update(malumot).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

async function nasiyalarniOlish(mijozId) {
  const { data, error } = await supabaseClient.from("nasiyalar").select("*").eq("mijoz_id", mijozId).eq("tolangan", false);
  if (error) throw error;
  return data || [];
}

async function nasiyaTolash(nasiyaId, summa) {
  const { data: nasiya, error: e1 } = await supabaseClient.from("nasiyalar").select("*").eq("id", nasiyaId).single();
  if (e1) throw e1;

  const yangiTolov = (nasiya.tolov_summasi || 0) + summa;
  if (yangiTolov > nasiya.summa) throw new Error("To'lov summasi qarzdan oshib ketdi");

  const tolangan = yangiTolov >= nasiya.summa;
  const { error } = await supabaseClient.from("nasiyalar").update({ tolov_summasi: yangiTolov, tolangan }).eq("id", nasiyaId);
  if (error) throw error;
}

async function moslikQoshish(asosiyId, mosId) {
  const { data, error } = await supabaseClient.from("mosliklar").insert({ asosiy_tovar_id: asosiyId, mos_tovar_id: mosId }).select().single();
  if (error) {
    if (error.code === "23505") throw new Error("Bu moslik allaqachon mavjud");
    throw error;
  }
  return data;
}

async function moslikTahrirlash(id, malumot) {
  const { data, error } = await supabaseClient.from("mosliklar").update(malumot).eq("id", id).select().single();
  if (error) {
    if (error.code === "23505") throw new Error("Bu moslik allaqachon mavjud");
    throw error;
  }
  return data;
}

async function boshSahifaMalumot() {
  const boshi = bugunBoshi();
  const [sotuvlar, xizmatlar, xarajatlar] = await Promise.all([
    supabaseClient.from("sotuvlar").select("*").gte("sana", boshi),
    supabaseClient.from("xizmat_sotuvlari").select("*").gte("sana", boshi),
    supabaseClient.from("xarajatlar").select("*").gte("sana", boshi),
  ]);

  const s = sotuvlar.data || [];
  const x = xizmatlar.data || [];
  const xr = xarajatlar.data || [];

  let naqdSotuv = 0, kartaSotuv = 0, naqdXizmat = 0, kartaXizmat = 0;
  let naqdXarajat = 0, kartaXarajat = 0;

  s.forEach((r) => {
    const summa = r.sotuv_narxi * r.soni;
    if (r.tolov_turi === "naqd") naqdSotuv += summa;
    else if (r.tolov_turi === "karta") kartaSotuv += summa;
  });

  x.forEach((r) => {
    if (r.tolov_turi === "naqd") naqdXizmat += r.narxi;
    else if (r.tolov_turi === "karta") kartaXizmat += r.narxi;
  });

  xr.forEach((r) => {
    if (r.tolov_turi === "naqd") naqdXarajat += r.miqdori;
    else if (r.tolov_turi === "karta") kartaXarajat += r.miqdori;
  });

  return {
    naqdKassa: naqdSotuv + naqdXizmat - naqdXarajat,
    kartaKassa: kartaSotuv + kartaXizmat - kartaXarajat,
    tushum: naqdSotuv + kartaSotuv + naqdXizmat + kartaXizmat,
    xarajat: naqdXarajat + kartaXarajat,
    foyda: (naqdSotuv + kartaSotuv + naqdXizmat + kartaXizmat) - (naqdXarajat + kartaXarajat)
  };
}

/* ============ YUKLASH FUNKSIYALARI ============ */
let _tovarlarKesh = [];
let _turlarKesh = [];

async function turlarniOlish() {
  if (_turlarKesh.length) return _turlarKesh;
  const { data, error } = await supabaseClient.from("tovar_turlari").select("*").order("id");
  if (error) throw error;
  _turlarKesh = data || [];
  return _turlarKesh;
}

async function barchaTovarlar() {
  const { data, error } = await supabaseClient.from("tovarlar").select("*, tovar_turlari(nomi)").eq("arxivlangan", false).order("model");
  if (error) throw error;
  _tovarlarKesh = data || [];
  return _tovarlarKesh;
}

async function yuklaBoshSahifa() {
  try {
    const m = await boshSahifaMalumot();
    document.getElementById("kassa-naqd").textContent = formatSum(m.naqdKassa);
    document.getElementById("kassa-karta").textContent = formatSum(m.kartaKassa);
    document.getElementById("bugun-tushum").textContent = formatSum(m.tushum);
    document.getElementById("bugun-xarajat").textContent = formatSum(m.xarajat);
    document.getElementById("bugun-foyda").textContent = formatSum(m.foyda);
  } catch (e) {
    xatoKorsatish("Bosh sahifa ma'lumotlarini yuklashda xato: " + e.message);
  }
}

/* --- 02 QIDIRUV --- */
let qidiruvNatijalari = [];
let joriySahifa = 1;
const sahifadagiSoni = 20;

async function yuklaQidiruv() {
  try {
    const turlar = await turlarniOlish();
    const turSel = document.getElementById("qidiruv-tur");
    turSel.innerHTML = '<option value="Hammasi">Hammasi</option>' + turlar.map((t) => `<option value="${t.id}">${t.nomi}</option>`).join("");

    await barchaTovarlar();
    const modelSel = document.getElementById("qidiruv-model");
    const unikalModellar = [...new Set(_tovarlarKesh.map(t => t.model))];
    modelSel.innerHTML = '<option value="Hammasi">Hammasi</option>' + unikalModellar.map((m) => `<option value="${m}">${m}</option>`).join("");

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
      const birlashganMatn = `${t.model_kodi} ${t.model} ${t.marka || ""}`.toLowerCase();
      return qismlar.every(qism => birlashganMatn.includes(qism));
    });
  }

  qidiruvNatijalari = natija;
  joriySahifa = 1;

  natijalarniChizish();
  mosModellarniQidiruvdaKorsat(matn);
}

function natijalarniChizish() {
  const tbody = document.getElementById("qidiruv-tbody");
  if (!tbody) return;
  
  if (!qidiruvNatijalari.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="bosh-qator">Natija topilmadi</td></tr>';
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  const boshi = (joriySahifa - 1) * sahifadagiSoni;
  const oxiri = boshi + sahifadagiSoni;
  const joriyTovarlar = qidiruvNatijalari.slice(boshi, oxiri);

  tbody.innerHTML = joriyTovarlar.map((t) => `
    <tr>
      <td data-label="Kod">${t.model_kodi}</td>
      <td data-label="Model">${t.model}</td>
      <td data-label="Marka">${t.marka || "—"}</td>
      <td data-label="Narx">${formatSum(t.narx)}</td>
      <td data-label="Soni">${t.soni} ta</td>
    </tr>
  `).join("");

  sahifalashniChizish();
}

function sahifalashniChizish() {
  const pagEl = document.getElementById("pagination");
  if (!pagEl) return;

  const jamiSahifalar = Math.ceil(qidiruvNatijalari.length / sahifadagiSoni);
  if (jamiSahifalar <= 1) { pagEl.innerHTML = ""; return; }

  let html = "";
  if (joriySahifa > 1) html += `<button class="page-btn" onclick="sahifagaOtish(${joriySahifa - 1})">⬅️</button>`;
  for (let i = 1; i <= jamiSahifalar; i++) {
    html += `<button class="page-btn ${i === joriySahifa ? 'faol' : ''}" onclick="sahifagaOtish(${i})">${i}</button>`;
  }
  if (joriySahifa < jamiSahifalar) html += `<button class="page-btn" onclick="sahifagaOtish(${joriySahifa + 1})">➡️</button>`;

  pagEl.innerHTML = html;
}

function sahifagaOtish(sahifa) {
  joriySahifa = sahifa;
  natijalarniChizish();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function mosModellarniQidiruvdaKorsat(matn = "") {
  const tbody = document.getElementById("mos-modellar-tbody");
  if (!tbody) return;

  if (!matn) {
    tbody.innerHTML = '<tr><td colspan="5" class="bosh-qator">Mos modellar yo\'q</td></tr>';
    return;
  }

  try {
    const qismlar = matn.split(/\s+/);
    let orFilters = qismlar.map(q => `model.ilike.%${q}%,marka.ilike.%${q}%,model_kodi.ilike.%${q}%`).join(",");
    
    const { data: barchaTopilgan, error: qidiruvXato } = await supabaseClient
      .from("tovarlar")
      .select("id")
      .or(orFilters);
      
    if (qidiruvXato) throw qidiruvXato;

    if (!barchaTopilgan || barchaTopilgan.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="bosh-qator">Mos modellar topilmadi</td></tr>';
      return;
    }

    const ids = barchaTopilgan.map(t => t.id);

    const { data, error } = await supabaseClient
      .from("mosliklar")
      .select(`
        asosiy_tovar_id,
        mos_tovar_id,
        asosiy:tovarlar!mosliklar_asosiy_tovar_id_fkey(model_kodi, model, marka, narx, soni, arxivlangan),
        mos:tovarlar!mosliklar_mos_tovar_id_fkey(model_kodi, model, marka, narx, soni, arxivlangan)
      `)
      .or(`asosiy_tovar_id.in.(${ids.join(',')}),mos_tovar_id.in.(${ids.join(',')})`);

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="bosh-qator">Bu modelga tegishli mosliklar topilmadi</td></tr>';
      return;
    }

    const unikal = new Map();
    data.forEach(r => {
      if (ids.includes(r.asosiy_tovar_id) && r.mos) {
        if (r.mos.arxivlangan === false) unikal.set(r.mos.model_kodi, r.mos);
      }
      if (ids.includes(r.mos_tovar_id) && r.asosiy) {
        if (r.asosiy.arxivlangan === false) unikal.set(r.asosiy.model_kodi, r.asosiy);
      }
    });

    if (unikal.size === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="bosh-qator">Faqat haqiqiy mos modellar topilmadi</td></tr>';
      return;
    }

    let html = "";
    unikal.forEach(t => {
      html += `<tr>
        <td data-label="Kod">${t.model_kodi}</td>
        <td data-label="Model">${t.model}</td>
        <td data-label="Marka">${t.marka || "—"}</td>
        <td data-label="Narx">${formatSum(t.narx)}</td>
        <td data-label="Soni">${t.soni} ta</td>
      </tr>`;
    });
    tbody.innerHTML = html;
    
  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="5" class="bosh-qator">Xato: ${e.message}</td></tr>`;
  }
}

/* --- 03 TOVAR QO'SHISH --- */
async function yuklaTovarQoshish() {
  try {
    const turlar = await turlarniOlish();
    const sel = document.getElementById("qoshish-tur");
    sel.innerHTML = '<option value="">— Tanlang —</option>' + turlar.map((t) => `<option value="${t.id}">${t.nomi}</option>`).join("");
    ["qoshish-kod", "qoshish-model", "qoshish-marka", "qoshish-narx"].forEach((id) => {
      document.getElementById(id).disabled = true;
      document.getElementById(id).value = "";
    });
    document.getElementById("qoshish-saqlash").disabled = true;
  } catch (e) { xatoKorsatish("Yuklashda xato: " + e.message); }
}

/* --- 04 OMBORGA KIRIM --- */
async function yuklaOmborKirim() {
  try {
    await barchaTovarlar();
    const dl = document.getElementById("kirim-kod-list");
    dl.innerHTML = _tovarlarKesh.map((t) => `<option value="${t.model_kodi}">${t.model} (${t.marka || ""})</option>`).join("");

    const { data, error } = await supabaseClient.from("kirimlar").select("*, tovarlar(model_kodi)").order("sana", { ascending: false }).limit(20);
    if (error) throw error;

    const tbody = document.getElementById("kirim-tbody");
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="bosh-qator">Kirim/chiqimlar yo\'q</td></tr>';
    } else {
      tbody.innerHTML = data.map((r) => {
        const isChiqim = r.soni < 0;
        const amalBelgisi = isChiqim 
          ? '<span class="badge badge-qizil">📤 Chiqim</span>'
          : '<span class="badge badge-yashil">📥 Kirim</span>';
        return `<tr>
          <td data-label="Sana">${sanaVaqt(new Date(r.sana))}</td>
          <td data-label="Model kodi">${r.tovarlar ? r.tovarlar.model_kodi : "—"}</td>
          <td data-label="Amal">${amalBelgisi}</td>
          <td data-label="Soni" class="${isChiqim ? 'son-chiqim' : 'son-kirim'}">${Math.abs(r.soni)} ta</td>
          <td data-label="Izoh">${r.izoh || "—"}</td>
          <td data-label="Bekor qilish">
            <button class="btn btn-kulrang" style="padding: 6px 12px; font-size: 12px;" data-kirim-bekor="${r.id}" title="Bekor qilish">↩️ Qaytarish</button>
          </td>
        </tr>`;
      }).join("");

      // Bekor qilish eventi
      tbody.querySelectorAll("[data-kirim-bekor]").forEach(btn => {
        btn.addEventListener("click", () => kirimChiqimBekorQilish(btn.dataset.kirimBekor));
      });
    }
  } catch (e) { xatoKorsatish("Kirim yuklashda xato: " + e.message); }
}

async function kirimChiqimBekorQilish(id) {
  const ok = await tasdiqlash("Bu amalni bekor qilmoqchimisiz? Tovar soni qayta hisoblanadi.");
  if (!ok) return;

  try {
    // 1. Kirim/chiqim ma'lumotini olish
    const { data: kirim, error: e1 } = await supabaseClient.from("kirimlar").select("*").eq("id", id).single();
    if (e1) throw e1;

    // 2. Tovar sonini qaytarish (agar kirim bo'lsa - ayiramiz, chiqim bo'lsa - qo'shamiz)
    const { data: tovar, error: e2 } = await supabaseClient.from("tovarlar").select("soni").eq("id", kirim.tovar_id).single();
    if (e2) throw e2;

    const yangiSoni = tovar.soni - kirim.soni;
    if (yangiSoni < 0) throw new Error("Bekor qilish imkonsiz, ombordagi tovar manfiyga tushib ketadi.");

    const { error: e3 } = await supabaseClient.from("tovarlar").update({ soni: yangiSoni }).eq("id", kirim.tovar_id);
    if (e3) throw e3;

    // 3. Kirim yozuvini o'chirish
    const { error: e4 } = await supabaseClient.from("kirimlar").delete().eq("id", id);
    if (e4) throw e4;

    muvaffaqiyatKorsatish("Amal bekor qilindi");
    _tovarlarKesh = []; // Keshni yangilash
    await yuklaOmborKirim(); // Jadvalni yangilash
  } catch (e) {
    xatoKorsatish("Xato: " + e.message);
  }
}

/* --- 05 TOVARLARNI TAHRIRLASH --- */
let _tahrirFiltrlangan = [];

async function yuklaTahrirlash() {
  try {
    const turlar = await turlarniOlish();
    const turSel = document.getElementById("tahrir-tur");
    turSel.innerHTML = '<option value="Hammasi">Hammasi</option>' + turlar.map((t) => `<option value="${t.id}">${t.nomi}</option>`).join("");

    await barchaTovarlar();
    const modelSel = document.getElementById("tahrir-model");
    const unikalModellar = [...new Set(_tovarlarKesh.map(t => t.model))];
    modelSel.innerHTML = '<option value="Hammasi">Hammasi</option>' + unikalModellar.map((m) => `<option value="${m}">${m}</option>`).join("");

    tahrirIshla();
  } catch (e) { xatoKorsatish("Tahrirlash yuklashda xato: " + e.message); }
}

function tahrirIshla() {
  const turVal = document.getElementById("tahrir-tur").value;
  const modelVal = document.getElementById("tahrir-model").value;
  const matn = document.getElementById("tahrir-qidiruv").value.toLowerCase().trim();

  let natija = _tovarlarKesh;
  if (turVal !== "Hammasi") natija = natija.filter((t) => String(t.tur_id) === turVal);
  if (modelVal !== "Hammasi") natija = natija.filter((t) => t.model === modelVal);
  if (matn) {
    const qismlar = matn.split(/\s+/);
    natija = natija.filter((t) => {
      const birlashganMatn = `${t.model_kodi} ${t.model} ${t.marka || ""}`.toLowerCase();
      return qismlar.every(qism => birlashganMatn.includes(qism));
    });
  }

  _tahrirFiltrlangan = natija;

  let turNomi = "tovar";
  if (turVal !== "Hammasi") {
    const tanlanganTur = _turlarKesh.find(t => String(t.id) === turVal);
    if (tanlanganTur) turNomi = tanlanganTur.nomi; 
  }
  
  const jamiDona = natija.reduce((sum, tovar) => sum + Number(tovar.soni || 0), 0);
  document.getElementById("tahrir-jami").textContent = `Jami ${jamiDona} ta ${turNomi}`;

  const tbody = document.getElementById("tahrir-tbody");
  if (!natija.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="bosh-qator">Tovar topilmadi</td></tr>';
    return;
  }
  tbody.innerHTML = natija.map((t) => `
    <tr>
      <td data-label="Kod">${t.model_kodi}</td>
      <td data-label="Model">${t.model}</td>
      <td data-label="Marka">${t.marka || "—"}</td>
      <td data-label="Narx">${formatSum(t.narx)}</td>
      <td data-label="Soni">${t.soni}</td>
      <td data-label="Amallar">
        <button class="amal-btn" data-tahrir="${t.id}" title="Tahrirlash">✏️</button>
        <button class="amal-btn" data-ochirish="${t.id}" title="O'chirish">🗑️</button>
      </td>
    </tr>
  `).join("");
}

/* --- 06 TOVAR SOTUVI --- */
let _sotuvTovar = null;

async function yuklaTovarSotuvi() {
  try {
    await barchaTovarlar();
    const dl = document.getElementById("sotuv-kod-list");
    dl.innerHTML = _tovarlarKesh.map((t) => `<option value="${t.model_kodi}">${t.model} (${t.marka || ""})</option>`).join("");

    const mijozlar = await mijozlarniOlish();
    const mSel = document.getElementById("sotuv-mijoz");
    mSel.innerHTML = '<option value="">— Mijoz tanlang —</option>' + mijozlar.map((m) => `<option value="${m.id}">${m.ism} (${m.telefon || ""})</option>`).join("");
    
    // Tarixni yuklash
    await yuklaSotuvTarixi();
  } catch (e) { xatoKorsatish("Sotuv yuklashda xato: " + e.message); }
}

async function yuklaSotuvTarixi() {
  try {
    const boshi = bugunBoshi();
    const { data, error } = await supabaseClient
      .from("sotuvlar")
      .select("*, tovarlar(model_kodi, model)")
      .gte("sana", boshi)
      .order("sana", { ascending: false });

    if (error) throw error;

    const tbody = document.getElementById("sotuv-tarix-tbody");
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="bosh-qator">Bugun sotuvlar yo\'q</td></tr>';
      return;
    }

    tbody.innerHTML = data.map((r) => {
      const jamiSumma = r.sotuv_narxi * r.soni;
      const tolovMatni = r.tolov_turi === 'naqd' ? '💵 Naqd' : r.tolov_turi === 'karta' ? '💳 Karta' : '🤝 Nasiya';
      
      return `<tr>
        <td data-label="Vaqt">${sanaVaqt(new Date(r.sana)).split(' ')[1]}</td>
        <td data-label="Model kodi">${r.tovarlar ? r.tovarlar.model_kodi : "—"}</td>
        <td data-label="Soni">${r.soni} ta</td>
        <td data-label="Summa">${formatSum(jamiSumma)}</td>
        <td data-label="To'lov">${tolovMatni}</td>
        <td data-label="Amal">
          <button class="btn btn-qizil" style="padding: 6px 12px; font-size: 12px;" data-sotuv-bekor="${r.id}" title="Sotuvni bekor qilish">↩️ Qaytarish</button>
        </td>
      </tr>`;
    }).join("");

    // Bekor qilish eventi
    tbody.querySelectorAll("[data-sotuv-bekor]").forEach(btn => {
      btn.addEventListener("click", () => sotuvniBekorQilish(btn.dataset.sotuvBekor));
    });

  } catch (e) {
    xatoKorsatish("Tarixni yuklashda xato: " + e.message);
  }
}

async function sotuvniBekorQilish(id) {
  const ok = await tasdiqlash("Bu sotuvni bekor qilib, tovarni omborga qaytarasizmi?");
  if (!ok) return;

  try {
    // 1. Sotuv ma'lumotlarini olish
    const { data: sotuv, error: e1 } = await supabaseClient.from("sotuvlar").select("*").eq("id", id).single();
    if (e1) throw e1;

    // 2. Tovar sonini omborga qayta qo'shish
    const { data: tovar, error: e2 } = await supabaseClient.from("tovarlar").select("soni").eq("id", sotuv.tovar_id).single();
    if (e2) throw e2;

    const { error: e3 } = await supabaseClient.from("tovarlar").update({ soni: tovar.soni + sotuv.soni }).eq("id", sotuv.tovar_id);
    if (e3) throw e3;

    // 3. Agar nasiya bo'lsa, nasiyani o'chirish
    await supabaseClient.from("nasiyalar").delete().eq("sotuv_id", id);

    // 4. Sotuvni o'chirish
    const { error: e5 } = await supabaseClient.from("sotuvlar").delete().eq("id", id);
    if (e5) throw e5;

    muvaffaqiyatKorsatish("Sotuv bekor qilindi, tovar omborga qaytarildi");
    _tovarlarKesh = []; // Keshni yangilash
    await yuklaTovarSotuvi(); // Jadvalni yangilash
  } catch (e) {
    xatoKorsatish("Xato: " + e.message);
  }
}

/* --- 06.1 XIZMAT SOTUVI --- */
async function yuklaXizmatSotuvi() {
  try {
    const mijozlar = await mijozlarniOlish();
    const mSel = document.getElementById("xizmat-mijoz");
    mSel.innerHTML = '<option value="">— Mijoz tanlang —</option>' + mijozlar.map((m) => `<option value="${m.id}">${m.ism} (${m.telefon || ""})</option>`).join("");

    const boshi = bugunBoshi();
    const { data, error } = await supabaseClient.from("xizmat_sotuvlari").select("*").gte("sana", boshi).order("sana", { ascending: false });
    if (error) throw error;

    const tbody = document.getElementById("xizmat-tbody");
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="bosh-qator">Bugun xizmat sotuvlari yo\'q</td></tr>';
    } else {
      tbody.innerHTML = data.map((r) => `
        <tr>
          <td data-label="Xizmat nomi">${r.xizmat_nomi}</td>
          <td data-label="Narxi">${formatSum(r.narxi)}</td>
          <td data-label="To'lov turi">${r.tolov_turi}</td>
          <td data-label="Sana">${sanaVaqt(new Date(r.sana))}</td>
        </tr>
      `).join("");
    }
  } catch (e) { xatoKorsatish("Xizmat sotuvi yuklashda xato: " + e.message); }
}

/* --- 07 XARAJAT --- */
async function yuklaXarajat() {
  try {
    const boshi = bugunBoshi();
    const { data, error } = await supabaseClient.from("xarajatlar").select("*").gte("sana", boshi).order("sana", { ascending: false });
    if (error) throw error;

    const tbody = document.getElementById("xarajat-tbody");
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="bosh-qator">Bugun xarajatlar yo\'q</td></tr>';
    } else {
      tbody.innerHTML = data.map((r) => `
        <tr>
          <td data-label="Nomi">${r.nomi}</td>
          <td data-label="Miqdori">${formatSum(r.miqdori)}</td>
          <td data-label="To'lov turi">${r.tolov_turi}</td>
          <td data-label="Sana">${sanaVaqt(new Date(r.sana))}</td>
        </tr>
      `).join("");
    }
  } catch (e) { xatoKorsatish("Xarajat yuklashda xato: " + e.message); }
}

/* --- 08 MOSLIK JADVALI --- */
async function yuklaMoslik() {
  try {
    await barchaTovarlar();
    const asosiyList = document.getElementById("mos-asosiy-list");
    const asosiyKodInput = document.getElementById("mos-asosiy-kod");
    
    if (asosiyList && asosiyKodInput) {
      asosiyList.innerHTML = _tovarlarKesh.map(t => `<option value="${t.model_kodi}">${t.model} (${t.marka || ""})</option>`).join("");
      asosiyKodInput.oninput = (e) => {
        const val = e.target.value.trim().toUpperCase();
        const t = _tovarlarKesh.find(x => x.model_kodi.toUpperCase() === val);
        document.getElementById("mos-asosiy-info").value = t ? `${t.model} (${t.marka})` : "— Model topilmadi —";
      };
    }

    const { data, error } = await supabaseClient.from("mosliklar").select(`
        id, asosiy_tovar_id, mos_tovar_id,
        asosiy:tovarlar!mosliklar_asosiy_tovar_id_fkey(model_kodi, model, marka),
        mos:tovarlar!mosliklar_mos_tovar_id_fkey(model_kodi, model, marka)
      `).order("asosiy_tovar_id");
      
    if (error) throw error;
    const tbody = document.getElementById("mos-tbody");
    if (!tbody) return;

    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="bosh-qator">Mosliklar yo\'q</td></tr>';
      return;
    }

    const guruhlar = {};
    data.forEach(r => {
      const asosiyId = r.asosiy_tovar_id;
      if (!guruhlar[asosiyId]) guruhlar[asosiyId] = { asosiy: r.asosiy, moslar: [] };
      guruhlar[asosiyId].moslar.push({ id: r.id, model: r.mos });
    });

    let html = "";
    for (const id in guruhlar) {
      const g = guruhlar[id];
      const asosiyText = `${g.asosiy.model_kodi} - ${g.asosiy.model} (${g.asosiy.marka})`;
      const moslarHtml = g.moslar.map(m => `
        <div class="mos-item">
          <span class="mos-item-matn">↳ ${m.model.model_kodi} - ${m.model.model} (${m.model.marka})</span>
          <button class="amal-btn amal-btn-qizil" data-mos-ochirish="${m.id}" title="O'chirish">🗑️</button>
        </div>`
      ).join("");

      html += `<tr>
        <td data-label="Asosiy model" class="mos-asosiy-cell">${asosiyText}</td>
        <td data-label="Mos modellar" class="mos-moslar-cell">${moslarHtml}</td>
        <td data-label="Amallar" class="mos-amallar-cell">
           <button class="amal-btn amal-btn-qizil" data-asosiy-ochirish="${id}" title="Barcha mosliklarni o'chirish">🗑️ Guruhni o'chirish</button>
        </td>
      </tr>`;
    }
    tbody.innerHTML = html;
  } catch (e) { xatoKorsatish("Moslik yuklashda xato: " + e.message); }
}

/* --- 09 MIJOZLAR --- */
async function yuklaMijozlar() {
  try {
    const mijozlar = await mijozlarniOlish();
    const natija = await Promise.all(mijozlar.map(async (m) => {
      const { data: nasiyalar } = await supabaseClient.from("nasiyalar").select("summa, tolov_summasi").eq("mijoz_id", m.id).eq("tolangan", false);
      const qarz = (nasiyalar || []).reduce((s, n) => s + (n.summa - (n.tolov_summasi || 0)), 0);

      const { data: sotuvlar } = await supabaseClient.from("sotuvlar").select("tovarlar(model)").eq("mijoz_id", m.id);
      const tovarlar = (sotuvlar || []).map((s) => (s.tovarlar ? s.tovarlar.model : null)).filter(Boolean);

      return { ...m, qarz, tovarlar };
    }));

    const tbody = document.getElementById("mijoz-tbody");
    if (!natija.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="bosh-qator">Mijozlar yo\'q</td></tr>';
      return;
    }

    const chizish = (list) => {
      tbody.innerHTML = list.map((m) => `
        <tr>
          <td data-label="Ism">${m.ism}</td>
          <td data-label="Telefon">${m.telefon || "—"}</td>
          <td data-label="Qarzi">${formatSum(m.qarz)}</td>
          <td data-label="Olgan tavari">${m.tovarlar.length ? m.tovarlar.join(", ") : "—"}</td>
          <td data-label="Amallar"><button class="amal-btn" data-mijoz-batafsil="${m.id}" title="Batafsil">📋</button></td>
        </tr>
      `).join("");
    };

    chizish(natija);

    const q = document.getElementById("mijoz-qidiruv").value.toLowerCase().trim();
    if (q) {
      const filtrlangan = natija.filter((m) => m.ism.toLowerCase().includes(q) || (m.telefon || "").toLowerCase().includes(q));
      if (!filtrlangan.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="bosh-qator">Mijoz topilmadi</td></tr>';
      } else {
        chizish(filtrlangan);
      }
    }
  } catch (e) { xatoKorsatish("Mijozlar yuklashda xato: " + e.message); }
}

/* ============ NAVIGATSIYA VA EVENTLAR ============ */
function navigatsiyaEventlarniUlash() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => navigatsiyaYukla(btn.dataset.sahifa));
  });
  document.querySelectorAll(".bnav-btn").forEach((btn) => {
    btn.addEventListener("click", () => navigatsiyaYukla(btn.dataset.sahifa));
  });
}

/* ============ PWA ============ */
function pwaRoyxatdanOtish() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then((reg) => console.log("SW ro'yxatdan o'tdi:", reg.scope)).catch((err) => console.error("SW xato:", err));
    });
  }
}

/* ============ DOMContentLoaded ============ */
document.addEventListener("DOMContentLoaded", () => {
  pwaRoyxatdanOtish();
  navigatsiyaEventlarniUlash();

  // Modallar
  document.getElementById("modal-bekor").addEventListener("click", () => {
    document.getElementById("modal-overlay").classList.add("yashirin");
    if (_tasdiqResolve) { _tasdiqResolve(false); _tasdiqResolve = null; }
  });
  document.getElementById("modal-tasdiq").addEventListener("click", () => {
    document.getElementById("modal-overlay").classList.add("yashirin");
    if (_tasdiqResolve) { _tasdiqResolve(true); _tasdiqResolve = null; }
  });

  // 03 TOVAR QO'SHISH
  document.getElementById("qoshish-tur").addEventListener("change", (e) => {
    const tanlangan = !!e.target.value;
    ["qoshish-kod", "qoshish-model", "qoshish-marka", "qoshish-narx"].forEach((id) => {
      document.getElementById(id).disabled = !tanlangan;
    });
    document.getElementById("qoshish-saqlash").disabled = !tanlangan;
  });

  document.getElementById("qoshish-saqlash").addEventListener("click", async () => {
    const tur_id = Number(document.getElementById("qoshish-tur").value);
    const model_kodi = document.getElementById("qoshish-kod").value.trim();
    const model = document.getElementById("qoshish-model").value.trim();
    const marka = document.getElementById("qoshish-marka").value.trim();
    const narx = Number(document.getElementById("qoshish-narx").value);

    if (!validatsiyaTekshir([
      { nomi: "Model kodi", qiymat: model_kodi, majburiy: true },
      { nomi: "Model", qiymat: model, majburiy: true },
      { nomi: "Marka", qiymat: marka, majburiy: true },
      { nomi: "Narx", qiymat: narx, majburiy: true },
    ])) return;
    if (narx <= 0) return xatoKorsatish("Narx 0 dan katta bo'lishi kerak");

    try {
      await tovarQoshish({ tur_id, model_kodi, model, marka, narx, soni: 0 });
      muvaffaqiyatKorsatish("Tovar muvaffaqiyatli qo'shildi");
      ["qoshish-kod", "qoshish-model", "qoshish-marka", "qoshish-narx"].forEach(id => document.getElementById(id).value = "");
      _tovarlarKesh = [];
    } catch (e) { xatoKorsatish(e.message); }
  });

  // 02 QIDIRUV
  document.getElementById("qidiruv-tur").addEventListener("change", qidiruvIshla);
  document.getElementById("qidiruv-model").addEventListener("change", qidiruvIshla);
  document.getElementById("qidiruv-matn").addEventListener("input", qidiruvIshla);

  // 04 OMBORGA KIRIM
  document.getElementById("kirim-saqlash").addEventListener("click", async () => {
    const kod = document.getElementById("kirim-kod").value.trim();
    const soni = Number(document.getElementById("kirim-soni").value);
    const izoh = document.getElementById("kirim-izoh").value.trim();

    if (!validatsiyaTekshir([
      { nomi: "Model kodi", qiymat: kod, majburiy: true },
      { nomi: "Soni", qiymat: soni, majburiy: true },
    ])) return;
    if (soni <= 0) return xatoKorsatish("Soni 0 dan katta bo'lishi kerak");

    try {
      const tovar = _tovarlarKesh.find((t) => t.model_kodi === kod);
      if (!tovar) return xatoKorsatish("Bunday model kodi topilmadi");
      await kirimQoshish({ tovar_id: tovar.id, soni, izoh: izoh || null });
      muvaffaqiyatKorsatish("Kirim muvaffaqiyatli qo'shildi");
      document.getElementById("kirim-kod").value = "";
      document.getElementById("kirim-soni").value = "";
      document.getElementById("kirim-izoh").value = "";
      _tovarlarKesh = [];
      yuklaOmborKirim();
    } catch (e) { xatoKorsatish(e.message); }
  });

  // 04 CHIQIM QILISH
  document.getElementById("chiqim-saqlash").addEventListener("click", async () => {
    const kod = document.getElementById("kirim-kod").value.trim();
    const soni = Number(document.getElementById("kirim-soni").value);
    const izoh = document.getElementById("kirim-izoh").value.trim();

    if (!kod) return xatoKorsatish("Model kodini tanlang yoki yozing");
    if (!soni || soni <= 0) return xatoKorsatish("Soni 0 dan katta bo'lishi kerak");

    try {
      const tovar = _tovarlarKesh.find((t) => t.model_kodi.toUpperCase() === kod.toUpperCase());
      if (!tovar) return xatoKorsatish("Bunday model kodi topilmadi");
      if (tovar.soni < soni) return xatoKorsatish(`Omborda buncha tovar yo'q. Mavjud: ${tovar.soni} ta`);

      const { error: e1 } = await supabaseClient.from("tovarlar").update({ soni: tovar.soni - soni }).eq("id", tovar.id);
      if (e1) throw e1;

      const { error: e2 } = await supabaseClient.from("kirimlar").insert({
        tovar_id: tovar.id,
        soni: -Math.abs(soni),
        izoh: izoh ? `CHIQIM: ${izoh}` : "CHIQIM",
      });
      if (e2) throw e2;

      muvaffaqiyatKorsatish("Chiqim muvaffaqiyatli amalga oshirildi");
      document.getElementById("kirim-kod").value = "";
      document.getElementById("kirim-soni").value = "";
      document.getElementById("kirim-izoh").value = "";
      _tovarlarKesh = [];
      yuklaOmborKirim();
    } catch (e) { xatoKorsatish(e.message); }
  });

  // 05 TAHRIRLASH
  document.getElementById("tahrir-tur").addEventListener("change", tahrirIshla);
  document.getElementById("tahrir-model").addEventListener("change", tahrirIshla);
  document.getElementById("tahrir-qidiruv").addEventListener("input", tahrirIshla);

  document.getElementById("tahrir-tbody").addEventListener("click", async (e) => {
    const tahrirId = e.target.dataset.tahrir;
    const ochirId = e.target.dataset.ochirish;

    if (tahrirId) {
      const t = _tovarlarKesh.find((x) => String(x.id) === tahrirId);
      if (!t) return;
      document.getElementById("tm-kod").value = t.model_kodi;
      document.getElementById("tm-model").value = t.model;
      document.getElementById("tm-marka").value = t.marka || "";
      document.getElementById("tm-narx").value = t.narx;
      document.getElementById("tm-soni").value = t.soni;
      document.getElementById("tahrir-modal-overlay").classList.remove("yashirin");
      document.getElementById("tahrir-modal-overlay").dataset.id = tahrirId;
    }

    if (ochirId) {
      const ok = await tasdiqlash("Bu tovarni o'chirishni tasdiqlaysizmi?");
      if (!ok) return;
      try {
        await tovarOchirish(Number(ochirId));
        muvaffaqiyatKorsatish("Tovar arxivlandi");
        _tovarlarKesh = [];
        yuklaTahrirlash();
      } catch (err) { xatoKorsatish(err.message); }
    }
  });

  document.getElementById("tm-bekor").addEventListener("click", () => document.getElementById("tahrir-modal-overlay").classList.add("yashirin"));
  document.getElementById("tm-saqlash").addEventListener("click", async () => {
    const id = Number(document.getElementById("tahrir-modal-overlay").dataset.id);
    const model_kodi = document.getElementById("tm-kod").value.trim();
    const model = document.getElementById("tm-model").value.trim();
    const marka = document.getElementById("tm-marka").value.trim();
    const narx = Number(document.getElementById("tm-narx").value);
    const soni = Number(document.getElementById("tm-soni").value);

    if (!validatsiyaTekshir([
      { nomi: "Model kodi", qiymat: model_kodi, majburiy: true },
      { nomi: "Model", qiymat: model, majburiy: true },
    ])) return;
    if (narx < 0 || soni < 0) return xatoKorsatish("Narx va soni manfiy bo'lmasin");

    try {
      await tovarTahrirlash(id, { model_kodi, model, marka, narx, soni });
      muvaffaqiyatKorsatish("Tovar yangilandi");
      document.getElementById("tahrir-modal-overlay").classList.add("yashirin");
      _tovarlarKesh = [];
      yuklaTahrirlash();
    } catch (e) { xatoKorsatish(e.message); }
  });

  // 06 TOVAR SOTUVI
  document.getElementById("sotuv-kod").addEventListener("input", (e) => {
    const kod = e.target.value.trim();
    const t = _tovarlarKesh.find((x) => x.model_kodi === kod);
    if (t) {
      _sotuvTovar = t;
      document.getElementById("sotuv-mavjud").value = `${t.soni} ta`;
      if (!document.getElementById("sotuv-narx").value) document.getElementById("sotuv-narx").value = t.narx;
    } else {
      _sotuvTovar = null;
      document.getElementById("sotuv-mavjud").value = "—";
    }
  });

  document.querySelectorAll('input[name="sotuv-tolov"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      document.getElementById("sotuv-mijoz-guruh").classList.toggle("yashirin", e.target.value !== "nasiya");
    });
  });

  document.getElementById("sotuv-saqlash").addEventListener("click", async () => {
    if (!_sotuvTovar) return xatoKorsatish("Model kodini tanlang");
    const soni = Number(document.getElementById("sotuv-soni").value);
    const sotuv_narxi = Number(document.getElementById("sotuv-narx").value);
    const tolov_turi = document.querySelector('input[name="sotuv-tolov"]:checked').value;
    const mijoz_id = document.getElementById("sotuv-mijoz").value;

    if (soni <= 0) return xatoKorsatish("Soni 0 dan katta bo'lishi kerak");
    if (sotuv_narxi <= 0) return xatoKorsatish("Sotuv narxi 0 dan katta bo'lishi kerak");
    if (soni > _sotuvTovar.soni) return xatoKorsatish("Omborda yetarli tovar yo'q");
    if (tolov_turi === "nasiya" && !mijoz_id) return xatoKorsatish("Nasiya uchun mijoz tanlanishi shart");

    try {
      await sotuvQoshish({
        tovar_id: _sotuvTovar.id, soni, sotuv_narxi, tolov_turi,
        mijoz_id: tolov_turi === "nasiya" ? Number(mijoz_id) : null,
      });
      muvaffaqiyatKorsatish("Sotuv muvaffaqiyatli yakunlandi");
      ["sotuv-kod", "sotuv-soni", "sotuv-narx"].forEach(id => document.getElementById(id).value = "");
      document.getElementById("sotuv-mavjud").value = "—";
      _sotuvTovar = null;
      _tovarlarKesh = [];
      yuklaSotuvTarixi(); // Tarixni yangilash
    } catch (e) { xatoKorsatish(e.message); }
  });

  // 06.1 XIZMAT SOTUVI
  document.querySelectorAll('input[name="xizmat-tolov"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      document.getElementById("xizmat-mijoz-guruh").classList.toggle("yashirin", e.target.value !== "nasiya");
    });
  });

  document.getElementById("xizmat-saqlash").addEventListener("click", async () => {
    const xizmat_nomi = document.getElementById("xizmat-nomi").value.trim();
    const narxi = Number(document.getElementById("xizmat-narx").value);
    const izoh = document.getElementById("xizmat-izoh").value.trim();
    const tolov_turi = document.querySelector('input[name="xizmat-tolov"]:checked').value;
    const mijoz_id = document.getElementById("xizmat-mijoz").value;

    if (!validatsiyaTekshir([
      { nomi: "Xizmat nomi", qiymat: xizmat_nomi, majburiy: true },
      { nomi: "Narxi", qiymat: narxi, majburiy: true },
    ])) return;
    if (narxi <= 0) return xatoKorsatish("Narx 0 dan katta bo'lishi kerak");
    if (tolov_turi === "nasiya" && !mijoz_id) return xatoKorsatish("Nasiya uchun mijoz tanlanishi shart");

    try {
      await xizmatSotuvQoshish({
        xizmat_nomi, narxi, izoh: izoh || null, tolov_turi,
        mijoz_id: tolov_turi === "nasiya" ? Number(mijoz_id) : null,
      });
      muvaffaqiyatKorsatish("Xizmat sotuvi saqlandi");
      ["xizmat-nomi", "xizmat-narx", "xizmat-izoh"].forEach(id => document.getElementById(id).value = "");
      yuklaXizmatSotuvi();
    } catch (e) { xatoKorsatish(e.message); }
  });

  // 07 XARAJAT
  document.getElementById("xarajat-saqlash").addEventListener("click", async () => {
    const nomi = document.getElementById("xarajat-nomi").value.trim();
    const miqdori = Number(document.getElementById("xarajat-miqdor").value);
    const tolov_turi = document.querySelector('input[name="xarajat-tolov"]:checked').value;
    const izoh = document.getElementById("xarajat-izoh").value.trim();

    if (!validatsiyaTekshir([
      { nomi: "Xarajat nomi", qiymat: nomi, majburiy: true },
      { nomi: "Miqdori", qiymat: miqdori, majburiy: true },
    ])) return;
    if (miqdori <= 0) return xatoKorsatish("Miqdor 0 dan katta bo'lishi kerak");

    try {
      await xarajatQoshish({ nomi, miqdori, tolov_turi, izoh: izoh || null });
      muvaffaqiyatKorsatish("Xarajat qo'shildi");
      ["xarajat-nomi", "xarajat-miqdor", "xarajat-izoh"].forEach(id => document.getElementById(id).value = "");
      yuklaXarajat();
    } catch (e) { xatoKorsatish(e.message); }
  });

  // 08 MOSLIK
  document.getElementById("mos-qoshish").addEventListener("click", async () => {
    const asosiyKod = document.getElementById("mos-asosiy-kod").value.trim();
    const yangiModel = document.getElementById("mos-tovar-model").value.trim();
    const yangiMarka = document.getElementById("mos-tovar-marka").value.trim();

    if (!asosiyKod) return xatoKorsatish("Asosiy model kodini tanlang yoki yozing");
    if (!yangiModel || !yangiMarka) return xatoKorsatish("Mos modelning nomi va markasini to'liq kiriting");

    try {
      const asosiyTovar = _tovarlarKesh.find(t => t.model_kodi.toUpperCase() === asosiyKod.toUpperCase());
      if (!asosiyTovar) return xatoKorsatish("Asosiy model bazadan topilmadi. Kodni to'g'ri yozing.");

      let mosTovar = _tovarlarKesh.find(t => t.model.toLowerCase() === yangiModel.toLowerCase() && (t.marka || "").toLowerCase() === yangiMarka.toLowerCase());
      let mosTovarId;

      if (mosTovar) {
        mosTovarId = mosTovar.id;
      } else {
        const avtoKod = "MOS-" + Date.now().toString().slice(-6);
        const { data: yangiTovar, error: qoshishXato } = await supabaseClient.from("tovarlar").insert({
          tur_id: asosiyTovar.tur_id, model_kodi: avtoKod, model: yangiModel, marka: yangiMarka, narx: 0, soni: 0, arxivlangan: true
        }).select().single();
        if (qoshishXato) throw qoshishXato;
        mosTovarId = yangiTovar.id;
      }

      const { data: mavjud } = await supabaseClient.from("mosliklar").select("id").eq("asosiy_tovar_id", asosiyTovar.id).eq("mos_tovar_id", mosTovarId).maybeSingle();
      if (mavjud) return xatoKorsatish("Bu moslik allaqachon jadvalda bor!");

      await moslikQoshish(asosiyTovar.id, mosTovarId);
      muvaffaqiyatKorsatish("Moslik muvaffaqiyatli saqlandi");
      document.getElementById("mos-tovar-model").value = "";
      document.getElementById("mos-tovar-marka").value = "";
      yuklaMoslik(); 
    } catch (e) { xatoKorsatish(e.message); }
  });

  document.getElementById("mos-saqlash").addEventListener("click", async () => {
    await document.getElementById("mos-qoshish").click();
    document.getElementById("mos-asosiy-kod").value = "";
    document.getElementById("mos-asosiy-info").value = "— Model tanlanmagan —";
  });

  document.getElementById("mos-tozalash").addEventListener("click", () => {
    document.getElementById("mos-asosiy-kod").value = "";
    document.getElementById("mos-asosiy-info").value = "— Model tanlanmagan —";
    document.getElementById("mos-tovar-model").value = "";
    document.getElementById("mos-tovar-marka").value = "";
  });

  document.getElementById("mos-tbody").addEventListener("click", async (e) => {
    const mosOchirId = e.target.dataset.mosOchirish;
    const asosiyOchirId = e.target.dataset.asosiyOchirish;

    if (mosOchirId) {
      const ok = await tasdiqlash("Bu moslikni o'chirishni tasdiqlaysizmi?");
      if (!ok) return;
      const { error } = await supabaseClient.from("mosliklar").delete().eq("id", mosOchirId);
      if (error) return xatoKorsatish(error.message);
      muvaffaqiyatKorsatish("Moslik o'chirildi");
      yuklaMoslik();
    }

    if (asosiyOchirId) {
      const ok = await tasdiqlash("Ushbu asosiy modelga tegishli BARCHA mosliklar o'chiriladi. Tasdiqlaysizmi?");
      if (!ok) return;
      const { error } = await supabaseClient.from("mosliklar").delete().eq("asosiy_tovar_id", asosiyOchirId);
      if (error) return xatoKorsatish(error.message);
      muvaffaqiyatKorsatish("Guruh o'chirildi");
      yuklaMoslik();
    }
  });

  // 09 MIJOZLAR
  document.getElementById("mijoz-qidiruv").addEventListener("input", yuklaMijozlar);

  document.getElementById("mijoz-yangi").addEventListener("click", () => {
    document.getElementById("mm-ism").value = "";
    document.getElementById("mm-telefon").value = "";
    document.getElementById("mijoz-modal-overlay").classList.remove("yashirin");
  });

  document.getElementById("mm-bekor").addEventListener("click", () => document.getElementById("mijoz-modal-overlay").classList.add("yashirin"));

  document.getElementById("mm-saqlash").addEventListener("click", async () => {
    const ism = document.getElementById("mm-ism").value.trim();
    const telefon = document.getElementById("mm-telefon").value.trim();
    if (!validatsiyaTekshir([
      { nomi: "Ism", qiymat: ism, majburiy: true },
      { nomi: "Telefon", qiymat: telefon, majburiy: true },
    ])) return;
    try {
      await mijozQoshish({ ism, telefon });
      muvaffaqiyatKorsatish("Mijoz qo'shildi");
      document.getElementById("mijoz-modal-overlay").classList.add("yashirin");
      yuklaMijozlar();
    } catch (e) { xatoKorsatish(e.message); }
  });

  document.getElementById("mijoz-tbody").addEventListener("click", async (e) => {
    const id = e.target.dataset.mijozBatafsil;
    if (!id) return;
    try {
      const nasiyalar = await nasiyalarniOlish(Number(id));
      const royxat = document.getElementById("batafsil-royxat");
      if (!nasiyalar.length) {
        royxat.innerHTML = '<div class="nasiya-qator"><div class="nasiya-info">Aktiv qarz yo\'q</div></div>';
      } else {
        royxat.innerHTML = nasiyalar.map((n) => {
          const qoldiq = n.summa - (n.tolov_summasi || 0);
          return `<div class="nasiya-qator">
            <div class="nasiya-info">
              Summa: <strong>${formatSum(n.summa)}</strong> ·
              To'langan: ${formatSum(n.tolov_summasi || 0)} ·
              Qoldiq: <strong style="color:#dc2626">${formatSum(qoldiq)}</strong>
            </div>
            <div class="nasiya-tolash">
              <input type="number" min="1" placeholder="To'lov summasi" id="tolov-${n.id}">
              <button class="btn btn-asosiy" data-tolash="${n.id}">To'lash</button>
            </div>
          </div>`;
        }).join("");
      }
      document.getElementById("batafsil-modal-overlay").classList.remove("yashirin");
    } catch (err) { xatoKorsatish(err.message); }
  });

  document.getElementById("batafsil-yopish").addEventListener("click", () => document.getElementById("batafsil-modal-overlay").classList.add("yashirin"));

  document.getElementById("batafsil-royxat").addEventListener("click", async (e) => {
    const nasiyaId = e.target.dataset.tolash;
    if (!nasiyaId) return;
    const input = document.getElementById(`tolov-${nasiyaId}`);
    const summa = Number(input.value);
    if (!summa || summa <= 0) return xatoKorsatish("To'lov summasini kiriting");
    try {
      await nasiyaTolash(Number(nasiyaId), summa);
      muvaffaqiyatKorsatish("To'lov qabul qilindi");
      document.getElementById("batafsil-modal-overlay").classList.add("yashirin");
      yuklaMijozlar();
    } catch (err) { xatoKorsatish(err.message); }
  });

  // Boshlang'ich sahifa
  navigatsiyaYukla("sahifa-01");
});