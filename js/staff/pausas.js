import { nhost } from '../nhost.js';
import { state } from './state.js';
import { mostrarMensagem } from './utils.js';

export async function carregarPausas() {
  const query = `
    query Pausas($id: uuid!) {
      pausas(where: { barbeiro_id: { _eq: $id } }, order_by: [{ data: asc }, { hora_inicio: asc }]) {
        id
        data
        hora_inicio
        hora_fim
      }
    }
  `;
  const response = await nhost.graphql.request(query, { id: state.barbeiroId });
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
    if (grupoAtual && grupoAtual.hora_inicio === p.hora_inicio && grupoAtual.hora_fim === p.hora_fim && diaSeguinte(grupoAtual.dataFimObj, dataAtual)) {
      grupoAtual.data_fim = p.data;
      grupoAtual.dataFimObj = dataAtual;
      grupoAtual.ids.push(p.id);
    } else {
      grupoAtual = { data_inicio: p.data, data_fim: p.data, dataFimObj: dataAtual, hora_inicio: p.hora_inicio, hora_fim: p.hora_fim, ids: [p.id] };
      grupos.push(grupoAtual);
    }
  });

  grupos.forEach(g => {
    const div = document.createElement("div");
    div.className = "list-item";
    const textoData = g.data_inicio === g.data_fim ? g.data_inicio : `${g.data_inicio} até ${g.data_fim}`;
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

export async function apagarGrupoPausas(ids) {
  if (!confirm("Apagar todas as pausas deste período?")) return;

  const mutation = `
    mutation DeletePausas($ids: [uuid!]!) {
      delete_pausas(where: { id: { _in: $ids } }) { affected_rows }
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

export async function apagarPausa(id) {
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

export function iniciarFlatpickrPausa() {
  state.pausaPicker = flatpickr("#pausa-range", {
    mode: "range",
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: [d => d.getDay() === 0],
    onDayCreate: function (dObj, dStr, fp, dayElem) {
      if (dayElem.classList.contains("flatpickr-disabled")) {
        dayElem.addEventListener("click", () => mostrarMensagem("Domingo está encerrado."));
      }
    }
  });

  flatpickr("#pausa-inicio", {
    enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true,
    minuteIncrement: 30, minTime: "08:00", maxTime: "19:00"
  });

  flatpickr("#pausa-fim", {
    enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true,
    minuteIncrement: 30, minTime: "08:00", maxTime: "19:00"
  });
}

export function initPausasListeners() {
  document.getElementById("btn-add-pausa").addEventListener("click", async () => {
    const datas = state.pausaPicker.selectedDates;
    const horaInicio = document.getElementById("pausa-inicio").value;
    const horaFim = document.getElementById("pausa-fim").value;

    if (datas.length < 2) { alert("Escolhe o dia de início e o dia de fim da pausa."); return; }
    if (!horaInicio || !horaFim) { alert("Preenche as horas de início e fim."); return; }
    if (horaFim <= horaInicio) { alert("A hora de fim deve ser posterior à hora de início."); return; }

    const dataInicio = state.pausaPicker.formatDate(datas[0], "Y-m-d");
    const dataFim = state.pausaPicker.formatDate(datas[1], "Y-m-d");

    const pausas = [];
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
      pausas.push({ barbeiro_id: state.barbeiroId, data: d.toISOString().split("T")[0], hora_inicio: horaInicio, hora_fim: horaFim });
    }

    const mutation = `
      mutation AddPausas($objs: [pausas_insert_input!]!) {
        insert_pausas(objects: $objs) { affected_rows }
      }
    `;
    const response = await nhost.graphql.request(mutation, { objs: pausas });

    if (response.error) {
      console.error("Erro ao adicionar pausas:", response.error);
      alert("Erro ao guardar pausas.");
      return;
    }

    state.pausaPicker.clear();
    document.getElementById("pausa-inicio").value = "";
    document.getElementById("pausa-fim").value = "";
    await carregarPausas();
  });
}