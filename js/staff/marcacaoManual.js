import { nhost } from '../nhost.js';
import { state } from './state.js';
import { feriados, estaEmFerias } from './feriados.js';
import { mostrarMensagem } from './utils.js';
import { carregarReservas } from './reservas.js';

function gerarHorarioBase(diaSemana) {
  const horas = [];
  let inicio, fim;
  if (diaSemana >= 1 && diaSemana <= 5) { inicio = 9; fim = 19; }
  else if (diaSemana === 6) { inicio = 8; fim = 18; }
  else return [];

  for (let h = inicio; h <= fim; h++) {
    horas.push(`${String(h).padStart(2, "0")}:00`);
    if (h !== fim) horas.push(`${String(h).padStart(2, "0")}:30`);
  }
  return horas;
}

async function verificarPausasManual(dataSelecionada) {
  const query = `
    query PausasManual($id: uuid!, $data: date!) {
      pausas(where: { barbeiro_id: { _eq: $id }, data: { _eq: $data } }) {
        hora_inicio
        hora_fim
      }
    }
  `;
  const response = await nhost.graphql.request(query, { id: state.barbeiroId, data: dataSelecionada });
  const pausas = response.data?.pausas;
  return pausas?.map(p => ({
    inicio: p.hora_inicio.substring(0, 5),
    fim: p.hora_fim.substring(0, 5)
  })) || [];
}

async function obterHorasReservadasManual(dataSelecionada) {
  const query = `
    query ReservasManual($id: uuid!, $data: date!) {
      reservas(where: { barbeiro_id: { _eq: $id }, data: { _eq: $data } }) {
        hora
      }
    }
  `;
  const response = await nhost.graphql.request(query, { id: state.barbeiroId, data: dataSelecionada });
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
    return !emPausa;
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

export function iniciarFlatpickrManual() {
  state.manualPicker = flatpickr("#manual-data", {
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: [d => d.getDay() === 0, d => estaEmFerias(d), ...feriados],
    onChange: function (selectedDates, dateStr) {
      gerarHorasManual(dateStr);
    },
    onDayCreate: function (dObj, dStr, fp, dayElem) {
      if (dayElem.classList.contains("flatpickr-disabled")) {
        dayElem.addEventListener("click", () => {
          const dia = dayElem.dateObj;
          if (dia.getDay() === 0) mostrarMensagem("Domingo está encerrado.");
          else if (estaEmFerias(dia)) mostrarMensagem("Estás de férias nesta data.");
          else mostrarMensagem("Feriado - indisponível.");
        });
      }
    }
  });
}

export function initMarcacaoManualListeners() {
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
        insert_reservas_one(object: $obj) { id }
      }
    `;
    const response = await nhost.graphql.request(mutation, {
      obj: { barbeiro_id: state.barbeiroId, data, hora, servico, cliente_nome, cliente_telemovel }
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
}