// Escopo auto-executável: inicializa o Addon, faz chamadas iniciais dependendo da URL e configura o monitoramento do sistema.
(function() {
    'use strict';

    // Obtém a versão e o ambiente diretamente do manifesto da extensão
    const MANIFESTO = chrome.runtime.getManifest();
    const VERSAO_ATUAL = MANIFESTO.version; 
    const AMBIENTE = MANIFESTO.config_ambiente || "main"; // Fallback para main caso não definido

    // Constrói a URL de checagem apontando para a branch correspondente do ambiente
    const URL_VERSAO = `https://raw.githubusercontent.com/tonn3r/PlatTransp/${AMBIENTE}/version.json`;

    async function verificarAtualizacao() {
        try {
            const response = await fetch(URL_VERSAO + "?t=" + new Date().getTime());
            
            if (!response.ok) {
                console.warn(`Addon PlatTransp [${AMBIENTE.toUpperCase()}]: Não foi possível checar a versão (Erro ${response.status}).`);
                return;
            }

            const dados = await response.json();
            
            if (dados.version !== VERSAO_ATUAL) {
                if (!document.getElementById('alerta-atualizacao-addon')) {
                    const alerta = document.createElement('div');
                    alerta.id = 'alerta-atualizacao-addon';
                    alerta.style = "position:fixed; top:0; left:0; width:100%; background:#e74c3c; color:white; text-align:center; padding:12px; z-index:999999; font-family:verdana; font-size:13px; font-weight:bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3);";
                    
                    // Define a cor de fundo com base no canal de atualização para alertar o usuário visualmente
                    if (AMBIENTE === "teste") {
                        alerta.style.backgroundColor = "#d35400"; // Laranja para ambiente de teste
                    }

                    alerta.innerHTML = `⚠️ NOVA ATUALIZAÇÃO DISPONÍVEL PARA O CANAL [${AMBIENTE.toUpperCase()}] (${dados.version})!<br>
                    Sua versão instalada é a ${VERSAO_ATUAL}.<br>
                    <a href="${dados.url}" style="color:#ffeb3b; text-decoration:underline; font-size:15px; display:inline-block; margin-top:5px;">📥 Clique aqui para baixar o ZIP de atualização</a> 
                    <span style="font-size:11px; font-weight:normal; margin-left:10px;">(Após baixar, extraia, substitua os arquivos antigos da pasta e clique no ícone de 'Atualizar' na página chrome://extensions)</span>`;
                    
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

    // Blindagem contra erros de módulos legados da página principal.php
    if (typeof window.AbreModulo !== 'function') {
        window.AbreModulo = function(...args) {
            if (typeof console !== 'undefined' && console.debug) {
                console.debug('[PlatTransp] Chamada para AbreModulo interceptada e silenciada preventivamente.', args);
            }
            return false;
        };
    }

    // Quando a plataforma desloga, aparece um link "Clique aqui para relogar" que nao funciona.  Essa é a correção para interceptar e redirecionar corretamente para a página de logout.
const interceptarLinkSessaoExpirada = (contextoDoc) => {
        if (!contextoDoc) return;
        const links = contextoDoc.querySelectorAll('a[href*="login/exit.php"]');
        links.forEach(link => {
            if (!link.dataset.plattranspCorrigido) {
                link.dataset.plattranspCorrigido = "true";
                // Força a URL absoluta correta e o carregamento na raiz da janela (_top)
                link.href = "http://plataforma-se2/login/exit.php";
                link.target = "_top";
                
                // Fallback via evento de clique para prevenir qualquer desvio relativo do navegador
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.top.location.href = "http://plataforma-se2/login/exit.php";
                });
            }
        });
    };

// Monitora o DOM para capturar o HTML de erro assim que ele for injetado de forma assíncrona
    const observerSessao = new MutationObserver(() => {
        interceptarLinkSessaoExpirada(document);
    });
    observerSessao.observe(document.body || document.documentElement, { childList: true, subtree: true });
    interceptarLinkSessaoExpirada(document);

    const urlAtual = window.location.href;

    if (urlAtual.includes('solicitacoes_transporte_realizadas') || document.getElementById('id_unidade_selecionada')) {
        if (typeof window.iniciarPaginaPesquisa === 'function') window.iniciarPaginaPesquisa();
    } else if (urlAtual.includes('ficha_transporte')) {
        if (typeof window.iniciarPaginaFicha === 'function') window.iniciarPaginaFicha();
    }

    // Interrompe e descarta as solicitações de busca de distância (OSRM) para poupar uso de CPU e memória.
    // Função global que interrompe qualquer cálculo OSRM a decorrer
    window.cancelarProcessamentosAssistente = function() {
        if (window.osrmAbortController) {
            try { window.osrmAbortController.abort(); } catch(e) {}
        }
        // limpar referência para evitar controllers pendentes
        window.osrmAbortController = null;
    };

    // Remove os modais, botões e limpa o armazenamento global do Assistente de Análise.
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

    // Empacota a função "FechaModal" nativa para rodar nossa limpeza interna sempre que um modal for fechado no SE2.
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

    // Tenta sobrescrever funções vitais e acompanhar iframes carregados para embutir as modificações necessárias sem perdas.
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