import { nhost } from '../nhost.js';
import { state } from './state.js';
import { mostrarMensagem } from './utils.js';

export async function verificarOwner() {
  const query = `
    query VerificarOwner($id: uuid!) {
      barbeiros(where: { id: { _eq: $id } }) { owner }
    }
  `;
  const response = await nhost.graphql.request(query, { id: state.barbeiroId });
  state.isOwner = response.data?.barbeiros?.[0]?.owner || false;

  if (state.isOwner) {
    document.getElementById("tab-btn-dados").style.display = "inline-block";
    document.getElementById("notificacao-sino").style.display = "flex";
    initSinoListener();
    await verificarReservasAntigas();
    verificarLembreteFimMes();
    await verificarDisponibilidadeLimpeza();
    await verificarAutoLimpeza();
  }
}

function initSinoListener() {
  const sino = document.getElementById("notificacao-sino");
  if (sino.dataset.listenerAtivo) return; // evita duplicar listener
  sino.dataset.listenerAtivo = "true";

  sino.addEventListener("click", () => {
    const box = document.getElementById("notificacoes-box");
    const estaVisivel = box.style.display === "block";

    if (estaVisivel) {
      box.style.display = "none";
    } else if (state.notificacaoAtual) {
      renderizarNotificacao(state.notificacaoAtual);
      box.style.display = "block";
    } else {
      renderizarNotificacao({
        titulo: "🔔 Sem notificações",
        mensagem: "Não há avisos pendentes de momento.",
        urgente: false,
        onExportar: null,
        onDispensar: () => { box.style.display = "none"; }
      });
      box.style.display = "block";
    }
  });
}

function verificarLembreteFimMes() {
  if (!state.isOwner) return;
  const hoje = new Date();
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diasRestantes = ultimoDia - hoje.getDate();

  const badge = document.getElementById("notificacao-badge");

  if (diasRestantes > 2) {
    state.notificacaoAtual = null;
    badge.style.display = "none";
    document.getElementById("notificacoes-box").style.display = "none";
    return;
  }

  badge.style.display = "flex";
  badge.textContent = "1";

  const notificacao = {
    titulo: "📅 Exportar reservas",
    mensagem: `Faltam <strong>${diasRestantes + 1} dia(s)</strong> para o fim do mês. Exporta as reservas antigas antes que sejam apagadas automaticamente no dia 1.`,
    urgente: true,
    onExportar: () => {
      document.getElementById("tab-btn-dados").click();
      document.getElementById("notificacoes-box").style.display = "none";
    },
    onDispensar: () => {
      document.getElementById("notificacoes-box").style.display = "none";
    }
  };

  state.notificacaoAtual = notificacao;

  // Só mostra automaticamente uma vez por dia (não sempre que abre a página)
  const jaVistoHoje = localStorage.getItem("notificacao_vista_data") === hoje.toISOString().split("T")[0];
  if (!jaVistoHoje) {
    renderizarNotificacao(notificacao);
    document.getElementById("notificacoes-box").style.display = "block";
    localStorage.setItem("notificacao_vista_data", hoje.toISOString().split("T")[0]);
  }
}

function renderizarNotificacao(notificacao) {
  const conteudo = document.getElementById("notificacao-conteudo");
  const { titulo, mensagem, urgente, onExportar, onDispensar } = notificacao;

  const botaoExportar = onExportar
    ? `<button class="btn-exportar">📥 Exportar agora</button>`
    : "";

  conteudo.innerHTML = `
    <div class="notificacao-item ${urgente ? 'urgente' : ''}">
      <div style="flex:1;">
        <strong>${titulo}</strong>
        <p>${mensagem}</p>
        <div>
          ${botaoExportar}
          <button class="btn-dispensar">Fechar</button>
        </div>
      </div>
    </div>
  `;

  if (onExportar) conteudo.querySelector(".btn-exportar").addEventListener("click", onExportar);
  conteudo.querySelector(".btn-dispensar").addEventListener("click", onDispensar);
}

// Mantido para compatibilidade com verificarAutoLimpeza
function mostrarNotificacao(titulo, mensagem, urgente, onExportar, onDispensar) {
  const notificacao = { titulo, mensagem, urgente, onExportar, onDispensar };
  state.notificacaoAtual = notificacao;
  renderizarNotificacao(notificacao);
  document.getElementById("notificacoes-box").style.display = "block";
}

async function verificarAutoLimpeza() {
  if (!state.isOwner) return;

  const agora = new Date();
  const ehDia1 = agora.getDate() === 1;
  const passou2350 = agora.getHours() > 23 || (agora.getHours() === 23 && agora.getMinutes() >= 50);
  if (!ehDia1 || !passou2350) return;

  const query = `
    query UltimaLimpeza($id: uuid!) {
      barbeiros(where: { id: { _eq: $id } }) { limpeza }
    }
  `;

  try {
    const response = await nhost.graphql.request(query, { id: state.barbeiroId });
    const ultimaLimpeza = response.data?.barbeiros?.[0]?.limpeza;
    const ultimaLimpezaMes = ultimaLimpeza ? ultimaLimpeza.slice(0, 7) : null;

    if (ultimaLimpezaMes === mesAtualStr()) return;

    const limite = cutoffDoisMesesAtras();
    const hojeStr = agora.toISOString().split("T")[0];

    const mutation = `
      mutation AutoLimpar($limite: date!, $id: uuid!, $hoje: date!) {
        delete_reservas(where: { data: { _lt: $limite } }) { affected_rows }
        update_barbeiros_by_pk(pk_columns: { id: $id }, _set: { limpeza: $hoje }) { id }
      }
    `;
    const resp = await nhost.graphql.request(mutation, { limite, id: state.barbeiroId, hoje: hojeStr });

    if (resp.error || resp.errors) {
      console.error("Erro na auto-limpeza:", resp.error || resp.errors);
      return;
    }

    const apagadas = resp.data?.delete_reservas?.affected_rows || 0;
    mostrarNotificacao(
      "🗑️ Limpeza automática concluída",
      `${apagadas} reserva(s) com mais de 2 meses foram apagadas automaticamente.`,
      false,
      () => { document.getElementById("notificacoes-box").style.display = "none"; },
      () => { document.getElementById("notificacoes-box").style.display = "none"; }
    );

    await verificarDisponibilidadeLimpeza();
    const banner = document.querySelector(".banner-aviso-limpeza");
    if (banner) banner.remove();
  } catch (err) {
    console.error("Erro na verificação de auto-limpeza:", err);
  }
}

function dataLimite2Meses() {
  const limite = new Date();
  limite.setMonth(limite.getMonth() - 2);
  return limite.toISOString().split("T")[0];
}

async function verificarReservasAntigas() {
  const limite = dataLimite2Meses();
  const query = `
    query ContarAntigas($limite: date!) {
      reservas_aggregate(where: { data: { _lte: $limite } }) {
        aggregate { count }
      }
    }
  `;
  const response = await nhost.graphql.request(query, { limite });
  const count = response.data?.reservas_aggregate?.aggregate?.count || 0;
  if (count > 0) mostrarBannerLimpeza(count);
}

function mostrarBannerLimpeza(count) {
  const banner = document.createElement("div");
  banner.className = "banner-aviso-limpeza";
  banner.textContent = `⚠️ Tens ${count} reserva(s) com mais de 2 meses. Clica para exportar e limpar os dados.`;
  banner.addEventListener("click", () => document.getElementById("tab-btn-dados").click());
  document.body.insertBefore(banner, document.body.firstChild);
}

function primeiroDiaDoMes(mesStr) { return `${mesStr}-01`; }

function ultimoDiaDoMesStr(mesStr) {
  const [ano, mes] = mesStr.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return `${mesStr}-${String(ultimoDia).padStart(2, "0")}`;
}

function mesAtualStr() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function cutoffDoisMesesAtras() {
  const hoje = new Date();
  const cutoff = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-01`;
}

async function verificarDisponibilidadeLimpeza() {
  const btn = document.getElementById("btn-limpar-antigas");
  const status = document.getElementById("limpeza-status");
  const hoje = new Date();

  const query = `
    query UltimaLimpeza($id: uuid!) {
      barbeiros(where: { id: { _eq: $id } }) { limpeza }
    }
  `;
  const response = await nhost.graphql.request(query, { id: state.barbeiroId });
  const ultimaLimpeza = response.data?.barbeiros?.[0]?.limpeza;
  const ultimaLimpezaMes = ultimaLimpeza ? ultimaLimpeza.slice(0, 7) : null;

  const ehDia1 = hoje.getDate() === 1;
  const jaLimpouEsteMes = ultimaLimpezaMes === mesAtualStr();

  if (jaLimpouEsteMes) {
    btn.disabled = true;
    status.textContent = "✅ Já limpaste os dados este mês. Disponível novamente no dia 1 do próximo mês.";
  } else if (!ehDia1) {
    btn.disabled = true;
    status.textContent = "🔒 Esta ação só fica disponível no dia 1 de cada mês.";
  } else {
    btn.disabled = false;
    status.textContent = "🟢 Disponível hoje — podes limpar os dados com mais de 2 meses.";
  }
}

export function initDadosListeners() {
  document.getElementById("btn-exportar-excel").addEventListener("click", async () => {
    const mesInicio = document.getElementById("export-mes-inicio").value;
    const mesFim = document.getElementById("export-mes-fim").value;

    if (!mesInicio || !mesFim) { alert("Escolhe o mês de início e de fim."); return; }

    const inicio = primeiroDiaDoMes(mesInicio);
    const fim = ultimoDiaDoMesStr(mesFim);
    if (fim < inicio) { alert("O mês de fim não pode ser anterior ao mês de início."); return; }

    const query = `
      query ExportarReservas($inicio: date!, $fim: date!) {
        reservas(where: { data: { _gte: $inicio, _lte: $fim } }, order_by: [{ data: asc }, { hora: asc }]) {
          data
          hora
          cliente_nome
          cliente_telemovel
          servico
          concluida
          barbeiro_id
        }
        barbeiros { id nome }
      }
    `;

    try {
      const response = await nhost.graphql.request(query, { inicio, fim });

      if (response.error || response.errors) {
        console.error("Erro ao exportar:", response.error || response.errors);
        alert("Erro ao exportar reservas. Verifica a consola (F12).");
        return;
      }
      if (!response.data) { alert("Erro: o servidor não devolveu dados."); return; }

      const reservas = response.data.reservas || [];
      const barbeiros = response.data.barbeiros || [];

      if (!reservas.length) { alert("Não há reservas neste período."); return; }

      const barbeirosMap = {};
      barbeiros.forEach(b => barbeirosMap[b.id] = b.nome);

      const linhas = reservas.map(r => ({
        Data: r.data,
        Hora: r.hora ? r.hora.slice(0, 5) : "",
        Barbeiro: barbeirosMap[r.barbeiro_id] || "Desconhecido",
        Cliente: r.cliente_nome,
        "Telemóvel": r.cliente_telemovel,
        "Serviço": r.servico || "",
        Atendida: r.concluida ? "Sim" : "Não"
      }));

      // Importar SheetJS dinamicamente (ESM)
      const XLSX = window.XLSX;
      if (!XLSX) {
        alert("Erro: a biblioteca SheetJS não está carregada. Recarrega a página.");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(linhas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reservas");

      const nomeFicheiro = `reservas_${mesInicio}_a_${mesFim}.xlsx`;

      try {
        XLSX.writeFile(wb, nomeFicheiro);
      } catch (err) {
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nomeFicheiro;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      mostrarMensagem("Excel exportado com sucesso!");
    } catch (err) {
      console.error("Erro inesperado na exportação:", err);
      alert("Ocorreu um erro inesperado. Verifica a consola (F12).");
    }
  });

  document.getElementById("btn-limpar-antigas").addEventListener("click", async () => {
    const limite = cutoffDoisMesesAtras();
    const confirmacao = confirm(
      `Isto vai apagar PERMANENTEMENTE todas as reservas anteriores a ${limite} (mais de 2 meses).\n\nJá exportaste esses dados para Excel? Esta ação não pode ser desfeita.`
    );
    if (!confirmacao) return;

    const mutation = `
      mutation LimparAntigas($limite: date!, $id: uuid!, $hoje: date!) {
        delete_reservas(where: { data: { _lt: $limite } }) { affected_rows }
        update_barbeiros_by_pk(pk_columns: { id: $id }, _set: { limpeza: $hoje }) { id }
      }
    `;
    const hoje = new Date().toISOString().split("T")[0];
    const response = await nhost.graphql.request(mutation, { limite, id: state.barbeiroId, hoje });

    if (response.error) {
      console.error("Erro ao limpar reservas:", response.error);
      alert("Erro ao apagar reservas antigas.");
      return;
    }

    const apagadas = response.data?.delete_reservas?.affected_rows || 0;
    alert(`${apagadas} reserva(s) apagada(s) com sucesso.`);

    const banner = document.querySelector(".banner-aviso-limpeza");
    if (banner) banner.remove();

    await verificarDisponibilidadeLimpeza();
  });
}