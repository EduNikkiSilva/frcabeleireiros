import { nhost } from './nhost.js';

let barbeiroId = null;
let editType = null;
let editId = null;

/* ---------------- MODAL ---------------- */

function abrirModal(tipo, id, dados) {
  editType = tipo;
  editId = id;

  document.getElementById("modal-bg").style.display = "flex";

  document.getElementById("modal-data1").style.display = "none";
  document.getElementById("modal-data2").style.display = "none";
  document.getElementById("modal-hora1").style.display = "none";
  document.getElementById("modal-hora2").style.display = "none";

  if (tipo === "ferias") {
    document.getElementById("modal-title").textContent = "Editar férias";
    document.getElementById("modal-data1").style.display = "block";
    document.getElementById("modal-data2").style.display = "block";
    document.getElementById("modal-data1").value = dados.data_inicio;
    document.getElementById("modal-data2").value = dados.data_fim;
  }

  if (tipo === "pausa") {
    document.getElementById("modal-title").textContent = "Editar pausa";
    document.getElementById("modal-data1").style.display = "block";
    document.getElementById("modal-hora1").style.display = "block";
    document.getElementById("modal-hora2").style.display = "block";
    document.getElementById("modal-data1").value = dados.data;
    document.getElementById("modal-hora1").value = dados.hora_inicio;
    document.getElementById("modal-hora2").value = dados.hora_fim;
  }
}

function fecharModal() {
  document.getElementById("modal-bg").style.display = "none";
}

/* ---------------- SESSÃO ---------------- */

async function checkSession() {
  const user = JSON.parse(localStorage.getItem("barbeiro"));

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  barbeiroId = user.id;

  await carregarBarbeiro();
  await carregarReservas();
  await carregarFerias();
  await carregarPausas();
  await carregarFeriasRanges();
  iniciarFlatpickrManual();
  iniciarFlatpickrFerias();
  iniciarFlatpickrPausa();
}

/* ---------------- CARREGAR DADOS ---------------- */

async function carregarBarbeiro() {
  const query = `
    query GetBarbeiro($id: uuid!) {
      barbeiros(where: { id: { _eq: $id } }) {
        nome
        username
        foto
      }
    }
  `;

  const response = await nhost.graphql.request(query, { id: barbeiroId });
  const data = response.data.barbeiros[0];

  if (data) {
    document.getElementById("bemvindo").textContent =
      "Olá, " + data.nome + " 👋";

    const contaUsername = document.getElementById("conta-username-atual");
    if (contaUsername) contaUsername.textContent = data.username;

    const contaAvatar = document.getElementById("conta-avatar");
    const contaAvatarFoto = document.getElementById("conta-avatar-foto");

    if (data.foto && contaAvatarFoto) {
      contaAvatarFoto.src = data.foto;
      contaAvatarFoto.style.display = "block";
      if (contaAvatar) contaAvatar.style.display = "none";
    } else if (contaAvatar) {
      contaAvatar.textContent = data.nome.charAt(0);
    }

    const logoutFoto = document.getElementById("logout-foto");
    if (logoutFoto && data.foto) {
      logoutFoto.src = data.foto;
    }
  }
}

async function carregarReservas() {
  const hoje = new Date().toISOString().split("T")[0];

  const query = `
    query ReservasHoje($id: uuid!, $data: date!) {
      reservas(where: {
        barbeiro_id: { _eq: $id },
        data: { _eq: $data }
      }, order_by: { hora: asc }) {
        id
        hora
        cliente_nome
        cliente_telemovel
        concluida
      }
    }
  `;

  const response = await nhost.graphql.request(query, {
    id: barbeiroId,
    data: hoje
  });

  const data = response.data.reservas;

  const ul = document.getElementById("lista-reservas");
  const resumo = document.getElementById("resumo-hoje");
  ul.innerHTML = "";

  if (!data || data.length === 0) {
    ul.innerHTML = "<div class='list-empty'>Sem marcações para hoje.</div>";
    resumo.textContent = "Hoje: sem marcações.";
    return;
  }

  const pendentes = data.filter(r => !r.concluida);
  const agora = new Date().toTimeString().slice(0, 5);
  const proxima = pendentes.find(r => r.hora.slice(0, 5) >= agora);

  resumo.innerHTML = proxima
    ? `Hoje: <strong>${data.length}</strong> marcação(ões) · Próxima às <strong>${proxima.hora.slice(0, 5)}</strong>`
    : `Hoje: <strong>${data.length}</strong> marcação(ões) · Todas já passaram ou concluídas`;

  data.forEach(r => {
    const div = document.createElement("div");
    div.className = "reserva-item" + (r.concluida ? " concluida" : "");
    div.innerHTML = `
      <span class="hora-badge">${r.hora.slice(0, 5)}</span>
      <div class="reserva-info">
        <strong>${r.cliente_nome}</strong>
        <a href="tel:${r.cliente_telemovel}">📞 ${r.cliente_telemovel}</a>
      </div>
      <button class="btn-concluir ${r.concluida ? 'ativo' : ''}" onclick="alternarConcluida('${r.id}', ${!r.concluida})" title="${r.concluida ? 'Marcar como não atendida' : 'Marcar como atendida'}">
        ✅
      </button>
    `;
    ul.appendChild(div);
  });
}

async function alternarConcluida(id, novoEstado) {
  const mutation = `
    mutation MarcarConcluida($id: uuid!, $concluida: Boolean!) {
      update_reservas_by_pk(pk_columns: { id: $id }, _set: { concluida: $concluida }) {
        id
      }
    }
  `;

  const response = await nhost.graphql.request(mutation, { id, concluida: novoEstado });

  if (response.error) {
    console.error("Erro ao atualizar reserva:", response.error);
    alert("Erro ao atualizar estado da reserva.");
    return;
  }

  await carregarReservas();
}

async function carregarFerias() {
  const query = `
    query Ferias($id: uuid!) {
      ferias(where: { barbeiro_id: { _eq: $id } }, order_by: { data_inicio: asc }) {
        id
        data_inicio
        data_fim
      }
    }
  `;

  const response = await nhost.graphql.request(query, { id: barbeiroId });
  const data = response.data.ferias;

  const ul = document.getElementById("lista-ferias");
  ul.innerHTML = "";

  if (!data || data.length === 0) {
    ul.innerHTML = "<div class='list-empty'>Sem férias registadas.</div>";
    return;
  }

  data.forEach(f => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div><strong>${f.data_inicio} até ${f.data_fim}</strong></div>
      <div class="actions">
        <button class="btn-small edit-btn" onclick='abrirModal("ferias", "${f.id}", ${JSON.stringify(f)})'>Editar</button>
        <button class="btn-small delete-btn" onclick='apagarFerias("${f.id}")'>Apagar</button>
      </div>
    `;
    ul.appendChild(div);
  });
}

async function carregarPausas() {
  const query = `
    query Pausas($id: uuid!) {
      pausas(where: { barbeiro_id: { _eq: $id } },
             order_by: [{ data: asc }, { hora_inicio: asc }]) {
        id
        data
        hora_inicio
        hora_fim
      }
    }
  `;

  const response = await nhost.graphql.request(query, { id: barbeiroId });
  const data = response.data.pausas;

  const ul = document.getElementById("lista-pausas");
  ul.innerHTML = "";

  if (!data || data.length === 0) {
    ul.innerHTML = "<div class='list-empty'>Sem pausas registadas.</div>";
    return;
  }

  const grupos = [];
  let grupoAtual = null;

  data.forEach(p => {
    const dataAtual = new Date(p.data);

    if (
      grupoAtual &&
      grupoAtual.hora_inicio === p.hora_inicio &&
      grupoAtual.hora_fim === p.hora_fim &&
      diaSeguinte(grupoAtual.dataFimObj, dataAtual)
    ) {
      grupoAtual.data_fim = p.data;
      grupoAtual.dataFimObj = dataAtual;
      grupoAtual.ids.push(p.id);
    } else {
      grupoAtual = {
        data_inicio: p.data,
        data_fim: p.data,
        dataFimObj: dataAtual,
        hora_inicio: p.hora_inicio,
        hora_fim: p.hora_fim,
        ids: [p.id]
      };
      grupos.push(grupoAtual);
    }
  });

  grupos.forEach(g => {
    const div = document.createElement("div");
    div.className = "list-item";

    const textoData = g.data_inicio === g.data_fim
      ? g.data_inicio
      : `${g.data_inicio} até ${g.data_fim}`;

    div.innerHTML = `
      <div>
        <strong>${textoData}</strong>
        <span>${g.hora_inicio} - ${g.hora_fim}</span>
      </div>
      <div class="actions">
        <button class="btn-small delete-btn" onclick='apagarGrupoPausas(${JSON.stringify(g.ids)})'>Apagar</button>
      </div>
    `;
    ul.appendChild(div);
  });
}

function diaSeguinte(dataAnterior, dataAtual) {
  const diff = (dataAtual - dataAnterior) / (1000 * 60 * 60 * 24);
  return diff === 1;
}

async function apagarGrupoPausas(ids) {
  if (!confirm("Apagar todas as pausas deste período?")) return;

  const mutation = `
    mutation DeletePausas($ids: [uuid!]!) {
      delete_pausas(where: { id: { _in: $ids } }) {
        affected_rows
      }
    }
  `;

  const response = await nhost.graphql.request(mutation, { ids });

  if (response.error) {
    console.error("Erro ao apagar pausas:", response.error);
    alert("Erro ao apagar pausas.");
    return;
  }

  await carregarPausas();
}

/* ---------------- ADICIONAR ---------------- */

document.getElementById("btn-add-ferias").addEventListener("click", async () => {
  const datas = feriasPicker.selectedDates;

  if (datas.length < 2) {
    alert("Escolhe o dia de início e o dia de fim das férias.");
    return;
  }

  const inicio = feriasPicker.formatDate(datas[0], "Y-m-d");
  const fim = feriasPicker.formatDate(datas[1], "Y-m-d");

  const mutation = `
    mutation AddFerias($obj: ferias_insert_input!) {
      insert_ferias_one(object: $obj) { id }
    }
  `;

  const response = await nhost.graphql.request(mutation, {
    obj: {
      barbeiro_id: barbeiroId,
      data_inicio: inicio,
      data_fim: fim
    }
  });

  if (response.error) {
    console.error("Erro ao adicionar férias:", response.error);
    alert("Erro ao guardar férias.");
    return;
  }

  feriasPicker.clear();
  await carregarFerias();
  await carregarFeriasRanges();
  if (manualPicker) manualPicker.redraw();
});

document.getElementById("btn-add-pausa").addEventListener("click", async () => {
  const datas = pausaPicker.selectedDates;
  const horaInicio = document.getElementById("pausa-inicio").value;
  const horaFim = document.getElementById("pausa-fim").value;

  if (datas.length < 2) {
    alert("Escolhe o dia de início e o dia de fim da pausa.");
    return;
  }

  if (!horaInicio || !horaFim) {
    alert("Preenche as horas de início e fim.");
    return;
  }

  if (horaFim <= horaInicio) {
    alert("A hora de fim deve ser posterior à hora de início.");
    return;
  }

  const dataInicio = pausaPicker.formatDate(datas[0], "Y-m-d");
  const dataFim = pausaPicker.formatDate(datas[1], "Y-m-d");

  const pausas = [];
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);

  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    pausas.push({
      barbeiro_id: barbeiroId,
      data: d.toISOString().split("T")[0],
      hora_inicio: horaInicio,
      hora_fim: horaFim
    });
  }

  const mutation = `
    mutation AddPausas($objs: [pausas_insert_input!]!) {
      insert_pausas(objects: $objs) {
        affected_rows
      }
    }
  `;

  const response = await nhost.graphql.request(mutation, { objs: pausas });

  if (response.error) {
    console.error("Erro ao adicionar pausas:", response.error);
    alert("Erro ao guardar pausas.");
    return;
  }

  pausaPicker.clear();
  document.getElementById("pausa-inicio").value = "";
  document.getElementById("pausa-fim").value = "";

  await carregarPausas();
});

/* ---------------- CÁLCULO DE FERIADOS (fixos + móveis + municipal) ---------------- */

function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(ano, mes - 1, dia);
}

function formatarData(date) {
  return date.toISOString().split("T")[0];
}

function adicionarDias(date, dias) {
  const nova = new Date(date);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

function gerarFeriados(ano) {
  const pascoa = calcularPascoa(ano);

  return [
    // Fixos nacionais obrigatórios
    `${ano}-01-01`, // Ano Novo
    `${ano}-04-25`, // Dia da Liberdade
    `${ano}-05-01`, // Dia do Trabalhador
    `${ano}-06-10`, // Dia de Portugal
    `${ano}-08-15`, // Assunção de Nossa Senhora
    `${ano}-10-05`, // Implantação da República
    `${ano}-11-01`, // Todos os Santos
    `${ano}-12-01`, // Restauração da Independência
    `${ano}-12-08`, // Imaculada Conceição
    `${ano}-12-25`, // Natal

    // Móveis nacionais obrigatórios (baseados na Páscoa)
    formatarData(adicionarDias(pascoa, -2)), // Sexta-feira Santa
    formatarData(pascoa),                     // Domingo de Páscoa
    formatarData(adicionarDias(pascoa, 60)), // Corpo de Deus

    // Municipal - Castelo Branco (Nossa Senhora de Mércoles)
    // Segunda terça-feira depois da Páscoa = Páscoa + 16 dias
    formatarData(adicionarDias(pascoa, 16))
  ];
}

const feriados = [
  ...gerarFeriados(new Date().getFullYear()),
  ...gerarFeriados(new Date().getFullYear() + 1)
];

/* ---------------- FÉRIAS DO BARBEIRO (para bloquear no calendário) ---------------- */

let feriasRanges = [];

async function carregarFeriasRanges() {
  const query = `
    query FeriasRanges($id: uuid!) {
      ferias(where: { barbeiro_id: { _eq: $id } }) {
        data_inicio
        data_fim
      }
    }
  `;

  const response = await nhost.graphql.request(query, { id: barbeiroId });
  const data = response.data?.ferias || [];

  feriasRanges = data.map(f => ({
    inicio: new Date(f.data_inicio + "T00:00:00"),
    fim: new Date(f.data_fim + "T00:00:00")
  }));
}

function estaEmFerias(date) {
  return feriasRanges.some(r => date >= r.inicio && date <= r.fim);
}

/* ---------------- GERAR HORAS DISPONÍVEIS (MARCAÇÃO MANUAL) ---------------- */

function gerarHorarioBase(diaSemana) {
  const horas = [];
  let inicio, fim;

  if (diaSemana >= 1 && diaSemana <= 5) {
    inicio = 9;
    fim = 19;
  } else if (diaSemana === 6) {
    inicio = 8;
    fim = 18;
  } else {
    return [];
  }

  for (let h = inicio; h <= fim; h++) {
    horas.push(`${String(h).padStart(2, "0")}:00`);
    if (h !== fim) horas.push(`${String(h).padStart(2, "0")}:30`);
  }

  return horas;
}

async function verificarPausasManual(dataSelecionada) {
  const query = `
    query PausasManual($id: uuid!, $data: date!) {
      pausas(where: {
        barbeiro_id: { _eq: $id },
        data: { _eq: $data }
      }) {
        hora_inicio
        hora_fim
      }
    }
  `;

  const response = await nhost.graphql.request(query, {
    id: barbeiroId,
    data: dataSelecionada
  });

  const pausas = response.data?.pausas;

  return pausas?.map(p => ({
    inicio: p.hora_inicio.substring(0, 5),
    fim: p.hora_fim.substring(0, 5)
  })) || [];
}

async function obterHorasReservadasManual(dataSelecionada) {
  const query = `
    query ReservasManual($id: uuid!, $data: date!) {
      reservas(where: {
        barbeiro_id: { _eq: $id },
        data: { _eq: $data }
      }) {
        hora
      }
    }
  `;

  const response = await nhost.graphql.request(query, {
    id: barbeiroId,
    data: dataSelecionada
  });

  const reservas = response.data?.reservas;

  return reservas?.map(r => r.hora.substring(0, 5)) || [];
}

async function gerarHorasManual(dataSelecionada) {
  const select = document.getElementById("manual-hora");

  if (!dataSelecionada) {
    select.innerHTML = '<option value="">Escolhe a data primeiro</option>';
    return;
  }

  const diaSemana = new Date(dataSelecionada + "T00:00:00").getDay();
  const horasBase = gerarHorarioBase(diaSemana);

  if (!horasBase.length) {
    select.innerHTML = '<option value="">Domingo indisponível</option>';
    return;
  }

  const pausas = await verificarPausasManual(dataSelecionada);
  const horasReservadas = await obterHorasReservadasManual(dataSelecionada);

  const horasDisponiveis = horasBase.filter(hora => {
    if (horasReservadas.includes(hora)) return false;
    const emPausa = pausas.some(p => hora >= p.inicio && hora <= p.fim);
    if (emPausa) return false;
    return true;
  });

  if (!horasDisponiveis.length) {
    select.innerHTML = '<option value="">Sem horários disponíveis</option>';
    return;
  }

  select.innerHTML = '<option value="">Escolhe a hora</option>';
  horasDisponiveis.forEach(h => {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = h;
    select.appendChild(opt);
  });
}

/* ---------------- FLATPICKR (MARCAÇÃO MANUAL) ---------------- */

let manualPicker = null;

function iniciarFlatpickrManual() {
  manualPicker = flatpickr("#manual-data", {
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: [
      d => d.getDay() === 0,
      d => estaEmFerias(d),
      ...feriados
    ],
    onChange: function (selectedDates, dateStr) {
      gerarHorasManual(dateStr);
    },
    onDayCreate: function (dObj, dStr, fp, dayElem) {
      if (dayElem.classList.contains("flatpickr-disabled")) {
        dayElem.addEventListener("click", () => {
          const dia = dayElem.dateObj;

          if (dia.getDay() === 0) {
            mostrarMensagem("Domingo está encerrado.");
          } else if (estaEmFerias(dia)) {
            mostrarMensagem("Estás de férias nesta data.");
          } else {
            mostrarMensagem("Feriado - indisponível.");
          }
        });
      }
    }
  });
}

/* ---------------- FLATPICKR (FÉRIAS - INTERVALO) ---------------- */

let feriasPicker = null;

function iniciarFlatpickrFerias() {
  feriasPicker = flatpickr("#ferias-range", {
    mode: "range",
    dateFormat: "Y-m-d",
    minDate: "today"
  });
}

/* ---------------- FLATPICKR (PAUSAS - INTERVALO) ---------------- */
/* ---------------- FLATPICKR (PAUSAS - INTERVALO + HORAS) ---------------- */
let pausaPicker = null;

function iniciarFlatpickrPausa() {
  pausaPicker = flatpickr("#pausa-range", {
    mode: "range",
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: [
      d => d.getDay() === 0
    ],
    onDayCreate: function (dObj, dStr, fp, dayElem) {
      if (dayElem.classList.contains("flatpickr-disabled")) {
        dayElem.addEventListener("click", () => {
          mostrarMensagem("Domingo está encerrado.");
        });
      }
    }
  });

  flatpickr("#pausa-inicio", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 30,
    minTime: "08:00",
    maxTime: "19:00"
  });

  flatpickr("#pausa-fim", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 30,
    minTime: "08:00",
    maxTime: "19:00"
  });
}
/* ---------------- REGISTAR MARCAÇÃO MANUAL (TELEFONE) ---------------- */

document.getElementById("btn-add-manual").addEventListener("click", async () => {
  const data = document.getElementById("manual-data").value;
  const hora = document.getElementById("manual-hora").value;
  const servico = document.getElementById("manual-servico").value;
  const cliente_nome = document.getElementById("manual-nome").value.trim();
  const cliente_telemovel = document.getElementById("manual-telemovel").value.trim();

  if (!data || !hora || !servico || !cliente_nome || !cliente_telemovel) {
    alert("Preenche todos os campos.");
    return;
  }

  const mutation = `
    mutation CriarReservaManual($obj: reservas_insert_input!) {
      insert_reservas_one(object: $obj) {
        id
      }
    }
  `;

  const response = await nhost.graphql.request(mutation, {
    obj: {
      barbeiro_id: barbeiroId,
      data,
      hora,
      servico,
      cliente_nome,
      cliente_telemovel
    }
  });

  if (response.error) {
    console.error("Erro ao registar marcação manual:", response.error);
    alert("Erro ao registar marcação.");
    return;
  }

  alert("Marcação registada com sucesso!");

  document.getElementById("manual-data").value = "";
  document.getElementById("manual-hora").innerHTML = '<option value="">Escolhe a data primeiro</option>';
  document.getElementById("manual-nome").value = "";
  document.getElementById("manual-telemovel").value = "";

  await carregarReservas();
});

/* ---------------- APAGAR ---------------- */

async function apagarFerias(id) {
  const mutation = `
    mutation DeleteFerias($id: uuid!) {
      delete_ferias_by_pk(id: $id) { id }
    }
  `;

  const response = await nhost.graphql.request(mutation, { id });

  if (response.error) {
    console.error("Erro ao apagar férias:", response.error);
    alert("Erro ao apagar férias.");
    return;
  }

  await carregarFerias();
  await carregarFeriasRanges();
  if (manualPicker) manualPicker.redraw();
}

async function apagarPausa(id) {
  const mutation = `
    mutation DeletePausa($id: uuid!) {
      delete_pausas_by_pk(id: $id) { id }
    }
  `;

  const response = await nhost.graphql.request(mutation, { id });

  if (response.error) {
    console.error("Erro ao apagar pausa:", response.error);
    alert("Erro ao apagar pausa.");
    return;
  }

  await carregarPausas();
}

/* ---------------- EDITAR (MODAL) ---------------- */

document.getElementById("modal-save").addEventListener("click", async () => {

  if (editType === "ferias") {
    const mutation = `
      mutation UpdateFerias($id: uuid!, $obj: ferias_set_input!) {
        update_ferias_by_pk(pk_columns: { id: $id }, _set: $obj) { id }
      }
    `;

    await nhost.graphql.request(mutation, {
      id: editId,
      obj: {
        data_inicio: document.getElementById("modal-data1").value,
        data_fim: document.getElementById("modal-data2").value
      }
    });

    await carregarFerias();
    await carregarFeriasRanges();
    if (manualPicker) manualPicker.redraw();
    mostrarMensagem("Férias atualizadas com sucesso");
  }

  if (editType === "pausa") {
    const mutation = `
      mutation UpdatePausa($id: uuid!, $obj: pausas_set_input!) {
        update_pausas_by_pk(pk_columns: { id: $id }, _set: $obj) { id }
      }
    `;

    await nhost.graphql.request(mutation, {
      id: editId,
      obj: {
        data: document.getElementById("modal-data1").value,
        hora_inicio: document.getElementById("modal-hora1").value,
        hora_fim: document.getElementById("modal-hora2").value
      }
    });

    await carregarPausas();
    mostrarMensagem("Pausa atualizada com sucesso");
  }

  fecharModal();
});

/* ---------------- MENSAGEM DE SUCESSO ---------------- */

function mostrarMensagem(texto) {
  const msg = document.createElement("div");
  msg.textContent = texto;
  msg.style.position = "fixed";
  msg.style.bottom = "25px";
  msg.style.right = "25px";
  msg.style.background = "#111827";
  msg.style.color = "white";
  msg.style.padding = "12px 18px";
  msg.style.borderRadius = "8px";
  msg.style.boxShadow = "0 10px 25px rgba(0,0,0,0.25)";
  msg.style.opacity = "0";
  msg.style.transition = "opacity 0.3s ease";

  document.body.appendChild(msg);

  setTimeout(() => msg.style.opacity = "1", 50);
  setTimeout(() => {
    msg.style.opacity = "0";
    setTimeout(() => msg.remove(), 300);
  }, 2000);
}

/* ---------------- LOGOUT ---------------- */

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("barbeiro");
  window.location.href = "login.html";
});

/* ---------------- ALTERAR DADOS DE ACESSO (CONTA) ---------------- */

document.getElementById("btn-guardar-conta").addEventListener("click", async () => {
  const btnGuardarConta = document.getElementById("btn-guardar-conta");
  const passwordAtual = document.getElementById("conta-password-atual").value;
  const novoUsername = document.getElementById("conta-novo-username").value.trim();
  const novaPassword = document.getElementById("conta-nova-password").value;
  const confirmarPassword = document.getElementById("conta-confirmar-password").value;

  if (!passwordAtual) {
    alert("Introduz a tua password atual para confirmar a alteração.");
    return;
  }

  if (!novoUsername && !novaPassword) {
    alert("Preenche o novo username e/ou a nova password.");
    return;
  }

  if (novaPassword && novaPassword !== confirmarPassword) {
    alert("As passwords não coincidem.");
    return;
  }

  // Construir o objeto só com os campos que o barbeiro quer mesmo alterar
  const alteracoes = {};
  if (novoUsername) alteracoes.username = novoUsername;
  if (novaPassword) alteracoes.password = novaPassword;

  btnGuardarConta.disabled = true;
  btnGuardarConta.textContent = "A guardar...";

  const mutation = `
    mutation AlterarConta($id: uuid!, $passwordAtual: String!, $obj: barbeiros_set_input!) {
      update_barbeiros(
        where: {
          id: { _eq: $id },
          password: { _eq: $passwordAtual }
        },
        _set: $obj
      ) {
        affected_rows
      }
    }
  `;

  const response = await nhost.graphql.request(mutation, {
    id: barbeiroId,
    passwordAtual,
    obj: alteracoes
  });

  if (response.error) {
    console.error("Erro ao alterar conta:", response.error);
    alert("Erro ao guardar alterações.");
    btnGuardarConta.disabled = false;
    btnGuardarConta.textContent = "💾 Guardar alterações";
    return;
  }

  const affected = response.data?.update_barbeiros?.affected_rows || 0;

  if (affected === 0) {
    alert("Password atual incorreta. Nenhuma alteração foi feita.");
    btnGuardarConta.disabled = false;
    btnGuardarConta.textContent = "💾 Guardar alterações";
    return;
  }

  alert("Dados atualizados com sucesso! Vais ter de fazer login novamente.");

  // Como o username pode ter mudado, força novo login por segurança
  localStorage.removeItem("barbeiro");
  window.location.href = "login.html";
});

/* ---------------- MOSTRAR/OCULTAR PASSWORD ---------------- */

document.querySelectorAll(".toggle-password").forEach(btn => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    if (input.type === "password") {
      input.type = "text";
      btn.textContent = "🙈";
    } else {
      input.type = "password";
      btn.textContent = "👁️";
    }
  });
});

/* ---------------- INICIAR ---------------- */

checkSession();

/* ---------------- HISTÓRICO ---------------- */

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-historico").addEventListener("click", () => {
    const filtros = document.getElementById("historico-filtros");
    filtros.style.display = filtros.style.display === "none" ? "block" : "none";
  });

  document.getElementById("historico-dia").addEventListener("change", async (e) => {
    if (!e.target.value) return;
    document.getElementById("historico-mes").value = "";
    await carregarHistorico(e.target.value, e.target.value, true);
  });

  document.getElementById("historico-mes").addEventListener("change", async (e) => {
    if (!e.target.value) return;
    document.getElementById("historico-dia").value = "";

    const mes = e.target.value;
    const inicio = mes + "-01";
    const [ano, mesNum] = mes.split("-");
    const ultimoDia = new Date(Number(ano), Number(mesNum), 0).getDate();
    const fim = `${mes}-${String(ultimoDia).padStart(2, "0")}`;

    await carregarHistorico(inicio, fim, false);
  });
});

async function carregarHistorico(inicio, fim, mostrarApenasHora) {
  const query = `
    query Historico($id: uuid!, $inicio: date!, $fim: date!) {
      reservas(where: {
        barbeiro_id: { _eq: $id },
        data: { _gte: $inicio, _lte: $fim }
      }, order_by: [{ data: asc }, { hora: asc }]) {
        id
        data
        hora
        cliente_nome
        cliente_telemovel
        concluida
      }
    }
  `;

  const response = await nhost.graphql.request(query, {
    id: barbeiroId,
    inicio,
    fim
  });

  const data = response.data.reservas;

  const ul = document.getElementById("lista-reservas");
  ul.innerHTML = "";

  if (!data || data.length === 0) {
    ul.innerHTML = "<div class='list-empty'>Sem reservas neste período.</div>";
    return;
  }

  data.forEach(r => {
    const div = document.createElement("div");
    div.className = "reserva-item" + (r.concluida ? " concluida" : "");

    const rotuloHora = mostrarApenasHora
      ? r.hora.slice(0, 5)
      : `${r.data} · ${r.hora.slice(0, 5)}`;

    div.innerHTML = `
      <span class="hora-badge">${rotuloHora}</span>
      <div class="reserva-info">
        <strong>${r.cliente_nome}</strong>
        <a href="tel:${r.cliente_telemovel}">📞 ${r.cliente_telemovel}</a>
      </div>
      <button class="btn-concluir ${r.concluida ? 'ativo' : ''}" onclick="alternarConcluidaHistorico('${r.id}', ${!r.concluida}, '${inicio}', '${fim}', ${mostrarApenasHora})" title="${r.concluida ? 'Marcar como não atendida' : 'Marcar como atendida'}">
        ✅
      </button>
      <button class="btn-delete-reserva" onclick="apagarReservaHistorico('${r.id}', '${inicio}', '${fim}', ${mostrarApenasHora})">✖</button>
    `;
    ul.appendChild(div);
  });
}

async function alternarConcluidaHistorico(id, novoEstado, inicio, fim, mostrarApenasHora) {
  const mutation = `
    mutation MarcarConcluida($id: uuid!, $concluida: Boolean!) {
      update_reservas_by_pk(pk_columns: { id: $id }, _set: { concluida: $concluida }) {
        id
      }
    }
  `;

  const response = await nhost.graphql.request(mutation, { id, concluida: novoEstado });

  if (response.error) {
    console.error("Erro ao atualizar reserva:", response.error);
    alert("Erro ao atualizar estado da reserva.");
    return;
  }

  await carregarHistorico(inicio, fim, mostrarApenasHora);
}

async function apagarReservaHistorico(id, inicio, fim, mostrarApenasHora) {
  if (!confirm("Apagar esta reserva? Esta ação não pode ser desfeita.")) return;

  const mutation = `
    mutation DeleteReserva($id: uuid!) {
      delete_reservas_by_pk(id: $id) { id }
    }
  `;

  const response = await nhost.graphql.request(mutation, { id });

  if (response.error) {
    console.error("Erro ao apagar reserva:", response.error);
    alert("Erro ao apagar reserva.");
    return;
  }

  mostrarMensagem("Reserva apagada com sucesso");
  await carregarHistorico(inicio, fim, mostrarApenasHora);
}

/* ---------------- EXPOR FUNÇÕES PARA O HTML (onclick) ---------------- */

window.abrirModal = abrirModal;
window.fecharModal = fecharModal;
window.apagarFerias = apagarFerias;
window.apagarPausa = apagarPausa;
window.apagarGrupoPausas = apagarGrupoPausas;
window.apagarReservaHistorico = apagarReservaHistorico;
window.alternarConcluida = alternarConcluida;
window.alternarConcluidaHistorico = alternarConcluidaHistorico;

/* ---------------- TIMEOUT DE INATIVIDADE ---------------- */

let inactivityTimer;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(() => {
    alert("Sessão terminada por inatividade.");
    localStorage.removeItem("barbeiro");
    window.location.href = "login.html";
  }, 5 * 60 * 1000);
}

["mousemove", "mousedown", "keypress", "touchstart", "scroll"].forEach(event => {
  document.addEventListener(event, resetInactivityTimer);
});

resetInactivityTimer();