import { abrirModal, fecharModal, initModalListeners } from './modal.js';
import { apagarFerias } from './ferias.js';
import { apagarPausa, apagarGrupoPausas } from './pausas.js';
import { alternarConcluida } from './reservas.js';
import { alternarConcluidaHistorico, apagarReservaHistorico, initHistoricoListeners } from './historico.js';
import { initMarcacaoManualListeners } from './marcacaoManual.js';
import { initFeriasListeners } from './ferias.js';
import { initPausasListeners } from './pausas.js';
import { initContaListeners } from './conta.js';
import { initDadosListeners } from './dados.js';
import { checkSession, initLogoutListener, initInactivityTimer } from './session.js';

// Expor funções chamadas via onclick inline no HTML
window.abrirModal = abrirModal;
window.fecharModal = fecharModal;
window.apagarFerias = apagarFerias;
window.apagarPausa = apagarPausa;
window.apagarGrupoPausas = apagarGrupoPausas;
window.apagarReservaHistorico = apagarReservaHistorico;
window.alternarConcluida = alternarConcluida;
window.alternarConcluidaHistorico = alternarConcluidaHistorico;

// Registar listeners de cada secção
initModalListeners();
initMarcacaoManualListeners();
initFeriasListeners();
initPausasListeners();
initContaListeners();
initDadosListeners();
initHistoricoListeners();
initLogoutListener();
initInactivityTimer();

document.getElementById("notificacao-fechar")?.addEventListener("click", () => {
  document.getElementById("notificacoes-box").style.display = "none";
});

// Iniciar sessão (carrega tudo)
checkSession();