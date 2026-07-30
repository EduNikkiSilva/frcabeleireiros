import { nhost } from '../nhost.js';
import { state } from './state.js';
import { carregarFerias } from './ferias.js';
import { carregarFeriasRanges } from './feriados.js';
import { carregarPausas } from './pausas.js';
import { carregarReservas } from './reservas.js';
import { carregarHistorico } from './historico.js';
import { mostrarMensagem } from './utils.js';

let modalHora1Picker = null;
let modalHora2Picker = null;

function iniciarFlatpickrModal() {
  modalHora1Picker = flatpickr("#modal-hora1", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 30
  });

  modalHora2Picker = flatpickr("#modal-hora2", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 30
  });
}

export function abrirModal(tipo, id, dados, contexto) {
  state.editType = tipo;
  state.editId = id;
  state.editContext = contexto || null;

  if (!modalHora1Picker) iniciarFlatpickrModal();

  document.getElementById("modal-bg").style.display = "flex";

  // Esconde todos os campos por defeito
  document.getElementById("modal-data1").style.display = "none";
  document.getElementById("modal-data2").style.display = "none";
  document.getElementById("modal-hora1").style.display = "none";
  document.getElementById("modal-hora2").style.display = "none";
  document.getElementById("modal-label-servico").style.display = "none";
  document.getElementById("modal-servico").style.display = "none";
  document.getElementById("modal-label-nome").style.display = "none";
  document.getElementById("modal-nome").style.display = "none";
  document.getElementById("modal-label-telemovel").style.display = "none";
  document.getElementById("modal-telemovel").style.display = "none";

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
    modalHora1Picker.setDate(dados.hora_inicio, true);
    modalHora2Picker.setDate(dados.hora_fim, true);
  }

  if (tipo === "reserva") {
    document.getElementById("modal-title").textContent = "Editar marcação";
    document.getElementById("modal-data1").style.display = "block";
    document.getElementById("modal-hora1").style.display = "block";
    document.getElementById("modal-label-servico").style.display = "block";
    document.getElementById("modal-servico").style.display = "block";
    document.getElementById("modal-label-nome").style.display = "block";
    document.getElementById("modal-nome").style.display = "block";
    document.getElementById("modal-label-telemovel").style.display = "block";
    document.getElementById("modal-telemovel").style.display = "block";

    document.getElementById("modal-data1").value = dados.data;
    modalHora1Picker.setDate(dados.hora ? dados.hora.slice(0, 5) : "", true);
    document.getElementById("modal-servico").value = dados.servico || "corte e lavagem";
    document.getElementById("modal-nome").value = dados.cliente_nome || "";
    document.getElementById("modal-telemovel").value = dados.cliente_telemovel || "";
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

    if (state.editType === "reserva") {
      const data = document.getElementById("modal-data1").value;
      const hora = document.getElementById("modal-hora1").value;
      const servico = document.getElementById("modal-servico").value;
      const cliente_nome = document.getElementById("modal-nome").value.trim();
      const cliente_telemovel = document.getElementById("modal-telemovel").value.trim();

      if (!data || !hora || !cliente_nome || !cliente_telemovel) {
        alert("Preenche todos os campos.");
        return;
      }

      const mutation = `
        mutation UpdateReserva($id: uuid!, $obj: reservas_set_input!) {
          update_reservas_by_pk(pk_columns: { id: $id }, _set: $obj) { id }
        }
      `;
      const response = await nhost.graphql.request(mutation, {
        id: state.editId,
        obj: { data, hora, servico, cliente_nome, cliente_telemovel }
      });

      if (response.error) {
        console.error("Erro ao atualizar marcação:", response.error);
        alert("Erro ao atualizar marcação.");
        return;
      }

      if (state.editContext?.tipo === "historico") {
        await carregarHistorico(
          state.editContext.inicio,
          state.editContext.fim,
          state.editContext.mostrarApenasHora
        );
      } else {
        await carregarReservas();
      }

      mostrarMensagem("Marcação atualizada com sucesso");
    }

    fecharModal();
  });
}