import { nhost } from '../nhost.js';
import { state } from './state.js';

export async function carregarReservas() {
  const hoje = new Date().toISOString().split("T")[0];

  const query = `
    query ReservasHoje($id: uuid!, $data: date!) {
      reservas(where: {
        barbeiro_id: { _eq: $id },
        data: { _eq: $data }
      }, order_by: { hora: asc }) {
        id
        data
        hora
        servico
        cliente_nome
        cliente_telemovel
        concluida
      }
    }
  `;
  const response = await nhost.graphql.request(query, { id: state.barbeiroId, data: hoje });
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
      <button class="btn-small edit-btn" onclick='abrirModal("reserva", "${r.id}", ${JSON.stringify(r)}, {"tipo":"hoje"})' title="Editar marcação">
        ✏️
      </button>
      <button class="btn-concluir ${r.concluida ? 'ativo' : ''}" onclick="alternarConcluida('${r.id}', ${!r.concluida})" title="${r.concluida ? 'Marcar como não atendida' : 'Marcar como atendida'}">
        ✅
      </button>
    `;
    ul.appendChild(div);
  });
}

export async function alternarConcluida(id, novoEstado) {
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
  await carregarReservas();
}