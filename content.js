(function() {
    'use strict';

    const VERSAO_ATUAL = "3.0"; 
    const URL_VERSAO = "https://raw.githubusercontent.com/tonn3r/PlatTransp/main/version.json";

    async function verificarAtualizacao() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(URL_VERSAO + "?t=" + new Date().getTime(), { signal: controller.signal });
            
            if (!response.ok) {
                console.warn("Addon PlatTransp: Não foi possível checar a versão (Erro " + response.status + ").");
                return;
            }

            const dados = await response.json();
            clearTimeout(timeoutId);
            
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
        // verificarAtualizacao();
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
            try { window.osrmAbortController.abort(); } catch(e) {}
        }
        // limpar referência para evitar controllers pendentes
        window.osrmAbortController = null;
    };

    function ocultarBotaoAssistente() {
        const btn = document.getElementById('btn-assistente-transporte');
        const mod = document.getElementById('modal-assistente-analise');
        if (btn) {
            btn.style.display = 'none';
            btn.remove();
        }
        if (mod) mod.remove();
        window.mapaSincronizado = false;
        if (typeof window.setSharedStoreValue === 'function') {
            window.setSharedStoreValue('dadosGeograficos', null);
        } else {
            window.dadosGeograficos = null;
        }
        window.currentStudentId = null;
        if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
    }

    function envolverFechaModal(originalFechaModal) {
        if (typeof originalFechaModal !== 'function') return originalFechaModal;
        if (originalFechaModal.__plattransp_wrapped) return originalFechaModal;
        const wrapped = function(...args) {
            ocultarBotaoAssistente();
            return originalFechaModal.apply(this, args);
        };
        wrapped.__plattransp_wrapped = true;
        return wrapped;
    }

    function monitorarCicloDeVidaModal() {
        if (typeof window.FechaModal === 'function') {
            window.FechaModal = envolverFechaModal(window.FechaModal);
        } else {
            const descriptor = Object.getOwnPropertyDescriptor(window, 'FechaModal');
            if (!descriptor || descriptor.configurable) {
                let atual = window.FechaModal;
                Object.defineProperty(window, 'FechaModal', {
                    configurable: true,
                    enumerable: true,
                    get() {
                        return atual;
                    },
                    set(valor) {
                        atual = envolverFechaModal(valor);
                    }
                });
            }
        }

        const iframePlatform = document.getElementById('img01'); 
        if (iframePlatform && !iframePlatform.dataset.monitoradoLoad) {
            iframePlatform.dataset.monitoradoLoad = "true";
            
            iframePlatform.addEventListener('load', () => {
                const mod = document.getElementById('modal-assistente-analise');
                if (mod) mod.remove();
                
                window.mapaSincronizado = false;
                if (typeof window.setSharedStoreValue === 'function') {
                    window.setSharedStoreValue('dadosGeograficos', null);
                } else {
                    window.dadosGeograficos = null;
                }
                window.currentStudentId = null;

                if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
            });
        }
    }

    if (!window._plattransp_monitor_interval_set) {
        window._plattransp_monitor_interval_set = true;
        setInterval(() => {
            try {
                if (typeof window.gerenciarBotaoAssistente === 'function') {
                    window.gerenciarBotaoAssistente();
                }
                monitorarCicloDeVidaModal();
            } catch (e) {
                console.error('Erro em monitor loop:', e);
            }
        }, 1500);
    }

})();