// =========================================================================
// CONFIGURAÇÃO CENTRALIZADA DE CHAVES DE API DO GOOGLE (DEFINIDAS APENAS UMA VEZ)
// =========================================================================
window.apiKeyGoogle = "CHAVE_GMAPS_1";
window.apiKeyGoogle2 = "CHAVE_GMAPS_2";
window.apiKeyGoogle3 = "CHAVE_GMAPS_3";

// Calcula uma aproximação de distância euclidiana rápida entre dois pontos (evita math.sqrt pesada).
window.calcularProximidadeRapida = function(lat1, lon1, lat2, lon2) {
    lat1 = Number(lat1); lon1 = Number(lon1); lat2 = Number(lat2); lon2 = Number(lon2);
    if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) return Infinity;
    const FATOR_LON = 0.916;
    const dLat = lat1 - lat2;
    const dLon = (lon1 - lon2) * FATOR_LON;
    return (dLat * dLat) + (dLon * dLon);
};

// Calcula a distância exata entre duas coordenadas em metros (Fórmula de Haversine).
window.calcularDistanciaHaversine = function(lat1, lon1, lat2, lon2) {
    lat1 = Number(lat1); lon1 = Number(lon1); lat2 = Number(lat2); lon2 = Number(lon2);
    if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) return Infinity;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    // Math.max evita que inconsistências minúsculas gerem NaN na raiz quadrada
    const c = 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));
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

        // 1. TENTATIVA: Extração via Texto (Mais robusta)
        let latE = null, lonE = null, latS = null, lonS = null;
        const textoCompleto = docVirtual.body.innerText;
        
        // Busca Latitude e Longitude do Endereço (usando Regex que aceita vírgulas ou pontos)
        const matchGeo = textoCompleto.match(/GEOLOCALIZAÇÃO: Latitude:\s*([-\d,.]+)\s*Longitude:\s*([-\d,.]+)/i);
        if (matchGeo) {
            latE = parseFloat(matchGeo[1].replace(',', '.'));
            lonE = parseFloat(matchGeo[2].replace(',', '.'));
        }

        // 2. TENTATIVA: Extração via Iframe (Fallback)
        const iframeMap = docVirtual.getElementById('map_endereco');
        if (iframeMap && iframeMap.src) {
            const urlCompleta = iframeMap.src;
            const regexOrigin = /origin=([^&]+)/i;
            const regexDest = /destination=([^&]+)/i;
            const matchOrigin = urlCompleta.match(regexOrigin);
            const matchDest = urlCompleta.match(regexDest);

            const parseCoord = (str) => {
                if(!str) return {lat: null, lon: null};
                // Limpa a string do mapa (ex: "-23,7111 -46,5921")
                const partes = decodeURIComponent(str).replace(/\+/g, ' ').split(/[\s,]+/);
                if(partes.length >= 2) return { lat: parseFloat(partes[0].replace(',', '.')), lon: parseFloat(partes[1].replace(',', '.')) };
                return { lat: null, lon: null };
            };

            const origin = parseCoord(matchOrigin ? matchOrigin[1] : null);
            const dest = parseCoord(matchDest ? matchDest[1] : null);
            
            // Prioriza o texto, usa o iframe se o texto falhou
            if (!latE) { latE = origin.lat; lonE = origin.lon; }
            if (!latS) { latS = dest.lat; lonS = dest.lon; }
        }

        if (latE !== null && lonE !== null) {
            return {
                urlMaps: iframeMap ? iframeMap.src : "",
                geoEndereco_Latit: latE,
                geoEndereco_Longit: lonE,
                geoEscola_Latit: latS,
                geoEscola_Longit: lonS
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
    if (!docAlvo) {
        console.error("[ASSISTENTE] Erro: Sincronização chamada sem documento alvo.");
        return;
    }

    let urlOrigem = docAlvo.location ? docAlvo.location.href : window.location.href;
    let idSolInput = docAlvo.querySelector('input[name="id_solicitacao"]') || docAlvo.querySelector('input[name="id"]');
    let idFicha = idSolInput ? idSolInput.value : '';
    let basePath = urlOrigem.substring(0, urlOrigem.lastIndexOf('/') + 1);

    const moduloPath = "modulos/transporte_escolar/";
    const prefixo = basePath.includes(moduloPath) ? "" : moduloPath;
    let urlFichaNova = basePath + prefixo + 'ficha_transporte_nova_versao.php?id_solicitacao=' + idFicha;

    const dadosGeo = await window.extrairDadosGeograficos(urlFichaNova);

    if (dadosGeo && dadosGeo.geoEndereco_Latit.length > 4 && dadosGeo.geoEndereco_Longit.length > 4) {

        const localValido = window.estaDentroDaCidade(dadosGeo.geoEndereco_Latit, dadosGeo.geoEndereco_Longit);
    
            // Se não estiver dentro, força o modo 'endereco' para ignorar as coordenadas corrompidas/distantes
            if (!localValido) {
                console.warn("[ASSISTENTE] Coordenadas fora de SBC. Forçando modo Endereço. urlFichaNova: " + urlFichaNova + " | Lat: " + dadosGeo.geoEndereco_Latit + " | Lon: " + dadosGeo.geoEndereco_Longit);
                window.setSharedStore?.({ modoMapaAtual: 'endereco' });
            }

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
                // --- OCULTAÇÃO DO TOGGLE SWITCH AUTOMÁTICA ---
                // Localiza o elemento visual do interruptor/toggle e o esconde com segurança
                const elementoToggle = document.getElementById('switch-transporte-mapa') || 
                                       document.querySelector('.switch-transporte-mapa') ||
                                       document.getElementById('toggle-transporte'); // Fallbacks comuns de ID
                if (elementoToggle) {
                    elementoToggle.style.setProperty('display', 'none', 'important');
                }

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
                window.gerarMapa(iframeAtual, coordenadaOrigemCalculada, coordenadaDestinoCalculada, urlIframeFallback);
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
                btnModoTransp.innerHTML = `<span class="mdi mdi-walk" style="font-size:14px; margin-right:4px; display:none;"></span> A pé`;

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
function marcarChaveComoBloqueada(apiKey, minutosCooldown = 10) {
    const tempoDesbloqueio = Date.now() + (minutosCooldown * 60 * 1000);
    // Salva o exato milissegundo em que a chave estará livre novamente
    localStorage.setItem(`gmaps_cooldown_${apiKey}`, tempoDesbloqueio.toString());
    console.warn(`⏳ Chave de API entrou em cooldown. Retorna em ${minutosCooldown} minutos.`);
}

function verificarEIncrementarCotaGoogle(apiKey, nomeChave) {
    const hoje = new Date().toISOString().slice(0, 10);
    const chaveStorageCount = `gmaps_count_${apiKey}_${hoje}`;
    const chaveStorageCooldown = `gmaps_cooldown_${apiKey}`;

    // 1. Verifica se a chave está em período de "resfriamento" (Cooldown)
    const tempoDesbloqueio = parseInt(localStorage.getItem(chaveStorageCooldown) || '0', 10);
    if (tempoDesbloqueio > Date.now()) {
        const minutosRestantes = Math.ceil((tempoDesbloqueio - Date.now()) / 60000);
        console.log(`🔒 ${nomeChave} está descansando. Liberada em aprox. ${minutosRestantes} min.`);
        return false; // Pula imediatamente para a próxima chave do array
    } else if (tempoDesbloqueio > 0) {
        // Se o tempo já passou, remove a trava e avisa no console
        localStorage.removeItem(chaveStorageCooldown);
        console.info(`✅ ${nomeChave} saiu do cooldown e voltou a operar.`);
    }

    // 2. Proteção do Limite Diário Seguro (Anti-Cobrança)
    let requisicoesHoje = parseInt(localStorage.getItem(chaveStorageCount) || '0', 10);
    const LIMITE_DIARIO_SEGURO = 400; 

    if (requisicoesHoje >= LIMITE_DIARIO_SEGURO) {
        // Bateu a cota diária de segurança? Coloca em cooldown por 12 horas (720 minutos)
        marcarChaveComoBloqueada(apiKey, 720);
        console.warn(`🛑 Limite diário seguro (400) atingido para a ${nomeChave}. Pulando para a próxima...`);
        return false;
    }

    // 3. Incrementa o uso diário e permite a requisição
    localStorage.setItem(chaveStorageCount, (requisicoesHoje + 1).toString());
    return true;
}

window._promiseGoogleMaps = window._promiseGoogleMaps || null;

function carregarSDKGoogleMaps(apiKey) {
    console.log(`🔑 Tentando carregar Google Maps SDK com a chave: ${apiKey}`);
    // 1. Se já carregou e a API de Directions está pronta, retorna true imediatamente
    if (window.google && window.google.maps && window.google.maps.DirectionsService) {
        return Promise.resolve(true);
    }
    
    // 2. Se já existe um carregamento em andamento, todas as requisições "pegam carona" na mesma Promise
    if (window._promiseGoogleMaps) {
        return window._promiseGoogleMaps;
    }

    // 3. Bloqueia múltiplos carregamentos criando uma única Promise global
    window._promiseGoogleMaps = new Promise((resolve) => {
        // Não destrua o objeto window.google globalmente, pois isso corrompe a instância na memória do navegador
        if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
             if (window.google && window.google.maps) {
                 return resolve(true);
             }
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&loading=async`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => resolve(true);
        script.onerror = () => {
            window._promiseGoogleMaps = null; // Permite tentar de novo se der falha real
            resolve(false);
        };
        
        document.head.appendChild(script);
    });

    return window._promiseGoogleMaps;
}

// --- SECTION: GOOGLE MAPS / OSRM ROUTING CALCULATION ---
// Calcula o trajeto (distância da rota) de um ponto ao outro via Google Maps SDK ou servidor OSRM (como fallback).
window._pendingTrajetos = window._pendingTrajetos || {};

window.calcularTrajeto = async function(latOrigin, lonOrigin, latDest, lonDest, profileIgnored = 'foot', signal = null) {

    // 1. Validação de presença de dados
    if (latOrigin == null || lonOrigin == null || latDest == null || lonDest == null) {
        console.warn("[PLUGIN-MAPA] 🚫 Coordenadas ausentes. Rota não calculada para não gerar Bad Request.");
        return null;
    }


    latOrigin = Number(latOrigin);
lonOrigin = Number(lonOrigin);
latDest = Number(latDest);
lonDest = Number(lonDest);

if (
    !Number.isFinite(latOrigin) ||
    !Number.isFinite(lonOrigin) ||
    !Number.isFinite(latDest) ||
    !Number.isFinite(lonDest)
) {
    return null;
}

    if (isNaN(latOrigin) || isNaN(lonOrigin) || isNaN(latDest) || isNaN(lonDest) ||
        Math.abs(latOrigin) > 90 || Math.abs(lonOrigin) > 180 ||
        Math.abs(latDest) > 90 || Math.abs(lonDest) > 180) {
        console.warn("[PLUGIN-MAPA] 🚫 Coordenadas inválidas interceptadas. Rota não calculada para não gerar Bad Request.");
        return null;
    }

    const localValido = window.estaDentroDaCidade(latOrigin, lonOrigin);
    
            // Se não estiver dentro, força o modo 'endereco' para ignorar as coordenadas corrompidas/distantes
            if (!localValido) {
                console.warn("[ASSISTENTE] Coordenadas fora de SBC. API Key: " + window.GOOGLE_MAPS_API_KEY);
                return null;
            }

    const STORAGE_KEY_GLOBAL = 'plattransp_global_routes_cache';
    const modoMapa = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
    
    const idUnidadeDestino = (typeof listaExibirBase !== 'undefined' && listaExibirBase)
    ? (
        listaExibirBase.find(e =>
            Math.abs(Number(e.lat) - latDest) < 0.000001 &&
            Math.abs(Number(e.lon) - lonDest) < 0.000001
        )?.id
        || `${latDest},${lonDest}`
      )
    : `${latDest},${lonDest}`;

    const pesosFontes = { 'GOOGLE': 3, 'OSRM': 2, 'HAVERSINE': 1 };

    // MÁGICA DE OTIMIZAÇÃO: Promise Coalescing (Evita Race Condition e múltiplas chamadas simultâneas)
    const cacheExecucaoKey = `${latOrigin},${lonOrigin}_${latDest},${lonDest}_${profileIgnored}`;
    
    if (window._pendingTrajetos[cacheExecucaoKey]) {
        return window._pendingTrajetos[cacheExecucaoKey];
    }

    // Envolve a lógica inteira num cache temporário para outras funções "pegarem carona"
    const promessaCalculo = (async () => {
        const executarCalculoParaPerfil = async (perfilAlvo) => {
            const googleMode = perfilAlvo === 'foot' ? 'WALKING' : 'DRIVING';
            const chaveCache = `${modoMapa}_${googleMode}_${latOrigin},${lonOrigin}_UE_${idUnidadeDestino}`;
            const dadosEmCacheValido = window.obterValorCachePersistente(STORAGE_KEY_GLOBAL, chaveCache);
            
            if (
    dadosEmCacheValido &&
    (dadosEmCacheValido.fonte === 'GOOGLE' || dadosEmCacheValido.fonte === 'OSRM')
) {

    const distanciaCache = Number(dadosEmCacheValido.distancia);

    if (
        Number.isFinite(distanciaCache) &&
        distanciaCache > 0 &&
        distanciaCache < 500000
    ) {

        return dadosEmCacheValido;

    }

    console.warn(
        "[CACHE] Distância inválida encontrada no cache:",
        dadosEmCacheValido
    );

    window.removerValorCachePersistente?.(
        STORAGE_KEY_GLOBAL,
        chaveCache
    );

}

            const salvarSeguroCache = (novoResultado) => {
                if (dadosEmCacheValido && dadosEmCacheValido.fonte) {
                    const pesoAtual = pesosFontes[dadosEmCacheValido.fonte] || 0;
                    const pesoNovo = pesosFontes[novoResultado.fonte] || 0;
                    if (pesoAtual > pesoNovo) return dadosEmCacheValido;
                }
                window.gerenciarEsalvarCachePersistente(STORAGE_KEY_GLOBAL, chaveCache, novoResultado);
                return novoResultado;
            };

            const chavesDisponiveis = [
                { key: window.apiKeyGoogle,  label: "Chave Google 1" },
                { key: window.apiKeyGoogle2, label: "Chave Google 2" },
                { key: window.apiKeyGoogle3, label: "Chave Google 3" }
            ];
            
            let dadosRoteamento = null;
            let googleSucesso = false;

            if (signal && signal.aborted) return null;

            for (const item of chavesDisponiveis) {
                if (!verificarEIncrementarCotaGoogle(item.key, item.label)) continue; 
                const carregouSDK = await carregarSDKGoogleMaps(item.key);
                if (!carregouSDK) continue;

                try {
                    const resultadoDirecao = await new Promise((resolve, reject) => {
                        const timeoutProtecao = setTimeout(() => reject('TIMEOUT_API_NOT_ACTIVATED'), 5000);
                        
                        if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
                            clearTimeout(timeoutProtecao);
                            return reject('SDK_INCOMPLETA');
                        }

                        if (signal && signal.aborted) {
                            clearTimeout(timeoutProtecao);
                            return reject('AbortError');
                        }

                        try {
                            const directionsService = new google.maps.DirectionsService();
                            directionsService.route({
                                origin: new google.maps.LatLng(latOrigin, lonOrigin),
                                destination: new google.maps.LatLng(latDest, lonDest),
                                travelMode: google.maps.TravelMode[googleMode]
                            }, (response, status) => {
                                clearTimeout(timeoutProtecao);
                                if (status === 'OK') {
                                    resolve(response.routes[0].legs[0].distance.value);
                                } else {
                                    reject(status);
                                }
                            });
                        } catch (e) {
                            clearTimeout(timeoutProtecao);
                            reject(e);
                        }
                    });

                    dadosRoteamento = Number(resultadoDirecao);

                    if (!Number.isFinite(dadosRoteamento) || dadosRoteamento <= 0) {
                        throw new Error("GOOGLE_INVALID_DISTANCE");
                    }

                    dadosRoteamento = Math.round(dadosRoteamento);

                        googleSucesso = true;
                        break;
                } catch (erroCapturado) {
                    const erroStr = (erroCapturado && erroCapturado.name) ? erroCapturado.name : String(erroCapturado);
                    if (erroStr === 'AbortError') return null; 
                    
                    // Previne o loop de chaves caso a rota simplesmente não exista (ZERO_RESULTS)
                    if (erroStr === 'ZERO_RESULTS') break;
                    
                    // Bloqueia a chave APENAS se a cota do Google estourar ou a chave for rejeitada.
                    if (erroStr === 'OVER_QUERY_LIMIT' || erroStr === 'REQUEST_DENIED') {
                        marcarChaveComoBloqueada(item.key);
                    }
                }
            }

            if (googleSucesso && dadosRoteamento !== null) {
                return salvarSeguroCache({ distancia: dadosRoteamento, fonte: 'GOOGLE' });
            }

            // --- FALLBACK 1: OSRM ---
            // --- FALLBACK 1: OSRM ---
            try {
                const url = `https://router.project-osrm.org/route/v1/${perfilAlvo}/${lonOrigin},${latOrigin};${lonDest},${latDest}?overview=false`;
                
                // Cria um AbortController combinado para forçar timeout de 3000ms na requisição HTTP do OSRM
                const osrmTimeoutController = new AbortController();
                const timeoutId = setTimeout(() => osrmTimeoutController.abort(), 3000);
                
                let fetchSignal = osrmTimeoutController.signal;
                if (signal) {
                    // Se houver um signal externo vindo do assistente, vincula ao cancelamento também
                    signal.addEventListener('abort', () => osrmTimeoutController.abort());
                    if (signal.aborted) osrmTimeoutController.abort();
                }
                
                const fetchOptions = { signal: fetchSignal };
                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                        return salvarSeguroCache({ distancia: Math.round(data.routes[0].distance), fonte: 'OSRM' });
                    }
                }
            } catch (e) {
                if (e.name === 'AbortError') return null;
            }

            // --- FALLBACK 2: HAVERSINE ---
            const distanciaHaversine = Number(
    window.calcularDistanciaHaversine(
        latOrigin,
        lonOrigin,
        latDest,
        lonDest
    )
);

if (
    !Number.isFinite(distanciaHaversine) ||
    distanciaHaversine < 0 ||
    distanciaHaversine > 500000
) {
    console.warn(
        "[PLUGIN-MAPA] Distância Haversine inválida:",
        distanciaHaversine,
        latOrigin,
        lonOrigin,
        latDest,
        lonDest
    );

    return null;
}

return salvarSeguroCache({
    distancia: Math.round(distanciaHaversine),
    fonte: 'HAVERSINE'
});
        };

        const resultadoFoot = await executarCalculoParaPerfil('foot');
        if (!resultadoFoot) return null;

        let usarExcecaoCarro = false;
        let resultadoCarro = null;

        if (resultadoFoot.distancia > 10000) {
            resultadoCarro = await executarCalculoParaPerfil('driving');
            if (resultadoCarro) {
                if (resultadoCarro.distancia < 5000 || resultadoCarro.distancia < (resultadoFoot.distancia / 2)) {
                    usarExcecaoCarro = true;
                }
            }
        }

        let distanciaBruta = usarExcecaoCarro && resultadoCarro
    ? resultadoCarro.distancia
    : resultadoFoot.distancia;

if (
    !Number.isFinite(distanciaBruta) ||
    distanciaBruta <= 0 ||
    distanciaBruta > 500000
) {
    console.warn("[PLUGIN-MAPA] Distância final inválida:", distanciaBruta);
    return null;
}
        let fonteFinal = usarExcecaoCarro && resultadoCarro ? resultadoCarro.fonte : resultadoFoot.fonte;
        let modoFinal = usarExcecaoCarro && resultadoCarro ? 'driving' : 'foot';

        let distanciaArredondada;
        if (distanciaBruta < 300) {
            distanciaArredondada = Math.round(distanciaBruta / 10) * 10;
        } else if (distanciaBruta >= 1000) {
            distanciaArredondada = Math.round(distanciaBruta / 100) * 100;
        } else {
            distanciaArredondada = Math.round(distanciaBruta / 50) * 50;
        }

        return {
            distancia: distanciaArredondada,
            fonte: fonteFinal,
            modoUtilizado: modoFinal
        };
    })();

    // Armazena a promessa no Objeto Global até ela finalizar
    window._pendingTrajetos[cacheExecucaoKey] = promessaCalculo;
    
    try {
        return await promessaCalculo;
    } finally {
        // Ao finalizar ou falhar, limpa do array temporário
        delete window._pendingTrajetos[cacheExecucaoKey];
    }
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
                    if (err.name === 'AbortError') {
                    console.warn("[Nominatim] Requisição cancelada ou Timeout atingido.");
                    } else {
                    console.error("❌ Erro ao buscar coordenadas...", err);
                    }
                    return null; // Retorna null para o fluxo continuar sem travar
                }
            });

            coordenadasResultado = localizacaoGeocode;
            console.info(`✅ Geocoding obtido via ${item.label}: ${coordenadasResultado.lat}, ${coordenadasResultado.lon}`);
            googleSucesso = true;
            break;
        } catch (statusErro) {
            console.warn(`⚠️ Falha no Geocoding da ${item.label}: Status/Motivo -> ${statusErro}`);
            // NOVO CÓDIGO
            if (statusErro === 'OVER_QUERY_LIMIT' || statusErro === 'REQUEST_DENIED') {
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
            if (statusErro === 'OVER_QUERY_LIMIT' || statusErro === 'REQUEST_DENIED') {
                marcarChaveComoBloqueada(item.key);
            }
        }
    }
    return googleSucesso ? enderecoEncontrado : null;
};
window.gerarMapa = async function(iframeAtual, origem, destino, urlFallbackIframe) {
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

    // Função auxiliar para verificar e formatar o prefixo "+-" caso a fonte não seja estritamente Google
    const verificarPrependDistancia = (texto, fonte) => {
        if (!texto) return texto;
        const f = (fonte || "").toLowerCase();
        const t = texto.toLowerCase();
        // Se a fonte não for google, ou se fonte/texto contiver OSRM ou Haversine
        if (f !== "google" || f.includes("osrm") || f.includes("haversine") || t.includes("osrm") || t.includes("haversine")) {
            if (!texto.startsWith("+-")) {
                return "+-" + texto;
            }
        }
        return texto;
    };

    try {
        const idContainerDinamico = "google-maps-container-dinamico";
        let elementoMapa = iframeAtual.parentNode.querySelector(`#${idContainerDinamico}`);

        // Se o mapa antigo já existe no DOM, remova-o para evitar conflitos de renderização e sobreposição de Canvas
        if (elementoMapa) {
            elementoMapa.remove();
        }

        // Agora, SEMPRE criamos um contêiner limpo
        elementoMapa = document.createElement("div");
        elementoMapa.id = idContainerDinamico;
        elementoMapa.style.width = iframeAtual.style.width || iframeAtual.width || "100%";
        elementoMapa.style.height = iframeAtual.style.height || iframeAtual.height || "400px";
        elementoMapa.style.borderRadius = iframeAtual.style.borderRadius || "4px";
        elementoMapa.style.border = "1px solid #ccc";
        iframeAtual.parentNode.insertBefore(elementoMapa, iframeAtual);

        // Oculta o iframe nativo para dar lugar à renderização rica por objetos JavaScript
        iframeAtual.style.display = "none";

        // Inicializa o mapa com controles visuais limpos e ID de mapa obrigatório para elementos avançados
        const mapOptions = {
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            mapTypeControl: false,
            streetViewControl: false,
            mapId: "DEMO_MAP_ID"
        };
        
        const mapa = new google.maps.Map(elementoMapa, mapOptions);
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(new google.maps.LatLng(origem.lat, origem.lon || origem.lng));
        bounds.extend(new google.maps.LatLng(destino.lat, destino.lon || destino.lng));
        mapa.fitBounds(bounds);

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

        // Definição de coordenadas normalizadas do destino para conferência estrita e precisa
        const destinoLatAlvo = Number(destino.lat);
        const destinoLonAlvo = Number(destino.lon || destino.lng);
        const cacheKeyMain = `${origem.lat},${origem.lon || origem.lng}->${destinoLatAlvo},${destinoLonAlvo}_${modoTransporte}`;

        // Armazenará o texto da distância calculada para reuso no hover do destino
        let textoDistanciaCompartilhada = "";
        let fonteDistanciaCompartilhada = "google";

        // Função auxiliar reutilizável para renderização do painel flutuante de distância na UI do mapa
        const injetarPainelControleDistancia = (textoDistancia, textoDuracao, fonte = "google") => {
            try {
                textoDistanciaCompartilhada = textoDistancia;
                fonteDistanciaCompartilhada = fonte;
                const painelDistancia = document.createElement("div");
                painelDistancia.style.cssText = "margin: 10px; padding: 8px 12px; background: white; color: #222; font-family: Verdana, sans-serif; font-size: 12px; font-weight: bold; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 1px solid #ddd; display: flex; flex-direction: column; gap: 2px; min-width: 110px;";
                
                const txtExibir = verificarPrependDistancia(textoDistancia, fonte);

                painelDistancia.innerHTML = `
                    <div style="color: #1a73e8; font-size: 13px; display: flex; align-items: center; gap: 4px;">
                        <span>🏁 Distância:</span> <span style="color: #222;">${txtExibir}</span>
                    </div>
                    <div style="color: #5f6368; font-size: 10px; font-weight: normal; padding-left: 18px;">
                        Tempo estimado: ${textoDuracao} (${modoTransporte === 'pe' ? 'A pé' : 'Carro'})
                    </div>
                `;
                mapa.controls[google.maps.ControlPosition.TOP_LEFT].push(painelDistancia);
            } catch (panelErr) {
                console.warn("Não foi possível processar layout do painel flutuante de distância:", panelErr);
            }
        };

        // --- INTERCEPTADOR BIDIRECIONAL DE CHAMADAS DE API (EVITA TRIPLICAÇÃO DO TRAJETO PRINCIPAL) ---
        if (window.lastGoogleDirectionsResponse && window.lastGoogleDirectionsKey === cacheKeyMain) {
            console.log("[PLUGIN-MAPA] 🚀 Trajeto principal detectado em Cache Global. Renderizando rota sem novas requisições.");
            directionsRenderer.setDirections(window.lastGoogleDirectionsResponse);
            const rotaLeg = window.lastGoogleDirectionsResponse.routes[0].legs[0];
            injetarPainelControleDistancia(rotaLeg.distance.text, rotaLeg.duration.text, "google");
        } else {
            directionsService.route({
                origin: localOrigem,
                destination: localDestino,
                travelMode: modoTransporte === 'pe' ? google.maps.TravelMode.WALKING : google.maps.TravelMode.DRIVING
            }, (response, status) => {
                if (status === 'OK') {
                    directionsRenderer.setDirections(response);
                    
                    // Salva a resposta completa para compartilhamento com as demais extensões da ficha
                    window.lastGoogleDirectionsResponse = response;
                    window.lastGoogleDirectionsKey = cacheKeyMain;

                    try {
                        const rotaLeg = response.routes[0].legs[0];
                        const textoDistancia = rotaLeg.distance.text;
                        const textoDuracao = rotaLeg.duration.text;
                        
                        injetarPainelControleDistancia(textoDistancia, textoDuracao, "google");

                        // Lança os valores calculados de forma temporária no objeto correspondente do array global escolasDB
                        if (window.escolasDB) {
                            const escolaAlvoObj = window.escolasDB.find(e => 
                                Math.abs(Number(e.lat) - destinoLatAlvo) < 0.0001 && 
                                Math.abs(Number(e.lon || e.lng) - destinoLonAlvo) < 0.0001
                            );
                            if (escolaAlvoObj) {
                                escolaAlvoObj.distanciaGoogleText = textoDistancia;
                                escolaAlvoObj.duracaoGoogleText = textoDuracao; // Mantido schoolAlvoObj conforme original
                                escolaAlvoObj.fonteDistancia = "google";
                            }
                        }

                        // Alimenta o cache persistente local para uso do funcs_assistente.js
                        if (window.salvarValorCachePersistente) {
                            const chaveCacheReg = `dist_${origem.lat}_${origem.lon || origem.lng}_to_${destinoLatAlvo}_${destinoLonAlvo}`;
                            window.salvarValorCachePersistente("cache_distancias", chaveCacheReg, {
                                distancia: textoDistancia,
                                duracao: textoDuracao,
                                fonte: "google",
                                timestamp: Date.now()
                            });
                        }
                    } catch (e) {
                        console.warn("Erro ao extrair e salvar metadados da rota principal de contingência:", e);
                    }
                } else {
                    console.error("[PLUGIN] Erro ao traçar rota no mapa JS. Revertendo para Fallback:", status);
                    elementoMapa.remove();
                    iframeAtual.style.display = "block";
                    iframeAtual.src = urlFallbackIframe;
                }
            });
        }

        // --- DETECÇÃO DO NÍVEL DO ALUNO E DADOS DA FICHA EM TEMPO REAL ---
        let nivelNorm = "";
        let isBercarioGeral = false;
        let enderecoCompletoAluno = "Residência do Aluno";
        let nomeEscolaDestino = "Escola de Destino Selecionada";

        const docEscopo = iframeAtual.ownerDocument || document;
        let nivel = extrairNivelAluno(docEscopo);
        
        if(nivel){
            nivelNorm = nivel.nivelNorm;
            isBercarioGeral = nivel.isBercarioGeral;    
        }

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

        if(!nivel){
        const selectNivel = docEscopo.getElementById('nivel');
        if (selectNivel?.options[selectNivel.selectedIndex]) {
            const textoSelecionado = selectNivel.options[selectNivel.selectedIndex].text || selectNivel.value;
            nivelNorm = window.normalizarTexto ? window.normalizarTexto(textoSelecionado) : textoSelecionado.toUpperCase().trim();
            nivelNorm = nivelNorm.replace(/([0-9]+)\s*[Oº\.]\s*ANO/g, '$1O ANO');
            if (nivelNorm.includes('EJA')) nivelNorm = 'EJA';
            if (nivelNorm.includes('ESPECIAL')) nivelNorm = 'ESPECIAL';
            isBercarioGeral = nivelNorm.includes('BERCARIO');
        }
    }

        console.log(`[FILTRO-MAPA] 🔎 Nível do Aluno Identificado para Filtragem: "${nivelNorm}" | É Berçário Geral: ${isBercarioGeral} | nivel extraido: ${nivel.nivelNorm}`);

        // --- RENDERIZAÇÃO DOS MARCADORES CUSTOMIZADOS HTML/CSS ---

        // 1. PIN DA ORIGEM (Casa do Aluno)
        const divCasa = document.createElement("div");
        divCasa.innerHTML = "🏠";
        divCasa.style.cssText = "font-size: 26px; background: transparent; border: none; box-shadow: none; padding: 0; margin: 0; display: flex; align-items: center; justify-content: center; cursor: pointer;";
        
        new AdvancedMarkerElement({
            position: localOrigem,
            map: mapa,
            title: enderecoCompletoAluno,
            content: divCasa
        });

        // 2. PIN DO DESTINO COM EXPANSÃO ADAPTÁVEL (Escola Alvo)
        const divEscolaDestino = document.createElement("div");
        divEscolaDestino.style.cssText = "font-family: Verdana, sans-serif; font-size: 26px; font-weight: normal; background: transparent; color: inherit; padding: 0; box-sizing: border-box; border-radius: 12px; box-shadow: none; width: auto; min-width: 32px; height: 32px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid transparent; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; white-space: nowrap; overflow: hidden; z-index: 12;";        
        
        const spanTextoDestino = document.createElement("span");
        spanTextoDestino.innerText = "🏫";
        divEscolaDestino.appendChild(spanTextoDestino);

        const spanDistanciaDestinoHover = document.createElement("span");
        spanDistanciaDestinoHover.style.cssText = "font-size: 9px; font-weight: normal; color: #e0e0e0; margin-top: 2px; display: none;";
        divEscolaDestino.appendChild(spanDistanciaDestinoHover);

        divEscolaDestino.addEventListener("mouseenter", () => {
            divEscolaDestino.style.fontSize = "11px";
            divEscolaDestino.style.fontWeight = "bold";
            divEscolaDestino.style.background = "#0d47a1";
            divEscolaDestino.style.color = "white";
            divEscolaDestino.style.border = "1px solid white";
            divEscolaDestino.style.borderRadius = "4px";
            divEscolaDestino.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
            divEscolaDestino.style.padding = "6px 10px";
            divEscolaDestino.style.width = "auto";
            divEscolaDestino.style.height = "auto";
            divEscolaDestino.style.minHeight = "32px";
            divEscolaDestino.style.overflow = "visible";
            spanTextoDestino.innerText = "🏫 " + nomeEscolaDestino;
            
            if (textoDistanciaCompartilhada) {
                spanDistanciaDestinoHover.innerText = verificarPrependDistancia(textoDistanciaCompartilhada, fonteDistanciaCompartilhada);
                spanDistanciaDestinoHover.style.display = "block";
            }
        });

        divEscolaDestino.addEventListener("mouseleave", () => {
            divEscolaDestino.style.fontSize = "26px";
            divEscolaDestino.style.fontWeight = "normal";
            divEscolaDestino.style.background = "transparent";
            divEscolaDestino.style.color = "inherit";
            divEscolaDestino.style.border = "1px solid transparent";
            divEscolaDestino.style.borderRadius = "12px";
            divEscolaDestino.style.boxShadow = "none";
            divEscolaDestino.style.padding = "0";
            divEscolaDestino.style.width = "auto";
            divEscolaDestino.style.height = "32px";
            divEscolaDestino.style.overflow = "hidden";
            spanTextoDestino.innerText = "🏫";
            spanDistanciaDestinoHover.style.display = "none";
        });

        new AdvancedMarkerElement({
            position: localDestino,
            map: mapa,
            title: nomeEscolaDestino,
            content: divEscolaDestino
        });

        // 3. WAYPOINTS (Outras escolas filtradas e sem duplicidade com o local de destino)
        const arrayEscolas = window.escolasDB;
        if (Array.isArray(arrayEscolas)) {
            console.log(`[FILTRO-MAPA] Total de escolas encontradas no banco DB: ${arrayEscolas.length}`);
            let escolasPlotadas = 0;

            arrayEscolas.forEach(escola => {
                if (!escola.lat || (!escola.lon && !escola.lng) || !escola.turmas) return;

                const escolaLat = Number(escola.lat);
                const escolaLon = Number(escola.lon || escola.lng);

                // CRITÉRIO EXCLUSOR REFORÇADO: Desconsidera se contiver as mesmas coordenadas exatas do destino do trajeto
                if (Math.abs(escolaLat - destinoLatAlvo) < 0.0001 && Math.abs(escolaLon - destinoLonAlvo) < 0.0001) return;

                // Identifica as turmas aptas e extrai os períodos para definir a regra de cores das Badges
                const turmasNivel = escola.turmas.filter(turma => {
                    if (!window.normalizarTexto) return true;
                    const nivelTurmaNorm = window.normalizarTexto(turma.nivel);
                    if (isBercarioGeral) return nivelTurmaNorm.includes('BERCARIO');
                    if (nivelNorm === 'ESPECIAL' && nivelTurmaNorm.includes('ESPECIAL')) return true;
                    if (nivelNorm === 'EJA' && nivelTurmaNorm.includes('EJA')) return true;
                    return nivelTurmaNorm === nivelNorm;
                });

                if (turmasNivel.length === 0) return;
                escolasPlotadas++;

                // Consolida os períodos encontrados para esta unidade
                const periodosEncontradosStr = [...new Set(turmasNivel.map(t => t.periodo))].join(' / ');

                // Define o esquema de cores padrão com base nas classes de badge do assistente
                let corFundoPadrao = "#e8e5fc"; // Padrão / Integral
                let corTextoPadrao = "#6658d3";
                let corFundoHover = "#5243c2";   // Tom levemente mais escuro para o hover

                if (periodosEncontradosStr.includes('INTEGRAL')) {
                    corFundoPadrao = "#e8e5fc";
                    corTextoPadrao = "#6658d3";
                    corFundoHover = "#5243c2";
                } else if (periodosEncontradosStr.includes('PARCIAL')) {
                    corFundoPadrao = "#bdf7b6";
                    corTextoPadrao = "#1c660d";
                    corFundoHover = "#144d09";
                } else { // Noite / Noturno
                    corFundoPadrao = "#115185";
                    corTextoPadrao = "#ffffff";
                    corFundoHover = "#0b395e";
                }

                // Limpa o nome ignorando tudo após a vírgula
                const nomeBase = (escola.nome || "UE").split(',')[0].trim();

                // Extrai abreviação inteligente tratando possíveis valores nulos ou indefinidos da propriedade
                let iniciais = escola.nome_un_sigla;
                if (!iniciais || typeof iniciais !== "string" || iniciais.trim() === "" || iniciais === "undefined") {
                    iniciais = nomeBase.length <= 6 ? nomeBase : nomeBase.replace(/EMEB|CRECHE/gi, "").trim().substring(0, 2).toUpperCase();
                }

                // --- INTEGRALIZAÇÃO DA DISTÂNCIA GOOGLE BIDIRECIONAL (PROPRIEDADES + CACHE) ---
                let labelDistanciaCalculada = "";
                const cacheChaveWay = `dist_${origem.lat}_${origem.lon || origem.lng}_to_${escolaLat}_${escolaLon}`;

                // Confere se o valor foi setado na propriedade pelo assistente ou existe em cache persistente real do Google
                let dadosDistWay = escola.distanciaGoogleText || escola.distanciaReal;
                let fonteDistWay = escola.distanciaGoogleText ? "google" : (escola.fonteDistancia || "");
                if (!dadosDistWay && window.obterValorCachePersistente) {
                    const cacheLido = window.obterValorCachePersistente("cache_distancias", cacheChaveWay);
                    if (cacheLido) {
                        dadosDistWay = cacheLido.distancia;
                        fonteDistWay = cacheLido.fonte || "";
                    }
                }

                if (dadosDistWay) {
                    labelDistanciaCalculada = `<br/><strong>Distância real:</strong> ${verificarPrependDistancia(dadosDistWay, fonteDistWay)}`;
                }

                // Armazenará dinamicamente o perfil de transporte retornado para a URL externa
                let perfilTransporteEfetivo = modoTransporte === 'pe' ? 'walking' : 'driving';

                // Função auxiliar em tempo de execução para recuperar e formatar dinamicamente a distância estruturada
                const obterTextoDistancia = async () => {
                    if (escola.distanciaGoogleText) return verificarPrependDistancia(escola.distanciaGoogleText, "google"); 
                    if (escola.distanciaReal) return verificarPrependDistancia(escola.distanciaReal, escola.fonteDistancia);
                    
                    if (window.obterValorCachePersistente) {
                        const cacheLido = window.obterValorCachePersistente("cache_distancias", cacheChaveWay);
                        if (cacheLido && cacheLido.distancia) return verificarPrependDistancia(cacheLido.distancia, cacheLido.fonte);
                    }

                    // Se não estiver em cache rápido, aciona seu interceptor/calculador central OSRM/Google/Haversine
                    if (window.calcularTrajeto) {
                        try {
                            const profileOSRM = modoTransporte === 'pe' ? 'foot' : 'car';
                            // Ajustado para receber a desestruturação do novo formato de retorno do OSRM
                            const resultado = await window.calcularTrajeto(origem.lat, origem.lon || origem.lng, escolaLat, escolaLon, profileOSRM);
                            if (resultado && resultado.distancia !== undefined) {
                                // Atualiza o perfil efetivo com base no parâmetro retornado da nova função OSRM se disponível
                                if (resultado.parametro) {
                                    perfilTransporteEfetivo = resultado.parametro === 'carro' ? 'driving' : 'walking';
                                }
                                const metros = resultado.distancia;
                                let texto = metros >= 5000 ? `${(metros / 1000).toFixed(1).replace('.', ',')} km` : `${metros} m`;
                                
                                // Verifica a propriedade .fonte do retorno do OSRM
                                const fonteOSRM = resultado.fonte || "osrm";
                                return verificarPrependDistancia(texto, fonteOSRM);
                            }
                        } catch (err) {
                            console.warn("Falha ao calcular distância dinâmica para o hover do waypoint:", err);
                        }
                    }
                    return "";
                };

                // Criação dinâmica da URL de Trajeto Externo partindo da Origem até o Waypoint
                const pOrigem = encodeURIComponent(`${origem.lat},${origem.lon || origem.lng}`);
                const pDestino = encodeURIComponent(`${escolaLat},${escolaLon}`);

                // Injeta de forma fixa o período também no evento Click (Mantendo fundo branco e fonte preta)
                const infoWindow = new google.maps.InfoWindow({
                    content: `<div style="font-family:Verdana,sans-serif;font-size:11px;color:#333;line-height:1.4;">
                                <strong>${escola.nome || 'Unidade Escolar'}</strong><br/>
                                ${escola.rua || ''}, ${escola.numero || ''}<br/>
                                <span>Bairro: ${escola.bairro || ''}</span><br/>
                                <strong>Período:</strong> ${periodosEncontradosStr}${labelDistanciaCalculada}<br/>
                                <a href="http://maps.google.com/maps?saddr=${pOrigem}&daddr=${pDestino}&dirflg=${perfilTransporteEfetivo === 'walking' ? 'w' : 'd'}" target="_blank" style="color:#1a73e8;text-decoration:none;font-weight:bold;display:inline-block;margin-top:5px;">🗺️ Abrir rota no Google Maps</a>
                              </div>`
                });

                // Componente HTML/CSS estruturado aplicando dinamicamente as cores de cada período mapped
                const divWaypoint = document.createElement("div");
                divWaypoint.style.cssText = `font-family: Verdana, sans-serif; font-size: 10px; font-weight: bold; background: ${corFundoPadrao}; color: ${corTextoPadrao}; padding: 0 6px; box-sizing: border-box; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.3); width: auto; min-width: 24px; height: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid white; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; white-space: nowrap; overflow: hidden; z-index: 10;`;
                
                // Elemento interno para controlar a troca de texto sem quebras de layout
                const spanTexto = document.createElement("span");
                spanTexto.innerText = iniciais;
                divWaypoint.appendChild(spanTexto);

                // Sub-span dedicado exclusivamente para exibir a distância renderizada abaixo do nome base
                const spanDistanciaHover = document.createElement("span");
                spanDistanciaHover.style.cssText = "font-size: 9px; font-weight: normal; color: #e0e0e0; margin-top: 2px; display: none;";
                divWaypoint.appendChild(spanDistanciaHover);

                // Novo Sub-span estruturado para exibir o período do nível do aluno no Hover
                const spanPeriodoHover = document.createElement("span");
                spanPeriodoHover.style.cssText = "font-size: 9px; font-weight: normal; color: #ffffff; margin-top: 1px; display: none;";
                spanPeriodoHover.innerText = `Período: ${periodosEncontradosStr}`;
                divWaypoint.appendChild(spanPeriodoHover);
                
                // Eventos dinâmicos avançados de expansão adaptáveis ao tamanho do texto e exibição da distância e período
                divWaypoint.addEventListener("mouseenter", async () => {
                    divWaypoint.style.borderRadius = "4px";
                    divWaypoint.style.width = "auto";
                    divWaypoint.style.maxWidth = "none";
                    divWaypoint.style.height = "auto";
                    divWaypoint.style.minHeight = "24px";
                    divWaypoint.style.padding = "6px 10px";
                    divWaypoint.style.background = corFundoHover;
                    divWaypoint.style.color = "#ffffff";
                    divWaypoint.style.overflow = "visible";
                    
                    spanTexto.innerText = nomeBase;
                    spanPeriodoHover.style.display = "block";

                    // Busca reativa assíncrona da distância real
                    const textoDist = await obterTextoDistancia();
                    if (textoDist) {
                        spanDistanciaHover.innerText = textoDist;
                        spanDistanciaHover.style.display = "block";

                        // Sincroniza dinamicamente a string do InfoWindow com o perfil de transporte correto
                        labelDistanciaCalculada = `<br/><strong>Distância real:</strong> ${textoDist}`;
                        infoWindow.setContent(`<div style="font-family:Verdana,sans-serif;font-size:11px;color:#333;line-height:1.4;">
                                                    <strong>${escola.nome || 'Unidade Escolar'}</strong><br/>
                                                    ${escola.rua || ''}, ${escola.numero || ''}<br/>
                                                    <span>Bairro: ${escola.bairro || ''}</span><br/>
                                                    <strong>Período:</strong> ${periodosEncontradosStr}${labelDistanciaCalculada}<br/>
                                                    <a href="http://maps.google.com/maps?saddr=${pOrigem}&daddr=${pDestino}&dirflg=${perfilTransporteEfetivo === 'walking' ? 'w' : 'd'}" target="_blank" style="color:#1a73e8;text-decoration:none;font-weight:bold;display:inline-block;margin-top:5px;">🗺️ Abrir rota no Google Maps</a>
                                                  </div>`);
                    }
                });

                divWaypoint.addEventListener("mouseleave", () => {
                    divWaypoint.style.borderRadius = "12px";
                    divWaypoint.style.width = "auto";
                    divWaypoint.style.maxWidth = "none";
                    divWaypoint.style.height = "24px";
                    divWaypoint.style.padding = "0 6px";
                    divWaypoint.style.background = corFundoPadrao;
                    divWaypoint.style.color = corTextoPadrao;
                    divWaypoint.style.overflow = "hidden";
                    
                    spanTexto.innerText = iniciais;
                    spanDistanciaHover.style.display = "none";
                    spanPeriodoHover.style.display = "none";
                });

                const marker = new AdvancedMarkerElement({
                    position: new google.maps.LatLng(escolaLat, escolaLon),
                    map: mapa,
                    title: nomeBase,
                    content: divWaypoint
                });

                marker.addListener('gmp-click', () => {
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

/**
 * Verifica se dois endereços estão aproximadamente na mesma direção
 * em relação a uma escola de referência.
 *
 * Retorna:
 * {
 *   mesmaDirecao: boolean,
 *   diferencaAngular: number,
 *   bearingFicha: number,
 *   bearingEnc: number
 * }
 */
function analisarDirecaoRelativa(
    escolaLat,
    escolaLon,
    latFicha,
    lonFicha,
    latEnc,
    lonEnc,
    toleranciaGraus = 45
) {
    const valores = [
        escolaLat,
        escolaLon,
        latFicha,
        lonFicha,
        latEnc,
        lonEnc
    ];

    if (valores.some(v => !Number.isFinite(v))) {
        return {
            mesmaDirecao: false,
            diferencaAngular: 999,
            bearingFicha: null,
            bearingEnc: null
        };
    }

    const calcularBearing = (lat1, lon1, lat2, lon2) => {
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;

        const λ1 = lon1 * Math.PI / 180;
        const λ2 = lon2 * Math.PI / 180;

        const y =
            Math.sin(λ2 - λ1) * Math.cos(φ2);

        const x =
            Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) *
            Math.cos(λ2 - λ1);

        let brng =
            Math.atan2(y, x) * 180 / Math.PI;

        return (brng + 360) % 360;
    };

    const bearingFicha =
        calcularBearing(
            escolaLat,
            escolaLon,
            latFicha,
            lonFicha
        );

    const bearingEnc =
        calcularBearing(
            escolaLat,
            escolaLon,
            latEnc,
            lonEnc
        );

    let diferencaAngular =
        Math.abs(bearingFicha - bearingEnc);

    if (diferencaAngular > 180) {
        diferencaAngular =
            360 - diferencaAngular;
    }

    return {
        mesmaDirecao:
            diferencaAngular <= toleranciaGraus,
        diferencaAngular,
        bearingFicha,
        bearingEnc
    };
}

window.estaDentroDaCidade = function(lat, lon) {
    // Coordenadas calculadas a partir dos limites que você passou
    const LAT_MIN = -23.9774;
    const LAT_MAX = -23.6436;
    const LON_MIN = -46.6423;
    const LON_MAX = -46.4298;
    
    const l = Number(lat);
    const n = Number(lon);
    
    if (!Number.isFinite(l) || !Number.isFinite(n)) return false;
    
    return (l >= LAT_MIN && l <= LAT_MAX && n >= LON_MIN && n <= LON_MAX);
};