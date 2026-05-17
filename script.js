const psychologists = [
  {
    id: 1,
    nome: "Dra. Marina Lopes",
    email: "marina@portalterapia.com",
    crp: "CRP 06/123456",
    especialidade: "Terapia Cognitivo-Comportamental",
    descricao: "Atendimento para ansiedade, estresse e organizacao emocional.",
    horarios: ["09:00", "10:30", "14:00"]
  },
  {
    id: 2,
    nome: "Dr. Rafael Nunes",
    email: "rafael@portalterapia.com",
    crp: "CRP 06/654321",
    especialidade: "Ansiedade e Estresse",
    descricao: "Acolhimento para adultos em rotina de estudo, trabalho e mudancas.",
    horarios: ["10:30", "16:00"]
  },
  {
    id: 3,
    nome: "Dra. Beatriz Campos",
    email: "beatriz@portalterapia.com",
    crp: "CRP 06/889900",
    especialidade: "Psicologia Clínica",
    descricao: "Acompanhamento psicologico com foco em desenvolvimento pessoal.",
    horarios: ["09:00", "14:00", "16:00"]
  }
];

const state = {
  user: JSON.parse(localStorage.getItem("apo:user")) || null,
  token: localStorage.getItem("apo:token") || "",
  users: JSON.parse(localStorage.getItem("apo:users")) || [],
  appointments: JSON.parse(localStorage.getItem("apo:appointments")) || [
    {
      id: 1,
      psicologo: "Dra. Marina Lopes",
      psicologoId: 1,
      psicologoEmail: "marina@portalterapia.com",
      paciente: "Ana Souza",
      pacienteEmail: "ana@email.com",
      data: "2026-05-18",
      horario: "14:00",
      status: "confirmada"
    }
  ],
  messages: JSON.parse(localStorage.getItem("apo:messages")) || [
    {
      id: 1,
      remetente: "Dra. Marina Lopes",
      texto: "Sua consulta está confirmada. Enviarei o link da sala no horário combinado.",
      data: "2026-05-14"
    }
  ]
};

const API_BASE_URL = window.PORTAL_TERAPIA_API_URL || "http://localhost:3000/api";

function save() {
  localStorage.setItem("apo:user", JSON.stringify(state.user));
  localStorage.setItem("apo:token", state.token || "");
  localStorage.setItem("apo:users", JSON.stringify(state.users));
  localStorage.setItem("apo:appointments", JSON.stringify(state.appointments));
  localStorage.setItem("apo:messages", JSON.stringify(state.messages));
}

function $(selector) {
  return document.querySelector(selector);
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.erro || "Erro ao comunicar com a API.");
  }

  return data;
}

function perfilId(perfil) {
  return {
    Administrador: 1,
    Psicólogo: 2,
    Paciente: 3
  }[perfil] || 3;
}

function perfilNome(perfil_id) {
  return {
    1: "Administrador",
    2: "Psicólogo",
    3: "Paciente"
  }[Number(perfil_id)] || "Paciente";
}

function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const nascimento = new Date(`${dataNascimento}T00:00:00`);
  const agora = new Date();
  let idade = agora.getFullYear() - nascimento.getFullYear();
  const mes = agora.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && agora.getDate() < nascimento.getDate())) {
    idade -= 1;
  }
  return idade;
}

function normalizeUser(usuario) {
  return {
    id: usuario.id_usuario,
    nome: usuario.nome,
    email: usuario.email,
    perfil: perfilNome(usuario.perfil_id),
    crp: usuario.crp,
    especialidade: usuario.especialidade
  };
}

function formatCount(value, suffix = "") {
  const number = Number(value || 0);
  return `${number.toLocaleString("pt-BR")}${suffix}`;
}

function setStats({ profissionais, pacientes, especialidades }, source = "api") {
  $("#professionalsCount").textContent = formatCount(profissionais);
  $("#patientsCount").textContent = formatCount(pacientes);
  $("#specialtiesCount").textContent = formatCount(especialidades);

  document.querySelector(".stats-band").dataset.source = source;
}

async function loadStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/estatisticas`);
    if (!response.ok) throw new Error("API indisponivel");

    const stats = await response.json();
    setStats(stats, "api");
  } catch (error) {
    setStats({
      profissionais: psychologists.length,
      pacientes: state.appointments.length,
      especialidades: new Set(psychologists.map((item) => item.especialidade)).size
    }, "demo");
  }
}

async function loadPsychologists() {
  try {
    const data = await apiRequest("/usuarios/psicologos");
    if (!data.length) return;

    psychologists.splice(0, psychologists.length, ...data.map((item) => ({
      id: item.id_usuario,
      nome: item.nome,
      email: item.email,
      crp: item.crp || "CRP não informado",
      especialidade: item.especialidade || "Psicologia Clínica",
      descricao: "Profissional cadastrado no Portal Terapia.",
      horarios: ["09:00", "10:30", "14:00", "16:00"]
    })));
  } catch (error) {
    // Mantém os profissionais de demonstração quando a API não está disponível.
  }
}

function renderPsychologists() {
  const term = $("#searchInput").value.toLowerCase();
  const specialty = $("#specialtyFilter").value;
  const grid = $("#psychologistGrid");

  const filtered = psychologists.filter((item) => {
    const matchesTerm = `${item.nome} ${item.especialidade}`.toLowerCase().includes(term);
    const matchesSpecialty = !specialty || item.especialidade === specialty;
    return matchesTerm && matchesSpecialty;
  });

  grid.innerHTML = filtered.map((item) => `
    <article class="psychologist-card">
      <div>
        <h3>${item.nome}</h3>
        <p>${item.crp}</p>
      </div>
      <p>${item.descricao}</p>
      <div class="tag-row">
        <span class="tag">${item.especialidade}</span>
        ${item.horarios.map((horario) => `<span class="tag">${horario}</span>`).join("")}
      </div>
      <button class="primary-button" type="button" data-book="${item.id}">Agendar</button>
    </article>
  `).join("");

  document.querySelectorAll("[data-book]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.user) {
        $("#loginMessage").textContent = "Faça login ou cadastre-se para agendar uma consulta.";
        location.hash = "loginForm";
        return;
      }

      if (state.user.perfil !== "Paciente") {
        $("#scheduleMessage").textContent = "Apenas pacientes podem criar novos agendamentos.";
        location.hash = "agenda";
        return;
      }

      $("#schedulePsychologist").value = button.dataset.book;
      location.hash = "agendamento";
    });
  });
}

function renderSelects() {
  const options = psychologists.map((item) => (
    `<option value="${item.id}">${item.nome} - ${item.especialidade}</option>`
  )).join("");

  $("#schedulePsychologist").innerHTML = options;
  $("#messageRecipient").innerHTML = options;
}

function renderAppointments() {
  const list = $("#appointmentsList");

  if (!state.user) {
    list.innerHTML = `<div class="appointment-row"><span>Faça login para visualizar suas consultas agendadas.</span></div>`;
    return;
  }

  const appointments = getVisibleAppointments();

  if (!appointments.length) {
    list.innerHTML = `<div class="appointment-row"><span>Nenhuma consulta agendada para este perfil.</span></div>`;
    return;
  }

  list.innerHTML = appointments.map((item) => `
    <article class="appointment-row">
      <div>
        <strong>${item.data} às ${item.horario}</strong><br>
        <span>${item.paciente} com ${item.psicologo}</span>
      </div>
      <div class="appointment-actions">
        <span class="status ${item.status}">${item.status}</span>
        <button class="secondary-button compact-button" type="button" ${item.status === "cancelada" ? "disabled" : ""}>Acessar consulta</button>
      </div>
    </article>
  `).join("");
}

async function loadAppointments() {
  if (!state.user || !state.token) {
    renderAppointments();
    return;
  }

  try {
    const data = await apiRequest("/consultas");
    state.appointments = data.map((item) => ({
      id: item.id_consulta,
      psicologo: item.psicologo_nome,
      psicologoId: item.psicologo_id,
      paciente: item.paciente_nome,
      pacienteEmail: state.user.perfil === "Paciente" ? state.user.email : "",
      data: String(item.data_consulta).slice(0, 10),
      horario: String(item.horario).slice(0, 5),
      status: item.status
    }));
    save();
  } catch (error) {
    // Se a API cair, mantém a agenda local já carregada.
  }

  renderAppointments();
}

function getVisibleAppointments() {
  const user = state.user;
  if (!user) return [];

  if (user.perfil === "Administrador") {
    return state.appointments;
  }

  if (user.perfil === "Psicólogo") {
    return state.appointments.filter((item) => (
      item.psicologoEmail === user.email ||
      item.psicologo === user.nome ||
      item.psicologoId === user.psicologoId
    ));
  }

  return state.appointments.filter((item) => (
    item.pacienteEmail === user.email ||
    item.paciente === user.nome
  ));
}

function renderMessages() {
  const list = $("#messagesList");

  list.innerHTML = state.messages.map((item) => `
    <article class="message-row">
      <strong>${item.remetente}</strong>
      <span>${item.texto}</span>
      <small>${item.data}</small>
    </article>
  `).join("");
}

function renderAuthArea() {
  const authArea = $("#authArea");
  if (!authArea) return;

  if (!state.user) {
    authArea.innerHTML = `
      <a class="secondary-button compact-button" href="#loginForm">Login</a>
      <a class="primary-button compact-button" href="#registerForm">Cadastre-se</a>
    `;
    return;
  }

  authArea.innerHTML = `
    <span class="user-chip">${state.user.nome}</span>
    <button class="ghost-button compact-button" id="logoutButton" type="button">Sair</button>
  `;

  $("#logoutButton").addEventListener("click", () => {
    state.user = null;
    state.token = "";
    save();
    renderAuthArea();
    renderScheduleAccess();
    renderAppointments();
    $("#loginMessage").textContent = "Sessão encerrada.";
  });
}

function renderScheduleAccess() {
  const heroButton = $("#heroScheduleButton");
  const scheduleForm = $("#scheduleForm");
  const scheduleMessage = $("#scheduleMessage");

  if (heroButton) {
    heroButton.textContent = state.user
      ? state.user.perfil === "Paciente" ? "Agendar consulta" : "Ver agenda"
      : "Entrar para agendar";
    heroButton.href = state.user
      ? state.user.perfil === "Paciente" ? "#agendamento" : "#agenda"
      : "#loginForm";
  }

  if (scheduleForm) {
    const canSchedule = state.user?.perfil === "Paciente";
    scheduleForm.classList.toggle("is-locked", !canSchedule);
    scheduleForm.querySelectorAll("input, select, textarea, button").forEach((field) => {
      field.disabled = !canSchedule;
    });
  }

  if (scheduleMessage && !state.user) {
    scheduleMessage.textContent = "Faça login ou cadastre-se para liberar o agendamento.";
  } else if (scheduleMessage && state.user?.perfil !== "Paciente") {
    scheduleMessage.textContent = "Este perfil pode visualizar agenda, mas não criar consulta como paciente.";
  } else if (scheduleMessage && state.user?.perfil === "Paciente" && (
    scheduleMessage.textContent.includes("liberar") ||
    scheduleMessage.textContent.includes("perfil")
  )) {
    scheduleMessage.textContent = "";
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toggleProfessionalFields() {
  const isPsychologist = $("#profileSelect").value === "Psicólogo";
  const fields = $("#professionalFields");
  fields.hidden = !isPsychologist;
  fields.querySelectorAll("input").forEach((input) => {
    input.required = isPsychologist;
  });
}

function initForms() {
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim().toLowerCase();
    const senha = String(data.get("senha"));

    try {
      const response = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, senha })
      });

      state.token = response.token;
      state.user = normalizeUser(response.usuario);
      save();
      renderAuthArea();
      renderScheduleAccess();
      await loadAppointments();
      $("#loginMessage").textContent = `Sessão iniciada como ${state.user.nome}.`;
    } catch (error) {
      const registeredUser = state.users.find((item) => item.email === email && item.senha === senha);

      if (!registeredUser) {
        $("#loginMessage").textContent = error.message || "E-mail ou senha inválidos.";
        return;
      }

      state.user = {
        nome: registeredUser.nome,
        email,
        perfil: registeredUser.perfil,
        dataNascimento: registeredUser.dataNascimento,
        crp: registeredUser.crp,
        especialidade: registeredUser.especialidade
      };
      state.token = "";
      save();
      renderAuthArea();
      renderScheduleAccess();
      renderAppointments();
      $("#loginMessage").textContent = `Sessão iniciada como ${state.user.nome}.`;
    }
  });

  $("#registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim().toLowerCase();
    const senha = String(data.get("senha"));
    const confirmarSenha = String(data.get("confirmarSenha"));
    const perfil = data.get("perfil");

    if (senha !== confirmarSenha) {
      $("#registerMessage").textContent = "As senhas não conferem.";
      return;
    }

    if (state.users.some((item) => item.email === email)) {
      $("#registerMessage").textContent = "Este e-mail já está cadastrado.";
      return;
    }

    if (perfil === "Psicólogo" && (!data.get("crp") || !data.get("especialidade") || !data.get("documentoProfissional"))) {
      $("#registerMessage").textContent = "Informe CRP, especialidade e identificação profissional.";
      return;
    }

    const newUser = {
      nome: data.get("nome"),
      email,
      telefone: data.get("telefone"),
      dataNascimento: data.get("dataNascimento"),
      senha,
      perfil,
      crp: data.get("crp") || "",
      especialidade: data.get("especialidade") || "",
      documentoProfissional: data.get("documentoProfissional") || ""
    };

    try {
      await apiRequest("/auth/registro", {
        method: "POST",
        body: JSON.stringify({
          nome: newUser.nome,
          email: newUser.email,
          senha: newUser.senha,
          perfil_id: perfilId(newUser.perfil),
          telefone: newUser.telefone,
          idade: calcularIdade(newUser.dataNascimento),
          crp: newUser.crp,
          especialidade: newUser.especialidade
        })
      });

      const login = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: newUser.email, senha: newUser.senha })
      });

      state.token = login.token;
      state.user = normalizeUser(login.usuario);
      $("#registerMessage").textContent = "Cadastro criado no banco de dados.";
    } catch (error) {
      state.users.push(newUser);
      state.user = {
        ...newUser,
        senha: undefined
      };
      state.token = "";
      $("#registerMessage").textContent = "Cadastro salvo no protótipo local.";
    }

    save();
    await loadPsychologists();
    renderSelects();
    renderPsychologists();
    renderAuthArea();
    renderScheduleAccess();
    await loadAppointments();
  });

  $("#scheduleForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.user) {
      $("#scheduleMessage").textContent = "Faça login ou cadastre-se para agendar uma consulta.";
      location.hash = "loginForm";
      return;
    }

    if (state.user.perfil !== "Paciente") {
      $("#scheduleMessage").textContent = "Apenas pacientes podem criar novos agendamentos.";
      return;
    }

    const data = new FormData(event.currentTarget);
    const selected = psychologists.find((item) => String(item.id) === data.get("psicologo"));

    try {
      if (!state.token) throw new Error("Sem token da API.");

      await apiRequest("/consultas", {
        method: "POST",
        body: JSON.stringify({
          psicologo_id: Number(selected.id),
          data_consulta: data.get("data"),
          horario: data.get("horario"),
          observacoes: data.get("observacoes")
        })
      });

      await loadAppointments();
    } catch (error) {
      state.appointments.unshift({
        id: Date.now(),
        psicologo: selected.nome,
        psicologoId: selected.id,
        psicologoEmail: selected.email,
        paciente: state.user?.nome || "Paciente",
        pacienteEmail: state.user?.email || "",
        data: data.get("data"),
        horario: data.get("horario"),
        status: "agendada"
      });
    }

    save();
    renderAppointments();
    $("#scheduleMessage").textContent = "Consulta agendada com sucesso.";
  });

  $("#messageForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const selected = psychologists.find((item) => String(item.id) === data.get("destinatario"));

    state.messages.unshift({
      id: Date.now(),
      remetente: state.user?.nome || "Paciente",
      texto: data.get("conteudo"),
      data: today(),
      destinatario: selected.nome
    });

    save();
    renderMessages();
    event.currentTarget.reset();
  });

  $("#searchInput").addEventListener("input", renderPsychologists);
  $("#specialtyFilter").addEventListener("change", renderPsychologists);
  $("#profileSelect").addEventListener("change", toggleProfessionalFields);

  document.querySelectorAll("[data-requires-auth='true']").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (state.user) return;
      event.preventDefault();
      $("#loginMessage").textContent = "Faça login ou cadastre-se para acessar o agendamento.";
      location.hash = "loginForm";
    });
  });
}

async function init() {
  const birthDateInput = document.querySelector("input[name='dataNascimento']");
  const scheduleDateInput = document.querySelector("input[name='data']");

  if (birthDateInput) {
    birthDateInput.min = "1900-01-01";
    birthDateInput.max = today();
  }

  if (scheduleDateInput) {
    scheduleDateInput.min = today();
    scheduleDateInput.value = today();
  }

  await loadPsychologists();
  renderSelects();
  renderPsychologists();
  await loadAppointments();
  renderMessages();
  renderAuthArea();
  renderScheduleAccess();
  loadStats();
  initForms();
  toggleProfessionalFields();
}

init();
