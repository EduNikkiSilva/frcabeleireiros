import { nhost } from './nhost.js';

/* ============================
   VARIÁVEIS
============================ */
const form = document.getElementById("booking-form");
const timeSelect = document.getElementById("time");
const popup = document.getElementById("popup");

const feriados = [
  "2026-01-01","2026-04-25","2026-05-01","2026-06-10",
  "2026-08-15","2026-10-05","2026-11-01","2026-12-01",
  "2026-12-08","2026-12-25"
];

/* ============================
   HORÁRIOS POR DIA DA SEMANA
============================ */
function gerarHorarioBase(diaSemana) {
  const horas = [];

  let inicio, fim;

  if (diaSemana >= 1 && diaSemana <= 5) {
    // Segunda a sexta
    inicio = 9;
    fim = 19;
  } else if (diaSemana === 6) {
    // Sábado
    inicio = 8;
    fim = 18;
  } else {
    // Domingo
    return [];
  }

  for (let h = inicio; h <= fim; h++) {
    horas.push(`${String(h).padStart(2, "0")}:00`);
    if (h !== fim) horas.push(`${String(h).padStart(2, "0")}:30`);
  }

  return horas;
}

/* ============================
   VERIFICAR FÉRIAS
============================ */
async function verificarFerias(barbeiroId, dataSelecionada) {
  const query = `
    query Ferias($id: uuid!) {
      ferias(where: { barbeiro_id: { _eq: $id } }) {
        data_inicio
        data_fim
      }
    }
  `;

  const response = await nhost.graphql.request(query, { id: barbeiroId });
  const ferias = response.data.ferias;

  const data = new Date(dataSelecionada);

  return ferias?.some(f => {
    const inicio = new Date(f.data_inicio);
    const fim = new Date(f.data_fim);
    return data >= inicio && data <= fim;
  });
}

async function verificarFeriasMes(barbeiroId) {
  const query = `
    query FeriasMes($id: uuid!) {
      ferias(where: { barbeiro_id: { _eq: $id } }) {
        data_inicio
        data_fim
      }
    }
  `;

  const response = await nhost.graphql.request(query, { id: barbeiroId });
  const ferias = response.data.ferias;

  if (!ferias || !ferias.length) return null;

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const feriasMes = ferias.filter(f => {
    const inicio = new Date(f.data_inicio);
    const fim = new Date(f.data_fim);

    return (
      (inicio.getMonth() === mesAtual && inicio.getFullYear() === anoAtual) ||
      (fim.getMonth() === mesAtual && fim.getFullYear() === anoAtual)
    );
  });

  return feriasMes.length ? feriasMes : null;
}

/* ============================
   VERIFICAR PAUSAS
============================ */
async function verificarPausas(barbeiroId, dataSelecionada) {
  const query = `
    query Pausas($id: uuid!, $data: date!) {
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

  const pausas = response.data.pausas;

  return pausas?.map(p => ({
    inicio: p.hora_inicio.substring(0, 5),
    fim: p.hora_fim.substring(0, 5)
  })) || [];
}

/* ============================
   VERIFICAR HORAS JÁ RESERVADAS
============================ */
async function obterHorasReservadas(barbeiroId, dataSelecionada) {
  const query = `
    query Reservas($id: uuid!, $data: date!) {
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

  const reservas = response.data.reservas;

  return reservas?.map(r => r.hora.substring(0, 5)) || [];
}

/* ============================
   GERAR HORAS DISPONÍVEIS
============================ */
async function gerarHoras(diaSemana, barbeiroId, dataSelecionada) {
  const horasBase = gerarHorarioBase(diaSemana);

  if (!horasBase.length) {
    timeSelect.innerHTML = '<option value="">Domingo indisponível</option>';
    return;
  }

  const pausas = await verificarPausas(barbeiroId, dataSelecionada);
  const horasReservadas = await obterHorasReservadas(barbeiroId, dataSelecionada);

  const hoje = new Date().toISOString().split("T")[0];
  const ehHoje = dataSelecionada === hoje;
  const agora = new Date().toTimeString().slice(0, 5);

  let horasDisponiveis = horasBase.filter(hora => {
    if (ehHoje && hora <= agora) return false;
    if (horasReservadas.includes(hora)) return false;

    const emPausa = pausas.some(p => hora >= p.inicio && hora <= p.fim);
    if (emPausa) return false;

    return true;
  });

  timeSelect.innerHTML = "";

  if (!horasDisponiveis.length) {
    timeSelect.innerHTML = '<option value="">Sem horários disponíveis</option>';
    return;
  }

  timeSelect.innerHTML = '<option value="">Escolhe a hora</option>';
  horasDisponiveis.forEach(h => {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = h;
    timeSelect.appendChild(opt);
  });
}

/* ============================
   FLATPICKR
============================ */
flatpickr("#date", {
  dateFormat: "Y-m-d",
  minDate: "today",
  disable: [
    d => d.getDay() === 0, // domingos
    ...feriados
  ],
  onChange: async function(selectedDates) {
    if (!selectedDates.length) return;

    const dataSelecionada = form.date.value;
    const barbeiroId = form.barber.value;

    if (!barbeiroId) {
      alert("Escolhe primeiro o barbeiro.");
      form.date.value = "";
      timeSelect.innerHTML = '<option value="">Escolhe a hora</option>';
      return;
    }

    if (await verificarFerias(barbeiroId, dataSelecionada)) {
      alert("Este barbeiro está de férias neste dia.");
      timeSelect.innerHTML = '<option value="">Sem horários disponíveis</option>';
      return;
    }

    const diaSemana = selectedDates[0].getDay();
    await gerarHoras(diaSemana, barbeiroId, dataSelecionada);
  }
});

/* ============================
   MUDAR BARBEIRO → RECARREGAR HORAS
============================ */
form.barber.addEventListener("change", async () => {
  const barbeiroId = form.barber.value;
  const info = document.getElementById("ferias-info");

  info.textContent = "";

  if (!barbeiroId) return;

  const feriasMes = await verificarFeriasMes(barbeiroId);

  if (feriasMes) {
    const f = feriasMes[0];
    info.textContent = `ℹ️ Este barbeiro está de férias de ${f.data_inicio} até ${f.data_fim}.`;
    info.style.color = "#b91c1c";
  } else {
    info.textContent = "✔ Este barbeiro está disponível este mês.";
    info.style.color = "#059669";
  }

  const dataSelecionada = form.date.value;
  if (dataSelecionada) {
    const diaSemana = new Date(dataSelecionada).getDay();
    await gerarHoras(diaSemana, barbeiroId, dataSelecionada);
  }
});

/* ============================
   SUBMETER MARCAÇÃO
============================ */
async function verificarDuplicado(barbeiroId, data, cliente_telemovel) {
  const query = `
    query VerificarDuplicado($barbeiroId: uuid!, $data: date!, $telemovel: String!) {
      reservas(where: {
        barbeiro_id: { _eq: $barbeiroId },
        data: { _eq: $data },
        cliente_telemovel: { _eq: $telemovel }
      }) {
        id
        hora
      }
    }
  `;

  const response = await nhost.graphql.request(query, {
    barbeiroId,
    data,
    telemovel: cliente_telemovel
  });

  return response.data?.reservas || [];
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const barbeiroId = form.barber.value;
  const servico = form.service.value;
  const data = form.date.value;
  const hora = form.time.value;
  const cliente_nome = form.name.value.trim();
  const cliente_telemovel = form.phone.value.trim();

  if (!barbeiroId || !servico || !data || !hora || !cliente_nome || !cliente_telemovel) {
    alert("Preenche todos os campos.");
    return;
  }

  const duplicados = await verificarDuplicado(barbeiroId, data, cliente_telemovel);

  if (duplicados.length > 0) {
    const horasExistentes = duplicados.map(r => r.hora.slice(0, 5)).join(", ");
    const confirmar = confirm(
      `Já tens uma marcação neste dia às ${horasExistentes}.\n\nQueres marcar mesmo assim outra reserva para as ${hora}?`
    );
    if (!confirmar) return;
  }

  const mutation = `
    mutation CriarReserva($obj: reservas_insert_input!) {
      insert_reservas_one(object: $obj) {
        id
      }
    }
  `;

  const variables = {
    obj: {
      cliente_nome,
      cliente_telemovel,
      barbeiro_id: barbeiroId,
      data,
      hora,
      servico
    }
  };

  const response = await nhost.graphql.request(mutation, variables);

    if (response.error) {
    alert("Erro ao registar a marcação.");
    return;
  }

  popup.style.opacity = "1";
  popup.style.transform = "translateY(0)";
  setTimeout(() => {
    popup.style.opacity = "0";
    popup.style.transform = "translateY(10px)";
  }, 3000);

  form.reset();
  timeSelect.innerHTML = '<option value="">Escolhe a hora</option>';
});
