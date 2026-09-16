// ============================================================================
// 🔘 SISTEMA CENTRAL DE LOGS DO ASSISTENTE
// ============================================================================
window.DEBUG_ASSISTENTE = true; // 🔴 Mude para false quando quiser DESLIGAR todos os logs de debug

window._ultimoLogCache = {};

/**
 * Exibe logs de debug com tag formatada e proteção contra repetição excessiva em loop/setInterval.
 * @param {string} modulo Tag do módulo (ex: 'GEO', 'ASSISTENTE', 'FICHA')
 * @param {string} mensagem Mensagem do log
 * @param  {...any} args Argumentos adicionais
 */
window.logDebug = function(modulo, mensagem, ...args) {
    if (!window.DEBUG_ASSISTENTE) return;

    const chaveLog = `${modulo}:${mensagem}`;
    const agora = Date.now();

    // Evita imprimir exatamente a mesma mensagem se disparada em menos de 1,5 segundos
    if (window._ultimoLogCache[chaveLog] && (agora - window._ultimoLogCache[chaveLog] < 1500)) {
        return;
    }
    window._ultimoLogCache[chaveLog] = agora;

    console.log(`[${modulo.toUpperCase()}] ${mensagem}`, ...args);
};

window.logErro = function(modulo, mensagem, ...args) {
    // Erros graves sempre serão exibidos
    console.error(`[${modulo.toUpperCase()}] ❌ ${mensagem}`, ...args);
};

// Escopo auto-executável: inicializa o Addon, faz chamadas iniciais dependendo da URL e configura o monitoramento do sistema.
(function() {
    'use strict';

    // Obtém a versão e o ambiente diretamente do manifesto da extensão
    const manifest = (typeof chrome !== 'undefined' && chrome?.runtime?.getManifest) 
        ? chrome.runtime.getManifest() 
        : null;
    const VERSAO_ATUAL = manifest ? manifest.version : null;
    const AMBIENTE = manifest ? manifest.config_ambiente || "main" : "main"; // Fallback para main caso não definido

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

    // Quando a plataforma desloga, aparece um link "Clique aqui para relogar" que não funciona. Essa é a correção para interceptar e redirecionar corretamente para a página de logout.
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

    // Identificação de rota e inicialização direta do módulo apropriado no DOM atual
    const urlAtual = window.location.href;

    if (urlAtual.includes('solicitacoes_transporte_realizadas') || document.getElementById('id_unidade_selecionada')) {
        if (typeof window.iniciarPaginaPesquisa === 'function') window.iniciarPaginaPesquisa();
    } else if (urlAtual.includes('ficha_transporte')) {
        if (typeof window.iniciarPaginaFicha === 'function') window.iniciarPaginaFicha();
    }

    // Interrompe e descarta as solicitações de busca de distância (OSRM) para poupar uso de CPU e memória.
    window.cancelarProcessamentosAssistente = function() {
        if (window.osrmAbortController) {
            try { window.osrmAbortController.abort(); } catch(e) {}
        }
        window.osrmAbortController = null;
    };

})();