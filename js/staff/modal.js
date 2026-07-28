import { nhost } from '../nhost.js';
import { state } from './state.js';
import { carregarFerias } from './ferias.js';
import { carregarFeriasRanges } from './feriados.js';
import { carregarPausas } from './pausas.js';
import { mostrarMensagem } from './utils.js';

export function abrirModal(tipo, id, dados) {
  state.editType = tipo;
  state.editId = id;

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

export function fecharModal() {
  document.getElementById("modal-bg").style.display = "none";
}

export function initModalListeners() {
  document.getElementById("modal-save").addEventListener("click", async () => {
    if (state.editType === "ferias") {
      const mutation = `
        mutation UpdateFerias($id: uuid!, $obj: ferias_set_input!) {
          update_ferias_by_pk(pk_columns: { id: $id }, _set: $obj) { id }
        }
      `;
      await nhost.graphql.request(mutation, {
        id: state.editId,
        obj: {
          data_inicio: document.getElementById("modal-data1").value,
          data_fim: document.getElementById("modal-data2").value
        }
      });
      await carregarFerias();
      await carregarFeriasRanges();
      if (state.manualPicker) state.manualPicker.redraw();
      mostrarMensagem("Férias atualizadas com sucesso");
    }

    if (state.editType === "pausa") {
      const mutation = `
        mutation UpdatePausa($id: uuid!, $obj: pausas_set_input!) {
          update_pausas_by_pk(pk_columns: { id: $id }, _set: $obj) { id }
        }
      `;
      await nhost.graphql.request(mutation, {
        id: state.editId,
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
}