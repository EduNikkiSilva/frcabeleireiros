/* =========================================================
   CONFIGURAÇÃO INICIAL
========================================================= */

let barbeiroId = null;
let editType = null;
let editId = null;
let diaSelecionadoHistorico = null;

/* =========================================================
   SESSÃO / LOGIN
========================================================= */

function checkSession() {
  const staffId = localStorage.getItem("staffId");

  if (!staffId) {
    window.location.href = "login.html";
    return;
  }

  barbeiroId = staffId;

  carregarBarbeiro();
  carregarReservas();
  carregarFerias();
  carregarPausas();
}

/* =========================================================
   CARREGAR NOME DO BARBEIRO
========================================================= */

async function carregarBarbeiro() {
  const { data } = await supabaseClient
    .from("barbeiros")
    .select("nome")
    .eq("id", barbeiroId)
    .single();

  if (data) {
    document.getElementById("bemvindo").textContent = `Olá, ${data.nome} 👋`;
  }
}

/* =========================================================
   RESERVAS
========================================================= */

async function carregarReservas() {
  const hoje = new Date().toISOString().split("T")[0];

  const { data } = await supabaseClient
    .from("reservas")
    .select("*")
    .eq("barbeiro_id", barbeiroId)
    .eq("data", hoje)
    .order("hora");

  renderReservas(data, "Sem marcações para hoje.");
}

async function carregarReservasPorDia(dataEscolhida) {
  const { data } = await supabaseClient
    .from("reservas")
    .select("*")
    .eq("barbeiro_id", barbeiroId)
    .eq("data", dataEscolhida)
    .order("hora");

  renderReservas(data, "Sem marcações neste dia.");

  const historicoLista = document.getElementById("historico-lista");
  historicoLista.textContent = `Histórico de ${dataEscolhida}: ${data?.length || 0} marcações.`;
}

function renderReservas(data, mensagemVazia) {
  const ul = document.getElementById("lista-reservas");
  ul.innerHTML = "";

  if (!data || !data.length) {
    ul.innerHTML = `<div class="list-empty">${mensagemVazia}</div>`;
    return;
  }

  data.forEach(r => {
    const div = document.createElement("div");
    div.className = "list-item";

    div.innerHTML = `
      <div>
        <strong>${r.data} · ${r.hora.slice(0, 5)}</strong>
        <span>${r.cliente_nome} (${r.servico})</span>
      </div>
      <button class="btn-delete-reserva" onclick="apagarReserva('${r.id}')">✖</button>
    `;

    ul.appendChild(div);
  });
}

/* =========================================================
   FÉRIAS
========================================================= */

async function carregarFerias() {
  const { data } = await supabaseClient
    .from("ferias")
    .select("*")
    .eq("barbeiro_id", barbeiroId)
    .order("data_inicio");

  const ul = document.getElementById("lista-ferias");
  ul.innerHTML = "";

  if (!data || !data.length) {
    ul.innerHTML = "<div class='list-empty'>Sem férias registadas.</div>";
    return;
  }

  data.forEach(f => {
    const div = document.createElement("div");
    div.className = "list-item";

    div.innerHTML = `
      <div><strong>${f.data_inicio} até ${f.data_fim}</strong></div>
      <div class="actions">
        <button class="btn-edit" onclick="editarFerias('${f.id}', '${f.data_inicio}', '${f.data_fim}')">Editar</button>
        <button class="btn-delete" onclick="apagarFerias('${f.id}')">Apagar</button>
      </div>
    `;

    ul.appendChild(div);
  });
}

/* =========================================================
   PAUSAS
========================================================= */

async function carregarPausas() {
  const { data } = await supabaseClient
    .from("pausas")
    .select("*")
    .eq("barbeiro_id", barbeiroId)
    .order("data")
    .order("hora_inicio");

  const ul = document.getElementById("lista-pausas");
  ul.innerHTML = "";

  if (!data || !data.length) {
    ul.innerHTML = "<div class='list-empty'>Sem pausas registadas.</div>";
    return;
  }

  data.forEach(p => {
    const div = document.createElement("div");
    div.className = "list-item";

    div.innerHTML = `
      <div>
        <strong>${p.data}</strong>
        <span>${p.hora_inicio.slice(0, 5)} - ${p.hora_fim.slice(0, 5)}</span>
      </div>
      <div class="actions">
        <button class="btn-edit" onclick="editarPausa('${p.id}', '${p.data}', '${p.hora_inicio}', '${p.hora_fim}')">Editar</button>
        <button class="btn-delete" onclick="apagarPausa('${p.id}')">Apagar</button>
      </div>
    `;

    ul.appendChild(div);
  });
}

/* =========================================================
   MODAL
========================================================= */

function resetModalFields() {
  ["modal-data1", "modal-data2", "modal-hora1", "modal-hora2"].forEach(id => {
    const el = document.getElementById(id);
    el.value = "";
    el.style.display = "block";
  });
}

function abrirModal() {
  document.getElementById("modal-bg").style.display = "flex";
}

function fecharModal() {
  document.getElementById("modal-bg").style.display = "none";
  resetModalFields();
}

/* =========================================================
   EDITAR FÉRIAS
========================================================= */

function editarFerias(id, inicio, fim) {
  editType = "ferias";
  editId = id;

  resetModalFields();

  document.getElementById("modal-title").textContent = "Editar férias";
  document.getElementById("modal-data1").value = inicio;
  document.getElementById("modal-data2").value = fim;

  document.getElementById("modal-hora1").style.display = "none";
  document.getElementById("modal-hora2").style.display = "none";

  abrirModal();
}

/* =========================================================
   EDITAR PAUSA
========================================================= */

function editarPausa(id, data, inicio, fim) {
  editType = "pausa";
  editId = id;

  resetModalFields();

  document.getElementById("modal-title").textContent = "Editar pausa";
  document.getElementById("modal-data1").value = data;
  document.getElementById("modal-data2").style.display = "none";

  document.getElementById("modal-hora1").value = inicio;
  document.getElementById("modal-hora2").value = fim;

  abrirModal();
}

/* =========================================================
   GUARDAR ALTERAÇÕES DO MODAL
========================================================= */

document.getElementById("modal-save").addEventListener("click", async () => {
  if (editType === "ferias") {
    const inicio = document.getElementById("modal-data1").value;
    const fim = document.getElementById("modal-data2").value;

    if (fim < inicio) {
      alert("A data de fim não pode ser anterior à data de início.");
      return;
    }

    await supabaseClient
      .from("ferias")
      .update({ data_inicio: inicio, data_fim: fim })
      .eq("id", editId);

    alert("Férias atualizadas com sucesso!");
    await carregarFerias();
  }

  if (editType === "pausa") {
    const data = document.getElementById("modal-data1").value;
    const inicio = document.getElementById("modal-hora1").value;
    const fim = document.getElementById("modal-hora2").value;

    if (fim <= inicio) {
      alert("A hora de fim deve ser posterior à hora de início.");
      return;
    }

    await supabaseClient
      .from("pausas")
      .update({ data, hora_inicio: inicio, hora_fim: fim })
      .eq("id", editId);

    alert("Pausa atualizada com sucesso!");
    await carregarPausas();
  }

  fecharModal();
});

/* =========================================================
   APAGAR FÉRIAS / PAUSAS / RESERVAS
========================================================= */

async function apagarFerias(id) {
  if (!confirm("Apagar férias?")) return;

  await supabaseClient.from("ferias").delete().eq("id", id);
  alert("Férias apagadas.");
  await carregarFerias();
}

async function apagarPausa(id) {
  if (!confirm("Apagar pausa?")) return;

  await supabaseClient.from("pausas").delete().eq("id", id);
  alert("Pausa apagada.");
  await carregarPausas();
}

async function apagarReserva(id) {
  if (!confirm("Tens a certeza que queres apagar esta reserva?")) return;

  await supabaseClient.from("reservas").delete().eq("id", id);

  const diaSelecionado = document.getElementById("historico-dia").value.trim();

  if (diaSelecionado !== "") {
    carregarReservasPorDia(diaSelecionado);
  } else {
    carregarReservas();
  }

  alert("Reserva apagada.");
}

/* =========================================================
   ADICIONAR FÉRIAS
========================================================= */

document.getElementById("btn-add-ferias").addEventListener("click", async () => {
  const inicio = document.getElementById("ferias-inicio").value;
  const fim = document.getElementById("ferias-fim").value;

  if (!inicio || !fim) {
    alert("Preenche as duas datas.");
    return;
  }

  if (fim < inicio) {
    alert("A data de fim não pode ser anterior à data de início.");
    return;
  }

  await supabaseClient.from("ferias").insert({
    barbeiro_id: barbeiroId,
    data_inicio: inicio,
    data_fim: fim
  });

  alert("Férias adicionadas com sucesso!");

  document.getElementById("ferias-inicio").value = "";
  document.getElementById("ferias-fim").value = "";

  await carregarFerias();
});

/* =========================================================
   ADICIONAR PAUSAS (INTERVALO)
========================================================= */

async function adicionarPausasIntervalo(barbeiroId, dataInicio, dataFim, horaInicio, horaFim) {
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);

  const pausas = [];

  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const dataFormatada = d.toISOString().split("T")[0];

    pausas.push({
      barbeiro_id: barbeiroId,
      data: dataFormatada,
      hora_inicio: horaInicio,
      hora_fim: horaFim
    });
  }

  const { error } = await supabaseClient.from("pausas").insert(pausas);
  return error;
}

document.getElementById("btn-add-pausa").addEventListener("click", async () => {
  const dataInicio = document.getElementById("pausa-data").value;
  const dataFim = document.getElementById("pausa-data-fim").value;
  const horaInicio = document.getElementById("pausa-inicio").value;
  const horaFim = document.getElementById("pausa-fim").value;

  if (!dataInicio || !dataFim || !horaInicio || !horaFim) {
    alert("Preenche todos os campos.");
    return;
  }

  if (dataFim < dataInicio) {
    alert("A data de fim não pode ser anterior à data de início.");
    return;
  }

  if (horaFim <= horaInicio) {
    alert("A hora de fim deve ser posterior à hora de início.");
    return;
  }

  const error = await adicionarPausasIntervalo(
    barbeiroId,
    dataInicio,
    dataFim,
    horaInicio,
    horaFim
  );

  if (error) {
    alert("Erro ao guardar pausas.");
    return;
  }

  alert("Pausas adicionadas com sucesso!");

  document.getElementById("pausa-data").value = "";
  document.getElementById("pausa-data-fim").value = "";
  document.getElementById("pausa-inicio").value = "";
  document.getElementById("pausa-fim").value = "";

  await carregarPausas();
});

/* =========================================================
   LOGOUT
========================================================= */

document.getElementById("logout-btn").addEventListener("click", async () => {
  localStorage.clear();
  window.location.href = "login.html";
});

/* =========================================================
   HISTÓRICO
========================================================= */

document.getElementById("btn-historico").addEventListener("click", () => {
  document.getElementById("historico-dia").style.display = "block";
});

document.getElementById("historico-dia").addEventListener("change", (e) => {
  diaSelecionadoHistorico = e.target.value;
  carregarReservasPorDia(diaSelecionadoHistorico);
});

/* =========================================================
   INATIVIDADE / REFRESH / FECHO
========================================================= */

let navegando = false;
let refreshing = false;

document.querySelectorAll("a").forEach(a => {
  a.addEventListener("click", () => {
    navegando = true;
  });
});

window.addEventListener("keydown", (e) => {
  if (e.key === "F5" || (e.ctrlKey && e.key === "r")) {
    refreshing = true;
  }
});

window.addEventListener("beforeunload", (e) => {
  if (!navegando) {
    refreshing = true;
  }
});

window.addEventListener("pagehide", async (event) => {
  if (!event.persisted && !navegando && !refreshing) {
    localStorage.clear();
  }
});

/* =========================================================
   TIMEOUT DE INATIVIDADE
========================================================= */

let inactivityTimer;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(async () => {
    alert("Sessão terminada por inatividade.");
    localStorage.clear();
    window.location.href = "login.html";
  }, 5 * 60 * 1000);
}

["mousemove", "mousedown", "keypress", "touchstart", "scroll"].forEach(event => {
  document.addEventListener(event, resetInactivityTimer);
});

resetInactivityTimer();

/* =========================================================
   INICIAR PAINEL
========================================================= */

checkSession();
