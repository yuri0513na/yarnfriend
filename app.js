/* Knit Mini - Projects (rows) + Yarn Inventory (grams + purpose from projects + photo) */

const STORAGE_KEY = "knit-mini:v4";

function uid() {
  return Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}
function toInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}
function clampNonNegative(n) {
  return Math.max(0, n);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        view: "projects", // 'projects' | 'detail' | 'yarn'
        selectedProjectId: null,
        projects: [],
        yarns: [],
      };
    }
    const parsed = JSON.parse(raw);
    return {
      view: parsed.view ?? "projects",
      selectedProjectId: parsed.selectedProjectId ?? null,
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      yarns: Array.isArray(parsed.yarns) ? parsed.yarns : [],
    };
  } catch {
    return { view: "projects", selectedProjectId: null, projects: [], yarns: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* ---- DOM ---- */
const tabProjects = document.getElementById("tab-projects");
const tabYarn = document.getElementById("tab-yarn");

const viewProjects = document.getElementById("view-projects");
const viewDetail = document.getElementById("view-detail");
const viewYarn = document.getElementById("view-yarn");

/* Projects */
const projectForm = document.getElementById("new-project-form");
const projectNameInput = document.getElementById("project-name-input");
const projectListEl = document.getElementById("project-list");
const projectEmptyEl = document.getElementById("project-empty");

/* Detail */
const backBtn = document.getElementById("back-btn");
const detailTitle = document.getElementById("detail-title");
const rowCountEl = document.getElementById("row-count");
const minusBtn = document.getElementById("minus-btn");
const plusBtn = document.getElementById("plus-btn");
const minus10Btn = document.getElementById("minus10-btn");
const plus10Btn = document.getElementById("plus10-btn");
const resetBtn = document.getElementById("reset-btn");
const deleteBtn = document.getElementById("delete-btn");

/* Yarn */
const yarnForm = document.getElementById("new-yarn-form");
const yarnName = document.getElementById("yarn-name");
const yarnColor = document.getElementById("yarn-color");
const yarnLot = document.getElementById("yarn-lot");
const yarnGrams = document.getElementById("yarn-grams");
const yarnFiber = document.getElementById("yarn-fiber");
const yarnPurposeSelect = document.getElementById("yarn-purpose-select");
const yarnPurposeCustom = document.getElementById("yarn-purpose-custom");
const yarnNotes = document.getElementById("yarn-notes");
const yarnPhotoInput = document.getElementById("yarn-photo");

const yarnListEl = document.getElementById("yarn-list");
const yarnEmptyEl = document.getElementById("yarn-empty");

/* ---- Helpers ---- */
function setView(view) {
  state.view = view;
  saveState();
  render();
}

function setSelectedProject(id) {
  state.selectedProjectId = id;
  saveState();
}

function getProjectById(id) {
  return state.projects.find(p => p.id === id) ?? null;
}

function fileToCompressedDataURL(file, { maxSize = 720, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("file read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image load failed"));
      img.onload = () => {
        const { width, height } = img;
        let targetW = width;
        let targetH = height;
        const longest = Math.max(width, height);
        if (longest > maxSize) {
          const scale = maxSize / longest;
          targetW = Math.round(width * scale);
          targetH = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---- UI builders ---- */
function renderTabs() {
  const onProjects = state.view === "projects" || state.view === "detail";
  tabProjects.classList.toggle("active", onProjects);
  tabYarn.classList.toggle("active", state.view === "yarn");
}

function renderViews() {
  viewProjects.hidden = !(state.view === "projects");
  viewDetail.hidden = !(state.view === "detail");
  viewYarn.hidden = !(state.view === "yarn");
}

/* ★ 追加：用途セレクトを作品一覧から生成 */
function renderPurposeSelect() {
  // 今ある選択を一旦全部消して、先頭の「任意」だけ残す
  const first = yarnPurposeSelect.querySelector("option[value='']");
  yarnPurposeSelect.innerHTML = "";
  yarnPurposeSelect.appendChild(first || new Option("用途：選択（任意）", ""));

  // projects を新しい順で並べる（見つけやすい）
  const projects = [...state.projects].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  for (const p of projects) {
    const opt = document.createElement("option");
    opt.value = p.id;          // ★ idで持つ（名称変更してもOK）
    opt.textContent = p.name;  // 表示は名前
    yarnPurposeSelect.appendChild(opt);
  }
}

function renderProjects() {
  projectListEl.innerHTML = "";

  if (state.projects.length === 0) {
    projectEmptyEl.hidden = false;
    return;
  }
  projectEmptyEl.hidden = true;

  const projects = [...state.projects].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  for (const p of projects) {
    const li = document.createElement("li");
    li.className = "item";

    const left = document.createElement("div");
    left.className = "item-main";

    const title = document.createElement("p");
    title.className = "item-title";
    title.textContent = p.name;

    const sub = document.createElement("p");
    sub.className = "item-sub";
    sub.textContent = "タップして開く";

    left.appendChild(title);
    left.appendChild(sub);

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `${p.rows ?? 0} 段`;

    li.appendChild(left);
    li.appendChild(badge);

    li.addEventListener("click", () => {
      setSelectedProject(p.id);
      state.view = "detail";
      saveState();
      render();
    });

    projectListEl.appendChild(li);
  }
}

function renderDetail() {
  const p = state.selectedProjectId ? getProjectById(state.selectedProjectId) : null;
  if (!p) {
    setView("projects");
    return;
  }
  detailTitle.textContent = p.name;
  rowCountEl.textContent = String(p.rows ?? 0);
}

function renderYarn() {
  yarnListEl.innerHTML = "";

  if (state.yarns.length === 0) {
    yarnEmptyEl.hidden = false;
    return;
  }
  yarnEmptyEl.hidden = true;

  const yarns = [...state.yarns].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  for (const y of yarns) {
    const li = document.createElement("li");
    li.className = "item";

    const row = document.createElement("div");
    row.className = "item-row";

    // ★ 写真を一覧に表示（左）
    if (y.photoDataUrl) {
      const img = document.createElement("img");
      img.className = "thumb";
      img.src = y.photoDataUrl;
      img.alt = `${y.name} photo`;
      row.appendChild(img);

      // タップで拡大表示
      img.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const w = window.open();
        if (w) w.document.write(`<img src="${y.photoDataUrl}" style="max-width:100%;height:auto;" />`);
      });
    }

    const left = document.createElement("div");
    left.className = "item-main";

    const title = document.createElement("p");
    title.className = "item-title";
    title.textContent = y.name;

    const sub = document.createElement("p");
    sub.className = "item-sub";

    // ★ 用途は「projectName」を優先表示（project削除されても残せる）
    const parts = [];
    if (y.color) parts.push(`色: ${y.color}`);
    if (y.lot) parts.push(`lot: ${y.lot}`);
    if (y.fiber) parts.push(y.fiber);
    if (y.purposeProjectName) parts.push(`用途: ${y.purposeProjectName}`);
    if (y.purposeCustom) parts.push(`用途: ${y.purposeCustom}`);
    if (y.notes) parts.push(y.notes);
    sub.textContent = parts.join(" / ") || "—";

    left.appendChild(title);
    left.appendChild(sub);

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `${y.grams ?? 0} g`;

    row.appendChild(left);
    row.appendChild(badge);
    li.appendChild(row);

    // クリックで在庫操作
    li.addEventListener("click", () => {
      const current = y.grams ?? 0;
      const action = prompt(
        `在庫操作（g）\n` +
        `現在: ${current}g\n\n` +
        `入力例:\n` +
        `+10  (10g増やす)\n` +
        `-25  (25g減らす)\n` +
        `=0   (0gにリセット)\n` +
        `photo (写真を削除)\n` +
        `del  (毛糸を削除)\n`,
        "+10"
      );
      if (action === null) return;

      const trimmed = action.trim().toLowerCase();

      if (trimmed === "del") {
        const ok = confirm(`「${y.name}」を削除しますか？`);
        if (!ok) return;
        state.yarns = state.yarns.filter(x => x.id !== y.id);
        saveState();
        renderYarn();
        return;
      }

      if (trimmed === "photo") {
        const ok = confirm("写真を削除しますか？");
        if (!ok) return;
        y.photoDataUrl = "";
        y.updatedAt = Date.now();
        saveState();
        renderYarn();
        return;
      }

      if (trimmed.startsWith("=")) {
        const n = toInt(trimmed.slice(1).trim(), 0);
        y.grams = clampNonNegative(n);
        y.updatedAt = Date.now();
        saveState();
        renderYarn();
        return;
      }

      const sign = trimmed[0];
      if (sign !== "+" && sign !== "-") {
        alert("入力形式が違うかも。例: +10 / -25 / =0 / photo / del");
        return;
      }
      const delta = toInt(trimmed.slice(1).trim(), NaN);
      if (!Number.isFinite(delta)) {
        alert("数字が読めなかったよ。例: +10 / -25");
        return;
      }
      const realDelta = sign === "+" ? delta : -delta;
      y.grams = clampNonNegative(current + realDelta);
      y.updatedAt = Date.now();
      saveState();
      renderYarn();
    });

    yarnListEl.appendChild(li);
  }
}

function render() {
  renderTabs();
  renderViews();

  if (state.view === "projects") renderProjects();
  if (state.view === "detail") renderDetail();
  if (state.view === "yarn") {
    renderPurposeSelect(); // ★ yarn viewに入るたび最新の作品を反映
    renderYarn();
  }
}

/* ---- Project actions ---- */
projectForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = projectNameInput.value.trim();
  if (!name) return;

  const now = Date.now();
  state.projects.push({ id: uid(), name, rows: 0, updatedAt: now });
  projectNameInput.value = "";
  saveState();

  renderProjects();
});

backBtn.addEventListener("click", () => setView("projects"));

function updateRows(delta) {
  const p = state.selectedProjectId ? getProjectById(state.selectedProjectId) : null;
  if (!p) return;
  p.rows = clampNonNegative((p.rows ?? 0) + delta);
  p.updatedAt = Date.now();
  saveState();
  rowCountEl.textContent = String(p.rows);
}

minusBtn.addEventListener("click", () => updateRows(-1));
plusBtn.addEventListener("click", () => updateRows(+1));
minus10Btn.addEventListener("click", () => updateRows(-10));
plus10Btn.addEventListener("click", () => updateRows(+10));

resetBtn.addEventListener("click", () => {
  const p = state.selectedProjectId ? getProjectById(state.selectedProjectId) : null;
  if (!p) return;
  p.rows = 0;
  p.updatedAt = Date.now();
  saveState();
  rowCountEl.textContent = "0";
});

deleteBtn.addEventListener("click", () => {
  const p = state.selectedProjectId ? getProjectById(state.selectedProjectId) : null;
  if (!p) return;

  const ok = confirm(`「${p.name}」を削除しますか？`);
  if (!ok) return;

  state.projects = state.projects.filter(x => x.id !== p.id);
  state.selectedProjectId = null;
  saveState();
  setView("projects");
});

/* ---- Yarn actions ---- */
yarnForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = yarnName.value.trim();
  if (!name) return;

  const grams = clampNonNegative(toInt(yarnGrams.value, 0));
  const now = Date.now();

  // ★ 用途：作品選択 or 自由入力（両方あったら両方保存）
  const selectedProjectId = yarnPurposeSelect.value || "";
  const selectedProject = selectedProjectId ? getProjectById(selectedProjectId) : null;
  const purposeProjectName = selectedProject ? selectedProject.name : "";
  const purposeCustom = yarnPurposeCustom.value.trim();

  // 写真
  let photoDataUrl = "";
  const file = yarnPhotoInput.files && yarnPhotoInput.files[0] ? yarnPhotoInput.files[0] : null;
  try {
    if (file) photoDataUrl = await fileToCompressedDataURL(file, { maxSize: 720, quality: 0.75 });
  } catch {
    alert("写真の読み込みに失敗しました。別の写真で試してみてね。");
  }

  state.yarns.push({
    id: uid(),
    name,
    color: yarnColor.value.trim(),
    lot: yarnLot.value.trim(),
    fiber: yarnFiber.value.trim(),
    grams,
    // ★ 用途保存（プロジェクトは id と name 両方）
    purposeProjectId: selectedProjectId,
    purposeProjectName,
    purposeCustom,
    notes: yarnNotes.value.trim(),
    photoDataUrl,
    updatedAt: now,
  });

  // reset
  yarnName.value = "";
  yarnColor.value = "";
  yarnLot.value = "";
  yarnFiber.value = "";
  yarnGrams.value = "";
  yarnPurposeSelect.value = "";
  yarnPurposeCustom.value = "";
  yarnNotes.value = "";
  yarnPhotoInput.value = "";

  saveState();
  renderYarn();
});

/* ---- Tabs ---- */
tabProjects.addEventListener("click", () => setView("projects"));
tabYarn.addEventListener("click", () => setView("yarn"));

/* ---- PWA Service Worker ---- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* ---- Startup ---- */
render();
