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

                if (
                    typeof dados !== 'undefined' &&
                    dados.lat &&
                    dados.lon &&
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
                                            dados.lat,
                                            dados.lon,
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
window.realizarCalculosIniciaisDistancia = async function() {

    const docAlvo = document;

    let enderecoCompleto = "";

    const inputRua =
        docAlvo.querySelector('input#endereco') ||
        docAlvo.querySelector('input[name="endereco"]');

    const inputNum =
        docAlvo.querySelector('input#endereco_numero_residencia') ||
        docAlvo.querySelector('input[name="endereco_numero_residencia"]');

    const inputBairro =
        docAlvo.querySelector('input#endereco_bairro') ||
        docAlvo.querySelector('input[name="endereco_bairro"]');

    let endRua =
        inputRua
            ? (inputRua.value || "").trim()
            : '';

    let endNum =
        inputNum
            ? (inputNum.value || "").trim()
            : '';

    let endBairro =
        inputBairro
            ? (inputBairro.value || "").trim()
            : '';

    if (!endRua) {

        const elRua =
            docAlvo.getElementById('endereco');

        endRua =
            elRua
                ? (
                    elRua.value ||
                    elRua.innerText ||
                    ""
                ).trim()
                : '';
    }

    if (!endNum) {

        const elNum =
            docAlvo.getElementById(
                'endereco_numero_residencia'
            );

        endNum =
            elNum
                ? (
                    elNum.value ||
                    elNum.innerText ||
                    ""
                ).trim()
                : '';
    }

    if (!endBairro) {

        const elBairro =
            docAlvo.getElementById(
                'endereco_bairro'
            );

        endBairro =
            elBairro
                ? (
                    elBairro.value ||
                    elBairro.innerText ||
                    ""
                ).trim()
                : '';
    }

    enderecoCompleto =
        [endRua, endNum, endBairro]
            .filter(Boolean)
            .join(", ");

    if (
        !enderecoCompleto ||
        enderecoCompleto.length < 5
    ) {

        const legends =
            Array.from(
                docAlvo.querySelectorAll('legend')
            );

        const legendEnd =
            legends.find(
                el =>
                    el.innerText.trim() ===
                    'Endereço'
                    ||
                    el.innerText.trim() ===
                    'Residência'
            );

        if (legendEnd) {

            const container =
                legendEnd.closest('.set_inner') ||
                legendEnd.parentElement;

            if (container) {

                const spanDados =
                    container.querySelector(
                        'span.texto_dados'
                    );

                if (spanDados) {

                    enderecoCompleto =
                        spanDados.innerText
                            .replace(/\s+/g, ' ')
                            .trim();
                }
            }
        }
    }

    let idSolInput =
        docAlvo.querySelector(
            'input[name="id_solicitacao"]'
        ) ||
        docAlvo.querySelector(
            'input[name="id"]'
        );

    let idFicha =
        idSolInput
            ? idSolInput.value
            : '';

    let urlOrigem =
        window.location.href;

    let basePath =
        urlOrigem.substring(
            0,
            urlOrigem.lastIndexOf('/') + 1
        );

    let urlFichaNova =
        basePath +
        'ficha_transporte_nova_versao.php?id_solicitacao=' +
        idFicha;

    let dadosGeo =
        await window.extrairDadosGeograficos(
            urlFichaNova
        );

    if (
        !dadosGeo ||
        !dadosGeo.geoEscola_Latit
    ) return;

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

    let coordEndereco =
        await window.obterCoordenadasPorEndereco(
            enderecoCompleto
        );

    let distDiferentes = false;
    let diferencaGeografica = 0;
    let distEndFoot = null;

    if (
        coordEndereco &&
        coordEndereco.lat
    ) {

        diferencaGeografica =
            window.calcularDistanciaHaversine(
                dadosGeo.geoEndereco_Latit,
                dadosGeo.geoEndereco_Longit,
                coordEndereco.lat,
                coordEndereco.lon
            );

        distDiferentes =
            (diferencaGeografica > 200);

    } else {

        coordEndereco = enderecoCompleto;

        distDiferentes = false;
    }

    let distCoordFootObj =
        await window.calcularTrajetoOSRM(
            dadosGeo.geoEndereco_Latit,
            dadosGeo.geoEndereco_Longit,
            dadosGeo.geoEscola_Latit,
            dadosGeo.geoEscola_Longit,
            'foot'
        );
    let distCoordFoot = distCoordFootObj ? distCoordFootObj.distancia : null;

    if (
        typeof coordEndereco === 'string'
    ) {

        distEndFoot = distCoordFoot;

    } else if (distDiferentes) {

        let distEndFootObj =
            await window.calcularTrajetoOSRM(
                coordEndereco.lat,
                coordEndereco.lon,
                dadosGeo.geoEscola_Latit,
                dadosGeo.geoEscola_Longit,
                'foot'
            );
        distEndFoot = distEndFootObj ? distEndFootObj.distancia : null;

    } else {

        distEndFoot = distCoordFoot;
    }

    window.setSharedStore({
        DistDiferentesEntreMapas: distDiferentes,
        distanciaCoord: distCoordFoot,
        distanciaEnd: distEndFoot
    });

    let usarCarro = false;

    let perfilFinal = 'foot';

    if (
        distCoordFoot > 10000 ||
        distEndFoot > 10000
    ) {

        let distCoordCar = distCoordFoot;
        if (distCoordFoot > 10000) {
            let distCoordCarObj = await window.calcularTrajetoOSRM(
                dadosGeo.geoEndereco_Latit,
                dadosGeo.geoEndereco_Longit,
                dadosGeo.geoEscola_Latit,
                dadosGeo.geoEscola_Longit,
                'driving'
            );
            if (distCoordCarObj) distCoordCar = distCoordCarObj.distancia;
        }

        let distEndCar =
            distEndFoot;

        if (distEndFoot > 10000) {

            if (
                typeof coordEndereco === 'string'
            ) {

                distEndCar =
                    distCoordCar;

            } else {

                let distEndCarObj =
                    await window.calcularTrajetoOSRM(
                        coordEndereco.lat,
                        coordEndereco.lon,
                        dadosGeo.geoEscola_Latit,
                        dadosGeo.geoEscola_Longit,
                        'driving'
                    );
                if (distEndCarObj) distEndCar = distEndCarObj.distancia;
            }
        }

        if (
            (
                distCoordFoot > 10000 &&
                distCoordCar < 5000
            )
            ||
            (
                distEndFoot > 10000 &&
                distEndCar < 5000
            )
        ) {

            usarCarro = true;

            distCoordFoot =
                distCoordCar;

            distEndFoot =
                distEndCar;

            perfilFinal =
                'driving';
        }
    }

    let objRota = {

        coordAlunoGPS: {
            lat: dadosGeo.geoEndereco_Latit,
            lon: dadosGeo.geoEndereco_Longit
        },

        coordAlunoEnd:
            coordEndereco,

        distanciaCoord:
            distCoordFoot,

        distanciaEnd:
            distEndFoot,

        perfilOSRM:
            perfilFinal
    };

    window.setSharedStoreValue(
        'dadosGeraisRota',
        objRota
    );

    if (usarCarro) {

        window.setSharedStoreValue(
            'modoTransporteAtual',
            'carro'
        );

        const toggleContainer =
            document.getElementById(
                'mapa-toggle-container'
            );

        if (
            toggleContainer &&
            toggleContainer.children[1]
        ) {

            toggleContainer.children[1]
                .innerHTML =
                    "🚗 De Carro";
        }

        if (
            typeof window.atualizarURLsMapasGlobal ===
            'function'
        ) {
            window.atualizarURLsMapasGlobal();
        }
    }
};


// Função central de Auditoria de Lote (Com suporte a varredura recursiva de tempo para o container do mapa)
window.verificaArqDiastur = async function(documentoContexto) {
    const targetDoc = documentoContexto || document;
    console.log("[AUDITORIA-LOTE] Iniciando verificação de ocorrências...");

    const primeiraSecaoOcorrencias = targetDoc.querySelector('#div_ocorrencias');
    if (!primeiraSecaoOcorrencias) {
        console.warn("[AUDITORIA-LOTE] Primeiro #div_ocorrencias não localizado neste contexto.");
        return;
    }

    // Fallbacks inteligentes estruturais de ano
    let anoAtendimento = "";
    const inputAno = targetDoc.querySelector('input[name="ano_atendimento"]');
    if (inputAno && inputAno.value.trim()) {
        anoAtendimento = inputAno.value.trim();
    } else {
        const matchAno = primeiraSecaoOcorrencias.innerText.match(/\b(20\d{2})\b/);
        anoAtendimento = matchAno ? matchAno[1] : new Date().getFullYear();
    }
    
    const raAlunoRaw = window.getSharedStoreValue?.('raAluno') || targetDoc.getElementById('ra_prodesp_search')?.value || '';
    const raAlunoTarget = raAlunoRaw.replace(/\D/g, '');

    if (!raAlunoTarget) {
        console.warn("[AUDITORIA-LOTE] Falha de contexto: RA não extraído do DOM.");
        return;
    }

    let tdArquivo = null;
    let numeroArquivo = "";
    const celulas = primeiraSecaoOcorrencias.querySelectorAll('td');

    celulas.forEach(td => {
        const matchTxt = td.innerText.match(/Arq\s+(\d+)/i);
        if (matchTxt) {
            tdArquivo = td;
            numeroArquivo = matchTxt[1];
        }
    });

    if (!tdArquivo || !numeroArquivo) {
        console.log("[AUDITORIA-LOTE] Nenhuma linha contendo 'Arq XXXX' elegível para link.");
        return;
    }

    const urlArquivo = `http://plataforma-se2/arquivos/transporte/arquivos%20empresa/Arquivo_${numeroArquivo}_${anoAtendimento}.xlsx`;

    // 1. Converte de imediato o termo estático em link ativo na tabela original (Aparece TODAS as vezes)
    tdArquivo.innerHTML = `<a href="${urlArquivo}" target="_blank" style="color: #2980b9; font-weight: bold; text-decoration: underline;" title="Download do arquivo original">Arq ${numeroArquivo} 📥</a>`;

    // 2. FILTRAGEM DE SEGURANÇA POR STATUS: O painel sob o mapa só é montado se a ficha contiver "EM ANÁLISE"
    const statusTextoGlobal = (window.getSharedStoreValue?.('statusFicha') || targetDoc.getElementById('status_atendimento')?.innerText || targetDoc.getElementById('mostra_status_pedido')?.innerText || "").toUpperCase();
    const isEmAnaliseLote = statusTextoGlobal.includes('EM ANÁLISE') || statusTextoGlobal.includes('EM ANALISE');
    
    if (!isEmAnaliseLote) {
        console.log("[AUDITORIA-LOTE] Ficha fora de análise. Painel complementar omitido e link mantido.");
        return;
    }

    // 3. CLONAGEM DA LÓGICA DE RETRY: Tenta capturar o container do mapa em loops controlados em caso de lentidão
    let retryCount = 0;
    const maxRetries = 5;
    const retryInterval = 500;

    const executarInjecaoSobMapa = async () => {
        const toggleContainer = targetDoc.getElementById('mapa-toggle-container');
        
        if (!toggleContainer) {
            if (retryCount < maxRetries) {
                retryCount++;
                console.log(`[AUDITORIA-LOTE] Aguardando o elemento #mapa-toggle-container estabilizar... Tentativa ${retryCount}/${maxRetries}`);
                setTimeout(executarInjecaoSobMapa, retryInterval);
            } else {
                console.warn("[AUDITORIA-LOTE] Limite de tentativas atingido. Elemento #mapa-toggle-container indisponível no DOM.");
            }
            return;
        }

        // 4. Estruturar o contêiner de auditoria acoplado diretamente sob o switch-mapa existente
        let divAuditoria = targetDoc.getElementById('plattransp-auditoria-lote');
        if (!divAuditoria) {
            divAuditoria = targetDoc.createElement('div');
            divAuditoria.id = 'plattransp-auditoria-lote';
            divAuditoria.style.cssText = "margin-top: 10px; padding-top: 8px; border-top: 1px dashed #ccc; font-family: verdana; font-size: 10px; display: block;";
            toggleContainer.parentNode.insertBefore(divAuditoria, toggleContainer.nextSibling);
        }

        divAuditoria.innerHTML = `
            <div style="font-size: 10px; font-family: verdana; color: #7f8c8d;">
                <span class="mdi mdi-loading mdi-spin" style="margin-right: 4px;"></span> Consultando endereço do cadastro original...
            </div>
        `;

        try {
            // Injeção Dinâmica Local Robusta do SheetJS caso a biblioteca não esteja no escopo do documento
            if (typeof XLSX === 'undefined') {
                console.log("[AUDITORIA-LOTE] XLSX indisponível. Carregando dependência em tempo de execução...");
                await new Promise((resolve) => {
                    const script = targetDoc.createElement('script');
                    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
                    script.onload = () => resolve();
                    script.onerror = () => resolve();
                    targetDoc.head.appendChild(script);
                });
            }

            if (typeof XLSX === 'undefined') {
                throw new Error("Dependência XLSX offline");
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const resposta = await fetch(urlArquivo, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!resposta.ok) throw new Error("404");

            const buffer = await resposta.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
            const planilhaJson = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

            const registroAluno = planilhaJson.find(linha => {
                const raLinha = String(linha['RA'] || linha['ID ALUNO'] || '').replace(/\D/g, '');
                return raLinha === raAlunoTarget;
            });

            if (registroAluno) {
                // Construtor String(...) previne erros fatais caso o Excel retorne números puros
                const endereco = String(registroAluno['ENDERECO'] || registroAluno['LOGRADOURO'] || '').trim();
                const numero = String(registroAluno['NUMERO'] || 'S/N').trim();
                const bairro = String(registroAluno['BAIRRO'] || '').trim();
                const cep = String(registroAluno['CEP'] || '').trim();
                const complemento = String(registroAluno['COMPLEMENTO'] || '').trim();
                const enderecoFormatado = `${endereco}, Nº ${numero}${complemento ? ' - ' + complemento : ''} - ${bairro} (CEP: ${cep})`;

                let rotaLink = null;
                const criarRotaPorCoordenadas = (origem, destinoLat, destinoLon) =>
                    `https://maps.google.com/maps?saddr=${encodeURIComponent(origem)}&daddr=${encodeURIComponent(destinoLat + ' ' + destinoLon)}`;

                if (typeof window.extrairDadosGeograficos === 'function') {
                    const idSolInput = targetDoc.querySelector('input[name="id_solicitacao"]') || targetDoc.querySelector('input[name="id"]');
                    const idFicha = idSolInput ? String(idSolInput.value || '').trim() : '';

                    if (idFicha) {
                        const urlOrigem = targetDoc.location && targetDoc.location.href
                            ? targetDoc.location.href
                            : window.location.href;
                        const basePath = urlOrigem.substring(0, urlOrigem.lastIndexOf('/') + 1);
                        const urlFichaNova = `${basePath}ficha_transporte_nova_versao.php?id_solicitacao=${encodeURIComponent(idFicha)}`;

                        try {
                            const dadosGeo = await window.extrairDadosGeograficos(urlFichaNova);
                            if (
                                dadosGeo &&
                                dadosGeo.geoEscola_Latit &&
                                dadosGeo.geoEscola_Longit
                            ) {
                                rotaLink = criarRotaPorCoordenadas(
                                    enderecoFormatado,
                                    dadosGeo.geoEscola_Latit,
                                    dadosGeo.geoEscola_Longit
                                );
                            }
                        } catch (e) {
                            console.warn("[AUDITORIA-LOTE] Falha ao obter coordenadas da escola para o link de rota:", e.message || e);
                        }
                    }
                }

                if (!rotaLink) {
                    rotaLink = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(enderecoFormatado)}&destination=${encodeURIComponent('Escola')}`;
                }

                const linkRotaHtml = `
                    <a href="${rotaLink}" target="_blank" style="color: #2980b9; text-decoration: underline; font-weight: bold; margin-left: 8px; display: inline-block;">
                        Ver trajeto
                    </a>
                `;

                // Persistir os dados minerados no barramento SharedStore global do ecossistema
                if (typeof window.setSharedStore === 'function') {
                    window.setSharedStore({
                        auditoriaLoteDisponivel: true,
                        auditoriaLoteEnderecoOriginal: enderecoFormatado,
                        auditoriaLoteDadosCompletos: registroAluno
                    });
                }

                // Exibe o painel amigável integrado à caixa de endereço nativa
                divAuditoria.innerHTML = `
                    <div style="line-height: 1.5; font-family: verdana; font-size: 10px; color: #2c3e50; margin-top: 5px;">
                        📍 <b>Endereço original do cadastro em [${anoAtendimento}], conforme <a href="${urlArquivo}" target="_blank" style="color: #2980b9; text-decoration: underline; font-weight: bold;">Arquivo ${numeroArquivo}</a>:</b>
                        <br><span style="background: #fff8db; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 5px; border: 1px solid #f1c40f; color: #d35400; font-weight: bold; width: calc(100% - 18px); box-sizing: border-box;">
                            ${enderecoFormatado}
                        </span>
                        ${linkRotaHtml}
                    </div>
                `;
            } else {
                if (divAuditoria) divAuditoria.remove();
            }

        } catch (erro) {
            console.warn("[AUDITORIA-LOTE] Omitindo painel complementar por falha técnica de leitura:", erro.message);
            if (divAuditoria) divAuditoria.remove();
        }
    };

    // Inicia o processo de injeção assíncrona com monitoramento de tempo
    executarInjecaoSobMapa();
};

// POLLER CONTEXTUALIZADO (IFRAME & DIRECT DEEP TRAVERSAL): Posicionado na base para ler referências acima
(function() {
    let checkCounter = 0;
    const maxPollAttempts = 10;
    
    function tentarLocalizarFicha() {
        checkCounter++;
        
        let docAlvo = document;
        let secaoOcorrencias = docAlvo.querySelector('#div_ocorrencias');
        
        if (!secaoOcorrencias) {
            const subIframes = document.querySelectorAll('iframe');
            for (let i = 0; i < subIframes.length; i++) {
                try {
                    let docIframe = subIframes[i].contentDocument || subIframes[i].contentWindow.document;
                    if (docIframe && docIframe.querySelector('#div_ocorrencias')) {
                        docAlvo = docIframe;
                        secaoOcorrencias = docIframe.querySelector('#div_ocorrencias');
                        break;
                    }
                } catch(e) {}
            }
        }
        
        if (secaoOcorrencias) {
            // Execução segura: A função já foi içada e compilada em window
            window.verificaArqDiastur(docAlvo);
            return;
        }
        
        if (checkCounter < maxPollAttempts) {
            setTimeout(tentarLocalizarFicha, 400);
        } else {
            console.warn(`[AUDITORIA-LOTE] Não foi localizada a ficha após ${maxPollAttempts} tentativas. Abortando.`);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tentarLocalizarFicha);
    } else {
        tentarLocalizarFicha();
    }
})();

document.addEventListener(
    'DOMContentLoaded',
    window.iniciarPaginaFicha
);