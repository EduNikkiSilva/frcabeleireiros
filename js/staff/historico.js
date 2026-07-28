import { nhost } from '../nhost.js';
import { state } from './state.js';
import { mostrarMensagem } from './utils.js';

export async function carregarHistorico(inicio, fim, mostrarApenasHora) {
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
  const response = await nhost.graphql.request(query, { id: state.barbeiroId, inicio, fim });
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
    const rotuloHora = mostrarApenasHora ? r.hora.slice(0, 5) : `${r.data} · ${r.hora.slice(0, 5)}`;

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

export async function alternarConcluidaHistorico(id, novoEstado, inicio, fim, mostrarApenasHora) {
  const mutation = `
    mutation MarcarConcluida($id: uuid!, $concluida: Boolean!) {
      update_reservas_by_pk(pk_columns: { id: $id }, _set: { concluida: $concluida }) { id }
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

export async function apagarReservaHistorico(id, inicio, fim, mostrarApenasHora) {
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

export function initHistoricoListeners() {
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
}