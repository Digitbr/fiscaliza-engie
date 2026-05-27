const app = document.querySelector("#app");

const STORAGE_KEY = "fiscalizapro.engie.v1";
const SESSION_KEY = "fiscalizapro.engie.session";
const DB_NAME = "fiscalizapro-engie-db";
const DB_STORE = "app-data";
const DB_VERSION = 1;

const CLIENTE = "ESOM – Engie Soluções de Operação e Manutenção";
const CONTRATO = "AC380ESOM";
const CONTRATADA = "V F S SISTEMA ELETRÔNICO DE ALARME LTDA";
const RESPONSAVEL_TRANSCRICAO = "RICARDO OLIVEIRA - GERENTE DE OPERAÇÕES - GRUPO PRIME";
const RESPONSAVEL_ESOM = "";
const PERMANENCIA_MINUTOS = 30;
const TEMPLATE_PATHS = {
  itapemirim: "./templates/tag-itapemirim-template.xlsx",
  tims: "./templates/tag-tims-template.xlsx",
  viana: "./templates/tag-viana-template.xlsx"
};

const TAGS = [
  { id: "tims", label: "TAG Tims", rounds: 2, photos: 4 },
  { id: "itapemirim", label: "TAG Itapemirim", rounds: 1, photos: 4 },
  { id: "viana", label: "TAG Viana", rounds: 1, photos: 4 }
];

const TEAMS = [
  "Adielton e João Victor",
  "Marcos e Rogério"
];

const SHIFTS = [
  { id: "diurna", label: "Diurna", period: "06:00 às 18:00" },
  { id: "noturna", label: "Noturna", period: "18:00 às 06:00" }
];

const SUPERVISORS = [
  { name: "MARCOS ANTONIO TELAROLLI", shift: "Diurna", team: "Marcos e Rogério" },
  { name: "ROGÉRIO PIMENTA DOS SANTOS", shift: "Diurna", team: "Marcos e Rogério" },
  { name: "JOÃO VITOR LIMA OLIVEIRA", shift: "Noturna", team: "Adielton e João Victor" },
  { name: "ADIELTON DE AZEVEDO DUARTE", shift: "Noturna", team: "Adielton e João Victor" }
];

const USERS = {
  admin: { password: "admin123", role: "admin", name: "Administrador", label: "Admin" },
  engie: { password: "engie123", role: "supervisor", name: "Supervisor ENGIE", label: "Supervisor" }
};

const defaultData = {
  records: [],
  notices: [
    {
      id: crypto.randomUUID(),
      title: "Atenção ao envio das fotos",
      body: "As fotos devem ser registradas na ordem da ronda para evitar rejeição da planilha.",
      createdAt: new Date().toISOString()
    }
  ],
  scales: SUPERVISORS
};

const state = {
  session: loadSession(),
  data: await loadData(),
  view: "dashboard",
  routeForm: createEmptyRoute(),
  editingNoticeId: null,
  filters: {
    date: "",
    tag: "all"
  }
};

render();

async function loadData() {
  try {
    const savedInDatabase = await readDatabaseValue(STORAGE_KEY);
    if (savedInDatabase) {
      return normalizeStoredData({ ...defaultData, ...savedInDatabase });
    }

    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed) {
      const migrated = normalizeStoredData({ ...defaultData, ...parsed });
      await writeDatabaseValue(STORAGE_KEY, migrated);
      return migrated;
    }

    const initialData = structuredClone(defaultData);
    await writeDatabaseValue(STORAGE_KEY, initialData);
    return initialData;
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  } catch (error) {
    console.warn("Não foi possível salvar o espelho local dos dados.", error);
  }

  writeDatabaseValue(STORAGE_KEY, state.data).catch((error) => {
    console.warn("Não foi possível salvar no banco interno.", error);
  });
}

function openInternalDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB indisponível neste navegador."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DB_STORE)) {
        database.createObjectStore(DB_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readDatabaseValue(key) {
  const database = await openInternalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE, "readonly");
    const store = transaction.objectStore(DB_STORE);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

async function writeDatabaseValue(key, value) {
  const database = await openInternalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE, "readwrite");
    const store = transaction.objectStore(DB_STORE);
    const request = store.put({ key, value, updatedAt: new Date().toISOString() });
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

function normalizeStoredData(data) {
  const normalized = JSON.parse(JSON.stringify(data), (_key, value) => {
    if (typeof value !== "string") return value;
    return value
      .replaceAll("\u00c3\u00a7", "ç")
      .replaceAll("\u00c3\u00a3", "ã")
      .replaceAll("\u00c3\u00b5", "õ")
      .replaceAll("\u00c3\u00aa", "ê")
      .replaceAll("\u00c3\u00a9", "é")
      .replaceAll("\u00c3\u00a1", "á")
      .replaceAll("\u00c3\u00a0", "à")
      .replaceAll("\u00c3\u00b3", "ó")
      .replaceAll("\u00c3\u00ba", "ú")
      .replaceAll("\u00c3\u00ad", "í")
      .replaceAll("\u00c3\u00b4", "ô")
      .replaceAll("\u00c3\u2021", "Ç")
      .replaceAll("\u00c3\u2022", "Õ")
      .replaceAll("\u00c3\u201d", "Ô")
      .replaceAll("\u00c2\u00aa", "ª")
      .replaceAll("\u00c2\u00ba", "º")
      .replaceAll("\u00e2\u20ac\u201c", "–")
      .replaceAll("Joao", "João")
      .replaceAll("JOAO", "JOÃO")
      .replaceAll("Rogerio", "Rogério")
      .replaceAll("ROGERIO", "ROGÉRIO")
      .replaceAll("rapido", "rápido")
      .replaceAll("horarios", "horários")
      .replaceAll("padrao", "padrão")
      .replaceAll("descricao", "descrição")
      .replaceAll("situacao", "situação")
      .replaceAll("paralisacoes", "paralisações")
      .replaceAll("transcricao", "transcrição")
      .replaceAll("fiscalizacao", "fiscalização")
      .replaceAll("concluido", "concluído");
  });
  normalized.scales = normalized.scales?.length ? normalized.scales : SUPERVISORS;
  normalized.notices = (normalized.notices?.length ? normalized.notices : defaultData.notices)
    .map((notice) => ({ attachment: null, ...notice }));
  normalized.records = (normalized.records || []).map((record) => ({
    shift: "noturna",
    kmStart: "",
    kmEnd: "",
    kmTotal: "",
    ...record
  }));
  return normalized;
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function saveSession(session) {
  state.session = session;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function createEmptyRoute() {
  return {
    id: crypto.randomUUID(),
    date: today(),
    tag: "",
    shift: "noturna",
    occurrenceRound1: "",
    occurrenceRound2: "",
    stoppages: "",
    arrivalRound1: "",
    arrivalRound2: "",
    kmStart: "",
    kmEnd: "",
    team: TEAMS[0],
    photos: Array.from({ length: 4 }, () => null),
    createdAt: new Date().toISOString(),
    status: "rascunho"
  };
}

function render() {
  if (!state.session) {
    renderLogin();
    return;
  }

  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="logo-stack">
            <span class="engie-logo">ENGIE</span>
            <span class="argos-logo">ARGOSVIG</span>
          </div>
          <div>
            <strong>Fiscaliza Pro</strong>
            <small>Rondas ENGIE</small>
          </div>
        </div>
        <nav class="nav">
          ${navButton("dashboard", "Início", "⌂")}
          ${state.session.role === "supervisor" ? navButton("chatbot", "Nova ronda", "+") : ""}
          ${navButton("records", "Registros", "▤")}
          ${navButton("scales", "Escalas", "◷")}
          ${navButton("notices", "Avisos", "!")}
        </nav>
        <div class="user-card">
          <span>${escapeHtml(state.session.label)}</span>
          <strong>${escapeHtml(state.session.name)}</strong>
          <button class="btn ghost full" data-action="logout">Sair</button>
        </div>
      </aside>
      <main class="main">
        ${renderTopbar()}
        ${renderView()}
      </main>
    </div>
  `;

  bindGlobalEvents();
  bindViewEvents();
}

function renderLogin(error = "") {
  app.innerHTML = `
    <main class="login">
      <section class="login-art">
        <div class="logo-line">
          <span class="engie-logo light">ENGIE</span>
          <span class="argos-logo light">ARGOSVIG</span>
        </div>
        <div>
          <p class="eyebrow">Fiscaliza Pro para rondas ENGIE</p>
          <h1>Registro guiado, rápido e pronto para gerar planilhas de ronda.</h1>
          <p>Um chatbot operacional transforma as respostas do supervisor em checklist, valida horários, exige fotos e monta o registro no padrão da planilha.</p>
        </div>
      </section>
      <section class="login-panel">
        <h2>Acessar sistema</h2>
        <p class="muted">Admin: <b>admin</b> / <b>admin123</b><br>Supervisor: <b>Engie</b> / <b>engie123</b></p>
        ${error ? `<div class="alert danger">${escapeHtml(error)}</div>` : ""}
        <form id="login-form" class="form">
          <label>Login
            <input name="login" autocomplete="username" placeholder="admin ou Engie" required>
          </label>
          <label>Senha
            <input name="password" type="password" autocomplete="current-password" placeholder="Digite a senha" required>
          </label>
          <button class="btn primary full" type="submit">Entrar</button>
        </form>
      </section>
    </main>
  `;

  document.querySelector("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const login = String(form.get("login") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const user = USERS[login];

    if (!user || user.password !== password) {
      renderLogin("Login ou senha incorretos.");
      return;
    }

    saveSession({ login, role: user.role, name: user.name, label: user.label });
    state.view = "dashboard";
    render();
  });
}

function renderTopbar() {
  const title = {
    dashboard: "Início",
    chatbot: "Nova ronda",
    records: "Registros",
    scales: "Escalas",
    notices: "Avisos"
  }[state.view];

  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">Operação ESOM</p>
        <h1>${title}</h1>
      </div>
      ${state.session.role === "supervisor" ? `<button class="btn primary" data-view="chatbot">Iniciar ronda</button>` : `<button class="btn primary" data-action="new-notice">Novo aviso</button>`}
    </header>
  `;
}

function renderView() {
  if (state.view === "chatbot") return renderChatbot();
  if (state.view === "records") return renderRecords();
  if (state.view === "scales") return renderScales();
  if (state.view === "notices") return renderNotices();
  return renderDashboard();
}

function renderDashboard() {
  const records = state.data.records;
  const occurrences = records.filter((record) => record.occurrenceRound1 || record.occurrenceRound2).length;
  const todayRecords = records.filter((record) => record.date === today()).length;
  const last = records.slice(-4).reverse();

  return `
    <section class="grid metrics">
      ${metric("Registros", records.length, "Planilhas criadas")}
      ${metric("Hoje", todayRecords, "Rondas registradas")}
      ${metric("Ocorrências", occurrences, "Com descrição preenchida")}
      ${metric("Avisos", state.data.notices.length, "Comunicados ativos")}
    </section>
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Ultimos registros</p>
            <h2>Rondas recentes</h2>
          </div>
          <button class="btn ghost" data-view="records">Ver todos</button>
        </div>
        ${last.length ? last.map(recordCard).join("") : emptyState("Nenhuma ronda registrada ainda.")}
      </article>
      <article class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Mural</p>
            <h2>Avisos do admin</h2>
          </div>
        </div>
        ${state.data.notices.map(noticeCard).join("") || emptyState("Nenhum aviso cadastrado.")}
      </article>
    </section>
  `;
}

function renderChatbot() {
  const form = state.routeForm;
  const tag = TAGS.find((item) => item.id === form.tag);
  const required = getChecklist();
  const timeWarning = shiftTimeWarning(form, tag);

  return `
    <section class="chat-layout">
      <article class="chat-panel">
        <div class="bot-message">
          <span class="bot-avatar">AI</span>
          <div>
            <strong>Assistente de Ronda ENGIE</strong>
            <p>Vou guiar seu preenchimento. Use seletores para data, TAG e horários. A saída é calculada automaticamente com permanência fixa de 30 minutos.</p>
          </div>
        </div>
        <form id="route-form" class="route-form">
          <div class="form-row">
            <label>Data da ronda
              <input type="date" name="date" value="${escapeAttr(form.date)}" required>
            </label>
            <label>TAG
              <select name="tag" required>
                <option value="">Selecione</option>
                ${TAGS.map((item) => `<option value="${item.id}" ${form.tag === item.id ? "selected" : ""}>${item.label}</option>`).join("")}
              </select>
            </label>
            <label>Turno
              <select name="shift" required>
                ${SHIFTS.map((shift) => `<option value="${shift.id}" ${form.shift === shift.id ? "selected" : ""}>${shift.label} - ${shift.period}</option>`).join("")}
              </select>
            </label>
          </div>

          <div class="locked-grid">
            ${lockedField("Cliente", CLIENTE)}
            ${lockedField("Número de contrato", CONTRATO)}
            ${lockedField("Contratada", CONTRATADA)}
            ${lockedField("Tempo de permanência", `${PERMANENCIA_MINUTOS} minutos`)}
          </div>

          <label>Descrição das ocorrências - 1ª ronda
            <textarea name="occurrenceRound1" rows="4" placeholder="Descreva a situação observada na primeira ronda">${escapeHtml(form.occurrenceRound1)}</textarea>
          </label>

          ${tag?.rounds === 2 ? `
            <label>Descrição das ocorrências - 2ª ronda
              <textarea name="occurrenceRound2" rows="4" placeholder="Descreva a situação observada na segunda ronda">${escapeHtml(form.occurrenceRound2)}</textarea>
            </label>
          ` : ""}

          <label>Paralisações
            <textarea name="stoppages" rows="3" placeholder="Informe paralisações, bloqueios, impedimentos ou escreva 'Sem paralisações'.">${escapeHtml(form.stoppages)}</textarea>
          </label>

          <div class="form-row">
            <label>Chegada na unidade - 1ª ronda
              <input type="time" name="arrivalRound1" value="${escapeAttr(form.arrivalRound1)}" required>
            </label>
            <label>Saída da unidade - 1ª ronda
              <input value="${escapeAttr(calcExit(form.arrivalRound1))}" readonly>
            </label>
          </div>

          ${tag?.rounds === 2 ? `
            <div class="form-row">
              <label>Chegada na unidade - 2ª ronda
                <input type="time" name="arrivalRound2" value="${escapeAttr(form.arrivalRound2)}" required>
              </label>
              <label>Saída da unidade - 2ª ronda
                <input value="${escapeAttr(calcExit(form.arrivalRound2))}" readonly>
              </label>
            </div>
          ` : ""}

          ${timeWarning ? `<div class="alert danger">${escapeHtml(timeWarning)}</div>` : ""}

          <div class="form-row">
            <label>KM inicial
              <input type="number" name="kmStart" min="0" step="0.1" inputmode="decimal" value="${escapeAttr(form.kmStart)}" required>
            </label>
            <label>KM final
              <input type="number" name="kmEnd" min="0" step="0.1" inputmode="decimal" value="${escapeAttr(form.kmEnd)}" required>
            </label>
            <label>KM percorrido
              <input value="${escapeAttr(formatKm(calcKmTotal(form.kmStart, form.kmEnd)))}" readonly>
            </label>
          </div>

          <label>Equipe de ronda
            <select name="team">
              ${TEAMS.map((team) => `<option ${form.team === team ? "selected" : ""}>${team}</option>`).join("")}
            </select>
          </label>

          <div class="photo-grid">
            ${form.photos.map((photo, index) => photoInput(photo, index, tag)).join("")}
          </div>

          <div class="locked-grid">
            ${lockedField("Responsável pela transcrição", RESPONSAVEL_TRANSCRICAO)}
            ${lockedField("Responsável pela fiscalização ESOM", RESPONSAVEL_ESOM)}
          </div>

          <div class="action-row">
            <button class="btn ghost" type="button" data-action="reset-route">Limpar</button>
            <button class="btn primary" type="submit">Salvar registro</button>
          </div>
        </form>
      </article>
      <aside class="panel checklist">
        <p class="eyebrow">Checklist inteligente</p>
        <h2>Itens obrigatorios</h2>
        ${required.map((item) => `<div class="check-item ${item.ok ? "ok" : ""}"><span>${item.ok ? "✓" : "○"}</span>${item.label}</div>`).join("")}
        <div class="tip">
          <strong>Fotos</strong>
          <p>${tag?.id === "tims" ? "Na TAG Tims, as 2 imagens de cima são da 1ª ronda e as 2 de baixo são da 2ª ronda." : "Para TAG Itapemirim e TAG Viana, registre as 4 fotos da 1ª ronda."}</p>
        </div>
      </aside>
    </section>
  `;
}

function renderRecords() {
  const records = filteredRecords();
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Histórico</p>
          <h2>Registros de rondas</h2>
        </div>
        <div class="filters">
          <input type="date" id="filter-date" value="${escapeAttr(state.filters.date)}">
          <select id="filter-tag">
            <option value="all">Todas as TAGs</option>
            ${TAGS.map((tag) => `<option value="${tag.id}" ${state.filters.tag === tag.id ? "selected" : ""}>${tag.label}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="record-list">
        ${records.length ? records.map(recordCard).join("") : emptyState("Nenhum registro encontrado para o filtro.")}
      </div>
    </section>
  `;
}

function renderScales() {
  const canEdit = state.session.role === "admin";
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Escala operacional</p>
          <h2>Supervisores ENGIE</h2>
        </div>
        <span class="badge">${canEdit ? "Admin pode alterar" : "Somente visualização"}</span>
      </div>
      <div class="scale-grid">
        ${state.data.scales.map((item, index) => `
          <article class="scale-card">
            <strong>${escapeHtml(item.name)}</strong>
            <label>Turno
              <select data-scale="${index}" data-field="shift" ${canEdit ? "" : "disabled"}>
                <option ${item.shift === "Diurna" ? "selected" : ""}>Diurna</option>
                <option ${item.shift === "Noturna" ? "selected" : ""}>Noturna</option>
              </select>
            </label>
            <label>Equipe
              <select data-scale="${index}" data-field="team" ${canEdit ? "" : "disabled"}>
                ${TEAMS.map((team) => `<option ${item.team === team ? "selected" : ""}>${team}</option>`).join("")}
              </select>
            </label>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderNotices() {
  const canEdit = state.session.role === "admin";
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Comunicados</p>
            <h2>Avisos operacionais</h2>
          </div>
          ${canEdit ? `<button class="btn primary" data-action="new-notice">Novo aviso</button>` : ""}
        </div>
        ${state.data.notices.map(noticeCard).join("") || emptyState("Nenhum aviso cadastrado.")}
      </article>
      ${canEdit ? `
        <article class="panel">
          <p class="eyebrow">Admin</p>
          <h2>${state.editingNoticeId ? "Editar aviso" : "Novo aviso"}</h2>
          <form id="notice-form" class="form">
            <label>Titulo
              <input name="title" required value="${escapeAttr(currentNotice()?.title || "")}">
            </label>
            <label>Mensagem
              <textarea name="body" rows="6" required>${escapeHtml(currentNotice()?.body || "")}</textarea>
            </label>
            <label>Documento do aviso
              <input name="attachment" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg">
            </label>
            ${currentNotice()?.attachment ? `
              <div class="attachment-preview">
                <span>Documento atual</span>
                <a href="${currentNotice().attachment.dataUrl}" download="${escapeAttr(currentNotice().attachment.name)}">${escapeHtml(currentNotice().attachment.name)}</a>
              </div>
            ` : ""}
            <button class="btn primary full" type="submit">Salvar aviso</button>
          </form>
        </article>
      ` : ""}
    </section>
  `;
}

function bindGlobalEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.view;
      if (next === "chatbot" && state.session.role !== "supervisor") return;
      state.view = next;
      render();
    });
  });

  document.querySelectorAll("[data-action='logout']").forEach((button) => {
    button.addEventListener("click", () => {
      localStorage.removeItem(SESSION_KEY);
      state.session = null;
      render();
    });
  });

  document.querySelectorAll("[data-action='new-notice']").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = "notices";
      state.editingNoticeId = null;
      render();
    });
  });
}

function bindViewEvents() {
  if (state.view === "chatbot") bindRouteForm();
  if (state.view === "records") bindRecords();
  if (state.view === "scales") bindScales();
  if (state.view === "notices") bindNotices();

  document.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = state.data.records.find((item) => item.id === button.dataset.export);
      if (record) exportSpreadsheet(record);
    });
  });
}

function bindRouteForm() {
  const form = document.querySelector("#route-form");
  form.addEventListener("input", updateRouteDraft);
  form.addEventListener("change", updateRouteDraft);

  form.querySelectorAll("input[type='file']").forEach((input) => {
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      state.routeForm.photos[Number(input.dataset.photo)] = await fileToDataUrl(file);
      render();
    });
  });

  document.querySelector("[data-action='reset-route']")?.addEventListener("click", () => {
    state.routeForm = createEmptyRoute();
    render();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    updateRouteDraft();
    const missing = getChecklist().filter((item) => !item.ok);
    if (missing.length) {
      alert(`Ainda falta preencher: ${missing.map((item) => item.label).join(", ")}`);
      return;
    }

    const record = normalizeRecord(state.routeForm);
    state.data.records.push(record);
    saveData();
    state.routeForm = createEmptyRoute();
    state.view = "records";
    render();
  });
}

function bindRecords() {
  document.querySelector("#filter-date")?.addEventListener("change", (event) => {
    state.filters.date = event.target.value;
    render();
  });
  document.querySelector("#filter-tag")?.addEventListener("change", (event) => {
    state.filters.tag = event.target.value;
    render();
  });
}

function bindScales() {
  document.querySelectorAll("[data-scale]").forEach((input) => {
    input.addEventListener("change", () => {
      if (state.session.role !== "admin") return;
      state.data.scales[Number(input.dataset.scale)][input.dataset.field] = input.value;
      saveData();
      render();
    });
  });
}

function bindNotices() {
  document.querySelector("#notice-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = currentNotice();
    const file = form.get("attachment");
    const attachment = file instanceof File && file.size
      ? await fileToStoredDocument(file)
      : current?.attachment || null;
    const notice = {
      id: state.editingNoticeId || crypto.randomUUID(),
      title: String(form.get("title") || "").trim(),
      body: String(form.get("body") || "").trim(),
      attachment,
      createdAt: current?.createdAt || new Date().toISOString()
    };

    if (state.editingNoticeId) {
      state.data.notices = state.data.notices.map((item) => item.id === notice.id ? notice : item);
    } else {
      state.data.notices.unshift(notice);
    }
    state.editingNoticeId = null;
    saveData();
    render();
  });

  document.querySelectorAll("[data-edit-notice]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingNoticeId = button.dataset.editNotice;
      render();
    });
  });

  document.querySelectorAll("[data-delete-notice]").forEach((button) => {
    button.addEventListener("click", () => {
      state.data.notices = state.data.notices.filter((item) => item.id !== button.dataset.deleteNotice);
      saveData();
      render();
    });
  });
}

function updateRouteDraft() {
  const form = document.querySelector("#route-form");
  if (!form) return;
  const data = new FormData(form);
  state.routeForm = {
    ...state.routeForm,
    date: String(data.get("date") || ""),
    tag: String(data.get("tag") || ""),
    shift: String(data.get("shift") || "noturna"),
    occurrenceRound1: String(data.get("occurrenceRound1") || ""),
    occurrenceRound2: String(data.get("occurrenceRound2") || ""),
    stoppages: String(data.get("stoppages") || ""),
    arrivalRound1: String(data.get("arrivalRound1") || ""),
    arrivalRound2: String(data.get("arrivalRound2") || ""),
    kmStart: String(data.get("kmStart") || ""),
    kmEnd: String(data.get("kmEnd") || ""),
    team: String(data.get("team") || TEAMS[0])
  };
}

function normalizeRecord(form) {
  return {
    ...form,
    id: crypto.randomUUID(),
    status: "concluído",
    client: CLIENTE,
    contract: CONTRATO,
    contractor: CONTRATADA,
    permanence: PERMANENCIA_MINUTOS,
    exitRound1: calcExit(form.arrivalRound1),
    exitRound2: calcExit(form.arrivalRound2),
    kmTotal: calcKmTotal(form.kmStart, form.kmEnd),
    transcriptionResponsible: RESPONSAVEL_TRANSCRICAO,
    esomResponsible: RESPONSAVEL_ESOM,
    createdBy: state.session.name,
    createdAt: new Date().toISOString()
  };
}

function getChecklist() {
  const form = state.routeForm;
  const tag = TAGS.find((item) => item.id === form.tag);
  const photosRequired = tag?.photos ?? 4;
  return [
    { label: "Data da ronda", ok: Boolean(form.date) },
    { label: "TAG selecionada", ok: Boolean(form.tag) },
    { label: "Turno recolhido", ok: Boolean(form.shift) },
    { label: "Ocorrência da 1ª ronda", ok: Boolean(form.occurrenceRound1.trim()) },
    { label: "Ocorrência da 2ª ronda", ok: tag?.rounds !== 2 || Boolean(form.occurrenceRound2.trim()) },
    { label: "Paralisações", ok: Boolean(form.stoppages.trim()) },
    { label: "Chegada da 1ª ronda", ok: Boolean(form.arrivalRound1) },
    { label: "Chegada da 2ª ronda", ok: tag?.rounds !== 2 || Boolean(form.arrivalRound2) },
    { label: "Horário compatível com o turno", ok: isRouteTimeCompatible(form, tag) },
    { label: "KM inicial e final", ok: isValidKmRange(form.kmStart, form.kmEnd) },
    { label: `${photosRequired} fotos anexadas`, ok: form.photos.filter(Boolean).length >= photosRequired },
    { label: "Equipe selecionada", ok: Boolean(form.team) }
  ];
}

function filteredRecords() {
  return state.data.records
    .filter((record) => !state.filters.date || record.date === state.filters.date)
    .filter((record) => state.filters.tag === "all" || record.tag === state.filters.tag)
    .slice()
    .reverse();
}

async function exportSpreadsheet(record) {
  if (!window.JSZip) {
    alert("O gerador de planilhas não foi carregado. Verifique a conexão com a internet e tente novamente.");
    return;
  }

  try {
    const blob = await buildTemplateWorkbook(record);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatório de Rondas - ${record.tag}-${record.date}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error(error);
    alert("Não foi possível gerar a planilha no modelo enviado.");
  }
}

async function buildTemplateWorkbook(record) {
  const templatePath = TEMPLATE_PATHS[record.tag];
  if (!templatePath) throw new Error("TAG sem modelo de planilha.");

  const response = await fetch(templatePath);
  if (!response.ok) throw new Error("Modelo de planilha não encontrado.");

  const zip = await window.JSZip.loadAsync(await response.arrayBuffer());
  const sheetPath = await resolveTemplateSheet(zip, record.date);
  const sheetXml = await zip.file(sheetPath).async("string");
  const sheetDoc = parseXml(sheetXml);

  const shift = shiftById(record.shift);
  setInlineString(sheetDoc, "A3", `DATA: ${formatLongDate(record.date)} - TURNO ${shift.label.toUpperCase()} - ${shift.period}`);
  setInlineString(sheetDoc, "A5", CLIENTE);
  setInlineString(sheetDoc, "F5", CONTRATO);
  setInlineString(sheetDoc, "H5", CONTRATADA);
  setInlineString(sheetDoc, "A7", occurrenceText(record));
  setInlineString(sheetDoc, "A9", stoppagesAndKmText(record));
  setNumber(sheetDoc, "A16", timeToExcel(record.arrivalRound1));
  setNumber(sheetDoc, "C16", minutesToExcel(PERMANENCIA_MINUTOS));
  setNumber(sheetDoc, "E16", timeToExcel(record.exitRound1));

  if (record.tag === "tims") {
    setNumber(sheetDoc, "G16", timeToExcel(record.arrivalRound2));
    setNumber(sheetDoc, "I16", minutesToExcel(PERMANENCIA_MINUTOS));
    setNumber(sheetDoc, "J16", timeToExcel(record.exitRound2));
  } else {
    setEmptyCell(sheetDoc, "G16");
    setEmptyCell(sheetDoc, "I16");
    setEmptyCell(sheetDoc, "J16");
  }

  setInlineString(sheetDoc, "A18", teamLabel(record.team));
  setInlineString(sheetDoc, "D18", RESPONSAVEL_TRANSCRICAO);
  setInlineString(sheetDoc, "G18", RESPONSAVEL_ESOM);
  zip.file(sheetPath, serializeXml(sheetDoc));

  await replaceTemplateImages(zip, sheetPath, record.photos || []);
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

async function resolveTemplateSheet(zip, date) {
  const workbookPath = "xl/workbook.xml";
  const workbookRelsPath = "xl/_rels/workbook.xml.rels";
  const workbookDoc = parseXml(await zip.file(workbookPath).async("string"));
  const relsDoc = parseXml(await zip.file(workbookRelsPath).async("string"));
  const desiredName = sheetNameFromDate(date);
  const sheets = Array.from(workbookDoc.getElementsByTagNameNS("*", "sheet"));
  const chosenSheet = sheets.find((sheet) => sheet.getAttribute("name") === desiredName) || sheets[0];
  if (!chosenSheet) throw new Error("Nenhuma aba encontrada no modelo.");

  if (chosenSheet.getAttribute("name") !== desiredName) {
    chosenSheet.setAttribute("name", desiredName);
    zip.file(workbookPath, serializeXml(workbookDoc));
  }

  const relationId = chosenSheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
    || chosenSheet.getAttribute("r:id");
  const relation = Array.from(relsDoc.getElementsByTagNameNS("*", "Relationship"))
    .find((item) => item.getAttribute("Id") === relationId);
  if (!relation) throw new Error("Aba do modelo sem relacionamento.");

  isolateWorkbookSheet(zip, workbookDoc, relsDoc, chosenSheet, relationId, desiredName);
  zip.file(workbookPath, serializeXml(workbookDoc));
  zip.file(workbookRelsPath, serializeXml(relsDoc));

  return resolveZipPath(workbookPath, relation.getAttribute("Target"));
}

function isolateWorkbookSheet(zip, workbookDoc, relsDoc, chosenSheet, chosenRelationId, desiredName) {
  const sheetsNode = chosenSheet.parentNode;
  Array.from(workbookDoc.getElementsByTagNameNS("*", "sheet"))
    .filter((sheet) => sheet !== chosenSheet)
    .forEach((sheet) => sheetsNode.removeChild(sheet));

  chosenSheet.setAttribute("name", desiredName || "Ronda");
  chosenSheet.setAttribute("sheetId", "1");

  Array.from(relsDoc.getElementsByTagNameNS("*", "Relationship"))
    .filter((relation) => {
      const type = relation.getAttribute("Type") || "";
      return type.endsWith("/worksheet") && relation.getAttribute("Id") !== chosenRelationId;
    })
    .forEach((relation) => relation.parentNode.removeChild(relation));

  const workbookViews = workbookDoc.getElementsByTagNameNS("*", "workbookView");
  Array.from(workbookViews).forEach((view) => {
    view.setAttribute("activeTab", "0");
    view.setAttribute("firstSheet", "0");
  });
}

async function replaceTemplateImages(zip, sheetPath, photos) {
  const validPhotos = photos.filter(Boolean);
  if (!validPhotos.length) return;

  const sheetDoc = parseXml(await zip.file(sheetPath).async("string"));
  const drawing = sheetDoc.getElementsByTagNameNS("*", "drawing")[0];
  if (!drawing) return;

  const sheetRelPath = relatedPathFor(sheetPath);
  const sheetRels = zip.file(sheetRelPath);
  if (!sheetRels) return;

  const sheetRelsDoc = parseXml(await sheetRels.async("string"));
  const drawingId = drawing.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
    || drawing.getAttribute("r:id");
  const drawingRel = Array.from(sheetRelsDoc.getElementsByTagNameNS("*", "Relationship"))
    .find((item) => item.getAttribute("Id") === drawingId);
  if (!drawingRel) return;

  const drawingPath = resolveZipPath(sheetPath, drawingRel.getAttribute("Target"));
  const drawingFile = zip.file(drawingPath);
  if (!drawingFile) return;

  const drawingDoc = parseXml(await drawingFile.async("string"));
  const drawingRelsPath = relatedPathFor(drawingPath);
  const drawingRelsFile = zip.file(drawingRelsPath);
  if (!drawingRelsFile) return;

  const drawingRelsDoc = parseXml(await drawingRelsFile.async("string"));
  const imageAnchors = Array.from(drawingDoc.getElementsByTagNameNS("*", "twoCellAnchor"))
    .concat(Array.from(drawingDoc.getElementsByTagNameNS("*", "oneCellAnchor")))
    .map((anchor) => {
      const from = anchor.getElementsByTagNameNS("*", "from")[0];
      const row = Number(from?.getElementsByTagNameNS("*", "row")[0]?.textContent || 0);
      const col = Number(from?.getElementsByTagNameNS("*", "col")[0]?.textContent || 0);
      const blip = anchor.getElementsByTagNameNS("*", "blip")[0];
      const relId = blip?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed")
        || blip?.getAttribute("r:embed");
      return { row, col, relId };
    })
    .filter((item) => item.relId && item.row >= 10)
    .sort((a, b) => a.row - b.row || a.col - b.col);

  imageAnchors.slice(0, validPhotos.length).forEach((anchor, index) => {
    const mediaRel = Array.from(drawingRelsDoc.getElementsByTagNameNS("*", "Relationship"))
      .find((item) => item.getAttribute("Id") === anchor.relId);
    if (!mediaRel) return;

    const mediaPath = resolveZipPath(drawingPath, mediaRel.getAttribute("Target"));
    zip.file(mediaPath, dataUrlBase64(validPhotos[index]), { base64: true });
  });
}

function setInlineString(doc, cellRef, value) {
  const cell = ensureCell(doc, cellRef);
  cell.setAttribute("t", "inlineStr");
  clearChildren(cell);
  const is = doc.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main", "is");
  const text = doc.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main", "t");
  text.textContent = value || "";
  is.appendChild(text);
  cell.appendChild(is);
}

function setNumber(doc, cellRef, value) {
  const cell = ensureCell(doc, cellRef);
  cell.removeAttribute("t");
  clearChildren(cell);
  const number = doc.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main", "v");
  number.textContent = String(value || 0);
  cell.appendChild(number);
}

function setEmptyCell(doc, cellRef) {
  const cell = ensureCell(doc, cellRef);
  cell.removeAttribute("t");
  clearChildren(cell);
}

function ensureCell(doc, cellRef) {
  const rowNumber = Number(cellRef.match(/\d+/)?.[0]);
  const row = ensureRow(doc, rowNumber);
  const existing = Array.from(row.getElementsByTagNameNS("*", "c"))
    .find((cell) => cell.getAttribute("r") === cellRef);
  if (existing) return existing;

  const cell = doc.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main", "c");
  cell.setAttribute("r", cellRef);
  row.appendChild(cell);
  return cell;
}

function ensureRow(doc, rowNumber) {
  const sheetData = doc.getElementsByTagNameNS("*", "sheetData")[0];
  const existing = Array.from(sheetData.getElementsByTagNameNS("*", "row"))
    .find((row) => Number(row.getAttribute("r")) === rowNumber);
  if (existing) return existing;

  const row = doc.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main", "row");
  row.setAttribute("r", String(rowNumber));
  sheetData.appendChild(row);
  return row;
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function occurrenceText(record) {
  if (record.tag === "tims") {
    return `1ª Ronda: ${record.occurrenceRound1 || "Sem ocorrência registrada."}\n\n2ª Ronda: ${record.occurrenceRound2 || "Sem ocorrência registrada."}`;
  }
  return `1ª Ronda: ${record.occurrenceRound1 || "Sem ocorrência registrada."}`;
}

function stoppagesAndKmText(record) {
  return [
    record.stoppages || "Sem paralisações.",
    `KM inicial: ${formatKm(record.kmStart)}`,
    `KM final: ${formatKm(record.kmEnd)}`,
    `KM percorrido: ${formatKm(record.kmTotal)}`
  ].join("\n");
}

function timeToExcel(time) {
  if (!time) return 0;
  const [hour, minute] = time.split(":").map(Number);
  return Number(((hour * 60 + minute) / 1440).toFixed(8));
}

function minutesToExcel(minutes) {
  return Number((Number(minutes || 0) / 1440).toFixed(8));
}

function teamLabel(team) {
  return String(team).toLowerCase().includes("marcos") ? "MARCOS E ROGÉRIO" : "JOÃO VICTOR E ADIELTON";
}

function shiftById(id) {
  return SHIFTS.find((shift) => shift.id === id) || SHIFTS[1];
}

function isRouteTimeCompatible(form, tag) {
  const arrivals = [form.arrivalRound1];
  if (tag?.rounds === 2) arrivals.push(form.arrivalRound2);
  return arrivals.every((time) => !time || isTimeWithinShift(time, form.shift));
}

function shiftTimeWarning(form, tag) {
  const shift = shiftById(form.shift);
  const invalidRounds = [
    { label: "1ª ronda", time: form.arrivalRound1 },
    ...(tag?.rounds === 2 ? [{ label: "2ª ronda", time: form.arrivalRound2 }] : [])
  ].filter((round) => round.time && !isTimeWithinShift(round.time, form.shift));

  if (!invalidRounds.length) return "";
  const rounds = invalidRounds.map((round) => `${round.label} (${round.time})`).join(", ");
  return `Horário fora do turno ${shift.label}. O turno ${shift.label.toLowerCase()} aceita chegada entre ${shift.period}. Corrija: ${rounds}.`;
}

function isTimeWithinShift(time, shiftId) {
  const minutes = timeToMinutes(time);
  if (!Number.isFinite(minutes)) return false;

  if (shiftId === "diurna") {
    return minutes >= 6 * 60 && minutes < 18 * 60;
  }

  return minutes >= 18 * 60 || minutes < 6 * 60;
}

function timeToMinutes(time) {
  if (!time) return NaN;
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
  return hour * 60 + minute;
}

function formatLongDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function sheetNameFromDate(value) {
  if (!value) return "Ronda";
  const [, month, day] = value.split("-");
  return `${day}_${month}`;
}

function relatedPathFor(path) {
  const parts = path.split("/");
  const fileName = parts.pop();
  return `${parts.join("/")}/_rels/${fileName}.rels`;
}

function resolveZipPath(basePath, target) {
  const stack = basePath.split("/").slice(0, -1);
  target.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") stack.pop();
    else stack.push(part);
  });
  return stack.join("/");
}

function dataUrlBase64(dataUrl) {
  return String(dataUrl).includes(",") ? String(dataUrl).split(",").pop() : String(dataUrl);
}

function parseXml(xml) {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function serializeXml(doc) {
  return new XMLSerializer().serializeToString(doc);
}

function navButton(view, label, icon) {
  return `<button class="${state.view === view ? "active" : ""}" data-view="${view}"><span>${icon}</span>${label}</button>`;
}

function metric(label, value, hint) {
  return `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${hint}</small></article>`;
}

function recordCard(record) {
  const tag = TAGS.find((item) => item.id === record.tag);
  const shift = shiftById(record.shift);
  return `
    <article class="record-card">
      <div>
        <span class="badge">${escapeHtml(tag?.label || "TAG")}</span>
        <h3>${formatDate(record.date)}</h3>
        <p>${escapeHtml(record.team)} · ${escapeHtml(shift.label)} · ${escapeHtml(record.arrivalRound1)} às ${escapeHtml(record.exitRound1)}</p>
        <p>KM: ${escapeHtml(record.kmStart || "-")} até ${escapeHtml(record.kmEnd || "-")} · Total ${escapeHtml(formatKm(record.kmTotal))}</p>
      </div>
      <div class="record-actions">
        <span>${record.photos.filter(Boolean).length} fotos</span>
        <button class="btn ghost" data-export="${record.id}">Exportar XLSX separado</button>
      </div>
    </article>
  `;
}

function noticeCard(notice) {
  const adminTools = state.session.role === "admin" ? `
    <div class="mini-actions">
      <button class="link" data-edit-notice="${notice.id}">Editar</button>
      <button class="link danger-text" data-delete-notice="${notice.id}">Excluir</button>
    </div>
  ` : "";
  return `
    <article class="notice">
      <div>
        <strong>${escapeHtml(notice.title)}</strong>
        <p>${escapeHtml(notice.body)}</p>
        ${notice.attachment ? `<a class="attachment-link" href="${notice.attachment.dataUrl}" download="${escapeAttr(notice.attachment.name)}">Baixar documento: ${escapeHtml(notice.attachment.name)}</a>` : ""}
        <small>${formatDate(notice.createdAt.slice(0, 10))}</small>
      </div>
      ${adminTools}
    </article>
  `;
}

function photoInput(photo, index, tag) {
  const label = tag?.id === "tims"
    ? index < 2 ? `Foto ${index + 1} - 1ª ronda` : `Foto ${index + 1} - 2ª ronda`
    : `Foto ${index + 1} - 1ª ronda`;

  return `
    <label class="photo-box">
      ${photo ? `<img src="${photo}" alt="${label}">` : `<span>${label}</span>`}
      <input type="file" accept="image/*" data-photo="${index}">
    </label>
  `;
}

function lockedField(label, value) {
  return `<label>${label}<input value="${escapeAttr(value)}" readonly></label>`;
}

function emptyState(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

function currentNotice() {
  return state.data.notices.find((item) => item.id === state.editingNoticeId);
}

function calcExit(time) {
  if (!time) return "";
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute + PERMANENCIA_MINUTOS, 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function calcKmTotal(start, end) {
  const startNumber = parseDecimal(start);
  const endNumber = parseDecimal(end);
  if (!Number.isFinite(startNumber) || !Number.isFinite(endNumber) || endNumber < startNumber) return "";
  return Number((endNumber - startNumber).toFixed(1));
}

function isValidKmRange(start, end) {
  return calcKmTotal(start, end) !== "";
}

function parseDecimal(value) {
  if (value === null || value === undefined || value === "") return NaN;
  return Number(String(value).replace(",", "."));
}

function formatKm(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = parseDecimal(value);
  if (!Number.isFinite(number)) return "-";
  return `${number.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToStoredDocument(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      dataUrl: reader.result
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function nl(value) {
  return escapeHtml(value || "").replace(/\n/g, "<br>");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}
