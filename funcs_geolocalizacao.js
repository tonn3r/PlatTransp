window.mapaSincronizado = false;

window.copiarCoordenadasEndereco = function() {
    let rota = window.dadosGeraisRota || (window.top && window.top.dadosGeraisRota);
    if (rota && rota.coordAlunoEnd && rota.coordAlunoEnd.lat) {
        let txt = `${rota.coordAlunoEnd.lat} ${rota.coordAlunoEnd.lon}`;
        navigator.clipboard.writeText(txt).catch(e => console.error("Erro copy", e));
    }
};

window.extrairDadosGeograficos = async function(urlFichaNova) {
    const tInicioGeo = performance.now();
    try {
        const resposta = await fetch(urlFichaNova);
        const htmlText = await resposta.text();
        
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
                    return { lat: parseFloat(partes[0].trim()), lon: parseFloat(partes[1].trim()) };
                }
                return { lat: null, lon: null };
            };

            const coordOrigin = separarCoordenadas(matchOrigin);
            const coordDest = separarCoordenadas(matchDest);

            const dados = {
                urlMaps: urlCompleta,
                geoEndereco_Latit: coordOrigin.lat,
                geoEndereco_Longit: coordOrigin.lon,
                geoEscola_Latit: coordDest.lat,
                geoEscola_Longit: coordDest.lon
            };

            const tFimGeo = performance.now();
            console.log(`⏱️ [Geo] Dados extraídos em ${(tFimGeo - tInicioGeo).toFixed(2)}ms`);
            return dados;
        }
        return null;
    } catch (erro) {
        console.error("❌ Erro ao extrair dados geográficos:", erro);
        return null;
    }
};

window.copiarCoordenadasEndereco = function() {
    let rota = window.dadosGeraisRota || (window.top && window.top.dadosGeraisRota);
    if (rota && rota.coordAlunoEnd) {
        if (typeof rota.coordAlunoEnd === 'string') {
            navigator.clipboard.writeText(rota.coordAlunoEnd).catch(e => console.error("Erro copy", e));
        } else if (rota.coordAlunoEnd.lat) {
            let txt = `${rota.coordAlunoEnd.lat} ${rota.coordAlunoEnd.lon}`;
            navigator.clipboard.writeText(txt).catch(e => console.error("Erro copy", e));
        }
    }
};

window.sincronizarMapaECoordenadas = async function(docAlvo) {
    if (window.mapaSincronizado) return; 
    window.mapaSincronizado = true;

    let urlOrigem = docAlvo.location ? docAlvo.location.href : window.location.href;
    
    let idSolInput = docAlvo.querySelector('input[name="id_solicitacao"]') || docAlvo.querySelector('input[name="id"]');
    let idFicha = idSolInput ? idSolInput.value : '';

    let basePath = urlOrigem.substring(0, urlOrigem.lastIndexOf('/') + 1);
    // Verifica se a baseUrl já termina ou contém o caminho do módulo
    const moduloPath = "modulos/transporte_escolar/";
    const prefixo = basePath.includes(moduloPath) ? "" : moduloPath;
    let urlFichaNova = basePath + prefixo + 'ficha_transporte_nova_versao.php?id_solicitacao=' + idFicha;

    const dadosGeo = await window.extrairDadosGeograficos(urlFichaNova);

    if (dadosGeo) {
        const iframeAtual = docAlvo.getElementById('map_endereco');
        const linkMapaNovaGuia = docAlvo.getElementById('botao_mapa');
        
        const btnAbrirFicha = docAlvo.getElementById('botaoAbrirFicha');
        if (btnAbrirFicha && !btnAbrirFicha.dataset.copyBound) {
            btnAbrirFicha.dataset.copyBound = 'true';
            btnAbrirFicha.addEventListener('click', window.copiarCoordenadasEndereco);
        }

        if (iframeAtual && !urlOrigem.includes('nova_versao')) {
            if (!window.urlEnderecoGlobal) {
                window.urlEnderecoGlobal = iframeAtual.src;
                window.urlBotaoEnderecoGlobal = linkMapaNovaGuia ? linkMapaNovaGuia.href : iframeAtual.src;
            }
            
            const statusTexto = (docAlvo.getElementById('status_atendimento')?.innerText || "").toUpperCase();
            const ehMudanca = statusTexto.includes("MUDANCA") || statusTexto.includes("MUDANÇA");

            window.modoMapaAtual = ehMudanca ? 'endereco' : 'coordenada';
            window.modoTransporteAtual = 'pe';

            const atualizarURLsMapas = () => {
                console.log("🗺️ atualizarURLsMapas() iniciada");
                let sufixoTransporteBotao = window.modoTransporteAtual === 'pe' ? "&travelmode=walking&dirflg=w" : "";
                let sufixoTransporteFrame = window.modoTransporteAtual === 'pe' ? "&mode=walking" : "";
                
                if (window.modoMapaAtual === 'coordenada') {
                    const urlIframe = `https://www.google.com/maps/embed/v1/directions?key=AIzaSyDFlvpNvHgc6N2gMYTPJq5HptaFXS-S2i8&origin=${dadosGeo.geoEndereco_Latit}+${dadosGeo.geoEndereco_Longit}&destination=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteFrame}`; //nao alterar
                    const urlLink = `https://maps.google.com/maps?saddr=${dadosGeo.geoEndereco_Latit}+${dadosGeo.geoEndereco_Longit}&daddr=${dadosGeo.geoEscola_Latit}+${dadosGeo.geoEscola_Longit}${sufixoTransporteBotao}`; //nao alterar
                    
                    iframeAtual.src = urlIframe;
                    if (linkMapaNovaGuia) linkMapaNovaGuia.href = urlLink;
                } else {
                    let rota = window.dadosGeraisRota || (window.top && window.top.dadosGeraisRota);
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
                    
                    let isPrimeiraVez = !window.primeiraExecucaoMapasFinalizada;
                    window.primeiraExecucaoMapasFinalizada = true;
                    
                    if (!isPrimeiraVez) {
                        iframeAtual.src = urlIframeEnd;
                    }
                    if (linkMapaNovaGuia) linkMapaNovaGuia.href = urlLinkEnd;
                }

                if (typeof window.atualizarListaEscolasDinamicamente === 'function') {
                    console.log("✅ atualizarListaEscolasDinamicamente encontrada em window");
                    console.log("📞 Chamando atualizarListaEscolasDinamicamente via window após mudança de mapa");
                    window.atualizarListaEscolasDinamicamente();
                } else if (window.top && typeof window.top.atualizarListaEscolasDinamicamente === 'function') {
                    console.log("✅ atualizarListaEscolasDinamicamente encontrada em window.top");
                    console.log("📞 Chamando atualizarListaEscolasDinamicamente via window.top após mudança de mapa");
                    window.top.atualizarListaEscolasDinamicamente();
                } else {
                    console.log("❌ Função atualizarListaEscolasDinamicamente não encontrada em window ou window.top");
                }
            };

            atualizarURLsMapas();
            window.atualizarURLsMapasGlobal = atualizarURLsMapas;

            if (!docAlvo.getElementById('mapa-toggle-container')) {
                const toggleContainer = docAlvo.createElement('div');
                toggleContainer.id = 'mapa-toggle-container';
                toggleContainer.style.cssText = "display: flex; justify-content: flex-end; gap: 8px; margin-top: 5px; font-size: 11px;";

                const btnModoMapa = docAlvo.createElement('button');
                btnModoMapa.innerHTML = ehMudanca ? "📍 Por Endereço" : "📍 Por Coordenadas";
                btnModoMapa.style.cssText = "padding: 3px 8px; cursor: pointer; border: 1px solid #ccc; background-color: #f9f9f9; color: #555; border-radius: 3px;";
                
                const btnModoTransp = docAlvo.createElement('button');
                btnModoTransp.innerHTML = "🚶 A pé";
                btnModoTransp.style.cssText = "padding: 3px 8px; cursor: pointer; border: 1px solid #ccc; background-color: #f9f9f9; color: #555; border-radius: 3px;";

                btnModoMapa.onclick = (e) => {
                    e.preventDefault();
                    console.log("🖱️ Botão 'Por Coordenadas/Endereço' clicado");
                    console.log("⚠️ DistDiferentesEntreMapas =", window.DistDiferentesEntreMapas);
                    window.modoMapaAtual = window.modoMapaAtual === 'endereco' ? 'coordenada' : 'endereco';
                    console.log("🔄 Novo modoMapaAtual:", window.modoMapaAtual);
                    btnModoMapa.innerHTML = window.modoMapaAtual === 'endereco' ? "📍 Por Endereço" : "📍 Por Coordenadas";
                    atualizarURLsMapas();
                };

                btnModoTransp.onclick = (e) => {
                    e.preventDefault();
                    window.modoTransporteAtual = window.modoTransporteAtual === 'pe' ? 'carro' : 'pe';
                    btnModoTransp.innerHTML = window.modoTransporteAtual === 'pe' ? "🚶 A pé" : "🚗 De Carro";
                    atualizarURLsMapas();
                };

                toggleContainer.appendChild(btnModoMapa);
                toggleContainer.appendChild(btnModoTransp);
                iframeAtual.parentNode.insertBefore(toggleContainer, iframeAtual.nextSibling);
            }
        }

        if (linkMapaNovaGuia) {
            linkMapaNovaGuia.target = "_blank";
        }

        window.dadosGeograficos = dadosGeo; 
    } else {
        window.dadosGeograficos = { erro: true };
    }
};

window.calcularTrajetoOSRM = async function(latOrigin, lonOrigin, latDest, lonDest, profile = 'foot', signal = null) {
    if (!latOrigin || !lonOrigin || !latDest || !lonDest) return null;
    try {
        const url = `https://router.project-osrm.org/route/v1/${profile}/${lonOrigin},${latOrigin};${lonDest},${latDest}?overview=false`;
        const fetchOptions = signal ? { signal } : {};
        const response = await fetch(url, fetchOptions);
        
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            return Math.round(data.routes[0].distance); 
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error(`❌ Erro ao calcular trajeto via OSRM (${profile}):`, e);
        }
    }
    return null;
};

window.obterCoordenadasPorEndereco = async function(enderecoCompleto) {
    if (!enderecoCompleto) return null;
    
    // Função auxiliar para substituir abreviações de tipos de vias
    function substituirAbreviacoes(endereco) {
        const substituicoes = {
            'AV ': 'AVENIDA ',
            'EST ': 'ESTRADA ',
            'R ': 'RUA ',
            'AL ': 'ALAMEDA ',
            'PC ': 'PRAÇA ',
            'VIE ': 'VIELA ',
            'VL ': 'VIELA ', // Cuidado: pode ser Via também, mas priorizando Viela
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
            'VL ': 'VIELA ',
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
        
        let enderecoCorrigido = endereco.toUpperCase();
        for (const [abreviacao, completo] of Object.entries(substituicoes)) {
            enderecoCorrigido = enderecoCorrigido.replace(new RegExp(`\\b${abreviacao}`, 'g'), completo);
        }
        return enderecoCorrigido;
    }
    
    try {
        let enderecoBusca = substituirAbreviacoes(enderecoCompleto);
        if (enderecoBusca && !enderecoBusca.toUpperCase().includes("BERNARDO")) {
            enderecoBusca += ", São Bernardo do Campo - SP";
        }
        
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoBusca)}&limit=1`;
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
    } catch(e) {
        console.error("❌ Erro ao buscar coordenadas do endereço no Nominatim:", e);
    }
    return null;
};