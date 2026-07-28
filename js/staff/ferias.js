import { nhost } from '../nhost.js';
import { state } from './state.js';

export async function carregarFerias() {
  const query = `
    query Ferias($id: uuid!) {
      ferias(where: { barbeiro_id: { _eq: $id } }, order_by: { data_inicio: asc }) {
        id
        data_inicio
        data_fim
      }
    }
  `;
  const response = await nhost.graphql.request(query, { id: state.barbeiroId });
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

export async function apagarFerias(id) {
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
  try {
    const mod = await import('./feriados.js');
    if (typeof mod.carregarFeriasRanges === 'function') {
      await mod.carregarFeriasRanges();
    } else {
      console.warn('feriados.js não exporta carregarFeriasRanges');
    }
  } catch (err) {
    console.warn('Erro ao importar feriados.js:', err);
  }
  if (state.manualPicker) state.manualPicker.redraw();
}

export function iniciarFlatpickrFerias() {
  state.feriasPicker = flatpickr("#ferias-range", {
    mode: "range",
    dateFormat: "Y-m-d",
    minDate: "today"
  });
}

export function initFeriasListeners() {
  document.getElementById("btn-add-ferias").addEventListener("click", async () => {
    const datas = state.feriasPicker.selectedDates;
    if (datas.length < 2) {
      alert("Escolhe o dia de início e o dia de fim das férias.");
      return;
    }

    const inicio = state.feriasPicker.formatDate(datas[0], "Y-m-d");
    const fim = state.feriasPicker.formatDate(datas[1], "Y-m-d");

    const mutation = `
      mutation AddFerias($obj: ferias_insert_input!) {
        insert_ferias_one(object: $obj) { id }
      }
    `;
    const response = await nhost.graphql.request(mutation, {
      obj: { barbeiro_id: state.barbeiroId, data_inicio: inicio, data_fim: fim }
    });

    if (response.error) {
      console.error("Erro ao adicionar férias:", response.error);
      alert("Erro ao guardar férias.");
      return;
    }

    state.feriasPicker.clear();
    await carregarFerias();
    try {
      const mod = await import('./feriados.js');
      if (typeof mod.carregarFeriasRanges === 'function') {
        await mod.carregarFeriasRanges();
      } else {
        console.warn('feriados.js não exporta carregarFeriasRanges');
      }
    } catch (err) {
      console.warn('Erro ao importar feriados.js:', err);
    }
    if (state.manualPicker) state.manualPicker.redraw();
  });
}