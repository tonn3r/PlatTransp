window.copiarCoordenadasEndereco = function() {
    const rota = window.getSharedStoreValue?.('dadosGeraisRota');

    if (!rota || !rota.coordAlunoEnd) return;

    // Proteção para navegadores/contextos que não suportam clipboard API diretamente
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
        console.warn("navigator.clipboard API não está disponível no contexto atual.");
        let txtToCopy = typeof rota.coordAlunoEnd === 'string' ? rota.coordAlunoEnd : (rota.coordAlunoEnd.lat ? `${rota.coordAlunoEnd.lat} ${rota.coordAlunoEnd.lon}` : "");
        if (txtToCopy) {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = txtToCopy;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const success = document.execCommand('copy');
                textArea.remove();
                if(!success) console.error("Falha ao copiar usando execCommand");
            } catch (e) {
                console.error("Erro no fallback de cópia", e);
            }
        }
        return;
    }

    if (typeof rota.coordAlunoEnd === 'string') {
        navigator.clipboard
            .writeText(rota.coordAlunoEnd)
            .catch(e => console.error("Erro copy", e));
        return;
    }

    if (rota.coordAlunoEnd.lat) {
        const txt = `${rota.coordAlunoEnd.lat} ${rota.coordAlunoEnd.lon}`;
        navigator.clipboard
            .writeText(txt)
            .catch(e => console.error("Erro copy", e));
    }
};

// --- SECTION: GEOGRAPHIC DATA EXTRACTION ---
// Technical comments for extrairDadosGeograficos:
// - Uses DOMParser to parse HTML from ficha_transporte_nova_versao.php
// - Extracts iframe src URL containing Google Maps parameters
// - Regex patterns: /origin=([^&]+)/i and /destination=([^&]+)/i capture coordinate strings
// - Coordinate parsing handles space/comma separators and converts to float
// - Returns structured object with lat/lon for address and school locations
window.extrairDadosGeograficos = async function(urlFichaNova) {
    const tInicioGeo = performance.now();

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const resposta = await fetch(urlFichaNova, { signal: controller.signal });
        if (!resposta.ok) return null;
        const htmlText = await resposta.text();
        clearTimeout(timeoutId);

        const parser = new DOMParser();
        const docVirtual = parser.parseFromString(
            htmlText,
            "text/html"
        );

        const iframeMap =
            docVirtual.getElementById('map_endereco');

        if (iframeMap && iframeMap.src) {

            const urlCompleta = iframeMap.src;

            const regexOrigin =
                /origin=([^&]+)/i;

            const regexDest =
                /destination=([^&]+)/i;

            const matchOrigin =
                urlCompleta.match(regexOrigin);

            const matchDest =
                urlCompleta.match(regexDest);

            const separarCoordenadas = (
                matchString
            ) => {

                if (!matchString) {
                    return {
                        lat: null,
                        lon: null
                    };
                }

                const decodificado =
                    decodeURIComponent(
                        matchString[1]
                    ).trim();

                const partes =
                    decodificado.split(
                        /[\s,]+/
                    );

                if (partes.length >= 2) {

                    return {
                        lat: parseFloat(
                            partes[0].trim()
                        ),
                        lon: parseFloat(
                            partes[1].trim()
                        )
                    };
                }

                return {
                    lat: null,
                    lon: null
                };
            };

            const coordOrigin =
                separarCoordenadas(matchOrigin);

            const coordDest =
                separarCoordenadas(matchDest);

            const dados = {
                urlMaps: urlCompleta,
                geoEndereco_Latit:
                    coordOrigin.lat,
                geoEndereco_Longit:
                    coordOrigin.lon,
                geoEscola_Latit:
                    coordDest.lat,
                geoEscola_Longit:
                    coordDest.lon
            };

            const tFimGeo = performance.now();

            return dados;
        }

        return null;

    } catch (erro) {
        console.error(
            "❌ Erro ao extrair dados geográficos:",
            erro
        );
        return null;
    }
};

window.sincronizarMapaECoordenadas =
async function(docAlvo) {

    let urlOrigem =
        docAlvo.location
            ? docAlvo.location.href
            : window.location.href;

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

    let basePath =
        urlOrigem.substring(
            0,
            urlOrigem.lastIndexOf('/') + 1
        );

    // Verifica se a baseUrl já termina ou contém o caminho do módulo
    const moduloPath =
        "modulos/transporte_escolar/";

    const prefixo =
        basePath.includes(moduloPath)
            ? ""
            : moduloPath;

    let urlFichaNova =
        basePath +
        prefixo +
        'ficha_transporte_nova_versao.php?id_solicitacao=' +
        idFicha;

    const dadosGeo =
        await window.extrairDadosGeograficos(
            urlFichaNova
        );

    if (dadosGeo) {

        const iframeAtual =
            docAlvo.getElementById(
                'map_endereco'
            );

        const linkMapaNovaGuia =
            docAlvo.getElementById(
                'botao_mapa'
            );

        const btnAbrirFicha =
            docAlvo.getElementById(
                'botaoAbrirFicha'
            );

        if (btnAbrirFicha) {
            try {
                vincularEventoUnico(btnAbrirFicha, 'click', window.copiarCoordenadasEndereco);
            } catch (e) {
                // fallback: dataset marker and native binding
                if (!btnAbrirFicha.dataset.copyBound) {
                    btnAbrirFicha.dataset.copyBound = 'true';
                    btnAbrirFicha.addEventListener('click', window.copiarCoordenadasEndereco);
                }
            }
        }

        if (
            iframeAtual &&
            !urlOrigem.includes('nova_versao')
        ) {

            if (!window.urlEnderecoGlobal) {

                window.urlEnderecoGlobal =
                    iframeAtual.src;

                window.urlBotaoEnderecoGlobal =
                    linkMapaNovaGuia
                        ? linkMapaNovaGuia.href
                        : iframeAtual.src;
            }

                if (typeof window.gerarEstilosAssistente === 'function') {
                    window.gerarEstilosAssistente(docAlvo);
                }

            let currentModoMapa = window.getSharedStoreValue?.('modoMapaAtual');
            if (!currentModoMapa) {
                const statusTexto = (docAlvo.getElementById('status_atendimento')?.innerText || "").toUpperCase();
                const ehMudanca = statusTexto.includes("MUDANCA") || statusTexto.includes("MUDANÇA");

                window.setSharedStore({
                    modoMapaAtual: ehMudanca ? 'endereco' : 'coordenada',
                    modoTransporteAtual: 'pe'
                });
            }
            
            const statusTextoAux = (docAlvo.getElementById('status_atendimento')?.innerText || "").toUpperCase();
            const ehMudancaAux = statusTextoAux.includes("MUDANCA") || statusTextoAux.includes("MUDANÇA");

            const atualizarURLsMapas = (atualizarLista = false) => {

                const modoTransporte =
                    window.getSharedStoreValue?.(
                        'modoTransporteAtual'
                    ) || 'pe';

                let sufixoTransporteBotao =
                    modoTransporte === 'pe'
                        ? "&travelmode=walking&dirflg=w"
                        : "";

                let sufixoTransporteFrame =
                    modoTransporte === 'pe'
                        ? "&mode=walking"
                        : "";

                const normalizeUrl = (url) =>
                    url
                        ? url.replace(
                            /&amp;/g,
                            '&'
                        )
                        : url;

                const setIframeSrc = (
                    newUrl
                ) => {

                    if (
                        !iframeAtual ||
                        !newUrl
                    ) return;

                    const normalized =
                        normalizeUrl(newUrl);

                    if (iframeAtual.dataset.currentSrc !== normalized) {
                        iframeAtual.dataset.currentSrc = normalized;
                        iframeAtual.src =
                            normalized;
                    }
                };

                const setLinkHref = (
                    newUrl
                ) => {

                    if (
                        !linkMapaNovaGuia ||
                        !newUrl
                    ) return;

                    const normalized =
                        normalizeUrl(newUrl);

                    if (linkMapaNovaGuia.dataset.currentHref !== normalized) {
                        linkMapaNovaGuia.dataset.currentHref = normalized;
                        linkMapaNovaGuia.href =
                            normalized;
                    }
                };

                const modoMapa =
                    window.getSharedStoreValue?.(
                        'modoMapaAtual'
                    ) || 'coordenada';

                if (
                    modoMapa === 'coordenada'
                ) {

                    const urlIframe =
                        `https://www.google.com/maps/embed/v1/directions?key=AIzaSyDFlvpNvHgc6N2gMYTPJq5HptaFXS-S2i8&origin=${dadosGeo.geoEndereco_Latit}+${dadosGeo.geoEndereco_Longit}&destination=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteFrame}`; //nao alterar

                    const urlLink =
                        `https://maps.google.com/maps?saddr=${dadosGeo.geoEndereco_Latit}+${dadosGeo.geoEndereco_Longit}&daddr=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteBotao}`; //nao alterar

                    setIframeSrc(urlIframe);
                    setLinkHref(urlLink);

                } else {

                    let rota =
                        window.getSharedStoreValue?.(
                            'dadosGeraisRota'
                        );

                    let urlIframeEnd = "";
                    let urlLinkEnd = "";

                    if (
                        rota &&
                        rota.coordAlunoEnd &&
                        typeof rota.coordAlunoEnd === 'string'
                    ) {

                        let stringEndereco =
                            encodeURIComponent(
                                rota.coordAlunoEnd
                            );

                        urlIframeEnd =
                            `https://www.google.com/maps/embed/v1/directions?key=AIzaSyDFlvpNvHgc6N2gMYTPJq5HptaFXS-S2i8&origin=${stringEndereco}&destination=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteFrame}`;

                        urlLinkEnd =
                            `https://maps.google.com/maps?saddr=${stringEndereco}&daddr=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteBotao}`;

                    } else if (
                        rota &&
                        rota.coordAlunoEnd &&
                        rota.coordAlunoEnd.lat
                    ) {

                        urlIframeEnd =
                            `https://www.google.com/maps/embed/v1/directions?key=AIzaSyDFlvpNvHgc6N2gMYTPJq5HptaFXS-S2i8&origin=${rota.coordAlunoEnd.lat}+${rota.coordAlunoEnd.lon}&destination=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteFrame}`;

                        urlLinkEnd =
                            `https://maps.google.com/maps?saddr=${rota.coordAlunoEnd.lat}+${rota.coordAlunoEnd.lon}&daddr=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteBotao}`;

                    } else {

                        urlIframeEnd =
                            `https://www.google.com/maps/embed/v1/directions?key=AIzaSyDFlvpNvHgc6N2gMYTPJq5HptaFXS-S2i8&origin=${dadosGeo.geoEndereco_Latit}+${dadosGeo.geoEndereco_Longit}&destination=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteFrame}`;

                        urlLinkEnd =
                            `https://maps.google.com/maps?saddr=${dadosGeo.geoEndereco_Latit}+${dadosGeo.geoEndereco_Longit}&daddr=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteBotao}`;
                    }

                    setIframeSrc(urlIframeEnd);
                    setLinkHref(urlLinkEnd);
                }

                if (
                    atualizarLista &&
                    typeof window.atualizarListaEscolasDinamicamente ===
                    'function'
                ) {

                    window.atualizarListaEscolasDinamicamente();
                }
            };

            atualizarURLsMapas(false);

            window.atualizarURLsMapasGlobal = () =>
                atualizarURLsMapas(true);

            // --- SECTION: UI RESILIENCE ---
            // Implement retry-loop (max 5 times, 500ms interval) or MutationObserver for mapa-toggle-container injection

            let retryCount = 0;

            const maxRetries = 5;

            const retryInterval = 500;

            let observer = null;

            const injectToggleContainer = () => {
                if (docAlvo.getElementById('mapa-toggle-container')) return;

                const toggleContainer = docAlvo.createElement('div');
                toggleContainer.id = 'mapa-toggle-container';
                toggleContainer.style.cssText = "display: flex; justify-content: flex-end; gap: 8px; margin-top: 5px; font-size: 11px;";

                const btnModoMapa = docAlvo.createElement('button');
                btnModoMapa.id = 'switch-origem-mapa';
                btnModoMapa.className = 'toggle-btn';
                btnModoMapa.innerHTML = ehMudancaAux
                    ? `<span class="mdi mdi-map-search" style="font-size:14px; margin-right:4px;"></span> Por Endereço`
                    : `<span class="mdi mdi-map-marker-radius-outline" style="font-size:14px; margin-right:4px;"></span> Por Coordenadas`;

                const btnModoTransp = docAlvo.createElement('button');
                btnModoTransp.id = 'switch-transporte-mapa';
                btnModoTransp.className = 'toggle-btn';
                btnModoTransp.innerHTML = `<span class="mdi mdi-walk" style="font-size:14px; margin-right:4px;"></span> A pé`;

                if (!btnModoMapa.dataset.boundclick) {
                    btnModoMapa.dataset.boundclick = 'true';
                    btnModoMapa.addEventListener('click', (e) => {
                        e.preventDefault();
                        const modoAtual = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
                        const novoModo = modoAtual === 'endereco' ? 'coordenada' : 'endereco';
                        window.setSharedStoreValue('modoMapaAtual', novoModo);
                        btnModoMapa.innerHTML = novoModo === 'endereco'
                            ? `<span class="mdi mdi-map-search" style="font-size:14px; margin-right:4px;"></span> Por Endereço`
                            : `<span class="mdi mdi-map-marker-radius-outline" style="font-size:14px; margin-right:4px;"></span> Por Coordenadas`;
                        atualizarURLsMapas(true);

                        const distanciaCoord = Number(window.getSharedStoreValue?.('distanciaCoord'));
                        const distanciaEnd = Number(window.getSharedStoreValue?.('distanciaEnd'));
                        const distanciaAtual = novoModo === 'endereco' ? distanciaEnd : distanciaCoord;
                        if (typeof window.atualizarInputDistancia === 'function') {
                            window.atualizarInputDistancia(distanciaAtual);
                        }
                    });
                }

                if (!btnModoTransp.dataset.boundclick) {
                    btnModoTransp.dataset.boundclick = 'true';
                    btnModoTransp.addEventListener('click', (e) => {
                        e.preventDefault();
                        const modoAtual = window.getSharedStoreValue?.('modoTransporteAtual') || 'pe';
                        const novoModo = modoAtual === 'pe' ? 'carro' : 'pe';
                        window.setSharedStoreValue('modoTransporteAtual', novoModo);
                        btnModoTransp.innerHTML = novoModo === 'pe'
                            ? `<span class="mdi mdi-walk" style="font-size:14px; margin-right:4px;"></span> A pé`
                            : `<span class="mdi mdi-car" style="font-size:14px; margin-right:4px;"></span> De Carro`;
                        atualizarURLsMapas(true);
                    });
                }

                toggleContainer.appendChild(btnModoMapa);
                toggleContainer.appendChild(btnModoTransp);

                if (
                    iframeAtual &&
                    iframeAtual.parentNode
                ) {

                    iframeAtual.parentNode.insertBefore(
                        toggleContainer,
                        iframeAtual.nextSibling
                    );

                    // Se um observer estiver observando, desconecta após injeção bem-sucedida
                    try {
                        if (observer && typeof observer.disconnect === 'function') observer.disconnect();
                    } catch(e) {}

                } else if (
                    retryCount < maxRetries
                ) {

                    retryCount++;

                    setTimeout(
                        injectToggleContainer,
                        retryInterval
                    );
                }
            };

            // Use MutationObserver for resilience if available

            if (typeof MutationObserver !== 'undefined') {
                let observer = null;

                observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList' && !docAlvo.getElementById('mapa-toggle-container')) {
                            injectToggleContainer();
                        }
                    });

                    // se já foi injetado, desconectar observer para economizar recursos
                    if (docAlvo.getElementById('mapa-toggle-container')) {
                        try { observer.disconnect(); } catch(e) {}
                    }
                });

                observer.observe(docAlvo.body, { childList: true, subtree: true });
            }

            injectToggleContainer();

        }

        if (linkMapaNovaGuia) {
            linkMapaNovaGuia.target =
                "_blank";
        }

        window.setSharedStoreValue(
            'dadosGeograficos',
            dadosGeo
        );

    } else {

        window.setSharedStoreValue(
            'dadosGeograficos',
            { erro: true }
        );
    }
};

// --- SECTION: OSRM ROUTING CALCULATION ---
// Technical comments for OSRM wrappers:
// - Coordinate calculation logic: Uses OSRM API with profile ('foot' or 'driving')
// - URL format: https://router.project-osrm.org/route/v1/{profile}/{lon},{lat};{lon},{lat}?overview=false
// - Returns distance in meters, rounded to nearest integer
// - Handles AbortController signals for cancellation
// - Gracefully returns null on errors or invalid coordinates

window.calcularTrajetoOSRM =
async function(
    latOrigin,
    lonOrigin,
    latDest,
    lonDest,
    profile = 'foot',
    signal = null
) {

    if (
        !latOrigin ||
        !lonOrigin ||
        !latDest ||
        !lonDest
    ) return null;

    try {

        const url =
            `https://router.project-osrm.org/route/v1/${profile}/${lonOrigin},${latOrigin};${lonDest},${latDest}?overview=false`;

        const fetchOptions =
            signal
                ? { signal }
                : {};

        const response =
            await fetch(
                url,
                fetchOptions
            );

        if (!response.ok) {
            return null;
        }

        const data =
            await response.json();

        if (
            data.code === 'Ok' &&
            data.routes &&
            data.routes.length > 0
        ) {

            return Math.round(
                data.routes[0].distance
            );
        }

    } catch (e) {

        if (
            e.name !== 'AbortError'
        ) {

            console.error(
                `❌ Erro ao calcular trajeto via OSRM (${profile}):`,
                e
            );
        }
    }

    return null;
};

window.obterCoordenadasPorEndereco =
async function(enderecoCompleto) {

    if (!enderecoCompleto) {
        return null;
    }

    // Função auxiliar para substituir abreviações de tipos de vias

    function substituirAbreviacoes(
        endereco
    ) {

        const substituicoes = {
            'AV ': 'AVENIDA ',
            'EST ': 'ESTRADA ',
            'R ': 'RUA ',
            'AL ': 'ALAMEDA ',
            'PC ': 'PRAÇA ',
            'VIE ': 'VIELA ',
            'VL ': 'VIELA ',
            'ROD ': 'RODOVIA ',
            'TRAV ': 'TRAVESSA ',
            'TV ': 'TRAVESSA ',
            'LAR ': 'LARGO ',
            'BEC ': 'BECO ',
            'CAM ': 'CAMINHO ',
            'CHA ': 'CHACARA ',
            'CON ': 'CONDOMINIO ',
            'FAZ ': 'FAZENDA ',
            'JAR ': 'JARDIM ',
            'LOT ': 'LOTEAMENTO ',
            'NUC ': 'NUCLEO ',
            'PAR ': 'PARQUE ',
            'PAS ': 'PASSAGEM ',
            'PTE ': 'PONTE ',
            'REC ': 'RECANTO ',
            'RES ': 'RESIDENCIAL ',
            'SIT ': 'SITIO ',
            'VIL ': 'VILA ',
            'QD ': 'QUADRA ',
            'LOT ': 'LOTE ',
            'GAL ': 'GALERIA ',
            'PAV ': 'PAVILHAO ',
            'BL ': 'BLOCO ',
            'AP ': 'APARTAMENTO ',
            'CS ': 'CASA ',
            'ED ': 'EDIFICIO ',
            'SL ': 'SALA ',
            'AND ': 'ANDAR ',
            'CJ ': 'CONJUNTO ',
            'NU ': 'NUMERO ',
            'N ': 'NUMERO '
        };

        let enderecoCorrigido =
            endereco.toUpperCase();

        for (
            const [abreviacao, completo]
            of Object.entries(
                substituicoes
            )
        ) {

            enderecoCorrigido =
                enderecoCorrigido.replace(
                    new RegExp(
                        `\\b${abreviacao}`,
                        'g'
                    ),
                    completo
                );
        }

        return enderecoCorrigido;
    }

    try {

        let enderecoBusca =
            substituirAbreviacoes(
                enderecoCompleto
            );

        if (
            enderecoBusca &&
            !enderecoBusca
                .toUpperCase()
                .includes("BERNARDO")
        ) {

            enderecoBusca +=
                ", São Bernardo do Campo - SP";
        }

        const url =
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoBusca)}&limit=1&email=app.plattransp@gmail.com`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept-Language': 'pt-BR,pt;q=0.9'
            }
        });

        if (!response.ok) {
            console.warn(`⚠️ Aviso Nominatim: Falha na requisição (Status: ${response.status})`);
            return null;
        }

        const data = await response.json();
        clearTimeout(timeoutId);

        if (
            data &&
            data.length > 0
        ) {

            return {
                lat: parseFloat(
                    data[0].lat
                ),
                lon: parseFloat(
                    data[0].lon
                )
            };
        }

    } catch(e) {

        console.error(
            "❌ Erro ao buscar coordenadas do endereço no Nominatim:",
            e
        );
    }

    return null;
};