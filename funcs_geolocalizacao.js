// =========================================================================
// CONFIGURAÇÃO CENTRALIZADA DE CHAVES DE API DO GOOGLE (DEFINIDAS APENAS UMA VEZ)
// =========================================================================
window.apiKeyGoogle = "AIzaSyDFlvpNvHgc6N2gMYTPJq5HptaFXS-S2i8";
window.apiKeyGoogle2 = "AIzaSyBUvko37UZpzfwS9rS3pfexlsptYqQZW78";
window.apiKeyGoogle3 = "AIzaSyDeFC9pEKnvyaqmVKbAVFJ2D2WRfh4esEs";

// Calcula uma aproximação de distância euclidiana rápida entre dois pontos (evita math.sqrt pesada).
window.calcularProximidadeRapida = function(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const FATOR_LON = 0.916;
    const dLat = lat1 - lat2;
    const dLon = (lon1 - lon2) * FATOR_LON;
    return (dLat * dLat) + (dLon * dLon);
};

// Calcula a distância exata entre duas coordenadas em metros (Fórmula de Haversine).
window.calcularDistanciaHaversine = function(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c) * 1000);
};

// Copia para a área de transferência as coordenadas do endereço atual do aluno.
window.copiarCoordenadasEndereco = function() {
    const rota = window.getSharedStoreValue?.('dadosGeraisRota');
    if (!rota || !rota.coordAlunoEnd) return;

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
        navigator.clipboard.writeText(rota.coordAlunoEnd).catch(e => console.error("Erro copy", e));
        return;
    }

    if (rota.coordAlunoEnd.lat) {
        const txt = `${rota.coordAlunoEnd.lat} ${rota.coordAlunoEnd.lon}`;
        navigator.clipboard.writeText(txt).catch(e => console.error("Erro copy", e));
    }
};

// Extrai dados geográficos (como Lat e Lon) do mapa da ficha de transporte usando DOMParser e expressões regulares.
window.extrairDadosGeograficos = async function(urlFichaNova) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const resposta = await fetch(urlFichaNova, { signal: controller.signal });
        if (!resposta.ok) return null;
        const htmlText = await resposta.text();
        clearTimeout(timeoutId);

        const parser = new DOMParser();
        const docVirtual = parser.parseFromString(htmlText, "text/html");
        const iframeMap = docVirtual.getElementById('map_endereco');

        if (iframeMap && iframeMap.src) {
            const urlCompleta = iframeMap.src;
            const regexOrigin = /origin=([^&]+)/i;
            const regexDest = /destination=([^&]+)/i;
            const matchOrigin = urlCompleta.match(regexOrigin);
            const matchDest = urlCompleta.match(regexDest);

            const separarCoordenadas = (matchString) => {
                if (!matchString) return { lat: null, lon: null };
                const decodificado = decodeURIComponent(matchString[1]).trim();
                const partes = decodificado.split(/[\s,]+/);
                if (partes.length >= 2) {
                    return {
                        lat: parseFloat(partes[0].trim()),
                        lon: parseFloat(partes[1].trim())
                    };
                }
                return { lat: null, lon: null };
            };

            const coordOrigin = separarCoordenadas(matchOrigin);
            const coordDest = separarCoordenadas(matchDest);

            return {
                urlMaps: urlCompleta,
                geoEndereco_Latit: coordOrigin.lat,
                geoEndereco_Longit: coordOrigin.lon,
                geoEscola_Latit: coordDest.lat,
                geoEscola_Longit: coordDest.lon
            };
        }
        return null;
    } catch (erro) {
        console.error("❌ Erro ao extrair dados geográficos:", erro);
        return null;
    }
};

// Sincroniza a origem e o destino do mapa na interface do usuário adicionando seletores de transporte e coordenadas.
window.sincronizarMapaECoordenadas = async function(docAlvo) {
    let urlOrigem = docAlvo.location ? docAlvo.location.href : window.location.href;
    let idSolInput = docAlvo.querySelector('input[name="id_solicitacao"]') || docAlvo.querySelector('input[name="id"]');
    let idFicha = idSolInput ? idSolInput.value : '';
    let basePath = urlOrigem.substring(0, urlOrigem.lastIndexOf('/') + 1);

    const moduloPath = "modulos/transporte_escolar/";
    const prefixo = basePath.includes(moduloPath) ? "" : moduloPath;
    let urlFichaNova = basePath + prefixo + 'ficha_transporte_nova_versao.php?id_solicitacao=' + idFicha;

    const dadosGeo = await window.extrairDadosGeograficos(urlFichaNova);

    if (dadosGeo) {
        const iframeAtual = docAlvo.getElementById('map_endereco');
        const linkMapaNovaGuia = docAlvo.getElementById('botao_mapa');
        const btnAbrirFicha = docAlvo.getElementById('botaoAbrirFicha');

        if (btnAbrirFicha) {
            if (!btnAbrirFicha.dataset.copyBound) {
                btnAbrirFicha.dataset.copyBound = 'true';
                btnAbrirFicha.addEventListener('click', window.copiarCoordenadasEndereco);
            }
        }

        if (iframeAtual && !urlOrigem.includes('nova_versao')) {
            if (!window.urlEnderecoGlobal) {
                window.urlEnderecoGlobal = iframeAtual.src;
                window.urlBotaoEnderecoGlobal = linkMapaNovaGuia ? linkMapaNovaGuia.href : iframeAtual.src;
            }

            if (typeof window.gerarEstilosAssistente === 'function') {
                window.gerarEstilosAssistente(docAlvo);
            }

            let currentModoMapa = window.getSharedStoreValue?.('modoMapaAtual');
            if (!currentModoMapa) {
                const statusTexto = (docAlvo.getElementById('status_atendimento')?.innerText || "").toUpperCase();
                const ehMudanca = statusTexto.includes("MUDANCA") || statusTexto.includes("MUDANÇA");
                window.setSharedStore?.({
                    modoMapaAtual: ehMudanca ? 'endereco' : 'coordenada',
                    modoTransporteAtual: 'pe'
                });
            }
            
            const statusTextoAux = (docAlvo.getElementById('status_atendimento')?.innerText || "").toUpperCase();
            const ehMudancaAux = statusTextoAux.includes("MUDANCA") || statusTextoAux.includes("MUDANÇA");

            const atualizarURLsMapas = (atualizarLista = false) => {
                const modoTransporte = window.getSharedStoreValue?.('modoTransporteAtual') || 'pe';
                let sufixoTransporteBotao = modoTransporte === 'pe' ? "&travelmode=walking&dirflg=w" : "";
                let sufixoTransporteFrame = modoTransporte === 'pe' ? "&mode=walking" : "";

                const normalizeUrl = (url) => url ? url.replace(/&/g, '&') : url;

                const setIframeSrc = (newUrl) => {
                    if (!iframeAtual || !newUrl) return;
                    const normalized = normalizeUrl(newUrl);
                    if (iframeAtual.dataset.currentSrc !== normalized) {
                        iframeAtual.dataset.currentSrc = normalized;
                        iframeAtual.src = normalized;
                    }
                };

                const setLinkHref = (newUrl) => {
                    if (!linkMapaNovaGuia || !newUrl) return;
                    const normalized = normalizeUrl(newUrl);
                    if (linkMapaNovaGuia.dataset.currentHref !== normalized) {
                        linkMapaNovaGuia.dataset.currentHref = normalized;
                        linkMapaNovaGuia.href = normalized;
                    }
                };

                const modoMapa = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';

                if (modoMapa === 'coordenada') {
                    const urlIframe = `https://www.google.com/maps/embed/v1/directions?key=AIzaSyDFlvpNvHgc6N2gMYTPJq5HptaFXS-S2i8&origin=${dadosGeo.geoEndereco_Latit}+${dadosGeo.geoEndereco_Longit}&destination=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteFrame}`;
                    const urlLink = `https://maps.google.com/maps?saddr=${dadosGeo.geoEndereco_Latit}+${dadosGeo.geoEndereco_Longit}&daddr=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteBotao}`;
                    setIframeSrc(urlIframe);
                    setLinkHref(urlLink);
                } else {
                    let rota = window.getSharedStoreValue?.('dadosGeraisRota');
                    let urlIframeEnd = "";
                    let urlLinkEnd = "";

                    if (rota && rota.coordAlunoEnd && typeof rota.coordAlunoEnd === 'string') {
                        let stringEndereco = encodeURIComponent(rota.coordAlunoEnd);
                        urlIframeEnd = `https://www.google.com/maps/embed/v1/directions?key=AIzaSyDFlvpNvHgc6N2gMYTPJq5HptaFXS-S2i8&origin=${stringEndereco}&destination=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteFrame}`;
                        urlLinkEnd = `https://maps.google.com/maps?saddr=${stringEndereco}&daddr=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteBotao}`;
                    } else if (rota && rota.coordAlunoEnd && rota.coordAlunoEnd.lat) {
                        urlIframeEnd = `https://www.google.com/maps/embed/v1/directions?key=AIzaSyDFlvpNvHgc6N2gMYTPJq5HptaFXS-S2i8&origin=${rota.coordAlunoEnd.lat}+${rota.coordAlunoEnd.lon}&destination=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteFrame}`;
                        urlLinkEnd = `https://maps.google.com/maps?saddr=${rota.coordAlunoEnd.lat}+${rota.coordAlunoEnd.lon}&daddr=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteBotao}`;
                    } else {
                        urlIframeEnd = `https://www.google.com/maps/embed/v1/directions?key=AIzaSyDFlvpNvHgc6N2gMYTPJq5HptaFXS-S2i8&origin=${dadosGeo.geoEndereco_Latit}+${dadosGeo.geoEndereco_Longit}&destination=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteFrame}`;
                        urlLinkEnd = `https://maps.google.com/maps?saddr=${dadosGeo.geoEndereco_Latit}+${dadosGeo.geoEndereco_Longit}&daddr=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteBotao}`;
                    }

                    setIframeSrc(urlIframeEnd);
                    setLinkHref(urlLinkEnd);
                }

                if (atualizarLista && typeof window.atualizarListaEscolasDinamicamente === 'function') {
                    window.atualizarListaEscolasDinamicamente();
                }
            };

            atualizarURLsMapas(false);
            window.atualizarURLsMapasGlobal = () => atualizarURLsMapas(true);

            let retryCount = 0;
            const maxRetries = 5;
            const retryInterval = 500;

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

                if (iframeAtual && iframeAtual.parentNode) {
                    iframeAtual.parentNode.insertBefore(toggleContainer, iframeAtual.nextSibling);
                } else if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(injectToggleContainer, retryInterval);
                }
            };

            if (typeof MutationObserver !== 'undefined') {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList' && !docAlvo.getElementById('mapa-toggle-container')) {
                            injectToggleContainer();
                        }
                    });
                    if (docAlvo.getElementById('mapa-toggle-container')) {
                        try { observer.disconnect(); } catch(e) {}
                    }
                });
                observer.observe(docAlvo.body, { childList: true, subtree: true });
            }
            injectToggleContainer();
        }

        if (linkMapaNovaGuia) {
            linkMapaNovaGuia.target = "_blank";
        }
        window.setSharedStoreValue('dadosGeograficos', dadosGeo);
    } else {
        window.setSharedStoreValue('dadosGeograficos', { erro: true });
    }
};

// --- SECTION: HELPER PARA CONTROLE DE COTAS E LIMITES (ANTI-COBRANÇA) ---
// Verifica se o limite diário da chave de API do Google Maps foi atingido para evitar cobranças indevidas.
function verificarEIncrementarCotaGoogle(apiKey, nomeChave) {
    const hoje = new Date().toISOString().slice(0, 10);
    const chaveStorageCount = `gmaps_count_${apiKey}_${hoje}`;
    const chaveStorageBloqueio = `gmaps_blocked_${apiKey}_${hoje}`;

    if (localStorage.getItem(chaveStorageBloqueio) === 'true') {
        return false;
    }

    let requisicoesHoje = parseInt(localStorage.getItem(chaveStorageCount) || '0', 10);
    const LIMITE_DIARIO_SEGURO = 400; 

    if (requisicoesHoje >= LIMITE_DIARIO_SEGURO) {
        localStorage.setItem(chaveStorageBloqueio, 'true');
        console.warn(`🛑 Limite diário de segurança atingido para a ${nomeChave}. Uso bloqueado para evitar cobrança.`);
        return false;
    }

    localStorage.setItem(chaveStorageCount, (requisicoesHoje + 1).toString());
    return true;
}

function marcarChaveComoBloqueada(apiKey) {
    const hoje = new Date().toISOString().slice(0, 10);
    localStorage.setItem(`gmaps_blocked_${apiKey}_${hoje}`, 'true');
}

function carregarSDKGoogleMaps(apiKey) {
    return new Promise((resolve) => {
        if (window.google && window.google.maps) {
            resolve(true);
            return;
        }
        const scripts = document.querySelectorAll('script[src*="maps.googleapis.com/maps/api/js"]');
        scripts.forEach(s => s.remove());
        window.google = undefined;

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
}

// --- SECTION: GOOGLE MAPS / OSRM ROUTING CALCULATION ---
// Calcula o trajeto (distância da rota) de um ponto ao outro via Google Maps SDK ou servidor OSRM (como fallback).
window.calcularTrajetoOSRM = async function(latOrigin, lonOrigin, latDest, lonDest, profile = 'foot', signal = null) {
    if (!latOrigin || !lonOrigin || !latDest || !lonDest) return null;
    const googleMode = profile === 'foot' ? 'WALKING' : 'DRIVING';
    
    const STORAGE_KEY_GLOBAL = 'plattransp_global_routes_cache';
    const modoMapa = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
    
    // Associa a coordenada ao ID real da Escola (UE) no assistente
    const idUnidadeDestino = (typeof listaExibirBase !== 'undefined' && listaExibirBase)
        ? listaExibirBase.find(e => Number(e.lat) === Number(latDest) && Number(e.lon) === Number(lonDest))?.id || `${latDest},${lonDest}`
        : `${latDest},${lonDest}`;

    const chaveCache = `${modoMapa}_${googleMode}_${latOrigin},${lonOrigin}_UE_${idUnidadeDestino}`;

    // Consulta o cache unificado com validação automática de expiração
    const dadosEmCacheValido = window.obterValorCachePersistente(STORAGE_KEY_GLOBAL, chaveCache);
    if (dadosEmCacheValido) {
        console.info("⚡ [CACHE-PERSISTENTE] Rota idêntica recuperada do localStorage (Teto Máx: 100 | Validade: 7 dias) para a UE:", idUnidadeDestino);
        return dadosEmCacheValido;
    }

    const chavesDisponiveis = [
        { key: window.apiKeyGoogle,  label: "Chave Google 1" },
        { key: window.apiKeyGoogle2, label: "Chave Google 2" },
        { key: window.apiKeyGoogle3, label: "Chave Google 3" }
    ];
    
    let dadosRoteamento = null;
    let googleSucesso = false;

    for (const item of chavesDisponiveis) {
        if (!verificarEIncrementarCotaGoogle(item.key, item.label)) continue; 

        const carregouSDK = await carregarSDKGoogleMaps(item.key);
        if (!carregouSDK) continue;

        try {
            const resultadoDirecao = await new Promise((resolve, reject) => {
                const timeoutProtecao = setTimeout(() => reject('TIMEOUT_API_NOT_ACTIVATED'), 3500);
                try {
                    if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
                        clearTimeout(timeoutProtecao);
                        return reject('SDK_INCOMPLETA');
                    }
                    const directionsService = new google.maps.DirectionsService();
                    directionsService.route({
                        origin: new google.maps.LatLng(latOrigin, lonOrigin),
                        destination: new google.maps.LatLng(latDest, lonDest),
                        travelMode: google.maps.TravelMode[googleMode]
                    }, (response, status) => {
                        clearTimeout(timeoutProtecao);
                        if (status === 'OK') resolve(response.routes[0].legs[0].distance.value);
                        else reject(status);
                    });
                } catch (err) {
                    clearTimeout(timeoutProtecao);
                    reject(err);
                }
            });

            dadosRoteamento = Math.round(resultadoDirecao);
            console.info(`✅ Roteamento obtido via ${item.label}: ${dadosRoteamento} metros`);
            googleSucesso = true;
            break; 
        } catch (statusErro) {
            console.warn(`⚠️ Falha na tentativa com ${item.label}: Status/Motivo -> ${statusErro}`);
            if (statusErro === 'OVER_QUERY_LIMIT' || statusErro === 'REQUEST_DENIED' || statusErro === 'TIMEOUT_API_NOT_ACTIVATED') {
                marcarChaveComoBloqueada(item.key);
            }
        }
    }

    if (googleSucesso && dadosRoteamento !== null) {
        const resultadoFinalGoogle = { distancia: dadosRoteamento, fonte: 'GOOGLE' };
        window.gerenciarEsalvarCachePersistente(STORAGE_KEY_GLOBAL, chaveCache, resultadoFinalGoogle);
        return resultadoFinalGoogle;
    }

    console.warn("⚠️ Ambas as chaves do Google falharam ou estão desativadas no Cloud. Acionando Fallback OSRM.");

    try {
        const url = `https://router.project-osrm.org/route/v1/${profile}/${lonOrigin},${latOrigin};${lonDest},${latDest}?overview=false`;
        const fetchOptions = signal ? { signal } : {};
        const response = await fetch(url, fetchOptions);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const distanciaOsrm = Math.round(data.routes[0].distance);
            console.info(`✅ Roteamento obtido via OSRM: ${distanciaOsrm} metros`);
            const resultadoFinalOSRM = { distancia: distanciaOsrm, fonte: 'OSRM' };
            window.gerenciarEsalvarCachePersistente(STORAGE_KEY_GLOBAL, chaveCache, resultadoFinalOSRM);
            return resultadoFinalOSRM;
        }
    } catch (e) {
        if (e.name === 'AbortError') return null;
    }
    
    const resultadoFinalHav = { distancia: window.calcularDistanciaHaversine(latOrigin, lonOrigin, latDest, lonDest), fonte: 'HAVERSINE' };
    window.gerenciarEsalvarCachePersistente(STORAGE_KEY_GLOBAL, chaveCache, resultadoFinalHav);
    return resultadoFinalHav;
};

// --- SECTION: GOOGLE MAPS / NOMINATIM GEOCODING ---
// Busca as coordenadas geográficas (Lat/Lon) correspondentes a um texto de endereço via Google ou Nominatim.
window.obterCoordenadasPorEndereco = async function(enderecoCompleto) {
    if (!enderecoCompleto) return null;

    function substituirAbreviacoes(endereco) {
        const substituicoes = {
            'AV ': 'AVENIDA ', 'EST ': 'ESTRADA ', 'R ': 'RUA ', 'AL ': 'ALAMEDA ',
            'PC ': 'PRAÇA ', 'VIE ': 'VIELA ', 'VL ': 'VIELA ', 'ROD ': 'RODOVIA ',
            'TRAV ': 'TRAVESSA ', 'TV ': 'TRAVESSA ', 'LAR ': 'LARGO ', 'BEC ': 'BECO ',
            'CAM ': 'CAMINHO ', 'CHA ': 'CHACARA ', 'CON ': 'CONDOMINIO ', 'FAZ ': 'FAZENDA ',
            'JAR ': 'JARDIM ', 'LOT ': 'LOTEAMENTO ', 'NUC ': 'NUCLEO ', 'PAR ': 'PARQUE ',
            'PAS ': 'PASSAGEM ', 'PTE ': 'PONTE ', 'REC ': 'RECANTO ', 'RES ': 'RESIDENCIAL ',
            'SIT ': 'SITIO ', 'VIL ': 'VILA ', 'QD ': 'QUADRA ', 'GAL ': 'GALERIA ',
            'BL ': 'BLOCO ', 'AP ': 'APARTAMENTO ', 'CS ': 'CASA ', 'ED ': 'EDIFICIO ',
            'AND ': 'ANDAR ', 'CJ ': 'CONJUNTO ', 'N ': 'NUMERO '
        };
        let enderecoCorrigido = endereco.toUpperCase();
        for (const [abreviacao, completo] of Object.entries(substituicoes)) {
            enderecoCorrigido = enderecoCorrigido.replace(new RegExp(`\\b${abreviacao}`, 'g'), completo);
        }
        return enderecoCorrigido;
    }

    let enderecoBusca = substituirAbreviacoes(enderecoCompleto);
    if (enderecoBusca && !enderecoBusca.toUpperCase().includes("BERNARDO")) {
        enderecoBusca += ", São Bernardo do Campo - SP";
    }

    const chavesDisponiveis = [
        { key: window.apiKeyGoogle,  label: "Chave Google 1" },
        { key: window.apiKeyGoogle2, label: "Chave Google 2" },
        { key: window.apiKeyGoogle3, label: "Chave Google 3" }
    ];

    let coordenadasResultado = null;
    let googleSucesso = false;

    for (const item of chavesDisponiveis) {
        if (!verificarEIncrementarCotaGoogle(item.key, item.label)) continue;

        const carregouSDK = await carregarSDKGoogleMaps(item.key);
        if (!carregouSDK) continue;

        try {
            const localizacaoGeocode = await new Promise((resolve, reject) => {
                const timeoutProtecao = setTimeout(() => reject('TIMEOUT_API_NOT_ACTIVATED'), 3500);
                try {
                    if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
                        clearTimeout(timeoutProtecao);
                        return reject('SDK_INCOMPLETA');
                    }
                    const geocoder = new google.maps.Geocoder();
                    geocoder.geocode({ address: enderecoBusca }, (results, status) => {
                        clearTimeout(timeoutProtecao);
                        if (status === 'OK' && results.length > 0) {
                            resolve({
                                lat: parseFloat(results[0].geometry.location.lat()),
                                lon: parseFloat(results[0].geometry.location.lng())
                            });
                        } else {
                            reject(status);
                        }
                    });
                } catch (err) {
                    clearTimeout(timeoutProtecao);
                    reject(err);
                }
            });

            coordenadasResultado = localizacaoGeocode;
            console.info(`✅ Geocoding obtido via ${item.label}: ${coordenadasResultado.lat}, ${coordenadasResultado.lon}`);
            googleSucesso = true;
            break;
        } catch (statusErro) {
            console.warn(`⚠️ Falha no Geocoding da ${item.label}: Status/Motivo -> ${statusErro}`);
            if (statusErro === 'OVER_QUERY_LIMIT' || statusErro === 'REQUEST_DENIED' || statusErro === 'TIMEOUT_API_NOT_ACTIVATED') {
                marcarChaveComoBloqueada(item.key);
            }
        }
    }

    if (googleSucesso && coordenadasResultado !== null) {
        return coordenadasResultado;
    }

    console.warn("⚠️ Geocodificação do Google falhou em ambas as chaves. Acionando Fallback Nominatim.");

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoBusca)}&limit=1&email=app.plattransp@gmail.com`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' }
        });
        if (!response.ok) return null;
        const data = await response.json();
        clearTimeout(timeoutId);

        if (data && data.length > 0) {
            const resultadoNominatim = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            console.info(`✅ Geocoding obtido via Nominatim: ${resultadoNominatim.lat}, ${resultadoNominatim.lon}`);
            return resultadoNominatim;
        }
    } catch(e) {
        console.error("❌ Erro ao buscar coordenadas do endereço no Nominatim:", e);
    }
    return null;
};

// --- SECTION: GOOGLE MAPS REVERSE GEOCODING ---
// Busca o endereço formatado por meio de uma coordenada (Latitude e Longitude) via Google Maps API.
window.obterEnderecoPorCoordenadas = async function(latitude, longitude) {
    if (!latitude || !longitude) return null;

    const chavesDisponiveis = [
        { key: window.apiKeyGoogle,  label: "Chave Google 1" },
        { key: window.apiKeyGoogle2, label: "Chave Google 2" },
        { key: window.apiKeyGoogle3, label: "Chave Google 3" }
    ];

    let enderecoEncontrado = null;
    let googleSucesso = false;

    for (const item of chavesDisponiveis) {
        if (!verificarEIncrementarCotaGoogle(item.key, item.label)) continue;

        const carregouSDK = await carregarSDKGoogleMaps(item.key);
        if (!carregouSDK) continue;

        try {
            const resultadoGeocode = await new Promise((resolve, reject) => {
                const timeoutProtecao = setTimeout(() => reject('TIMEOUT_API_NOT_ACTIVATED'), 3500);
                try {
                    if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
                        clearTimeout(timeoutProtecao);
                        return reject('SDK_INCOMPLETA');
                    }
                    const geocoder = new google.maps.Geocoder();
                    const latlng = { lat: parseFloat(latitude), lng: parseFloat(longitude) };
                    geocoder.geocode({ location: latlng }, (results, status) => {
                        clearTimeout(timeoutProtecao);
                        if (status === 'OK' && results[0]) resolve(results[0].formatted_address);
                        else reject(status);
                    });
                } catch (err) {
                    clearTimeout(timeoutProtecao);
                    reject(err);
                }
            });

            enderecoEncontrado = resultadoGeocode;
            console.info(`✅ Reverse Geocoding obtido via ${item.label}: ${enderecoEncontrado}`);
            googleSucesso = true;
            break;
        } catch (statusErro) {
            console.warn(`⚠️ Falha no Reverse Geocoding da ${item.label}: Status/Motivo -> ${statusErro}`);
            if (statusErro === 'OVER_QUERY_LIMIT' || statusErro === 'REQUEST_DENIED' || statusErro === 'TIMEOUT_API_NOT_ACTIVATED') {
                marcarChaveComoBloqueada(item.key);
            }
        }
    }
    return googleSucesso ? enderecoEncontrado : null;
};