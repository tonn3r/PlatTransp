(function() {
    'use strict';

    const VERSAO_ATUAL = "3.0"; 
    const URL_VERSAO = "https://raw.githubusercontent.com/tonn3r/PlatTransp/main/version.json";

    async function verificarAtualizacao() {
        try {
            const response = await fetch(URL_VERSAO + "?t=" + new Date().getTime());
            
            if (!response.ok) {
                console.warn("Addon PlatTransp: Não foi possível checar a versão (Erro " + response.status + ").");
                return;
            }

            const dados = await response.json();
            
            if (dados.version !== VERSAO_ATUAL) {
                if (!document.getElementById('alerta-atualizacao-addon')) {
                    const alerta = document.createElement('div');
                    alerta.id = 'alerta-atualizacao-addon';
                    alerta.style = "position:fixed; top:0; left:0; width:100%; background:#e74c3c; color:white; text-align:center; padding:12px; z-index:999999; font-family:verdana; font-size:13px; font-weight:bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3);";
                    alerta.innerHTML = `⚠️ NOVA VERSÃO DO ADDON DISPONÍVEL (${dados.version})! Sua versão atual é a ${VERSAO_ATUAL}. <br><a href="${dados.url}" style="color:#ffeb3b; text-decoration:underline; font-size:15px; display:inline-block; margin-top:5px;">📥 Clique aqui para baixar o ZIP atualizado</a> <span style="font-size:11px; font-weight:normal; margin-left:10px;">(Após baixar, extraia, substitua os arquivos antigos e clique em 'Atualizar' nas Extensões do Chrome)</span>`;
                    document.body.prepend(alerta);
                }
            }
        } catch (e) {
            console.log("Erro ao verificar atualização do Addon PlatTransp:", e);
        }
    }
    
    if (window === window.top) {
        verificarAtualizacao();
    }

    const urlAtual = window.location.href;

    if (urlAtual.includes('solicitacoes_transporte_realizadas') || document.getElementById('id_unidade_selecionada')) {
        if (typeof window.iniciarPaginaPesquisa === 'function') window.iniciarPaginaPesquisa();
    } else if (urlAtual.includes('ficha_transporte')) {
        if (typeof window.iniciarPaginaFicha === 'function') window.iniciarPaginaFicha();
    }

    // Função global que interrompe qualquer cálculo OSRM a decorrer
    window.cancelarProcessamentosAssistente = function() {
        if (window.osrmAbortController) {
            window.osrmAbortController.abort();
        }
        window.osrmAbortController = new AbortController();
    };

    function monitorarCicloDeVidaModal() {
        if (typeof window.FechaModal === 'function' && !window.FechaModalMonitorado) {
            const originalFechaModal = window.FechaModal;
            window.FechaModalMonitorado = true;
            
            window.FechaModal = function(...args) {
                const btn = document.getElementById('btn-assistente-transporte');
                const mod = document.getElementById('modal-assistente-analise');
                if (btn) btn.remove();
                if (mod) mod.remove();
                
                window.mapaSincronizado = false;
                window.dadosGeograficos = null;
                window.currentStudentId = null; 
                
                // MATA OS PROCESSOS EM BACKGROUND
                if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
                
                originalFechaModal.apply(this, args);
            };
        }

        const iframePlatform = document.getElementById('img01'); 
        if (iframePlatform && !iframePlatform.dataset.monitoradoLoad) {
            iframePlatform.dataset.monitoradoLoad = "true";
            
            iframePlatform.addEventListener('load', () => {
                const mod = document.getElementById('modal-assistente-analise');
                if (mod) mod.remove();
                
                window.mapaSincronizado = false;
                window.dadosGeograficos = null;
                window.currentStudentId = null;

                if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
            });
        }
    }

    setInterval(() => {
        // Respect APP_SCOPE for scope-aware hierarchy
        const scope = window.APP_SCOPE || window;
        if (typeof scope.gerenciarBotaoAssistente === 'function') {
            scope.gerenciarBotaoAssistente();
        }
        monitorarCicloDeVidaModal();
    }, 1000);

})();