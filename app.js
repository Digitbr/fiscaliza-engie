const app = document.querySelector("#app");

const STORAGE_KEY = "fiscalizapro.engie.v1";
const SESSION_KEY = "fiscalizapro.engie.session";
const DB_NAME = "fiscalizapro-engie-db";
const DB_STORE = "app-data";
const DB_VERSION = 1;
const PERMISSION_KEYS = {
  dashboard: "Painel",
  inspections: "Criar fiscalizações",
  kilometers: "Controle de KM",
  records: "Consultar registros",
  scales: "Gerenciar escalas",
  employees: "Cadastrar funcionários",
  notices: "Gerenciar avisos",
  users: "Gerenciar usuários",
  editRecords: "Editar registros",
  deleteRecords: "Excluir registros"
};

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

const defaultData = {
  records: [],
  kmRecords: [],
  teams: TEAMS,
  notices: [
    {
      id: crypto.randomUUID(),
      title: "Atenção ao envio das fotos",
      body: "As fotos devem ser registradas na ordem da ronda para evitar rejeição da planilha.",
      createdAt: new Date().toISOString()
    }
  ],
  scales: SUPERVISORS,
  employees: SUPERVISORS.map((supervisor) => ({
    id: crypto.randomUUID(),
    name: supervisor.name,
    registration: "",
    jobTitle: "Supervisor",
    email: "",
    phone: "",
    active: true
  }))
};

const state = {
  session: loadSession(),
  data: await loadData(),
  view: "dashboard",
  routeForm: createEmptyRoute(),
  editingRecordId: null,
  editingKmId: null,
  editingEmployeeId: null,
  editingNoticeId: null,
  selectedRecordIds: new Set(),
  filters: {
    records: {}
  }
};

render();

async function loadData() {
  try {
    if (stateToken()) {
      const response = await apiRequest("/api/app-data");
      if (response.data) {
        const remote = normalizeStoredData({ ...defaultData, ...response.data });
        await writeDatabaseValue(STORAGE_KEY, remote);
        return remote;
      }
    }
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

async function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  } catch (error) {
    console.warn("Não foi possível salvar o espelho local dos dados.", error);
  }

  await writeDatabaseValue(STORAGE_KEY, state.data).catch((error) => {
    console.warn("Não foi possível salvar no banco interno.", error);
  });
  if (stateToken()) {
    await apiRequest("/api/app-data", {
      method: "PUT",
      body: JSON.stringify(state.data)
    });
  }
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
  normalized.teams = Array.from(new Set([
    ...(normalized.teams || TEAMS),
    ...normalized.scales.map((scale) => scale.team).filter(Boolean)
  ]));
  normalized.notices = (normalized.notices?.length ? normalized.notices : defaultData.notices)
    .map((notice) => ({
      ...notice,
      attachments: notice.attachments || (notice.attachment ? [notice.attachment] : [])
    }));
  normalized.records = (normalized.records || []).map((record) => ({
    shift: "noturna",
    ...record
  }));
  normalized.kmRecords = normalized.kmRecords || [];
  normalized.kmRecords = normalized.kmRecords.map((record) => ({
    type: "initial",
    location: "engie",
    status: "active",
    ...record
  }));
  normalized.employees = (normalized.employees || defaultData.employees).map((employee) => ({
    id: employee.id || crypto.randomUUID(),
    registration: "",
    jobTitle: "",
    email: "",
    phone: "",
    active: true,
    ...employee
  }));
  normalized.scales = normalized.scales.map((scale) => {
    const employee = normalized.employees.find((item) => item.id === scale.employeeId || item.name === scale.name);
    return {
      id: scale.id || crypto.randomUUID(),
      employeeId: employee?.id || "",
      ...scale
    };
  });
  return normalized;
}

function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    return session?.accessToken ? session : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  state.session = session;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function stateToken() {
  return loadSession()?.accessToken || "";
}

async function apiRequest(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (stateToken()) headers.set("Authorization", `Bearer ${stateToken()}`);
  const response = await fetch(url, { ...options, headers });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "Falha ao comunicar com o servidor.");
  return payload;
}

function hasPermission(permission) {
  if (state.session?.isDeveloper) return true;
  if (state.session?.permissions?.[permission] !== undefined) {
    return Boolean(state.session.permissions[permission]);
  }
  const role = state.session?.role;
  if (role === "admin") return true;
  if (role === "manager") return permission !== "users";
  if (role === "supervisor") return ["dashboard", "inspections", "kilometers", "records", "editRecords"].includes(permission);
  if (role === "inspector") return ["dashboard", "inspections", "kilometers", "records", "editRecords"].includes(permission);
  return ["dashboard", "records"].includes(permission);
}

function createEmptyRoute() {
  return {
    id: crypto.randomUUID(),
    date: today(),
    tag: "",
    shift: "noturna",
    occurrenceRound1: "",
    occurrenceRound2: "",
    arrivalRound1: "",
    arrivalRound2: "",
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
          <img class="prime-brand-logo" src="/prime-logo.png" alt="Prime Consultoria e Serviços">
          <div>
            <strong>Fiscaliza Pro</strong>
            <small>Rondas ENGIE</small>
          </div>
        </div>
        <nav class="nav">
          ${navButton("dashboard", "Início", "⌂")}
          ${hasPermission("inspections") ? navButton("chatbot", "Nova ronda", "+") : ""}
          ${hasPermission("kilometers") ? navButton("kilometers", "KM", "⌖") : ""}
          ${hasPermission("records") ? navButton("records", "Registros", "▤") : ""}
          ${hasPermission("scales") ? navButton("scales", "Escalas", "◷") : ""}
          ${hasPermission("employees") ? navButton("employees", "Funcionários", "♟") : ""}
          ${hasPermission("notices") ? navButton("notices", "Avisos", "!") : ""}
          ${hasPermission("users") ? navButton("users", "Usuários", "♙") : ""}
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
    <main class="login prime-login">
      <section class="login-panel prime-login-card">
        <img class="login-prime-logo" src="/prime-logo.png" alt="Prime Consultoria e Serviços">
        <h2>Fiscaliza Pro</h2>
        <p class="login-subtitle">Sistema Integrado de Fiscalização Operacional</p>
        ${error ? `<div class="alert danger">${escapeHtml(error)}</div>` : ""}
        <form id="login-form" class="form">
          <label>E-mail
            <input name="email" type="email" autocomplete="username" placeholder="seuemail@empresa.com.br" required>
          </label>
          <label>Senha
            <input name="password" type="password" autocomplete="current-password" placeholder="Digite a senha" required>
          </label>
          <button class="btn primary full" type="submit">Acessar sistema</button>
        </form>
        <small class="login-footer">Prime Consultoria e Serviços Ltda.</small>
      </section>
    </main>
  `;

  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    button.textContent = "Entrando...";
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    try {
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const loginPayload = await loginResponse.json();
      if (!loginResponse.ok) throw new Error(loginPayload.error || "Sessão não criada.");
      const profileResponse = await fetch("/api/session", {
        headers: { Authorization: `Bearer ${loginPayload.accessToken}` }
      });
      const profilePayload = await profileResponse.json();
      if (!profileResponse.ok) throw new Error(profilePayload.error || "Usuário sem acesso.");
      const profile = profilePayload.data;
      saveSession({
        ...profile,
        role: String(profile.role).toLowerCase(),
        accessToken: loginPayload.accessToken,
        refreshToken: loginPayload.refreshToken,
        expiresAt: loginPayload.expiresAt
      });
      state.data = await loadData();
      state.view = "dashboard";
      render();
    } catch (loginError) {
      renderLogin(loginError.message || "E-mail ou senha incorretos.");
    }
  });
}

function renderTopbar() {
  const title = {
    dashboard: "Início",
    chatbot: "Nova ronda",
    kilometers: "Controle de KM",
    records: "Registros",
    scales: "Escalas",
    employees: "Cadastro de funcionários",
    notices: "Avisos"
    ,users: "Usuários e permissões"
  }[state.view];

  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">Operação ESOM</p>
        <h1>${title}</h1>
      </div>
      ${hasPermission("inspections") ? `<button class="btn primary" data-view="chatbot">Iniciar ronda</button>` : hasPermission("notices") ? `<button class="btn primary" data-action="new-notice">Novo aviso</button>` : ""}
    </header>
  `;
}

function renderView() {
  if (state.view === "chatbot") return renderChatbot();
  if (state.view === "kilometers") return renderKilometers();
  if (state.view === "records") return renderRecords();
  if (state.view === "scales") return renderScales();
  if (state.view === "employees") return renderEmployees();
  if (state.view === "notices") return renderNotices();
  if (state.view === "users") return renderUsers();
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
  const isEditing = Boolean(state.editingRecordId);
  const tag = TAGS.find((item) => item.id === form.tag);
  const required = getChecklist();
  const timeWarning = shiftTimeWarning(form, tag);

  return `
    <section class="chat-layout">
      <article class="chat-panel">
        <div class="bot-message">
          <span class="bot-avatar">AI</span>
          <div>
            <strong>${isEditing ? "Editar registro de ronda" : "Assistente de Ronda ENGIE"}</strong>
            <p>${isEditing ? "Revise os campos necessários. As fotos atuais serão mantidas até que sejam substituídas." : "Vou guiar seu preenchimento. Use seletores para data, TAG e horários. A saída é calculada automaticamente com permanência fixa de 30 minutos."}</p>
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

          <label>Equipe de ronda
            <input name="team" list="team-options" value="${escapeAttr(form.team)}" required>
            ${teamDataList()}
          </label>

          <div class="photo-grid">
            ${form.photos.map((photo, index) => photoInput(photo, index, tag)).join("")}
          </div>

          <div class="locked-grid">
            ${lockedField("Responsável pela transcrição", RESPONSAVEL_TRANSCRICAO)}
            ${lockedField("Responsável pela fiscalização ESOM", RESPONSAVEL_ESOM)}
          </div>

          <div class="action-row">
            <button class="btn ghost" type="button" data-action="${isEditing ? "cancel-edit-record" : "reset-route"}">${isEditing ? "Cancelar edição" : "Limpar"}</button>
            <button class="btn primary" type="submit">${isEditing ? "Salvar alterações" : "Salvar registro"}</button>
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
  const groups = groupRecordsByTag(state.data.records);
  const total = state.data.records.length;
  const activeTags = groups.filter((group) => group.records.length).length;
  const withOccurrences = state.data.records.filter(hasRecordOccurrence).length;
  const selection = selectedRecords();
  const firstActiveTag = groups.find((group) => group.records.length)?.key;
  return `
    <section class="grid metrics">
      ${metric("Registros", total, "Rondas armazenadas")}
      ${metric("TAGs", activeTags, "Caixas com registros")}
      ${metric("Ocorrências", withOccurrences, "Registros com apontamento")}
    </section>
    ${total ? recordExportPanel(selection) : ""}
    <section class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Histórico</p>
          <h2>Registros de rondas</h2>
        </div>
        <span class="badge">${total} registro(s)</span>
      </div>
      <div class="tag-record-list">
        ${groups.map((group) => tagRecordFolder(group, group.key === firstActiveTag)).join("")}
      </div>
    </section>
  `;
}

function renderKilometers() {
  const recentKm = state.data.kmRecords.slice().reverse();
  const kmSummaries = buildKmSummaries().slice(0, 6);
  const editing = state.data.kmRecords.find((record) => record.id === state.editingKmId);
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Odômetro</p>
            <h2>${editing ? "Editar KM da viatura" : "Registrar KM da viatura"}</h2>
          </div>
          <span class="badge">Não vai para a planilha ENGIE</span>
        </div>
        <form id="km-form" class="form">
          <div class="form-row">
            <label>Data
              <input type="date" name="date" value="${escapeAttr(editing?.date || today())}" required>
            </label>
            ${lockedField("Local de início do KM", "ENGIE")}
            <label>Tipo de KM
              <select name="type" required>
                <option value="initial" ${editing?.type === "initial" ? "selected" : ""}>KM inicial</option>
                <option value="final" ${editing?.type === "final" ? "selected" : ""}>KM final</option>
              </select>
            </label>
          </div>
          <div class="camera-panel">
            <label>Foto do hodômetro
              <input type="file" name="odometerPhoto" accept="image/*" capture="environment" ${editing?.photo ? "" : "required"}>
            </label>
            <div class="camera-preview" id="km-preview">${editing?.photo ? `<img src="${editing.photo}" alt="Foto atual do hodômetro"><span>Foto atual mantida; selecione outra para substituir.</span>` : "A foto aparecerá aqui"}</div>
          </div>
          <div class="form-row">
            <label>KM informado
              <input name="kmValue" type="number" min="0" step="0.1" inputmode="decimal" placeholder="Digite o KM manualmente" value="${escapeAttr(editing?.kmValue ?? "")}" required>
            </label>
            <label>Observação
              <input name="note" placeholder="Ex.: troca de viatura, abastecimento, conferência" value="${escapeAttr(editing?.note || "")}">
            </label>
          </div>
          <div class="tip">
            <strong>Registro manual</strong>
            <p>Use a foto apenas como comprovação e digite o KM conferido no painel da viatura.</p>
          </div>
          <div class="action-row">
            <button class="btn ghost" type="button" data-action="clear-km">${editing ? "Cancelar edição" : "Limpar"}</button>
            <button class="btn primary" type="submit">${editing ? "Salvar alterações" : "Salvar KM"}</button>
          </div>
        </form>
      </article>
      <article class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Cálculo</p>
            <h2>KM total</h2>
          </div>
          <button class="btn ghost" type="button" data-export-km>Exportar histórico CSV</button>
        </div>
        <div class="km-summary-list">
          ${kmSummaries.map(kmSummaryCard).join("") || emptyState("Nenhum par de KM registrado ainda.")}
        </div>
        <details class="records-folder" open>
          <summary>Histórico completo de KM (${recentKm.length})</summary>
          <div class="folder-content">
            ${recentKm.map(kmCard).join("") || emptyState("Nenhum KM registrado ainda.")}
          </div>
        </details>
      </article>
    </section>
  `;
}

function renderScales() {
  const canEdit = hasPermission("scales");
  const activeEmployees = state.data.employees.filter((employee) => employee.active);
  return `
    <section class="content-grid scale-management">
      <article class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Escala operacional</p>
          <h2>Equipe escalada</h2>
        </div>
        <span class="badge">${canEdit ? "Admin pode alterar" : "Somente visualização"}</span>
      </div>
      <div class="scale-grid">
        ${state.data.scales.map((item, index) => `
          <article class="scale-card">
            <label>Funcionário
              <select data-scale="${index}" data-field="employeeId" ${canEdit ? "" : "disabled"}>
                <option value="">Selecione</option>
                ${activeEmployees.map((employee) => `<option value="${employee.id}" ${item.employeeId === employee.id || item.name === employee.name ? "selected" : ""}>${escapeHtml(employee.name)}</option>`).join("")}
              </select>
            </label>
            <label>Turno
              <select data-scale="${index}" data-field="shift" ${canEdit ? "" : "disabled"}>
                <option ${item.shift === "Diurna" ? "selected" : ""}>Diurna</option>
                <option ${item.shift === "Noturna" ? "selected" : ""}>Noturna</option>
              </select>
            </label>
            <label>Equipe
              <input data-scale="${index}" data-field="team" list="team-options" value="${escapeAttr(item.team)}" ${canEdit ? "" : "disabled"}>
            </label>
            ${canEdit ? `<button class="btn danger" type="button" data-delete-scale="${index}">Remover da escala</button>` : ""}
          </article>
        `).join("")}
      </div>
      </article>
      ${canEdit ? `
        <article class="panel">
          <p class="eyebrow">Nova escala</p>
          <h2>Adicionar funcionário</h2>
          <form id="scale-form" class="form">
            <label>Funcionário
              <select name="employeeId" required>
                <option value="">Selecione</option>
                ${activeEmployees.map((employee) => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`).join("")}
              </select>
            </label>
            <label>Turno
              <select name="shift"><option>Diurna</option><option>Noturna</option></select>
            </label>
            <label>Equipe
              <input name="team" list="team-options" value="${escapeAttr(state.data.teams[0] || "")}" required>
            </label>
            ${teamDataList()}
            <button class="btn primary full" type="submit">Adicionar à escala</button>
          </form>
        </article>
      ` : ""}
    </section>
  `;
}

function renderEmployees() {
  const editing = state.data.employees.find((employee) => employee.id === state.editingEmployeeId);
  return `
    <section class="content-grid">
      <article class="panel">
        <div class="panel-head">
          <div><p class="eyebrow">Equipe</p><h2>Funcionários cadastrados</h2></div>
          <span class="badge">${state.data.employees.length} funcionário(s)</span>
        </div>
        <div class="employee-list">
          ${state.data.employees.map(employeeCard).join("") || emptyState("Nenhum funcionário cadastrado.")}
        </div>
      </article>
      <article class="panel">
        <p class="eyebrow">Cadastro</p>
        <h2>${editing ? "Editar funcionário" : "Novo funcionário"}</h2>
        <form id="employee-form" class="form">
          <label>Nome completo<input name="name" required value="${escapeAttr(editing?.name || "")}"></label>
          <div class="form-row">
            <label>Matrícula<input name="registration" value="${escapeAttr(editing?.registration || "")}"></label>
            <label>Cargo<input name="jobTitle" value="${escapeAttr(editing?.jobTitle || "")}"></label>
          </div>
          <label>E-mail<input name="email" type="email" value="${escapeAttr(editing?.email || "")}"></label>
          <label>Telefone<input name="phone" value="${escapeAttr(editing?.phone || "")}"></label>
          <label class="switch-line"><input name="active" type="checkbox" ${editing?.active !== false ? "checked" : ""}> Funcionário ativo</label>
          <div class="action-row">
            ${editing ? `<button class="btn ghost" type="button" data-cancel-employee>Cancelar</button>` : ""}
            <button class="btn primary" type="submit">${editing ? "Salvar alterações" : "Cadastrar funcionário"}</button>
          </div>
        </form>
      </article>
    </section>
  `;
}

function renderNotices() {
  const canEdit = hasPermission("notices");
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
            <label>Imagens, planilhas e PDFs
              <input name="attachments" type="file" accept=".pdf,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.webp" multiple>
            </label>
            ${currentNotice()?.attachments?.length ? `
              <div class="attachment-preview">
                <span>${currentNotice().attachments.length} anexo(s) atual(is)</span>
                <small>Novos arquivos serão acrescentados aos existentes.</small>
              </div>
            ` : ""}
            <button class="btn primary full" type="submit">Salvar aviso</button>
          </form>
        </article>
      ` : ""}
    </section>
  `;
}

function renderUsers() {
  return `
    <section class="panel users-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Administração</p>
          <h2>Usuários e permissões</h2>
          <p class="muted">Crie acessos e defina quais módulos cada pessoa pode utilizar.</p>
        </div>
        <button class="btn primary" type="button" data-action="new-user">+ Novo usuário</button>
      </div>
      <div id="users-content">${emptyState("Carregando usuários...")}</div>
    </section>
    <div id="user-modal"></div>
  `;
}

async function loadUsers() {
  const container = document.querySelector("#users-content");
  if (!container) return;
  try {
    const payload = await apiRequest("/api/admin/users");
    container.innerHTML = `
      <div class="table-wrap"><table class="users-table">
        <thead><tr><th>Status</th><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Permissões</th><th>Ações</th></tr></thead>
        <tbody>${payload.data.map((user) => `
          <tr>
            <td><span class="status-pill ${user.active ? "active" : "inactive"}">${user.active ? "Ativo" : "Inativo"}</span></td>
            <td><strong>${escapeHtml(user.name)}</strong>${user.isDeveloper ? `<small class="developer-badge">Operador programador</small>` : ""}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml(roleLabel(user.role))}</td>
            <td>${user.isDeveloper ? "Todas" : Object.values(user.permissions || {}).filter(Boolean).length}</td>
            <td class="user-actions">
              <button class="icon-btn edit" data-edit-user="${user.id}" title="Editar">✎</button>
              <button class="icon-btn danger" data-delete-user="${user.id}" ${user.isDeveloper || user.id === state.session.id ? "disabled" : ""} title="Excluir">⌫</button>
            </td>
          </tr>`).join("")}</tbody>
      </table></div>`;
    container.querySelectorAll("[data-edit-user]").forEach((button) => button.addEventListener("click", () => openUserModal(payload.data.find((user) => user.id === button.dataset.editUser))));
    container.querySelectorAll("[data-delete-user]").forEach((button) => button.addEventListener("click", async () => {
      if (!confirm("Remover este usuário e seu acesso ao sistema?")) return;
      await apiRequest(`/api/admin/users/${button.dataset.deleteUser}`, { method: "DELETE" });
      await loadUsers();
    }));
  } catch (error) {
    container.innerHTML = `<div class="alert danger">${escapeHtml(error.message)}</div>`;
  }
}

function roleLabel(role) {
  return ({ ADMIN: "Administrador", MANAGER: "Gestor", SUPERVISOR: "Supervisor", INSPECTOR: "Fiscal", VIEWER: "Somente leitura" })[role] || role;
}

function openUserModal(user = null) {
  const modal = document.querySelector("#user-modal");
  const permissions = user?.permissions || {};
  modal.innerHTML = `
    <div class="modal-backdrop"><section class="modal-card">
      <div class="panel-head"><div><p class="eyebrow">Acesso</p><h2>${user ? "Editar usuário" : "Novo usuário"}</h2></div><button class="icon-btn" type="button" data-close-modal>×</button></div>
      <form id="user-form" class="form">
        <div class="form-row">
          <label>Nome<input name="name" required value="${escapeAttr(user?.name || "")}"></label>
          <label>Login (e-mail)<input name="email" type="email" autocomplete="username" required value="${escapeAttr(user?.email || "")}"></label>
        </div>
        <div class="form-row">
          <label>Perfil<select name="role">${["ADMIN","MANAGER","SUPERVISOR","INSPECTOR","VIEWER"].map((role) => `<option value="${role}" ${user?.role === role ? "selected" : ""}>${roleLabel(role)}</option>`).join("")}</select></label>
          <label>${user ? "Nova senha (opcional)" : "Senha inicial"}<input name="password" type="password" minlength="8" ${user ? "" : "required"}></label>
        </div>
        <label class="switch-line"><input name="active" type="checkbox" ${user?.active !== false ? "checked" : ""}> Usuário ativo</label>
        <fieldset class="permission-grid"><legend>Funções disponíveis</legend>
          ${Object.entries(PERMISSION_KEYS).map(([key, label]) => `<label class="permission-option"><input type="checkbox" name="permission" value="${key}" ${user?.isDeveloper || permissions[key] ? "checked" : ""} ${user?.isDeveloper ? "disabled" : ""}> ${label}</label>`).join("")}
        </fieldset>
        <div class="action-row"><button class="btn ghost" type="button" data-close-modal>Cancelar</button><button class="btn primary" type="submit">Salvar usuário</button></div>
      </form>
    </section></div>`;
  modal.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => modal.innerHTML = ""));
  modal.querySelector("#user-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      email: String(form.get("email") || "").trim().toLowerCase(),
      name: String(form.get("name")),
      role: String(form.get("role")),
      active: form.get("active") === "on",
      permissions: Object.fromEntries(Object.keys(PERMISSION_KEYS).map((key) => [key, form.getAll("permission").includes(key)]))
    };
    if (form.get("password")) body.password = String(form.get("password"));
    try {
      await apiRequest(user ? `/api/admin/users/${user.id}` : "/api/admin/users", { method: user ? "PATCH" : "POST", body: JSON.stringify(body) });
      modal.innerHTML = "";
      await loadUsers();
    } catch (error) {
      alert(error.message);
    }
  });
}

function bindGlobalEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.view;
      if (next === "chatbot" && !hasPermission("inspections")) return;
      if (next === "chatbot") {
        state.editingRecordId = null;
        state.routeForm = createEmptyRoute();
      }
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
  if (state.view === "kilometers") bindKilometers();
  if (state.view === "records") bindRecords();
  if (state.view === "scales") bindScales();
  if (state.view === "employees") bindEmployees();
  if (state.view === "notices") bindNotices();
  if (state.view === "users") {
    document.querySelector("[data-action='new-user']")?.addEventListener("click", () => openUserModal());
    loadUsers();
  }

  bindRecordActions();
}

function bindRecordActions() {
  document.querySelectorAll("[data-select-all-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      const tagId = button.dataset.selectAllTag;
      const group = groupRecordsByTag(state.data.records).find((item) => item.key === tagId);
      if (!group) return;

      const filters = { ...defaultRecordFilters(), ...state.filters.records[tagId] };
      const visibleRecords = group.records.filter((record) => recordMatchesFilters(record, filters));
      const selectedTag = selectedRecords()[0]?.tag;
      if (selectedTag && selectedTag !== tagId) {
        state.selectedRecordIds.clear();
      }
      visibleRecords.forEach((record) => state.selectedRecordIds.add(record.id));
      render();
    });
  });

  document.querySelectorAll("[data-deselect-all-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      const tagId = button.dataset.deselectAllTag;
      state.data.records
        .filter((record) => record.tag === tagId)
        .forEach((record) => state.selectedRecordIds.delete(record.id));
      render();
    });
  });

  document.querySelectorAll("[data-record-select]").forEach((input) => {
    input.addEventListener("change", () => {
      const record = state.data.records.find((item) => item.id === input.dataset.recordSelect);
      if (!record) return;

      if (input.checked) {
        const selectedTag = selectedRecords()[0]?.tag;
        if (selectedTag && selectedTag !== record.tag) {
          input.checked = false;
          alert("Selecione apenas registros da mesma TAG para exportar juntos.");
          return;
        }
        state.selectedRecordIds.add(record.id);
      } else {
        state.selectedRecordIds.delete(record.id);
      }

      render();
    });
  });

  document.querySelector("[data-export-selected]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const records = selectedRecords();
    if (!records.length) return;

    button.disabled = true;
    button.textContent = "Gerando planilhas...";
    try {
      await exportRecordSelection(records);
    } finally {
      render();
    }
  });

  document.querySelector("[data-export-pdf-selected]")?.addEventListener("click", async () => {
    await exportRecordsPdf(selectedRecords());
  });

  document.querySelector("[data-clear-record-selection]")?.addEventListener("click", () => {
    state.selectedRecordIds.clear();
    render();
  });

  document.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const record = state.data.records.find((item) => item.id === button.dataset.export);
      if (record) exportSpreadsheet(record);
    });
  });

  document.querySelectorAll("[data-export-pdf]").forEach((button) => {
    button.addEventListener("click", async () => {
      const record = state.data.records.find((item) => item.id === button.dataset.exportPdf);
      if (record) await exportRecordsPdf([record]);
    });
  });

  document.querySelectorAll("[data-edit-record]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = state.data.records.find((item) => item.id === button.dataset.editRecord);
      if (!record || !hasPermission("editRecords")) return;
      state.editingRecordId = record.id;
      state.routeForm = {
        ...structuredClone(record),
        photos: Array.from({ length: 4 }, (_, index) => record.photos?.[index] || null)
      };
      state.view = "chatbot";
      render();
    });
  });

  document.querySelectorAll("[data-delete-record]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      const record = state.data.records.find((item) => item.id === button.dataset.deleteRecord);
      if (!record) return;
      if (!confirm(`Apagar a ronda de ${formatDate(record.date)}?`)) return;
      state.data.records = state.data.records.filter((item) => item.id !== record.id);
      state.selectedRecordIds.delete(record.id);
      button.disabled = true;
      await saveData();
      render();
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
    state.editingRecordId = null;
    state.routeForm = createEmptyRoute();
    render();
  });

  document.querySelector("[data-action='cancel-edit-record']")?.addEventListener("click", () => {
    state.editingRecordId = null;
    state.routeForm = createEmptyRoute();
    state.view = "records";
    render();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    updateRouteDraft();
    const missing = getChecklist().filter((item) => !item.ok);
    if (missing.length) {
      alert(`Ainda falta preencher: ${missing.map((item) => item.label).join(", ")}`);
      return;
    }

    if (state.editingRecordId) {
      const original = state.data.records.find((item) => item.id === state.editingRecordId);
      if (!original) {
        alert("O registro que estava sendo editado não foi encontrado.");
        return;
      }
      const record = normalizeRecord(state.routeForm, original);
      state.data.records = state.data.records.map((item) => item.id === record.id ? record : item);
    } else {
      state.data.records.push(normalizeRecord(state.routeForm));
    }
    await saveData();
    state.editingRecordId = null;
    state.routeForm = createEmptyRoute();
    state.view = "records";
    render();
  });
}

function bindRecords() {
  document.querySelectorAll("[data-record-filter]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      state.filters.records[form.dataset.tag] = {
        search: String(data.get("search") || "").trim(),
        dateFrom: String(data.get("dateFrom") || ""),
        dateTo: String(data.get("dateTo") || ""),
        shift: String(data.get("shift") || "all"),
        team: String(data.get("team") || "all"),
        occurrence: String(data.get("occurrence") || "all")
      };
      render();
    });
  });

  document.querySelectorAll("[data-clear-record-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.records[button.dataset.clearRecordFilter] = defaultRecordFilters();
      render();
    });
  });

}

function bindKilometers() {
  const form = document.querySelector("#km-form");
  const fileInput = form?.querySelector("input[name='odometerPhoto']");
  const preview = document.querySelector("#km-preview");
  if (!form || !fileInput || !preview) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const photo = await fileToDataUrl(file);
    preview.innerHTML = `<img src="${photo}" alt="Foto do hodômetro"><span>Foto anexada. Digite o KM manualmente.</span>`;
  });

  document.querySelector("[data-action='clear-km']")?.addEventListener("click", () => {
    state.editingKmId = null;
    render();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const photoFile = data.get("odometerPhoto");
    const existing = state.data.kmRecords.find((record) => record.id === state.editingKmId);
    const photo = photoFile instanceof File && photoFile.size
      ? await fileToDataUrl(photoFile)
      : existing?.photo || "";
    const kmValue = parseDecimal(data.get("kmValue"));
    if (!Number.isFinite(kmValue)) {
      alert("Informe um KM válido antes de salvar.");
      return;
    }

    const record = {
      id: crypto.randomUUID(),
      date: String(data.get("date") || today()),
      location: "engie",
      type: String(data.get("type") || "initial"),
      kmValue,
      note: String(data.get("note") || "").trim(),
      photo,
      createdBy: state.session.name,
      createdAt: new Date().toISOString(),
      status: "active",
      revisesId: existing?.id || null
    };
    if (existing) {
      existing.status = "superseded";
      existing.supersededAt = new Date().toISOString();
      existing.supersededBy = state.session.name;
    }
    state.data.kmRecords = [...state.data.kmRecords, record];
    state.editingKmId = null;
    await saveData();
    render();
  });

  document.querySelectorAll("[data-edit-km]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingKmId = button.dataset.editKm;
      render();
    });
  });

  document.querySelectorAll("[data-delete-km]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Arquivar este registro de KM? Ele continuará salvo no histórico.")) return;
      const record = state.data.kmRecords.find((item) => item.id === button.dataset.deleteKm);
      if (!record) return;
      record.status = "archived";
      record.archivedAt = new Date().toISOString();
      record.archivedBy = state.session.name;
      if (state.editingKmId === button.dataset.deleteKm) state.editingKmId = null;
      await saveData();
      render();
    });
  });

  document.querySelector("[data-export-km]")?.addEventListener("click", exportKmHistoryCsv);
}

function bindScales() {
  document.querySelectorAll("[data-scale]").forEach((input) => {
    input.addEventListener("change", async () => {
      if (!hasPermission("scales")) return;
      const scale = state.data.scales[Number(input.dataset.scale)];
      scale[input.dataset.field] = input.value;
      if (input.dataset.field === "team") ensureTeam(input.value);
      if (input.dataset.field === "employeeId") {
        scale.name = state.data.employees.find((employee) => employee.id === input.value)?.name || "";
      }
      await saveData();
      render();
    });
  });

  document.querySelector("#scale-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const employee = state.data.employees.find((item) => item.id === data.get("employeeId"));
    if (!employee) return;
    state.data.scales.push({
      id: crypto.randomUUID(),
      employeeId: employee.id,
      name: employee.name,
      shift: String(data.get("shift") || "Diurna"),
      team: String(data.get("team") || state.data.teams[0] || TEAMS[0])
    });
    ensureTeam(String(data.get("team") || ""));
    await saveData();
    render();
  });

  document.querySelectorAll("[data-delete-scale]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Remover este funcionário da escala?")) return;
      state.data.scales.splice(Number(button.dataset.deleteScale), 1);
      await saveData();
      render();
    });
  });
}

function bindEmployees() {
  document.querySelector("#employee-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const existing = state.data.employees.find((employee) => employee.id === state.editingEmployeeId);
    const employee = {
      id: existing?.id || crypto.randomUUID(),
      name: String(data.get("name") || "").trim(),
      registration: String(data.get("registration") || "").trim(),
      jobTitle: String(data.get("jobTitle") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      active: data.get("active") === "on"
    };
    state.data.employees = existing
      ? state.data.employees.map((item) => item.id === employee.id ? employee : item)
      : [...state.data.employees, employee];
    state.data.scales.forEach((scale) => {
      if (scale.employeeId === employee.id) scale.name = employee.name;
    });
    state.editingEmployeeId = null;
    await saveData();
    render();
  });

  document.querySelector("[data-cancel-employee]")?.addEventListener("click", () => {
    state.editingEmployeeId = null;
    render();
  });

  document.querySelectorAll("[data-edit-employee]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingEmployeeId = button.dataset.editEmployee;
      render();
    });
  });

  document.querySelectorAll("[data-delete-employee]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.deleteEmployee;
      if (state.data.scales.some((scale) => scale.employeeId === id)) {
        alert("Remova o funcionário da escala antes de excluí-lo.");
        return;
      }
      if (!confirm("Excluir este funcionário?")) return;
      state.data.employees = state.data.employees.filter((employee) => employee.id !== id);
      await saveData();
      render();
    });
  });
}

function bindNotices() {
  document.querySelector("#notice-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = currentNotice();
    const files = form.getAll("attachments").filter((file) => file instanceof File && file.size);
    const existingSize = (current?.attachments || []).reduce((total, attachment) => total + Number(attachment.size || 0), 0);
    const newSize = files.reduce((total, file) => total + file.size, 0);
    if (existingSize + newSize > 2_500_000) {
      alert("Os anexos deste aviso devem somar no máximo 2,5 MB.");
      return;
    }
    const newAttachments = await Promise.all(files.map(fileToStoredDocument));
    const notice = {
      id: state.editingNoticeId || crypto.randomUUID(),
      title: String(form.get("title") || "").trim(),
      body: String(form.get("body") || "").trim(),
      attachments: [...(current?.attachments || []), ...newAttachments],
      createdAt: current?.createdAt || new Date().toISOString()
    };

    if (state.editingNoticeId) {
      state.data.notices = state.data.notices.map((item) => item.id === notice.id ? notice : item);
    } else {
      state.data.notices.unshift(notice);
    }
    state.editingNoticeId = null;
    await saveData();
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
    arrivalRound1: String(data.get("arrivalRound1") || ""),
    arrivalRound2: String(data.get("arrivalRound2") || ""),
    team: String(data.get("team") || TEAMS[0])
  };
}

function normalizeRecord(form, original = null) {
  return {
    ...form,
    id: original?.id || crypto.randomUUID(),
    status: "concluído",
    client: CLIENTE,
    contract: CONTRATO,
    contractor: CONTRATADA,
    permanence: PERMANENCIA_MINUTOS,
    exitRound1: calcExit(form.arrivalRound1),
    exitRound2: calcExit(form.arrivalRound2),
    transcriptionResponsible: RESPONSAVEL_TRANSCRICAO,
    esomResponsible: RESPONSAVEL_ESOM,
    createdBy: original?.createdBy || state.session.name,
    createdAt: original?.createdAt || new Date().toISOString(),
    updatedBy: original ? state.session.name : undefined,
    updatedAt: original ? new Date().toISOString() : undefined
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
    { label: "Chegada da 1ª ronda", ok: Boolean(form.arrivalRound1) },
    { label: "Chegada da 2ª ronda", ok: tag?.rounds !== 2 || Boolean(form.arrivalRound2) },
    { label: "Horário compatível com o turno", ok: isRouteTimeCompatible(form, tag) },
    { label: `${photosRequired} fotos anexadas`, ok: form.photos.filter(Boolean).length >= photosRequired },
    { label: "Equipe selecionada", ok: Boolean(form.team) }
  ];
}

function selectedRecords() {
  const records = state.data.records
    .filter((record) => state.selectedRecordIds.has(record.id))
    .sort((a, b) => String(recordDateValue(a)).localeCompare(String(recordDateValue(b))));

  if (records.length !== state.selectedRecordIds.size) {
    state.selectedRecordIds = new Set(records.map((record) => record.id));
  }

  return records;
}

function recordExportPanel(records) {
  const tag = TAGS.find((item) => item.id === records[0]?.tag);
  const firstDate = records[0] ? recordDateValue(records[0]) : "";
  const lastDate = records.length ? recordDateValue(records[records.length - 1]) : "";
  const period = firstDate
    ? firstDate === lastDate ? formatDate(firstDate) : `${formatDate(firstDate)} a ${formatDate(lastDate)}`
    : "Nenhum registro selecionado";

  return `
    <section class="panel record-export-panel">
      <div class="record-export-copy">
        <p class="eyebrow">Exportação em lote</p>
        <h2>Uma planilha por TAG, com uma aba para cada dia</h2>
        <p>Marque os registros que devem sair juntos. Períodos maiores são separados em arquivos de até 30 dias e baixados juntos em um ZIP.</p>
      </div>
      <div class="record-export-summary">
        <span class="badge">${records.length} selecionado(s)</span>
        <strong>${escapeHtml(tag?.label || "Escolha uma TAG")}</strong>
        <small>${escapeHtml(period)}</small>
        <div class="record-export-actions">
          <button class="btn primary" type="button" data-export-selected ${records.length ? "" : "disabled"}>Exportar selecionados</button>
          <button class="btn ghost" type="button" data-export-pdf-selected ${records.length ? "" : "disabled"}>Exportar PDF</button>
          <button class="btn ghost" type="button" data-clear-record-selection ${records.length ? "" : "disabled"}>Limpar seleção</button>
        </div>
      </div>
    </section>
  `;
}

function groupRecordsByTag(records) {
  return TAGS.map((tag) => ({
    key: tag.id,
    title: tag.label,
    records: records
      .filter((record) => record.tag === tag.id)
      .slice()
      .sort((a, b) => String(recordDateValue(b)).localeCompare(String(recordDateValue(a))))
  }));
}

function tagRecordFolder(group, isOpen) {
  const filters = { ...defaultRecordFilters(), ...state.filters.records[group.key] };
  const filtered = group.records.filter((record) => recordMatchesFilters(record, filters));
  const selectedCount = group.records.filter((record) => state.selectedRecordIds.has(record.id)).length;
  return `
    <details class="records-folder tag-record-folder" ${isOpen ? "open" : ""}>
      <summary>
        <span>
          <strong>${escapeHtml(group.title)}</strong>
          <small>${group.records.length} registro(s) armazenado(s) · ${selectedCount} selecionado(s)</small>
        </span>
        <span class="badge">${filtered.length} exibido(s)</span>
      </summary>
      <div class="folder-content tag-folder-content">
        <form class="tag-filter-grid" data-record-filter data-tag="${escapeAttr(group.key)}">
          <label>Busca geral
            <input name="search" placeholder="Equipe, turno, responsável ou ocorrência" value="${escapeAttr(filters.search)}">
          </label>
          <label>Data inicial
            <input type="date" name="dateFrom" value="${escapeAttr(filters.dateFrom)}">
          </label>
          <label>Data final
            <input type="date" name="dateTo" value="${escapeAttr(filters.dateTo)}">
          </label>
          <label>Turno
            <select name="shift">
              <option value="all">Todos</option>
              ${SHIFTS.map((shift) => `<option value="${shift.id}" ${filters.shift === shift.id ? "selected" : ""}>${shift.label}</option>`).join("")}
            </select>
          </label>
          <label>Equipe
            <select name="team">
              <option value="all">Todas</option>
              ${state.data.teams.map((team) => `<option value="${escapeAttr(team)}" ${filters.team === team ? "selected" : ""}>${escapeHtml(team)}</option>`).join("")}
            </select>
          </label>
          <label>Ocorrência
            <select name="occurrence">
              <option value="all">Todas</option>
              <option value="with" ${filters.occurrence === "with" ? "selected" : ""}>Com ocorrência</option>
              <option value="without" ${filters.occurrence === "without" ? "selected" : ""}>Sem ocorrência</option>
            </select>
          </label>
          <div class="tag-filter-actions">
            <button class="btn primary" type="submit">Filtrar</button>
            <button class="btn ghost" type="button" data-clear-record-filter="${escapeAttr(group.key)}">Limpar</button>
          </div>
        </form>
        <div class="tag-selection-bar">
          <div>
            <strong>Seleção desta TAG</strong>
            <small>“Marcar tudo” considera somente os registros exibidos pelo filtro.</small>
          </div>
          <div class="tag-selection-actions">
            <button class="btn ghost" type="button" data-select-all-tag="${escapeAttr(group.key)}" ${filtered.length ? "" : "disabled"}>Marcar tudo</button>
            <button class="btn ghost" type="button" data-deselect-all-tag="${escapeAttr(group.key)}" ${selectedCount ? "" : "disabled"}>Desmarcar tudo</button>
          </div>
        </div>
        <div class="record-list">
          ${filtered.length ? filtered.map(recordCard).join("") : emptyState(`Nenhum registro encontrado na ${group.title} com os filtros selecionados.`)}
        </div>
      </div>
    </details>
  `;
}

function recordMatchesFilters(record, filters) {
  const search = normalizeText(filters.search);
  const tag = TAGS.find((item) => item.id === record.tag);
  const shift = shiftById(record.shift);
  const text = normalizeText([
    record.date,
    tag?.label,
    shift.label,
    record.team,
    record.createdBy,
    record.occurrenceRound1,
    record.occurrenceRound2,
    record.arrivalRound1,
    record.arrivalRound2
  ].join(" "));

  if (search && !text.includes(search)) return false;
  if (filters.dateFrom && record.date < filters.dateFrom) return false;
  if (filters.dateTo && record.date > filters.dateTo) return false;
  if (filters.shift !== "all" && record.shift !== filters.shift) return false;
  if (filters.team !== "all" && record.team !== filters.team) return false;
  if (filters.occurrence === "with" && !hasRecordOccurrence(record)) return false;
  if (filters.occurrence === "without" && hasRecordOccurrence(record)) return false;
  return true;
}

function defaultRecordFilters() {
  return { search: "", dateFrom: "", dateTo: "", shift: "all", team: "all", occurrence: "all" };
}

function hasRecordOccurrence(record) {
  return Boolean(String(record.occurrenceRound1 || "").trim() || String(record.occurrenceRound2 || "").trim());
}

function recordDateValue(record) {
  return record.date || String(record.createdAt || today()).slice(0, 10);
}

async function exportSpreadsheet(record) {
  await exportRecordSelection([record]);
}

async function exportRecordsPdf(records) {
  const selected = (records || []).filter(Boolean);
  if (!selected.length) return;
  if (!window.jspdf?.jsPDF) {
    alert("O gerador de PDF não foi carregado. Verifique a conexão e tente novamente.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const logo = await templateLogoDataUrl(selected[0].tag);
  for (let index = 0; index < selected.length; index += 1) {
    if (index) doc.addPage();
    const record = selected[index];
    const tag = TAGS.find((item) => item.id === record.tag);
    const shift = shiftById(record.shift);
    pdfCell(doc, 13, 10, 184, 25, `RELATÓRIO DIÁRIO DE RONDAS - ${(tag?.label || record.tag).toUpperCase()}`, {
      bold: true,
      size: 13,
      align: "center",
      fill: [255, 255, 255]
    });
    if (logo) {
      try {
        doc.addImage(logo, "JPEG", 16, 12, 25, 21, undefined, "FAST");
      } catch (error) {
        console.warn("Logotipo ignorado no PDF.", error);
      }
    }
    pdfCell(doc, 13, 35, 184, 12, `DATA: ${formatLongDate(record.date)} - TURNO ${shift.label.toUpperCase()} - ${shift.period}`, {
      bold: true,
      align: "center",
      size: 9,
      fill: [230, 230, 230]
    });
    pdfLabelValue(doc, 13, 47, 82, 8, 15, "CONTRATANTE", CLIENTE);
    pdfLabelValue(doc, 95, 47, 38, 8, 15, "CONTRATO", CONTRATO);
    pdfLabelValue(doc, 133, 47, 64, 8, 15, "CONTRATADA", CONTRATADA);
    pdfLabelValue(doc, 13, 70, 184, 8, 24, "SITUAÇÃO / OCORRÊNCIAS", occurrenceText(record), { valueSize: 8 });
    pdfLabelValue(doc, 13, 102, 184, 8, 13, "PARALISAÇÕES", "Sem paralisações.", { valueSize: 8 });
    pdfCell(doc, 13, 123, 184, 7, "REGISTRO FOTOGRÁFICO", {
      bold: true,
      size: 8,
      align: "center",
      fill: [230, 230, 230]
    });

    const photos = (record.photos || []).filter(Boolean).slice(0, 4);
    const photoLabels = record.tag === "tims"
      ? ["1ª RONDA - FOTO 1", "1ª RONDA - FOTO 2", "2ª RONDA - FOTO 1", "2ª RONDA - FOTO 2"]
      : ["1ª RONDA - FOTO 1", "1ª RONDA - FOTO 2", "1ª RONDA - FOTO 3", "1ª RONDA - FOTO 4"];
    for (let photoIndex = 0; photoIndex < 4; photoIndex += 1) {
      const column = photoIndex % 2;
      const row = Math.floor(photoIndex / 2);
      const x = 13 + column * 92;
      const y = 130 + row * 51;
      pdfCell(doc, x, y, 92, 7, photoLabels[photoIndex], {
        bold: true,
        size: 7,
        align: "center",
        fill: [240, 240, 240]
      });
      doc.rect(x, y + 7, 92, 44);
      if (photos[photoIndex]) {
        addPdfImageContained(doc, photos[photoIndex], x + 1, y + 8, 90, 42);
      }
    }

    const columns = record.tag === "tims"
      ? [
          ["CHEGADA 1ª RONDA", record.arrivalRound1],
          ["PERMANÊNCIA", formatDuration(PERMANENCIA_MINUTOS)],
          ["SAÍDA 1ª RONDA", record.exitRound1],
          ["CHEGADA 2ª RONDA", record.arrivalRound2],
          ["PERMANÊNCIA", formatDuration(PERMANENCIA_MINUTOS)],
          ["SAÍDA 2ª RONDA", record.exitRound2]
        ]
      : [
          ["CHEGADA 1ª RONDA", record.arrivalRound1],
          ["PERMANÊNCIA", formatDuration(PERMANENCIA_MINUTOS)],
          ["SAÍDA 1ª RONDA", record.exitRound1]
        ];
    const colWidth = 184 / columns.length;
    columns.forEach(([label, value], columnIndex) => {
      pdfCell(doc, 13 + columnIndex * colWidth, 232, colWidth, 15, `${label}\n${value || "-"}`, {
        bold: true,
        size: 7,
        align: "center"
      });
    });
    pdfCell(doc, 13, 247, 55, 24, `EQUIPE DE RONDA\n${teamLabel(record.team)}`, { size: 7, bold: true, align: "center" });
    pdfCell(doc, 68, 247, 75, 24, `RESPONSÁVEL PELA TRANSCRIÇÃO\n${RESPONSAVEL_TRANSCRICAO}`, { size: 6.5, align: "center" });
    pdfCell(doc, 143, 247, 54, 24, `RESPONSÁVEL ESOM\n${RESPONSAVEL_ESOM || "-"}`, { size: 7, align: "center" });
    doc.setFont(undefined, "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · ${index + 1}/${selected.length}`, 13, 280);
  }
  const first = selected[0];
  const suffix = selected.length === 1
    ? formatDate(first.date).replaceAll("/", "-")
    : `${selected.length}-registros`;
  doc.save(`Relatório de Rondas - ${suffix}.pdf`);
}

async function templateLogoDataUrl(tagId) {
  try {
    if (!window.JSZip) return "";
    const path = TEMPLATE_PATHS[tagId];
    if (!path) return "";
    const response = await fetch(path);
    if (!response.ok) return "";
    const zip = await window.JSZip.loadAsync(await response.arrayBuffer());
    const logo = zip.file("xl/media/image2.jpg");
    if (!logo) return "";
    return `data:image/jpeg;base64,${await logo.async("base64")}`;
  } catch (error) {
    console.warn("Não foi possível carregar o logotipo do modelo.", error);
    return "";
  }
}

function pdfLabelValue(doc, x, y, width, labelHeight, valueHeight, label, value, options = {}) {
  pdfCell(doc, x, y, width, labelHeight, label, {
    bold: true,
    size: 7,
    align: "center",
    fill: [230, 230, 230]
  });
  pdfCell(doc, x, y + labelHeight, width, valueHeight, value, {
    size: options.valueSize || 7,
    align: "center"
  });
}

function addPdfImageContained(doc, dataUrl, x, y, width, height) {
  try {
    const properties = doc.getImageProperties(dataUrl);
    const scale = Math.min(width / properties.width, height / properties.height);
    const renderedWidth = properties.width * scale;
    const renderedHeight = properties.height * scale;
    doc.addImage(
      dataUrl,
      imageFormat(dataUrl),
      x + (width - renderedWidth) / 2,
      y + (height - renderedHeight) / 2,
      renderedWidth,
      renderedHeight,
      undefined,
      "FAST"
    );
  } catch (error) {
    console.warn("Foto ignorada no PDF.", error);
  }
}

function pdfCell(doc, x, y, width, height, text, options = {}) {
  if (options.fill) {
    doc.setFillColor(...options.fill);
    doc.rect(x, y, width, height, "F");
  }
  doc.setDrawColor(70);
  doc.rect(x, y, width, height);
  doc.setTextColor(...(options.color || [25, 25, 25]));
  doc.setFontSize(options.size || 9);
  doc.setFont(undefined, options.bold ? "bold" : "normal");
  const lines = doc.splitTextToSize(String(text || ""), width - 4);
  const lineHeight = (options.size || 9) * 0.42;
  const textY = y + Math.max(4, (height - lines.length * lineHeight) / 2 + lineHeight);
  if (options.align === "center") {
    lines.forEach((line, lineIndex) => doc.text(line, x + width / 2, textY + lineIndex * lineHeight, { align: "center" }));
  } else {
    doc.text(lines, x + 2, textY);
  }
}

function imageFormat(dataUrl) {
  return String(dataUrl).startsWith("data:image/png") ? "PNG" : "JPEG";
}

async function exportRecordSelection(records) {
  if (!window.JSZip) {
    alert("O gerador de planilhas não foi carregado. Verifique a conexão com a internet e tente novamente.");
    return;
  }

  try {
    const selected = validateRecordSelection(records);
    const periods = groupRecordsIntoThirtyDayPeriods(selected);

    if (periods.length === 1) {
      const workbook = await buildTemplateWorkbookForRecords(periods[0].records);
      downloadBlob(workbook, workbookFileName(selected[0].tag, periods[0]));
      return;
    }

    const archive = new window.JSZip();
    for (const period of periods) {
      const workbook = await buildTemplateWorkbookForRecords(period.records);
      archive.file(workbookFileName(selected[0].tag, period), workbook);
    }

    const tag = TAGS.find((item) => item.id === selected[0].tag);
    const zipBlob = await archive.generateAsync({
      type: "blob",
      mimeType: "application/zip"
    });
    downloadBlob(zipBlob, `Relatórios de Rondas - ${sanitizeFileName(tag?.label || selected[0].tag)}.zip`);
  } catch (error) {
    console.error(error);
    alert(error.message || "Não foi possível gerar as planilhas no modelo enviado.");
  }
}

async function buildTemplateWorkbook(record) {
  return buildTemplateWorkbookForRecords([record]);
}

async function buildTemplateWorkbookForRecords(records) {
  const selected = validateRecordSelection(records);
  const templatePath = TEMPLATE_PATHS[selected[0].tag];
  if (!templatePath) throw new Error("TAG sem modelo de planilha.");

  const response = await fetch(templatePath);
  if (!response.ok) throw new Error("Modelo de planilha não encontrado.");

  const zip = await window.JSZip.loadAsync(await response.arrayBuffer());
  const workbook = await loadWorkbookContext(zip);
  await ensureWorkbookSheetCapacity(zip, workbook, selected.length);

  const sheets = Array.from(workbook.workbookDoc.getElementsByTagNameNS("*", "sheet"));
  const usedNames = new Set();
  const assignments = [];

  for (let index = 0; index < selected.length; index += 1) {
    const record = selected[index];
    const sheet = sheets[index];
    const relationId = sheetRelationshipId(sheet);
    const relation = findRelationship(workbook.relsDoc, relationId);
    if (!relation) throw new Error("Aba do modelo sem relacionamento.");

    const sheetPath = resolveZipPath(workbook.workbookPath, relation.getAttribute("Target"));
    const name = uniqueSheetName(record.date, usedNames);
    sheet.setAttribute("name", name);
    assignments.push({ sheet, relationId });
    await populateTemplateSheet(zip, sheetPath, record);
  }

  isolateWorkbookSheets(workbook.workbookDoc, workbook.relsDoc, assignments);
  zip.file(workbook.workbookPath, serializeXml(workbook.workbookDoc));
  zip.file(workbook.workbookRelsPath, serializeXml(workbook.relsDoc));

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

async function populateTemplateSheet(zip, sheetPath, record) {
  const sheetXml = await zip.file(sheetPath).async("string");
  const sheetDoc = parseXml(sheetXml);

  const shift = shiftById(record.shift);
  setInlineString(sheetDoc, "A3", `DATA: ${formatLongDate(record.date)} - TURNO ${shift.label.toUpperCase()} - ${shift.period}`);
  setInlineString(sheetDoc, "A5", CLIENTE);
  setInlineString(sheetDoc, "F5", CONTRATO);
  setInlineString(sheetDoc, "H5", CONTRATADA);
  setInlineString(sheetDoc, "A7", occurrenceText(record));
  setInlineString(sheetDoc, "A9", "Sem paralisações.");
  setNumber(sheetDoc, "A16", timeToExcel(record.arrivalRound1));
  setInlineString(sheetDoc, "C16", formatDuration(PERMANENCIA_MINUTOS));
  setNumber(sheetDoc, "E16", timeToExcel(record.exitRound1));

  if (record.tag === "tims") {
    setNumber(sheetDoc, "G16", timeToExcel(record.arrivalRound2));
    setInlineString(sheetDoc, "I16", formatDuration(PERMANENCIA_MINUTOS));
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
}

function validateRecordSelection(records) {
  const selected = (records || [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => {
      const dateOrder = String(recordDateValue(a)).localeCompare(String(recordDateValue(b)));
      return dateOrder || String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });

  if (!selected.length) throw new Error("Selecione pelo menos um registro para exportar.");
  const tags = new Set(selected.map((record) => record.tag));
  if (tags.size !== 1) throw new Error("Selecione apenas registros da mesma TAG.");
  return selected;
}

function groupRecordsIntoThirtyDayPeriods(records) {
  const selected = validateRecordSelection(records);
  const periods = [];

  selected.forEach((record) => {
    const date = recordDateValue(record);
    let period = periods[periods.length - 1];
    if (!period || date > period.windowEnd) {
      period = {
        start: date,
        end: date,
        windowEnd: addDaysToDateInput(date, 30),
        records: []
      };
      periods.push(period);
    }

    period.records.push(record);
    period.end = date;
  });

  return periods;
}

function addDaysToDateInput(value, days) {
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function workbookFileName(tagId, period) {
  const tag = TAGS.find((item) => item.id === tagId);
  const start = formatDate(period.start).replaceAll("/", "-");
  const end = formatDate(period.end).replaceAll("/", "-");
  return `Relatório de Rondas - ${sanitizeFileName(tag?.label || tagId)} - ${start} a ${end}.xlsx`;
}

function sanitizeFileName(value) {
  return String(value || "Rondas").replace(/[<>:"/\\|?*]/g, "-").trim();
}

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function loadWorkbookContext(zip) {
  const workbookPath = "xl/workbook.xml";
  const workbookRelsPath = "xl/_rels/workbook.xml.rels";
  const contentTypesPath = "[Content_Types].xml";
  const workbookDoc = parseXml(await zip.file(workbookPath).async("string"));
  const relsDoc = parseXml(await zip.file(workbookRelsPath).async("string"));
  const contentTypesDoc = parseXml(await zip.file(contentTypesPath).async("string"));
  return {
    workbookPath,
    workbookRelsPath,
    contentTypesPath,
    workbookDoc,
    relsDoc,
    contentTypesDoc
  };
}

async function ensureWorkbookSheetCapacity(zip, workbook, desiredCount) {
  let sheets = Array.from(workbook.workbookDoc.getElementsByTagNameNS("*", "sheet"));
  if (!sheets.length) throw new Error("Nenhuma aba encontrada no modelo.");

  const sourceSheet = sheets[0];
  while (sheets.length < desiredCount) {
    await cloneWorkbookSheet(zip, workbook, sourceSheet);
    sheets = Array.from(workbook.workbookDoc.getElementsByTagNameNS("*", "sheet"));
  }

  zip.file(workbook.contentTypesPath, serializeXml(workbook.contentTypesDoc));
}

async function cloneWorkbookSheet(zip, workbook, sourceSheet) {
  const sourceRelation = findRelationship(workbook.relsDoc, sheetRelationshipId(sourceSheet));
  if (!sourceRelation) throw new Error("Não foi possível duplicar a aba do modelo.");

  const sourceSheetPath = resolveZipPath(workbook.workbookPath, sourceRelation.getAttribute("Target"));
  const newSheetIndex = nextZipIndex(zip, /^xl\/worksheets\/sheet(\d+)\.xml$/);
  const newSheetPath = `xl/worksheets/sheet${newSheetIndex}.xml`;
  zip.file(newSheetPath, await zip.file(sourceSheetPath).async("uint8array"));

  const sourceSheetRelPath = relatedPathFor(sourceSheetPath);
  const sourceSheetRels = zip.file(sourceSheetRelPath);
  if (sourceSheetRels) {
    const sheetRelsDoc = parseXml(await sourceSheetRels.async("string"));
    const drawingRelation = Array.from(sheetRelsDoc.getElementsByTagNameNS("*", "Relationship"))
      .find((relation) => String(relation.getAttribute("Type") || "").endsWith("/drawing"));

    if (drawingRelation) {
      const sourceDrawingPath = resolveZipPath(sourceSheetPath, drawingRelation.getAttribute("Target"));
      const newDrawingPath = await cloneDrawingBundle(zip, workbook.contentTypesDoc, sourceDrawingPath);
      drawingRelation.setAttribute("Target", relativeZipPath(newSheetPath, newDrawingPath));
    }

    zip.file(relatedPathFor(newSheetPath), serializeXml(sheetRelsDoc));
  }

  addContentTypeOverride(
    workbook.contentTypesDoc,
    newSheetPath,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
  );

  const relationshipId = nextRelationshipId(workbook.relsDoc);
  const relationship = workbook.relsDoc.createElementNS(
    "http://schemas.openxmlformats.org/package/2006/relationships",
    "Relationship"
  );
  relationship.setAttribute("Id", relationshipId);
  relationship.setAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet");
  relationship.setAttribute("Target", relativeZipPath(workbook.workbookPath, newSheetPath));
  workbook.relsDoc.documentElement.appendChild(relationship);

  const sheetsNode = sourceSheet.parentNode;
  const newSheet = workbook.workbookDoc.createElementNS(
    "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "sheet"
  );
  newSheet.setAttribute("name", `Ronda ${newSheetIndex}`);
  newSheet.setAttribute("sheetId", String(nextSheetId(workbook.workbookDoc)));
  newSheet.setAttributeNS(
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "r:id",
    relationshipId
  );
  sheetsNode.appendChild(newSheet);
}

async function cloneDrawingBundle(zip, contentTypesDoc, sourceDrawingPath) {
  const newDrawingIndex = nextZipIndex(zip, /^xl\/drawings\/drawing(\d+)\.xml$/);
  const newDrawingPath = `xl/drawings/drawing${newDrawingIndex}.xml`;
  zip.file(newDrawingPath, await zip.file(sourceDrawingPath).async("uint8array"));

  const sourceDrawingRelsPath = relatedPathFor(sourceDrawingPath);
  const sourceDrawingRels = zip.file(sourceDrawingRelsPath);
  if (sourceDrawingRels) {
    const drawingRelsDoc = parseXml(await sourceDrawingRels.async("string"));
    const imageRelations = Array.from(drawingRelsDoc.getElementsByTagNameNS("*", "Relationship"))
      .filter((relation) => String(relation.getAttribute("Type") || "").endsWith("/image"));

    for (const relation of imageRelations) {
      const sourceMediaPath = resolveZipPath(sourceDrawingPath, relation.getAttribute("Target"));
      const extension = sourceMediaPath.split(".").pop() || "jpg";
      const newMediaIndex = nextZipIndex(zip, /^xl\/media\/image(\d+)\.[^.]+$/);
      const newMediaPath = `xl/media/image${newMediaIndex}.${extension}`;
      zip.file(newMediaPath, await zip.file(sourceMediaPath).async("uint8array"));
      relation.setAttribute("Target", relativeZipPath(newDrawingPath, newMediaPath));
    }

    zip.file(relatedPathFor(newDrawingPath), serializeXml(drawingRelsDoc));
  }

  addContentTypeOverride(
    contentTypesDoc,
    newDrawingPath,
    "application/vnd.openxmlformats-officedocument.drawing+xml"
  );
  return newDrawingPath;
}

function isolateWorkbookSheets(workbookDoc, relsDoc, assignments) {
  const keptSheets = new Set(assignments.map((assignment) => assignment.sheet));
  const keptRelationshipIds = new Set(assignments.map((assignment) => assignment.relationId));
  const sheetsNode = assignments[0].sheet.parentNode;

  Array.from(workbookDoc.getElementsByTagNameNS("*", "sheet"))
    .filter((sheet) => !keptSheets.has(sheet))
    .forEach((sheet) => sheetsNode.removeChild(sheet));

  assignments.forEach((assignment, index) => {
    assignment.sheet.setAttribute("sheetId", String(index + 1));
  });

  Array.from(relsDoc.getElementsByTagNameNS("*", "Relationship"))
    .filter((relation) => {
      const type = relation.getAttribute("Type") || "";
      return type.endsWith("/worksheet") && !keptRelationshipIds.has(relation.getAttribute("Id"));
    })
    .forEach((relation) => relation.parentNode.removeChild(relation));

  Array.from(workbookDoc.getElementsByTagNameNS("*", "definedNames"))
    .forEach((node) => node.parentNode.removeChild(node));

  const workbookViews = workbookDoc.getElementsByTagNameNS("*", "workbookView");
  Array.from(workbookViews).forEach((view) => {
    view.setAttribute("activeTab", "0");
    view.setAttribute("firstSheet", "0");
  });
}

function sheetRelationshipId(sheet) {
  return sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
    || sheet.getAttribute("r:id");
}

function findRelationship(relsDoc, relationshipId) {
  return Array.from(relsDoc.getElementsByTagNameNS("*", "Relationship"))
    .find((relation) => relation.getAttribute("Id") === relationshipId);
}

function nextRelationshipId(relsDoc) {
  const used = new Set(
    Array.from(relsDoc.getElementsByTagNameNS("*", "Relationship"))
      .map((relation) => relation.getAttribute("Id"))
  );
  let index = 1;
  while (used.has(`rId${index}`)) index += 1;
  return `rId${index}`;
}

function nextSheetId(workbookDoc) {
  return Array.from(workbookDoc.getElementsByTagNameNS("*", "sheet"))
    .reduce((max, sheet) => Math.max(max, Number(sheet.getAttribute("sheetId")) || 0), 0) + 1;
}

function nextZipIndex(zip, pattern) {
  return Object.keys(zip.files).reduce((max, path) => {
    const match = path.match(pattern);
    return match ? Math.max(max, Number(match[1]) || 0) : max;
  }, 0) + 1;
}

function addContentTypeOverride(doc, path, contentType) {
  const partName = `/${path}`;
  const existing = Array.from(doc.getElementsByTagNameNS("*", "Override"))
    .find((item) => item.getAttribute("PartName") === partName);
  if (existing) return;

  const override = doc.createElementNS(
    "http://schemas.openxmlformats.org/package/2006/content-types",
    "Override"
  );
  override.setAttribute("PartName", partName);
  override.setAttribute("ContentType", contentType);
  doc.documentElement.appendChild(override);
}

function uniqueSheetName(date, usedNames) {
  const base = sheetNameFromDate(date).slice(0, 31);
  let name = base;
  let suffix = 2;
  while (usedNames.has(name)) {
    const ending = `-${suffix}`;
    name = `${base.slice(0, 31 - ending.length)}${ending}`;
    suffix += 1;
  }
  usedNames.add(name);
  return name;
}

function relativeZipPath(fromPath, toPath) {
  const fromParts = fromPath.split("/").slice(0, -1);
  const toParts = toPath.split("/");
  while (fromParts.length && toParts.length && fromParts[0] === toParts[0]) {
    fromParts.shift();
    toParts.shift();
  }
  return `${"../".repeat(fromParts.length)}${toParts.join("/")}`;
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
      return { row, col, relId, anchor };
    })
    .filter((item) => item.relId && item.row >= 10)
    .sort((a, b) => a.row - b.row || a.col - b.col);

  imageAnchors.slice(0, validPhotos.length).forEach((anchor, index) => {
    const mediaRel = Array.from(drawingRelsDoc.getElementsByTagNameNS("*", "Relationship"))
      .find((item) => item.getAttribute("Id") === anchor.relId);
    if (!mediaRel) return;

    const mediaPath = resolveZipPath(drawingPath, mediaRel.getAttribute("Target"));
    const imageBytes = dataUrlBytes(validPhotos[index]);
    if (imageBytes) {
      tightenImageAnchor(anchor.anchor);
      zip.file(mediaPath, imageBytes);
    } else {
      console.warn(`Foto ${index + 1} ignorada na exportação: conteúdo inválido.`);
    }
  });
  zip.file(drawingPath, serializeXml(drawingDoc));
}

function tightenImageAnchor(anchor) {
  const from = anchor.getElementsByTagNameNS("*", "from")[0];
  const colOff = from?.getElementsByTagNameNS("*", "colOff")[0];
  const rowOff = from?.getElementsByTagNameNS("*", "rowOff")[0];
  if (colOff) colOff.textContent = "20000";
  if (rowOff) rowOff.textContent = "20000";

  const ext = anchor.getElementsByTagNameNS("*", "ext")[0];
  if (ext) {
    const cx = Number(ext.getAttribute("cx") || 0);
    const cy = Number(ext.getAttribute("cy") || 0);
    if (cx) ext.setAttribute("cx", String(Math.round(cx * 1.04)));
    if (cy) ext.setAttribute("cy", String(Math.round(cy * 1.04)));
  }
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

function timeToExcel(time) {
  if (!time) return 0;
  const [hour, minute] = time.split(":").map(Number);
  return Number(((hour * 60 + minute) / 1440).toFixed(8));
}

function minutesToExcel(minutes) {
  return Number((Number(minutes || 0) / 1440).toFixed(8));
}

function teamLabel(team) {
  return String(team || "").toLocaleUpperCase("pt-BR");
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

function dataUrlBytes(dataUrl) {
  try {
    const value = String(dataUrl || "");
    const content = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
    let base64 = content
      .replace(/\s+/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const remainder = base64.length % 4;
    if (remainder === 1) return null;
    if (remainder) base64 = base64.padEnd(base64.length + (4 - remainder), "=");

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch (error) {
    console.warn("Não foi possível decodificar uma foto para a planilha.", error);
    return null;
  }
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
  const canDelete = hasPermission("deleteRecords");
  const canEdit = hasPermission("editRecords");
  const occurrenceLabel = hasRecordOccurrence(record) ? "Com ocorrência" : "Sem ocorrência";
  const selected = state.selectedRecordIds.has(record.id);
  const selectedTag = selectedRecords()[0]?.tag;
  const selectionDisabled = Boolean(selectedTag && selectedTag !== record.tag);
  return `
    <article class="record-card ${selected ? "selected" : ""}">
      <label class="record-select">
        <input
          type="checkbox"
          data-record-select="${record.id}"
          ${selected ? "checked" : ""}
          ${selectionDisabled ? "disabled" : ""}
        >
        <span>${selectionDisabled ? "Outra TAG selecionada" : "Incluir na exportação"}</span>
      </label>
      <div>
        <span class="badge">${escapeHtml(tag?.label || "TAG")}</span>
        <h3>${formatDate(record.date)}</h3>
        <p>${escapeHtml(record.team)} · ${escapeHtml(shift.label)} · ${escapeHtml(record.arrivalRound1)} às ${escapeHtml(record.exitRound1)}</p>
        <small>${escapeHtml(occurrenceLabel)} · Criado por ${escapeHtml(record.createdBy || "Supervisor")}</small>
      </div>
      <div class="record-actions">
        <span>${record.photos.filter(Boolean).length} fotos</span>
        ${canEdit ? `<button class="btn ghost" type="button" data-edit-record="${record.id}">Editar registro</button>` : ""}
        <button class="btn ghost" type="button" data-export-pdf="${record.id}">Exportar PDF</button>
        <button class="btn ghost" type="button" data-export="${record.id}">Exportar somente este</button>
        ${canDelete ? `<button class="btn danger" type="button" data-delete-record="${record.id}">Apagar ronda</button>` : ""}
      </div>
    </article>
  `;
}

function kmCard(record) {
  const typeLabel = record.type === "final" ? "KM final" : "KM inicial";
  const statusLabel = record.status === "archived"
    ? "Arquivado"
    : record.status === "superseded" ? "Versão anterior" : "Ativo";
  return `
    <article class="record-card km-card ${record.status !== "active" ? "historical" : ""}">
      <div>
        <span class="badge">ENGIE · ${statusLabel}</span>
        <h3>${escapeHtml(formatKm(record.kmValue))}</h3>
        <p>${escapeHtml(typeLabel)} · ${formatDate(record.date)} · ${escapeHtml(record.note || "Sem observação")}</p>
        <small>${escapeHtml(record.createdBy || "Supervisor")}</small>
      </div>
      ${record.photo ? `<img src="${record.photo}" alt="Foto do hodômetro">` : ""}
      <div class="record-actions">
        ${record.status === "active" ? `
          <button class="btn ghost" type="button" data-edit-km="${record.id}">Corrigir</button>
          <button class="btn danger" type="button" data-delete-km="${record.id}">Arquivar</button>
        ` : ""}
      </div>
    </article>
  `;
}

function employeeCard(employee) {
  return `
    <article class="employee-card">
      <div>
        <span class="status-pill ${employee.active ? "active" : "inactive"}">${employee.active ? "Ativo" : "Inativo"}</span>
        <h3>${escapeHtml(employee.name)}</h3>
        <p>${escapeHtml(employee.jobTitle || "Cargo não informado")} · Matrícula: ${escapeHtml(employee.registration || "—")}</p>
        <small>${escapeHtml(employee.email || "Sem e-mail")} · ${escapeHtml(employee.phone || "Sem telefone")}</small>
      </div>
      <div class="record-actions">
        <button class="btn ghost" type="button" data-edit-employee="${employee.id}">Editar</button>
        <button class="btn danger" type="button" data-delete-employee="${employee.id}">Excluir</button>
      </div>
    </article>
  `;
}

function kmSummaryCard(summary) {
  return `
    <article class="km-summary">
      <div>
        <span class="badge">ENGIE</span>
        <strong>${formatDate(summary.date)}</strong>
      </div>
      <p>Inicial: ${escapeHtml(formatKm(summary.initial?.kmValue))}</p>
      <p>Final: ${escapeHtml(formatKm(summary.final?.kmValue))}</p>
      <h3>${summary.total === "" ? "Aguardando par" : escapeHtml(formatKm(summary.total))}</h3>
    </article>
  `;
}

function noticeCard(notice) {
  const adminTools = hasPermission("notices") ? `
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
        ${noticeAttachments(notice)}
        <small>${formatDate(notice.createdAt.slice(0, 10))}</small>
      </div>
      ${adminTools}
    </article>
  `;
}

function noticeAttachments(notice) {
  return (notice.attachments || []).map((attachment) => {
    const isImage = String(attachment.type || "").startsWith("image/");
    if (isImage) {
      return `
        <a class="notice-image-link" href="${attachment.dataUrl}" target="_blank" rel="noopener">
          <img class="notice-image" src="${attachment.dataUrl}" alt="${escapeAttr(attachment.name)}">
          <span>${escapeHtml(attachment.name)}</span>
        </a>
      `;
    }
    return `<a class="attachment-link" href="${attachment.dataUrl}" download="${escapeAttr(attachment.name)}">Baixar arquivo: ${escapeHtml(attachment.name)}</a>`;
  }).join("");
}

function teamDataList() {
  return `<datalist id="team-options">${state.data.teams.map((team) => `<option value="${escapeAttr(team)}"></option>`).join("")}</datalist>`;
}

function ensureTeam(team) {
  const value = String(team || "").trim();
  if (value && !state.data.teams.includes(value)) state.data.teams.push(value);
}

function exportKmHistoryCsv() {
  const headers = ["Data", "Tipo", "KM", "Observação", "Status", "Registrado por", "Registrado em", "Substitui registro"];
  const rows = state.data.kmRecords.map((record) => [
    record.date,
    record.type === "final" ? "KM final" : "KM inicial",
    record.kmValue,
    record.note || "",
    record.status || "active",
    record.createdBy || "",
    record.createdAt || "",
    record.revisesId || ""
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";"))
    .join("\r\n");
  downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), `Histórico de KM - ${today()}.csv`);
}

function photoInput(photo, index, tag) {
  const label = tag?.id === "tims"
    ? index < 2 ? `Foto ${index + 1} - 1ª ronda` : `Foto ${index + 1} - 2ª ronda`
    : `Foto ${index + 1} - 1ª ronda`;

  return `
    <label class="photo-box">
      ${photo ? `<img src="${photo}" alt="${label}">` : `<span>${label}<small>Use câmera ou arquivo</small></span>`}
      <span class="photo-actions">
        <span class="photo-action">Câmera<input type="file" accept="image/*" capture="environment" data-photo="${index}"></span>
        <span class="photo-action">Arquivo<input type="file" accept="image/*" data-photo="${index}"></span>
      </span>
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

function formatDuration(minutes) {
  const total = Math.max(0, Number(minutes) || 0);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
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

function buildKmSummaries() {
  const groups = new Map();
  state.data.kmRecords.filter((record) => record.status === "active").forEach((record) => {
    const key = `${record.date}|engie`;
    const current = groups.get(key) || { date: record.date, location: "engie", initial: null, final: null };
    if (record.type === "final") current.final = record;
    else current.initial = record;
    groups.set(key, current);
  });

  return Array.from(groups.values())
    .map((summary) => ({
      ...summary,
      total: summary.initial && summary.final ? calcKmTotal(summary.initial.kmValue, summary.final.kmValue) : ""
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export {
  buildTemplateWorkbookForRecords,
  groupRecordsIntoThirtyDayPeriods
};
