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
// Sincroniza a origem e o destino do mapa na interface do usuário adicionando seletores de transporte e coordenadas.
// Sincroniza a origem e o destino do mapa na interface do usuário adicionando seletores de transporte e coordenadas.
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

            const atualizarURLsMapas = async (atualizarLista = false) => {
                const modoTransporte = window.getSharedStoreValue?.('modoTransporteAtual') || 'pe';
                let sufixoTransporteBotao = modoTransporte === 'pe' ? "&travelmode=walking&dirflg=w" : "";
                let sufixoTransporteFrame = modoTransporte === 'pe' ? "&mode=walking" : "";

                // --- PROCESSAMENTO DOS WAYPOINTS PARA EXIBIÇÃO NO IFRAME ---
                let sufixoWaypoints = "";
                if (typeof listaExibirBase !== 'undefined' && Array.isArray(listaExibirBase)) {
                    const pontosEscolas = listaExibirBase
                        .filter(e => e.lat && e.lon && (Number(e.lat) !== Number(dadosGeo.geoEscola_Latit) || Number(e.lon) !== Number(dadosGeo.geoEscola_Longit)))
                        .map(e => `${e.lat},${e.lon}`);
                    
                    if (pontosEscolas.length > 0) {
                        sufixoWaypoints = `&waypoints=${encodeURIComponent(pontosEscolas.join('|'))}`;
                    }
                }

                const normalizeUrl = (url) => url ? url.replace(/&/g, '&') : url;

                const setLinkHref = (newUrl) => {
                    if (!linkMapaNovaGuia || !newUrl) return;
                    const normalized = normalizeUrl(newUrl);
                    if (linkMapaNovaGuia.dataset.currentHref !== normalized) {
                        linkMapaNovaGuia.dataset.currentHref = normalized;
                        linkMapaNovaGuia.href = normalized;
                    }
                };

                const modoMapa = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
                
                let coordenadaOrigemCalculada = { lat: dadosGeo.geoEndereco_Latit, lon: dadosGeo.geoEndereco_Longit };
                const coordenadaDestinoCalculada = { lat: dadosGeo.geoEscola_Latit, lon: dadosGeo.geoEscola_Longit };
                
                let urlIframeFallback = "";
                let urlLinkBotao = "";

                if (modoMapa === 'coordenada') {
                    urlIframeFallback = `https://maps.google.com/maps?saddr=${dadosGeo.geoEndereco_Latit},${dadosGeo.geoEndereco_Longit}&daddr=${dadosGeo.geoEscola_Latit},${dadosGeo.geoEscola_Longit}${sufixoWaypoints}${sufixoTransporteBotao}&output=embed`;
                    urlLinkBotao = `https://maps.google.com/maps?saddr=${dadosGeo.geoEndereco_Latit},${dadosGeo.geoEndereco_Longit}&daddr=${dadosGeo.geoEscola_Latit},${dadosGeo.geoEscola_Longit}${sufixoWaypoints}${sufixoTransporteBotao}`;
                } else {
                    let rota = window.getSharedStoreValue?.('dadosGeraisRota');

                    if (rota && rota.coordAlunoEnd && typeof rota.coordAlunoEnd === 'string') {
                        let stringEndereco = encodeURIComponent(rota.coordAlunoEnd);
                        urlIframeFallback = `https://maps.google.com/maps?saddr=${stringEndereco}&daddr=${dadosGeo.geoEscola_Latit},${dadosGeo.geoEscola_Longit}${sufixoWaypoints}${sufixoTransporteBotao}&output=embed`;
                        urlLinkBotao = `https://maps.google.com/maps?saddr=${stringEndereco}&daddr=${dadosGeo.geoEscola_Latit},${dadosGeo.geoEscola_Longit}${sufixoWaypoints}${sufixoTransporteBotao}`;
                    } else if (rota && rota.coordAlunoEnd && rota.coordAlunoEnd.lat) {
                        coordenadaOrigemCalculada = { lat: rota.coordAlunoEnd.lat, lon: rota.coordAlunoEnd.lon };
                        urlIframeFallback = `https://maps.google.com/maps?saddr=${rota.coordAlunoEnd.lat},${rota.coordAlunoEnd.lon}&daddr=${dadosGeo.geoEscola_Latit},${dadosGeo.geoEscola_Longit}${sufixoWaypoints}${sufixoTransporteBotao}&output=embed`;
                        urlLinkBotao = `https://maps.google.com/maps?saddr=${rota.coordAlunoEnd.lat},${rota.coordAlunoEnd.lon}&daddr=${dadosGeo.geoEscola_Latit},${dadosGeo.geoEscola_Longit}${sufixoWaypoints}${sufixoTransporteBotao}`;
                    } else {
                        urlIframeFallback = `https://maps.google.com/maps?saddr=${dadosGeo.geoEndereco_Latit},${dadosGeo.geoEndereco_Longit}&daddr=${dadosGeo.geoEscola_Latit},${dadosGeo.geoEscola_Longit}${sufixoWaypoints}${sufixoTransporteBotao}&output=embed`;
                        urlLinkBotao = `https://maps.google.com/maps?saddr=${dadosGeo.geoEndereco_Latit},${dadosGeo.geoEndereco_Longit}&daddr=${dadosGeo.geoEscola_Latit},${dadosGeo.geoEscola_Longit}${sufixoWaypoints}${sufixoTransporteBotao}`;
                    }
                }

                // Tenta forçar o carregamento assíncrono do SDK limpando restrições prévias de cota
                if (!window.google || !window.google.maps) {
                    const chaves = [window.apiKeyGoogle, window.apiKeyGoogle2, window.apiKeyGoogle3];
                    for (const chave of chaves) {
                        const ok = await carregarSDKGoogleMaps(chave);
                        if (ok) break;
                    }
                }

                // Invoca a verificação dinâmica. Caso o SDK siga nulo por falha das chaves, urlIframeFallback garantirá a rota e os pins no iframe de forma nativa e estável!
                window.gerarMapaComTrajetoEEscolas(iframeAtual, coordenadaOrigemCalculada, coordenadaDestinoCalculada, urlIframeFallback);
                setLinkHref(urlLinkBotao);

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
        // CORREÇÃO: Se o SDK já está carregado e corresponde à janela ativa, reaproveita sem destruir a instância concorrente
        if (window.google && window.google.maps && window.google.maps.DirectionsService) {
            resolve(true);
            return;
        }
        
        // Remove scripts duplicados antigos apenas se houver troca de chaves e o objeto global estiver quebrado
        const scripts = document.querySelectorAll('script[src*="maps.googleapis.com/maps/api/js"]');
        if (scripts.length > 0 && (!window.google || !window.google.maps)) {
            scripts.forEach(s => s.remove());
            window.google = undefined;
        }

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
        console.info("⚡ [CACHE / calcularTrajetoOSRM] Rota idêntica recuperada do localStorage (Teto Máx: 100 | Validade: 7 dias) para a UE:", idUnidadeDestino);
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
            //window.gerenciarEsalvarCachePersistente(STORAGE_KEY_GLOBAL, chaveCache, resultadoFinalOSRM);
            return resultadoFinalOSRM;
        }
    } catch (e) {
        if (e.name === 'AbortError') return null;
    }
    
    const resultadoFinalHav = { distancia: window.calcularDistanciaHaversine(latOrigin, lonOrigin, latDest, lonDest), fonte: 'HAVERSINE' };
    //window.gerenciarEsalvarCachePersistente(STORAGE_KEY_GLOBAL, chaveCache, resultadoFinalHav);
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
window.gerarMapaComTrajetoEEscolas = async function(iframeAtual, origem, destino, urlFallbackIframe) {
    // Caso o SDK do Google não esteja carregado ou falte dados geográficos fundamentais, aciona o Fallback de URLs estáticas
    if (!window.google || !window.google.maps || !origem.lat || !destino.lat) {
        console.warn("[gerarMapa] SDK do Google Maps ausente ou dados incompletos. Usando fallback de URL estática.");
        if (iframeAtual && urlFallbackIframe) {
            iframeAtual.style.display = "block";
            const idContainerDinamico = "google-maps-container-dinamico";
            const mapaDinamicoAntigo = iframeAtual.parentNode ? iframeAtual.parentNode.querySelector(`#${idContainerDinamico}`) : null;
            if (mapaDinamicoAntigo) mapaDinamicoAntigo.remove();
            
            const normalizedFallback = urlFallbackIframe.replace(/&/g, '&');
            if (iframeAtual.dataset.currentSrc !== normalizedFallback) {
                iframeAtual.dataset.currentSrc = normalizedFallback;
                iframeAtual.src = normalizedFallback;
            }
        }
        return;
    }

    try {
        const idContainerDinamico = "google-maps-container-dinamico";
        let elementoMapa = iframeAtual.parentNode.querySelector(`#${idContainerDinamico}`);

        // Se o contêiner dinâmico ainda não existe, cria-se um espelho perfeito com as dimensões do iframe original
        if (!elementoMapa) {
            elementoMapa = document.createElement("div");
            elementoMapa.id = idContainerDinamico;
            elementoMapa.style.width = iframeAtual.style.width || iframeAtual.width || "100%";
            elementoMapa.style.height = iframeAtual.style.height || iframeAtual.height || "400px";
            elementoMapa.style.borderRadius = iframeAtual.style.borderRadius || "4px";
            elementoMapa.style.border = "1px solid #ccc";
            iframeAtual.parentNode.insertBefore(elementoMapa, iframeAtual);
        }

        // Oculta o iframe nativo para dar lugar à renderização rica por objetos JavaScript
        iframeAtual.style.display = "none";

        // Inicializa o mapa com controles visuais limpos e ID de mapa obrigatório para elementos avançados
        const mapOptions = {
            zoom: 14,
            center: new google.maps.LatLng(origem.lat, origem.lon || origem.lng || origem.lon),
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            mapTypeControl: false,
            streetViewControl: false,
            mapId: "DEMO_MAP_ID"
        };
        
        const mapa = new google.maps.Map(elementoMapa, mapOptions);

        // Importa a biblioteca de marcadores avançados em HTML/CSS nativos
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

        // Configura o serviço e a linha visual do trajeto direto (Omitindo marcadores padrão A e B para usarmos os nossos em HTML)
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
            map: mapa,
            suppressMarkers: true 
        });

        const localOrigem = new google.maps.LatLng(origem.lat, origem.lon || origem.lng);
        const localDestino = new google.maps.LatLng(destino.lat, destino.lon || destino.lng);
        const modoTransporte = window.getSharedStoreValue?.('modoTransporteAtual') || 'pe';

        // Executa o trajeto direto entre aluno e escola alvo
        directionsService.route({
            origin: localOrigem,
            destination: localDestino,
            travelMode: modoTransporte === 'pe' ? google.maps.TravelMode.WALKING : google.maps.TravelMode.DRIVING
        }, (response, status) => {
            if (status === 'OK') {
                directionsRenderer.setDirections(response);
                
                // --- INJEÇÃO DA LEGENDA DE DISTÂNCIA REAL DA API ---
                try {
                    const rotaLeg = response.routes[0].legs[0];
                    const textoDistancia = rotaLeg.distance.text; // Ex: "1.2 km" ou "850 m"
                    const textoDuracao = rotaLeg.duration.text;  // Ex: "15 min"
                    
                    // Cria o elemento do painel de controle flutuante
                    const painelDistancia = document.createElement("div");
                    painelDistancia.style.cssText = "margin: 10px; padding: 8px 12px; background: white; color: #222; font-family: Verdana, sans-serif; font-size: 12px; font-weight: bold; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 1px solid #ddd; display: flex; flex-direction: column; gap: 2px; min-width: 110px;";
                    
                    painelDistancia.innerHTML = `
                        <div style="color: #1a73e8; font-size: 13px; display: flex; align-items: center; gap: 4px;">
                            <span>🏁 Distância:</span> <span style="color: #222;">${textoDistancia}</span>
                        </div>
                        <div style="color: #5f6368; font-size: 10px; font-weight: normal; padding-left: 18px;">
                            Tempo estimado: ${textoDuracao} (${modoTransporte === 'pe' ? 'A pé' : 'Carro'})
                        </div>
                    `;
                    
                    // Insere o painel dinamicamente na UI nativa do mapa do Google (Canto superior esquerdo)
                    mapa.controls[google.maps.ControlPosition.TOP_LEFT].push(painelDistancia);
                    console.log(`[PLUGIN-MAPA] Legenda de distância injetada com sucesso: ${textoDistancia}`);
                } catch (e) {
                    console.warn("Não foi possível renderizar o painel flutuante de distância:", e);
                }

            } else {
                console.error("[PLUGIN] Erro ao traçar rota no mapa JS. Revertendo para Fallback:", status);
                elementoMapa.remove();
                iframeAtual.style.display = "block";
                iframeAtual.src = urlFallbackIframe;
            }
        });

        // --- DETECÇÃO DO NÍVEL DO ALUNO E DADOS DA FICHA EM TEMPO REAL ---
        let nivelNorm = "";
        let isBercarioGeral = false;
        let enderecoCompletoAluno = "Residência do Aluno";
        let nomeEscolaDestino = "Escola de Destino Selecionada";

        const docEscopo = iframeAtual.ownerDocument || document;
        
        // Coleta o endereço completo para o hover da origem
        const elEndereco = docEscopo.getElementById('endereco');
        const elNumero = docEscopo.getElementById('endereco_numero_residencia');
        const elBairro = docEscopo.getElementById('endereco_bairro');
        if (elEndereco) {
            enderecoCompletoAluno = [elEndereco.value || elEndereco.innerText, elNumero?.value || elNumero?.innerText, elBairro?.value || elBairro?.innerText].filter(Boolean).join(', ').trim() || enderecoCompletoAluno;
        }

        // Coleta o nome da escola alvo para o hover do destino
        const inputIdUnidade = docEscopo.querySelector('input[name="id_unidade"]');
        if (inputIdUnidade && window.escolasDB) {
            const escolaAlvoObj = window.escolasDB.find(e => String(e.id) === String(inputIdUnidade.value.trim()));
            if (escolaAlvoObj) nomeEscolaDestino = escolaAlvoObj.nome;
        }

        const selectNivel = docEscopo.getElementById('nivel');
        if (selectNivel?.options[selectNivel.selectedIndex]) {
            const textoSelecionado = selectNivel.options[selectNivel.selectedIndex].text || selectNivel.value;
            nivelNorm = window.normalizarTexto ? window.normalizarTexto(textoSelecionado) : textoSelecionado.toUpperCase().trim();
            nivelNorm = nivelNorm.replace(/([0-9]+)\s*[Oº\.]\s*ANO/g, '$1O ANO');
            if (nivelNorm.includes('EJA')) nivelNorm = 'EJA';
            if (nivelNorm.includes('ESPECIAL')) nivelNorm = 'ESPECIAL';
            isBercarioGeral = nivelNorm.includes('BERCARIO') && nivelNorm !== 'BERCARIO INICIAL' && nivelNorm !== 'BERCARIO FINAL';
        }

        console.log(`[FILTRO-MAPA] 🔎 Nível do Aluno Identificado para Filtragem: "${nivelNorm}" | É Berçário Geral: ${isBercarioGeral}`);

        // --- RENDERIZAÇÃO DOS MARCADORES CUSTOMIZADOS HTML/CSS ---

        // 1. PIN DA ORIGEM (Casa do Aluno) com hover do endereço completo
        const divCasa = document.createElement("div");
        divCasa.innerHTML = "🏠";
        divCasa.style.cssText = "font-size: 20px; background: #1a73e8; color: white; padding: 6px; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.4); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 2px solid white;";
        
        new AdvancedMarkerElement({
            position: localOrigem,
            map: mapa,
            title: enderecoCompletoAluno,
            content: divCasa
        });

        // 2. PIN DO DESTINO (Escola Escolhida/Atual) com hover do nome da escola alvo
        const divEscolaDestino = document.createElement("div");
        divEscolaDestino.innerHTML = "🏫";
        divEscolaDestino.style.cssText = "font-size: 20px; background: #d93025; color: white; padding: 6px; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.4); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 2px solid white;";
        
        new AdvancedMarkerElement({
            position: localDestino,
            map: mapa,
            title: nomeEscolaDestino,
            content: divEscolaDestino
        });

        // 3. WAYPOINTS (Outras escolas com filtro de nível e transformação dinâmica em hover)
        const arrayEscolas = window.escolasDB;
        if (Array.isArray(arrayEscolas)) {
            console.log(`[FILTRO-MAPA] Total de escolas encontradas no banco DB: ${arrayEscolas.length}`);
            let escolasPlotadas = 0;

            arrayEscolas.forEach(escola => {
                if (!escola.lat || !escola.lon || !escola.turmas) return;

                // Ignora se for a coordenada exata do destino final
                if (Number(escola.lat) === Number(destino.lat) && Number(escola.lon) === Number(destino.lon)) return;

                // Executa a regra padrão de filtro de turmas do seu assistente
                const temTurmaApta = school => school.turmas.some(turma => {
                    if (!window.normalizarTexto) return true;
                    const nivelTurmaNorm = window.normalizarTexto(turma.nivel);
                    if (isBercarioGeral) return nivelTurmaNorm.includes('BERCARIO');
                    if (nivelNorm === 'ESPECIAL' && nivelTurmaNorm.includes('ESPECIAL')) return true;
                    if (nivelNorm === 'EJA' && nivelTurmaNorm.includes('EJA')) return true;
                    return nivelTurmaNorm === nivelNorm;
                });

                if (!temTurmaApta(escola)) return;
                escolasPlotadas++;

                // Limpa o nome ignorando tudo após a vírgula
                const nomeBase = (escola.nome || "UE").split(',')[0].trim();

                // Extrai abreviação inteligente (se já não for curta, pega as duas primeiras letras após tirar 'EMEB')
                const iniciais = nomeBase.length <= 6 ? nomeBase : nomeBase.replace("EMEB", "").trim().substring(0, 2).toUpperCase();

                // Componente HTML/CSS estruturado para transição de Redondo para Retangular Dinâmico
                const divWaypoint = document.createElement("div");
                divWaypoint.style.cssText = "font-family: Verdana, sans-serif; font-size: 10px; font-weight: bold; background: #5f6368; color: white; padding: 4px 8px; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.3); width: 24px; height: 24px; min-width: 24px; display: flex; align-items: center; justify-content: center; border: 1px solid white; opacity: 0.75; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; z-index: 10;";
                
                // Elemento interno para controlar a troca de texto sem quebras de layout
                const spanTexto = document.createElement("span");
                spanTexto.innerText = iniciais;
                divWaypoint.appendChild(spanTexto);
                
                // Eventos dinâmicos avançados de expansão e alteração de opacidade
                divWaypoint.addEventListener("mouseenter", () => {
                    divWaypoint.style.borderRadius = "4px";
                    divWaypoint.style.width = "auto";
                    divWaypoint.style.maxWidth = "220px";
                    divWaypoint.style.height = "auto";
                    divWaypoint.style.minHeight = "24px";
                    divWaypoint.style.background = "#202124";
                    divWaypoint.style.opacity = "1.0";
                    spanTexto.innerText = nomeBase; // Revela o nome limpo inteiro
                });

                divWaypoint.addEventListener("mouseleave", () => {
                    divWaypoint.style.borderRadius = "50%";
                    divWaypoint.style.width = "24px";
                    divWaypoint.style.height = "24px";
                    divWaypoint.style.background = "#5f6368";
                    divWaypoint.style.opacity = "0.75";
                    spanTexto.innerText = iniciais; // Retorna às iniciais curtas
                });

                // CORREÇÃO: Alterado termo incorreto de "school.lon" para "escola.lon" para evitar quebra de script
                const marker = new AdvancedMarkerElement({
                    position: new google.maps.LatLng(escola.lat, escola.lon),
                    map: mapa,
                    title: nomeBase, // Mostra o nome inteiro limpo na tooltip nativa do browser
                    content: divWaypoint
                });

                const infoWindow = new google.maps.InfoWindow({
                    content: `<div style="font-family:Verdana,sans-serif;font-size:11px;color:#333;">
                                <strong>${escola.nome || 'Unidade Escolar'}</strong><br/>
                                ${escola.rua || ''}, ${escola.numero || ''}<br/>
                                <span>Bairro: ${escola.bairro || ''}</span>
                              </div>`
                });

                marker.addListener('click', () => {
                    infoWindow.open(mapa, marker);
                });
            });

            console.log(`[FILTRO-MAPA] ✅ Processo finalizado com sucesso! Escolas plotadas no mapa: ${escolasPlotadas}`);
        }
    } catch (err) {
        console.error("[gerarMapa] Falha crítica no mapa interativo JS. Acionando Fallback nativo estrutural:", err);
        if (iframeAtual) {
            iframeAtual.style.display = "block";
            iframeAtual.src = urlFallbackIframe;
        }
    }
};