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
}

/* ---------------- CARREGAR DADOS ---------------- */

async function carregarBarbeiro() {
  const query = `
    query GetBarbeiro($id: uuid!) {
      barbeiros(where: { id: { _eq: $id } }) {
        nome
      }
    }
  `;

  const response = await nhost.graphql.request(query, { id: barbeiroId });
  const data = response.data.barbeiros[0];

  if (data) {
    document.getElementById("bemvindo").textContent =
      "Olá, " + data.nome + " 👋";
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
      }
    }
  `;

  const response = await nhost.graphql.request(query, {
    id: barbeiroId,
    data: hoje
  });

  const data = response.data.reservas;

  const ul = document.getElementById("lista-reservas");
  ul.innerHTML = "";

  if (!data || data.length === 0) {
    ul.innerHTML = "<div class='list-empty'>Sem marcações para hoje.</div>";
    return;
  }

  data.forEach(r => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <strong>${r.hora}</strong>
      <span>${r.cliente_nome} · ${r.cliente_telemovel}</span>
    `;
    ul.appendChild(div);
  });
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

  // Agrupar dias consecutivos com a mesma hora_inicio/hora_fim
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
  const inicio = document.getElementById("ferias-inicio").value;
  const fim = document.getElementById("ferias-fim").value;
  if (!inicio || !fim) return;

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

  await carregarFerias();
});

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

  // Gerar uma pausa para cada dia do intervalo
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

  document.getElementById("pausa-data").value = "";
  document.getElementById("pausa-data-fim").value = "";
  document.getElementById("pausa-inicio").value = "";
  document.getElementById("pausa-fim").value = "";

  await carregarPausas();
});

/* ---------------- APAGAR ---------------- */

async function apagarFerias(id) {
  const mutation = `
    mutation DeleteFerias($id: uuid!) {
      delete_ferias_by_pk(id: $id) { id }
    }
  `;

  await nhost.graphql.request(mutation, { id });
  await carregarFerias();
}

async function apagarPausa(id) {
  const mutation = `
    mutation DeletePausa($id: uuid!) {
      delete_pausas_by_pk(id: $id) { id }
    }
  `;

  await nhost.graphql.request(mutation, { id });
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

/* ---------------- INICIAR ---------------- */

checkSession();

/* ---------------- HISTÓRICO ---------------- */

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-historico").addEventListener("click", () => {
    document.getElementById("historico-mes").style.display = "block";
  });

    document.getElementById("historico-mes").addEventListener("change", async (e) => {
    const mes = e.target.value;

    const query = `
      query Historico($id: uuid!, $inicio: date!, $fim: date!) {
        reservas(where: {
          barbeiro_id: { _eq: $id },
          data: { _gte: $inicio, _lte: $fim }
        }, order_by: [{ data: asc }, { hora: asc }]) {
          data
          hora
          cliente_nome
          cliente_telemovel
        }
      }
    `;

    const response = await nhost.graphql.request(query, {
      id: barbeiroId,
      inicio: mes + "-01",
      fim: mes + "-31"
    });

    const data = response.data.reservas;

    const ul = document.getElementById("lista-reservas");
    ul.innerHTML = "";

    if (!data || data.length === 0) {
      ul.innerHTML = "<div class='list-empty'>Sem reservas neste mês.</div>";
      return;
    }

    data.forEach(r => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <strong>${r.data} · ${r.hora}</strong>
        <span>${r.cliente_nome} · ${r.cliente_telemovel}</span>
      `;
      ul.appendChild(div);
    });
  });
});

/* ---------------- EXPOR FUNÇÕES PARA O HTML (onclick) ---------------- */

window.abrirModal = abrirModal;
window.fecharModal = fecharModal;
window.apagarFerias = apagarFerias;
window.apagarPausa = apagarPausa;

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