// Remove os acentos e normaliza os caracteres de um texto, além de passá-lo para maiúsculas.
window.normalizarTexto = function(texto) {
    if (!texto) return "";

    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/º|ª/g, "O")
        .trim();
};

// --- SECTION: SHARED STORE MANAGEMENT ---
// NOVA LÓGICA:
// - Estado persistido em elemento hidden no DOM
// - Sem dependência de APP_SCOPE
// - Sem dependência de parent/top/window compartilhado
// - Compatível com iframe, frameset e acesso direto

// Busca ou cria o elemento de formulário escondido que armazena dados globais compartilhados da sessão.
window.getSharedStoreElement = function() {
    let targetDoc = document;
    try {
        if (window.top && window.top.document) {
            targetDoc = window.top.document;
        }
    } catch(e) {}
    
    let el = targetDoc.getElementById('plattransp-shared-store');

    if (!el) {
        el = targetDoc.createElement('input');
        el.type = 'hidden';
        el.id = 'plattransp-shared-store';
        el.value = '{}';

        (targetDoc.body || targetDoc.documentElement).appendChild(el);
    }

    return el;
};

function blindarElementosAnalise(doc) {
    const selectMotivo = doc.getElementById("status_motivo_");

    if (selectMotivo) {
        console.log("[PLUGIN] Elemento select encontrado. Iniciando correção estrutural e de eventos...");

        // --- CORREÇÃO ESTRUTURAL (DOM EXTRACTION) ---
        const elStatusDetalhes = doc.getElementById("status_detalhes_div");
        const elEscolaProxima = doc.getElementById("escola_mais_proxima_div");

        // Se ambos existirem e um estiver erroneamente dentro do outro
        if (elStatusDetalhes && elEscolaProxima && elEscolaProxima.contains(elStatusDetalhes)) {
            console.log("[PLUGIN] Detectado status_detalhes_div dentro de escola_mais_proxima_div. Corrigindo estrutura...");
            
            // Move o status_detalhes_div para fora, posicionando-o logo após o escola_mais_proxima_div
            elEscolaProxima.after(elStatusDetalhes);
            
            console.log("[PLUGIN] ✅ Estrutura corrigida! As divs agora são irmãs independentes.");
        }

        // --- MANIPULAÇÃO DE EVENTOS ---
        // Remove completamente o atributo nativo onchange para evitar que chame a função da página
        selectMotivo.removeAttribute("onchange");

        // Criamos a função de exibição robusta que força a visibilidade
        const aplicarRegrasVisibilidade = () => {
            const valorSelecionado = selectMotivo.value || "";

            // Elementos estruturais que SEMPRE devem ficar visíveis (independente de herança agora que estão separados)
            const IDsSempreVisiveis = ["distancia_aferida_div", "status_detalhes_div", "botao_salvar_modal"];
            IDsSempreVisiveis.forEach(id => {
                const el = doc.getElementById(id);
                if (el) {
                    el.style.setProperty("display", "block", "important");
                    el.style.setProperty("visibility", "visible", "important");
                    el.style.setProperty("opacity", "1", "important");
                }
            });

            // Elemento dinâmico (escola_mais_proxima_div) - agora pode sumir sem levar o status_detalhes_div junto
            const elEscolaProximaAtualizado = doc.getElementById("escola_mais_proxima_div");
            if (elEscolaProximaAtualizado) {
                if (valorSelecionado.toUpperCase().includes("OPCAO")) {
                    elEscolaProximaAtualizado.style.setProperty("display", "block", "important");
                    elEscolaProximaAtualizado.style.setProperty("visibility", "visible", "important");
                    elEscolaProximaAtualizado.style.setProperty("opacity", "1", "important");
                } else {
                    elEscolaProximaAtualizado.style.setProperty("display", "none", "important");
                }
            }
        };

        // Atribuímos o novo evento de mudança diretamente no elemento
        selectMotivo.onchange = aplicarRegrasVisibilidade;

        // Executa uma vez no carregamento para aplicar o estado inicial baseado na opção atual
        aplicarRegrasVisibilidade();

    } else {
        // Caso o select ainda não esteja renderizado na tela, tenta novamente
        setTimeout(() => blindarElementosAnalise(doc), 200);
    }
}

// Pega os valores armazenados no estado global (shared store) a partir do elemento escondido do DOM.
window.getSharedStore = function() {
    const el = window.getSharedStoreElement();

    if (!el) return {};

    try {
        return JSON.parse(el.value || '{}');
    } catch (e) {
        console.error('Erro parse shared store:', e);
        return {};
    }
};

// Pega o valor correspondente a uma chave específica armazenada no estado global.
window.getSharedStoreValue = function(key) {
    const store = window.getSharedStore();
    return store ? store[key] : undefined;
};

// Atualiza ou insere múltiplos dados no estado global (shared store) através de um objeto.
window.setSharedStore = function(updates) {
    const el = window.getSharedStoreElement();

    if (!el) return null;

    const store = window.getSharedStore();

    Object.assign(store, updates || {});

    el.value = JSON.stringify(store);

    return store;
};

// Define o valor de uma chave específica e atualiza o estado global na página.
window.setSharedStoreValue = function(key, value) {
    const store = window.getSharedStore();

    store[key] = value;

    const el = window.getSharedStoreElement();

    if (!el) return null;

    el.value = JSON.stringify(store);

    return value;
};

// Insere um botão com um link de pesquisa ao lado do endereço na ficha para encontrar outros alunos na mesma rua.
window.aplicarLinkPesquisaEndereco = function() {
    const docAlvo = document;

    let elEndereco = null;
    let textoOriginal = "";

    const legends = Array.from(docAlvo.querySelectorAll('legend'));

    const legendEnderecos = legends.find(
        el => el.innerText.trim() === 'Endereço'
    );

    if (legendEnderecos) {
        const container = legendEnderecos.closest('.set_inner');

        if (container) {
            elEndereco = container.querySelector('span.texto_dados b u');

            if (elEndereco) {
                textoOriginal = elEndereco.innerText;
            }
        }
    }

    if (!textoOriginal) {
        const elInput = docAlvo.getElementById('endereco');

        if (elInput) {
            textoOriginal = elInput.value || elInput.innerText;
            elEndereco = elInput;
        }
    }

    
    if (!textoOriginal) return;

    let ruaLimpa = textoOriginal.split(',')[0].trim();

    const prefixos =
        /^(RUA|R\.|AVENIDA|AV\.|AV|TRAVESSA|TRV\.|VIELA|PRA[ÇC]A|ESTRADA|ALAMEDA|RODOVIA|LADEIRA|BECO|MARGINAL)\s+/i;

    ruaLimpa = ruaLimpa.replace(prefixos, '').trim();

    const particulas = /\b(DO|DA|DOS|DAS)\b/gi;

    ruaLimpa = ruaLimpa
        .replace(particulas, '')
        .replace(/\s+/g, ' ')
        .trim();

    const baseUrl =
        window.location.href.split('ficha_transporte')[0];

    const moduloPath = "modulos/transporte_escolar/";

    const prefixo =
        baseUrl.includes(moduloPath)
            ? ""
            : moduloPath;

    const urlPesquisa =
        `${baseUrl}${prefixo}solicitacoes_transporte_realizadas.php?endereco=${encodeURIComponent(ruaLimpa)}`;

    if (elEndereco.tagName === 'U') {

        elEndereco.style.cursor = 'pointer';
        elEndereco.style.color = '#2980b9';

        elEndereco.title =
            `Pesquisar outros alunos na rua: ${ruaLimpa}`;

        if (!elEndereco.dataset.boundclick) {
            elEndereco.dataset.boundclick = 'true';
            elEndereco.addEventListener('click', function() {
                window.open(urlPesquisa, '_blank');
            });
        }

    } else {

        if (!docAlvo.getElementById('link-pesquisa-rua')) {

            const btnPesquisa = docAlvo.createElement('a');

            btnPesquisa.id = 'link-pesquisa-rua';
            btnPesquisa.href = urlPesquisa;
            btnPesquisa.target = '_blank';

            btnPesquisa.innerHTML =
                ' 🔍 Pesquisar Rua';

            btnPesquisa.style.cssText =
                'font-size: 11px; margin-left: 10px; color: #2980b9; text-decoration: none; font-weight: bold; cursor: pointer;';

            btnPesquisa.title =
                `Pesquisar outros alunos na rua: ${ruaLimpa}`;

            elEndereco.parentNode.insertBefore(
                btnPesquisa,
                elEndereco.nextSibling
            );
        }
    }
};

// Inicia o processo automático de captura de informações (como RA e status) e chama outras funções auxiliares quando a página da ficha é carregada.
window.iniciarPaginaFicha = function() {

    // Captura o RA do aluno (se houver) e o salva no estado global da aplicação.
    // Esta informação será utilizada pelo assistente na etapa de "Encaminhamento".
    const inputRaProdesp = document.getElementById('ra_prodesp_search');
    if (inputRaProdesp && typeof window.setSharedStoreValue === 'function') {
        window.setSharedStoreValue('raAluno', inputRaProdesp.value.trim());
    }

    const statusDiv = document.getElementById('status_atendimento') || document.getElementById('mostra_status_pedido');
    const textoStatus = statusDiv ? (statusDiv.innerText || '').toUpperCase() : '';
    const textoStatusSemAcento = textoStatus.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isEmAnalise = textoStatusSemAcento.includes('EM ANALISE');

    if (typeof window.setSharedStoreValue === 'function') {
        window.setSharedStoreValue('statusFicha', textoStatus);
        window.setSharedStoreValue('statusFichaEmAnalise', isEmAnalise);
    }

    if (
        typeof window.realizarCalculosIniciaisDistancia ===
        'function'
    ) {
        window.realizarCalculosIniciaisDistancia();
    }

    if (
        typeof window.aplicarLinkPesquisaEndereco ===
        'function'
    ) {
        window.aplicarLinkPesquisaEndereco();
    }


    if (typeof window.blindarElementosAnalise === 'function') {
        window.blindarElementosAnalise(document);
    }

    const storageHelper = {

        save: function(key, data, callback) {

            if (
                typeof chrome !== 'undefined' &&
                chrome.storage
            ) {

                let obj = {};

                obj[key] = data;

                chrome.storage.local.set(
                    obj,
                    callback
                );

            } else {

                localStorage.setItem(
                    key,
                    JSON.stringify(data)
                );

                if (callback) callback();
            }
        },

        get: function(key, callback) {

            if (
                typeof chrome !== 'undefined' &&
                chrome.storage
            ) {

                chrome.storage.local.get(
                    [key],
                    (result) => callback(result[key])
                );

            } else {

                const item =
                    localStorage.getItem(key);

                callback(
                    item
                        ? JSON.parse(item)
                        : null
                );
            }
        }
    };

    const form =
        document.querySelector('form[name="form1"]');

    if (!form) return;

    storageHelper.get(
        'dados_analise_assistente',
        (dadosSalvos) => {

            if (!dadosSalvos) return;

            if (
                dadosSalvos.distanciamedia ||
                dadosSalvos.distancia
            ) {

                const valDist =
                    dadosSalvos.distanciamedia ||
                    dadosSalvos.distancia;

                const inputDist =
                    form.querySelector(
                        'input[name="distancia_aferida"]'
                    );

                if (inputDist) {
                    inputDist.value =
                        valDist.replace(/[^0-9]/g, '');
                }
            }

            const textarea =
                form.querySelector(
                    'textarea[name="status_detalhes"]'
                );

            if (textarea) {

                let textoArr = [];

                if (
                    dadosSalvos.analise ||
                    dadosSalvos.obs
                ) {

                    textoArr.push(
                        `Análise Base: ${dadosSalvos.analise || ''} | ${dadosSalvos.obs || ''}`
                    );
                }

                const dbLocal =
                    window.escolasDB || [];

                // CORREÇÃO APLICADA: Obtém as coordenadas da rota calculada ou do histórico persistido
                const dadosRota = typeof window.getSharedStoreValue === 'function' ? window.getSharedStoreValue('dadosGeraisRota') : null;
                const latAluno = dadosRota?.coordAlunoGPS?.lat || dadosSalvos?.lat;
                const lonAluno = dadosRota?.coordAlunoGPS?.lon || dadosSalvos?.lon;

                if (
                    latAluno &&
                    lonAluno &&
                    dbLocal.length > 0
                ) {

                    textoArr.push(
                        `\n--- ESCOLAS MAIS PRÓXIMAS (Em linha reta) ---`
                    );

                    const escolasCalculadas =
                        dbLocal
                            .map(esc => {

                                return {
                                    nome: esc.nome,
                                    distancia:
                                        window.calcularDistanciaHaversine(
                                            latAluno,
                                            lonAluno,
                                            esc.lat,
                                            esc.lon
                                        )
                                };

                            })
                            .sort(
                                (a, b) =>
                                    a.distancia -
                                    b.distancia
                            );

                    const top3 =
                        escolasCalculadas.slice(0, 3);

                    top3.forEach((esc, index) => {
                        textoArr.push(
                            `${index + 1}º ${esc.nome}`
                        );
                    });
                }

                textarea.value =
                    textoArr.join('\n');

                try {

                    textarea.dispatchEvent(
                        new Event(
                            'change',
                            { bubbles: true }
                        )
                    );

                } catch(e){}
            }
        }
    );
};

// Realiza a verificação e o cálculo prévio de distância por endereço e coordenadas, e salva as informações no estado compartilhado.
window.realizarCalculosIniciaisDistancia = async function(forcarRecalculo = false) {
    const docAlvo = document;

    let idSolInput =
        docAlvo.querySelector('input[name="id_solicitacao"]') ||
        docAlvo.querySelector('input[name="id"]');

    let idFicha = idSolInput ? (idSolInput.value || "").trim() : '';

    if (!idFicha) {
        console.warn('[ASSISTENTE] ID da solicitação/ficha não encontrado. Não é possível ler/salvar cache.');
    }

    const NOME_CACHE_STORAGE = 'cache_calculos_fichas';
    const CHAVE_REGISTRO = idFicha ? `ficha_${idFicha}` : null;

    // Se NÃO forçado e temos ID válido, tenta recuperar do cache
    if (!forcarRecalculo && CHAVE_REGISTRO) {
        const cacheSalvo = window.obterValorCachePersistente(NOME_CACHE_STORAGE, CHAVE_REGISTRO);
        if (cacheSalvo && cacheSalvo.dadosGeraisRota) {
            console.log(`[ASSISTENTE] ⚡ Dados de rota recuperados do cache persistente para a ficha: ${idFicha}`);
            
            // Restaura o SharedStore global da sessão com os dados cacheados
            window.setSharedStore({
                DistDiferentesEntreMapas: cacheSalvo.DistDiferentesEntreMapas,
                distanciaCoord: cacheSalvo.distanciaCoord,
                distanciaEnd: cacheSalvo.distanciaEnd
            });
            window.setSharedStoreValue('dadosGeraisRota', cacheSalvo.dadosGeraisRota);
            
            if (cacheSalvo.modoTransporteAtual) {
                window.setSharedStoreValue('modoTransporteAtual', cacheSalvo.modoTransporteAtual);
                // Atualiza o texto visual do botão se for carro
                const toggleContainer = document.getElementById('mapa-toggle-container');
                if (toggleContainer && toggleContainer.children[1] && cacheSalvo.modoTransporteAtual === 'carro') {
                    toggleContainer.children[1].innerHTML = "🚗 De Carro";
                }
            }
            return; // Interrompe a execução poupando APIs externas
        }
    }

    // --- SE NÃO TIVER CACHE OU SE FOR FORÇADO, EXECUTA O CÁLCULO TRADICIONAL ---
    let enderecoCompleto = "";

    const inputRua = docAlvo.querySelector('input#endereco') || docAlvo.querySelector('input[name="endereco"]');
    const inputNum = docAlvo.querySelector('input#endereco_numero_residencia') || docAlvo.querySelector('input[name="endereco_numero_residencia"]');
    const inputBairro = docAlvo.querySelector('input#endereco_bairro') || docAlvo.querySelector('input[name="endereco_bairro"]');

    let endRua = inputRua ? (inputRua.value || "").trim() : '';
    let endNum = inputNum ? (inputNum.value || "").trim() : '';
    let endBairro = inputBairro ? (inputBairro.value || "").trim() : '';

    if (!endRua) {
        const elRua = docAlvo.getElementById('endereco');
        endRua = elRua ? (elRua.value || elRua.innerText || "").trim() : '';
    }
    if (!endNum) {
        const elNum = docAlvo.getElementById('endereco_numero_residencia');
        endNum = elNum ? (elNum.value || elNum.innerText || "").trim() : '';
    }
    if (!endBairro) {
        const elBairro = docAlvo.getElementById('endereco_bairro');
        endBairro = elBairro ? (elBairro.value || elBairro.innerText || "").trim() : '';
    }

    enderecoCompleto = [endRua, endNum, endBairro].filter(Boolean).join(", ");

    if (!enderecoCompleto || enderecoCompleto.length < 5) {
        const legends = Array.from(docAlvo.querySelectorAll('legend'));
        const legendEnd = legends.find(el => el.innerText.trim() === 'Endereço' || el.innerText.trim() === 'Residência');
        if (legendEnd) {
            const container = legendEnd.closest('.set_inner') || legendEnd.parentElement;
            if (container) {
                const spanDados = container.querySelector('span.texto_dados');
                if (spanDados) {
                    enderecoCompleto = spanDados.innerText.replace(/\s+/g, ' ').trim();
                }
            }
        }
    }

    let urlOrigem = window.location.href;
    let basePath = urlOrigem.substring(0, urlOrigem.lastIndexOf('/') + 1);
    let urlFichaNova = basePath + 'ficha_transporte_nova_versao.php?id_solicitacao=' + idFicha;

    let dadosGeo = await window.extrairDadosGeograficos(urlFichaNova);

    if (!dadosGeo || !dadosGeo.geoEscola_Latit) return;

    const isEmAnalise = window.getSharedStoreValue?.('statusFichaEmAnalise');
    if (!isEmAnalise) {
        console.info('[ASSISTENTE] Ficha não está em análise. Pulando chamadas de geolocalização.');
        window.setSharedStore({
            distanciaCoord: null,
            distanciaEnd: null,
            DistDiferentesEntreMapas: false,
            perfilOSRM: 'foot'
        });
        return;
    }

    let coordEndereco = await window.obterCoordenadasPorEndereco(enderecoCompleto);
    let distDiferentes = false;
    let diferencaGeografica = 0;
    
    let distCoordObj = null;
    let distEndObj = null;

    if (coordEndereco && coordEndereco.lat) {
        diferencaGeografica = window.calcularDistanciaHaversine(
            dadosGeo.geoEndereco_Latit, dadosGeo.geoEndereco_Longit,
            coordEndereco.lat, coordEndereco.lon
        );
        distDiferentes = (diferencaGeografica > 200);
    } else {
        coordEndereco = enderecoCompleto;
        distDiferentes = false;
    }

    // Executa as chamadas inteligentes auto-calculáveis
    distCoordObj = await window.calcularTrajetoOSRM(
        dadosGeo.geoEndereco_Latit, dadosGeo.geoEndereco_Longit,
        dadosGeo.geoEscola_Latit, dadosGeo.geoEscola_Longit
    );

    if (typeof coordEndereco === 'string') {
        distEndObj = distCoordObj;
    } else if (distDiferentes) {
        distEndObj = await window.calcularTrajetoOSRM(
            coordEndereco.lat, coordEndereco.lon,
            dadosGeo.geoEscola_Latit, dadosGeo.geoEscola_Longit
        );
    } else {
        distEndObj = distCoordObj;
    }

    const distCoordFinal = distCoordObj ? distCoordObj.distancia : null;
    const distEndFinal = distEndObj ? distEndObj.distancia : null;
    // O perfil final armazenado será baseado no trajeto da coordenada do GPS do aluno
    const perfilFinalAdotado = distCoordObj ? distCoordObj.modoUtilizado : 'foot';

    window.setSharedStore({
        DistDiferentesEntreMapas: distDiferentes,
        distanciaCoord: distCoordFinal,
        distanciaEnd: distEndFinal
    });

    let objRota = {
        coordAlunoGPS: { lat: dadosGeo.geoEndereco_Latit, lon: dadosGeo.geoEndereco_Longit },
        coordAlunoEnd: coordEndereco,
        distanciaCoord: distCoordFinal,
        distanciaEnd: distEndFinal,
        perfilOSRM: perfilFinalAdotado
    };

    window.setSharedStoreValue('dadosGeraisRota', objRota);
    window.setSharedStoreValue('modoTransporteAtual', perfilFinalAdotado === 'driving' ? 'carro' : 'pe');

    // Remove referências visuais ao antigo container manipulador se ele ainda existir no DOM
    const toggleContainer = document.getElementById('mapa-toggle-container');
    if (toggleContainer) {
        toggleContainer.style.display = 'none'; 
    }

    if (typeof window.atualizarURLsMapasGlobal === 'function') {
        window.atualizarURLsMapasGlobal();
    }

    // --- SALVA NO CACHE PERSISTENTE ANTES DE CONCLUIR ---
    if (CHAVE_REGISTRO) {
        const dadosParaGravar = {
            DistDiferentesEntreMapas: distDiferentes,
            distanciaCoord: distCoordFinal,
            distanciaEnd: distEndFinal,
            modoTransporteAtual: perfilFinalAdotado === 'driving' ? 'carro' : 'pe',
            dadosGeraisRota: objRota
        };
        window.gerenciarEsalvarCachePersistente(NOME_CACHE_STORAGE, CHAVE_REGISTRO, dadosParaGravar);
        console.log(`[ASSISTENTE] ✅ Dados salvos no cache com sucesso automático para ficha: ${idFicha}`);
    }
};


window.atualizarInputDistancia = function(distanciaEmMetros) {
    const docContexto = typeof docAlvo !== 'undefined' ? docAlvo : document;
    const inputDist = docContexto.getElementById('input-assistente-dist');
    
    if (inputDist) {
        if (distanciaEmMetros === undefined || distanciaEmMetros === null || isNaN(distanciaEmMetros)) {
            inputDist.value = "---";
            return;
        }
        // Converte metros em formato km legível (ex: 1.25 km)
        const valorKm = (distanciaEmMetros / 1000).toFixed(2);
        inputDist.value = `${valorKm} km`;
        console.log(`[ASSISTENTE] Campo input-assistente-dist atualizado para: ${valorKm} km`);
    }
};

window.verificaArqDiastur = async function(documentoContexto = document) {
    const targetDoc = documentoContexto || document;
    console.log("[AUDITORIA-LOTE] Iniciando verificação de ocorrências...");

    const primeiraSecaoOcorrencias = targetDoc.querySelector('#div_ocorrencias');
    if (!primeiraSecaoOcorrencias) {
        console.warn("[AUDITORIA-LOTE] Primeiro #div_ocorrencias não localizado neste contexto.");
        return;
    }

    // --- 1. CAPTURA DE DADOS DO ALUNO ---
    let anoAtendimento = "";
    const inputAno = targetDoc.querySelector('input[name="ano_atendimento"]');
    if (inputAno && inputAno.value.trim()) {
        anoAtendimento = inputAno.value.trim();
    } else {
        const matchAno = primeiraSecaoOcorrencias.innerText.match(/\b(20\d{2})\b/);
        anoAtendimento = matchAno ? matchAno[1] : new Date().getFullYear();
    }
    
    let raAlunoRaw = "";
    const inputRa = targetDoc.getElementById('ra_prodesp_search');
    if (inputRa) raAlunoRaw = inputRa.value || "";

    if (typeof window.getSharedStoreValue === 'function'&& !raAlunoRaw) {
        raAlunoRaw = window.getSharedStoreValue('raAluno') || "";
    }
    
    const raAlunoTarget = raAlunoRaw.replace(/\D/g, '');

    if (!raAlunoTarget) {
        console.warn("[AUDITORIA-LOTE] Falha: RA não localizado no DOM.");
        return;
    }

    // --- 2. LOCALIZAR O ARQUIVO DO LOTE NA TABELA ---
    let tdArquivo = null;
    let numeroArquivo = "";
    const celulas = primeiraSecaoOcorrencias.querySelectorAll('td');

    celulas.forEach(td => {
        if (td.dataset.arqProcessado === "true") return;
        const matchTxt = td.innerText.match(/Arq\s+(\d+)/i);
        if (matchTxt) {
            tdArquivo = td;
            numeroArquivo = matchTxt[1];
        }
    });

    if (!tdArquivo || !numeroArquivo) {
        console.log("[AUDITORIA-LOTE] Nenhuma linha 'Arq XXXX' elegível.");
        return;
    }

    tdArquivo.dataset.arqProcessado = "true";
    const urlArquivo = `http://plataforma-se2/arquivos/transporte/arquivos%20empresa/Arquivo_${numeroArquivo}_${anoAtendimento}.xlsx`;

    tdArquivo.innerHTML = `<a href="${urlArquivo}" target="_blank" style="color: #2980b9; font-weight: bold; text-decoration: underline;" title="Baixar planilha do lote">Arq ${numeroArquivo} 📥</a>`;

    // --- 3. IDENTIFICAR A ESCOLA (DESTINO NO GOOGLE MAPS) ---
    let destinoEscola = "";
    const inputIdUnidade = targetDoc.querySelector('input[name="id_unidade"]') || targetDoc.querySelector('input#id_unidade');
    
    if (inputIdUnidade && window.escolasDB) {
        const idBusca = inputIdUnidade.value.trim();
        const escolaEncontrada = window.escolasDB.find(e => String(e.id) === idBusca);
        
        if (escolaEncontrada) {
            if (escolaEncontrada.lat && escolaEncontrada.lon) {
                destinoEscola = `${escolaEncontrada.lat},${escolaEncontrada.lon}`;
            } else if (escolaEncontrada.rua) {
                destinoEscola = `${escolaEncontrada.rua}, ${escolaEncontrada.numero || 'S/N'} - ${escolaEncontrada.bairro || ''}`;
            }
        }
    }

    // --- 4. LEITURA BRUTA DO XLSX E CRUZAMENTO DE DADOS ---
    let enderecoXlsx = null;
    let enderecoXlsxURL = null;

    try {
        const loadingMsg = targetDoc.createElement('span');
        loadingMsg.innerHTML = " <span style='font-size:10px; color:#e67e22;'>⏳ Lendo endereço do XLSX...</span>";
        tdArquivo.appendChild(loadingMsg);

        if (typeof XLSX === 'undefined') {
            await new Promise((resolve) => {
                const script = targetDoc.createElement('script');
                script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
                script.onload = () => resolve();
                script.onerror = () => resolve();
                targetDoc.head.appendChild(script);
            });
        }

        if (typeof XLSX !== 'undefined') {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const resposta = await fetch(urlArquivo, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (resposta.ok) {
                const buffer = await resposta.arrayBuffer();
                const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                
                // header: 1 transforma a planilha em um Array de Arrays (Linhas x Colunas)
                // Isso ignora formatações ruins e títulos fora de lugar
                const matrizDados = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });

                // Procura em qual linha exata o RA do aluno está (em qualquer coluna)
                let indiceLinhaAluno = -1;
                for (let i = 0; i < matrizDados.length; i++) {
                    for (let j = 0; j < matrizDados[i].length; j++) {
                        const valorCelula = String(matrizDados[i][j] || '').replace(/\D/g, '');
                        // Confirma se o conteúdo da célula é exatamente o RA procurado
                        if (valorCelula === raAlunoTarget && raAlunoTarget.length > 4) {
                            indiceLinhaAluno = i;
                            break;
                        }
                    }
                    if (indiceLinhaAluno !== -1) break;
                }

                // Procura a linha que contém o Cabeçalho (buscando palavras chaves)
                let indiceCabecalho = 0;
                for (let i = 0; i < matrizDados.length; i++) {
                    const textoLinhaInteira = matrizDados[i].join(' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                    if (textoLinhaInteira.includes('ENDERECO') || textoLinhaInteira.includes('LOGRADOURO')) {
                        indiceCabecalho = i;
                        break;
                    }
                }

                if (indiceLinhaAluno !== -1) {
                    const cabecalho = matrizDados[indiceCabecalho];
                    const dadosAluno = matrizDados[indiceLinhaAluno];
                    
                    let rua = "", numero = "S/N", bairro = "", cep = "", complemento = "";

                    // Varre a linha de cabeçalho para saber em qual coluna está cada dado
                    for (let col = 0; col < cabecalho.length; col++) {
                        let nomeCol = String(cabecalho[col] || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
                        let valorCol = String(dadosAluno[col] || '').trim();
                        
                        if (nomeCol.includes('ENDERECO') || nomeCol.includes('LOGRADOURO') || nomeCol.includes('RUA')) rua = valorCol;
                        else if (nomeCol === 'NUMERO' || nomeCol === 'N' || nomeCol === 'NUM') numero = valorCol;
                        else if (nomeCol.includes('BAIRRO')) bairro = valorCol;
                        else if (nomeCol.includes('CEP')) cep = valorCol;
                        else if (nomeCol.includes('COMPLEMENTO')) complemento = valorCol;
                    }

                    if (rua) {
                        enderecoXlsx = `${rua}, Nº ${numero}${complemento ? ' - ' + complemento : ''} - ${bairro} (CEP: ${cep})`;
                        enderecoXlsxURL = `${rua}, Nº ${numero}, ${bairro}, São bernardo do Campo, ${cep}`;
                        console.log("[AUDITORIA-LOTE] ✅ Endereço extraído com sucesso da planilha:", enderecoXlsx);
                    }
                } else {
                    console.warn(`[AUDITORIA-LOTE] ❌ Aluno com RA ${raAlunoTarget} não foi encontrado dentro do arquivo XLSX.`);
                }
            }
        }
        loadingMsg.remove();
    } catch (erro) {
        console.warn("[AUDITORIA-LOTE] Erro técnico ao processar o XLSX:", erro);
    }

    
    // --- 5. RENDERIZAÇÃO DA INTERFACE COM A ROTA ---
    if (enderecoXlsx) {
        // Link oficial para traçar rota no Maps
        let urlGoogleMaps = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(enderecoXlsxURL)}`;
        if (destinoEscola) {
            urlGoogleMaps += `&destination=${encodeURIComponent(destinoEscola)}`;
        }

        const elementoLinha = tdArquivo.parentElement;

        if (enderecoXlsx && elementoLinha && elementoLinha.tagName === 'TR') {
            const novaLinha = targetDoc.createElement('tr');
            novaLinha.className = 'linha-info-endereco-auditoria';
            novaLinha.style.backgroundColor = '#fcf8e3';
            novaLinha.style.borderLeft = '4px solid #f39c12';
            
            novaLinha.innerHTML = `
                <td colspan="5">
                    <strong>Endereço original do cadastro:</strong> ${enderecoXlsx}
                    <a href="${urlGoogleMaps}" target="_blank" rel="noopener" style="margin-left: 15px; color: #2980b9; font-weight: bold; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">Trajeto</a>
                </td>
            `;
            elementoLinha.parentNode.insertBefore(novaLinha, elementoLinha.nextSibling);
        }

        if (enderecoXlsx && (!elementoLinha || elementoLinha.tagName !== 'TR')) {
            const painelInfo = targetDoc.createElement('div');
            painelInfo.id = 'painel-consolidado-diastur';
            painelInfo.style.cssText = "margin-top: 15px; padding: 12px; background: #ebf5fb; border: 1px solid #a9cce3; border-radius: 6px; color: #21618c; font-family: Arial, sans-serif; font-size: 13px;";
            painelInfo.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <strong style="color: #1b4f72;">📢 Endereço Original Lote/XLSX:</strong> 
                        <span style="color: #2c3e50;">${enderecoXlsx}</span>
                    </div>
                    <a href="${urlGoogleMaps}" target="_blank" rel="noopener" style="background: #e67e22; color: white; padding: 6px 14px; border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 12px;">
                        🚗 Rota (Casa ➔ Escola) ↗
                    </a>
                </div>
            `;
            primeiraSecaoOcorrencias.appendChild(painelInfo);
        }
    }
};

(function() {
    const dispararVerificacao = () => {
        let alvo = document.querySelector('#div_ocorrencias');
        if (alvo) { window.verificaArqDiastur(document); return true; }
        
        const frames = document.querySelectorAll('iframe');
        for (let i = 0; i < frames.length; i++) {
            try {
                let docFr = frames[i].contentDocument || frames[i].contentWindow.document;
                if (docFr && docFr.querySelector('#div_ocorrencias')) {
                    window.verificaArqDiastur(docFr);
                    return true;
                }
            } catch(e) {}
        }
        return false;
    };

    if (!dispararVerificacao()) {
        const obs = new MutationObserver((_, o) => {
            if (dispararVerificacao()) o.disconnect();
        });
        obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
        setTimeout(() => obs.disconnect(), 7000); // Trava de segurança para desativar após 7 segundos
    }
})();

document.addEventListener(
    'DOMContentLoaded',
    window.iniciarPaginaFicha
);

// =========================================================================
// SISTEMA CENTRALIZADO E PERSISTENTE DE CONTROLE DE CACHE (EXPIRAÇÃO DE 7 DIAS E MÁX 100 ITENS)
// =========================================================================
window.gerenciarEsalvarCachePersistente = function(nomeChaveStorage, chaveRegistro, dadosValor) {
    try {
        let cacheCompleto = JSON.parse(localStorage.getItem(nomeChaveStorage) || '{}');
        const agora = Date.now();
        const LIMITE_EXPIRACAO_MS = 7 * 24 * 60 * 60 * 1000; // 7 Dias em milissegundos

        // 1. Limpeza reativa: remove qualquer dado que já tenha expirado o prazo de 7 dias
        for (let k in cacheCompleto) {
            if (cacheCompleto[k] && cacheCompleto[k].timestamp && (agora - cacheCompleto[k].timestamp > LIMITE_EXPIRACAO_MS)) {
                delete cacheCompleto[k];
            }
        }

        // 2. Adiciona ou atualiza o registro pretendido com o carimbo do timestamp atual
        if (dadosValor !== undefined) {
            cacheCompleto[chaveRegistro] = {
                valor: dadosValor,
                timestamp: agora
            };
        }

        // 3. Aplicação do Teto Estrito (Máximo 100 registros)
        let listaChavesAtivas = Object.keys(cacheCompleto);
        if (listaChavesAtivas.length > 100) {
            // Ordena as chaves colocando os timestamps mais antigos no começo do array
            listaChavesAtivas.sort((a, b) => {
                const timeA = cacheCompleto[a]?.timestamp || 0;
                const timeB = cacheCompleto[b]?.timestamp || 0;
                return timeA - timeB;
            });

            // Remove os itens mais antigos até restaurar o limite de 100 itens
            while (listaChavesAtivas.length > 100) {
                const chaveRemover = listaChavesAtivas.shift();
                delete cacheCompleto[chaveRemover];
            }
        }

        localStorage.setItem(nomeChaveStorage, JSON.stringify(cacheCompleto));
    } catch (e) {
        console.error(`❌ Erro crítico ao gerenciar armazenamento do cache [${nomeChaveStorage}]:`, e);
    }
};

window.obterValorCachePersistente = function(nomeChaveStorage, chaveRegistro) {
    try {
        let cacheCompleto = JSON.parse(localStorage.getItem(nomeChaveStorage) || '{}');
        const agora = Date.now();
        const LIMITE_EXPIRACAO_MS = 7 * 24 * 60 * 60 * 1000; // 7 Dias

        if (cacheCompleto[chaveRegistro]) {
            // Verifica se expirou os 7 dias no momento da leitura
            if (agora - cacheCompleto[chaveRegistro].timestamp > LIMITE_EXPIRACAO_MS) {
                delete cacheCompleto[chaveRegistro];
                localStorage.setItem(nomeChaveStorage, JSON.stringify(cacheCompleto));
                return null;
            }
            return cacheCompleto[chaveRegistro].valor;
        }
    } catch (e) {
        return null;
    }
    return null;
};