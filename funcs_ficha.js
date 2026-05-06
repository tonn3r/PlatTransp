window.calcularDistanciaHaversine = function(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round((R * c) * 1000); 
};

window.normalizarTexto = function(texto) {
    if (!texto) return "";
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/º|ª/g, "O").trim();
};

window.iniciarPaginaFicha = function() {
    if (typeof window.realizarCalculosIniciaisDistancia === 'function') {
        window.realizarCalculosIniciaisDistancia();
    }

    const storageHelper = {
        save: function(key, data, callback) {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                let obj = {}; obj[key] = data;
                chrome.storage.local.set(obj, callback);
            } else {
                localStorage.setItem(key, JSON.stringify(data));
                if (callback) callback();
            }
        },
        get: function(key, callback) {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get([key], (result) => callback(result[key]));
            } else {
                const item = localStorage.getItem(key);
                callback(item ? JSON.parse(item) : null);
            }
        }
    };

    const form = document.querySelector('form[name="form1"]');
    if (!form) return;

    storageHelper.get('dados_analise_assistente', (dados) => {
        if (!dados) return;

        if(dados.distanciamedia || dados.distancia) {
            const valDist = dados.distanciamedia || dados.distancia;
            const inputDist = form.querySelector('input[name="distancia_aferida"]');
            if(inputDist) inputDist.value = valDist.replace(/[^0-9]/g, ''); 
        }

        const textarea = form.querySelector('textarea[name="status_detalhes"]');
        if(textarea) {
            let textoArr = [];
            if(dados.analise || dados.obs) {
                textoArr.push(`Análise Base: ${dados.analise || ''} | ${dados.obs || ''}`);
            }
            
            const dbLocal = window.escolasDB || [];
            if(dados.lat && dados.lon && dbLocal.length > 0) {
                textoArr.push(`\n--- ESCOLAS MAIS PRÓXIMAS (Em linha reta) ---`);
                const escolasCalculadas = dbLocal.map(esc => {
                    return {
                        nome: esc.nome,
                        distancia: window.calcularDistanciaHaversine(dados.lat, dados.lon, esc.lat, esc.lon)
                    };
                }).sort((a, b) => a.distancia - b.distancia);
                
                const top3 = escolasCalculadas.slice(0, 3);
                top3.forEach((esc, index) => {
                    textoArr.push(`${index + 1}º ${esc.nome}`);
                });
            }

            textarea.value = textoArr.join('\n');
            try { textarea.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
        }
    });
};

window.realizarCalculosIniciaisDistancia = async function() {
    const docAlvo = document;
    const endRua = docAlvo.getElementById('endereco') ? (docAlvo.getElementById('endereco').value || docAlvo.getElementById('endereco').innerText) : '';
    const endNum = docAlvo.getElementById('endereco_numero_residencia') ? (docAlvo.getElementById('endereco_numero_residencia').value || docAlvo.getElementById('endereco_numero_residencia').innerText) : '';
    const endBairro = docAlvo.getElementById('endereco_bairro') ? (docAlvo.getElementById('endereco_bairro').value || docAlvo.getElementById('endereco_bairro').innerText) : '';
    const enderecoCompleto = [endRua, endNum, endBairro].filter(Boolean).join(" ");

    let idSolInput = docAlvo.querySelector('input[name="id_solicitacao"]') || docAlvo.querySelector('input[name="id"]');
    let idFicha = idSolInput ? idSolInput.value : '';
    let urlOrigem = window.location.href;
    let basePath = urlOrigem.substring(0, urlOrigem.lastIndexOf('/') + 1);
    let urlFichaNova = basePath + 'ficha_transporte_nova_versao.php?id_solicitacao=' + idFicha;

    let dadosGeo = await window.extrairDadosGeograficos(urlFichaNova);
    if (!dadosGeo || !dadosGeo.geoEscola_Latit) return;

    let coordEndereco = await window.obterCoordenadasPorEndereco(enderecoCompleto);
    
    let distCoordFoot = await window.calcularTrajetoOSRM(dadosGeo.geoEndereco_Latit, dadosGeo.geoEndereco_Longit, dadosGeo.geoEscola_Latit, dadosGeo.geoEscola_Longit, 'foot');
    let distEndFoot = null;
    
    if (coordEndereco && coordEndereco.lat) {
        distEndFoot = await window.calcularTrajetoOSRM(coordEndereco.lat, coordEndereco.lon, dadosGeo.geoEscola_Latit, dadosGeo.geoEscola_Longit, 'foot');
    } else {
        distEndFoot = distCoordFoot; 
        coordEndereco = { lat: dadosGeo.geoEndereco_Latit, lon: dadosGeo.geoEndereco_Longit };
    }

    const arredonda100 = (val) => Math.round((val || 0) / 100) * 100;
    let dif = Math.abs(arredonda100(distCoordFoot) - arredonda100(distEndFoot));
    let distDiferentes = (dif > 200);

    // Salva na memória do Iframe e da Janela Pai simultaneamente
    window.DistDiferentesEntreMapas = distDiferentes;
    try { window.top.DistDiferentesEntreMapas = distDiferentes; } catch(e){}

    let usarCarro = false;
    let distCoordFinal = distCoordFoot;
    let distEndFinal = distEndFoot;
    let perfilFinal = 'foot';

    if (distCoordFoot > 10000 || distEndFoot > 10000) {
        let distCoordCar = distCoordFoot > 10000 ? await window.calcularTrajetoOSRM(dadosGeo.geoEndereco_Latit, dadosGeo.geoEndereco_Longit, dadosGeo.geoEscola_Latit, dadosGeo.geoEscola_Longit, 'driving') : distCoordFoot;
        let distEndCar = distEndFoot > 10000 ? await window.calcularTrajetoOSRM(coordEndereco.lat, coordEndereco.lon, dadosGeo.geoEscola_Latit, dadosGeo.geoEscola_Longit, 'driving') : distEndFoot;
        
        if ((distCoordFoot > 10000 && distCoordCar < 5000) || (distEndFoot > 10000 && distEndCar < 5000)) {
            usarCarro = true;
            distCoordFinal = distCoordCar;
            distEndFinal = distEndCar;
            perfilFinal = 'driving';
        }
    }

    let objRota = {
        coordAlunoGPS: { lat: dadosGeo.geoEndereco_Latit, lon: dadosGeo.geoEndereco_Longit },
        coordAlunoEnd: coordEndereco,
        distanciaCoord: distCoordFinal,
        distanciaEnd: distEndFinal,
        perfilOSRM: perfilFinal
    };

    // Salva na memória do Iframe e da Janela Pai simultaneamente
    window.dadosGeraisRota = objRota;
    try { window.top.dadosGeraisRota = objRota; } catch(e){}

    if (usarCarro) {
        window.modoTransporteAtual = 'carro';
        try { window.top.modoTransporteAtual = 'carro'; } catch(e){}
        
        const toggleContainer = document.getElementById('mapa-toggle-container');
        if (toggleContainer && toggleContainer.children[1]) {
            toggleContainer.children[1].innerHTML = "🚗 De Carro";
        }
        if (typeof window.atualizarURLsMapasGlobal === 'function') window.atualizarURLsMapasGlobal();
        else if (window.top && typeof window.top.atualizarURLsMapasGlobal === 'function') window.top.atualizarURLsMapasGlobal();
    }

    console.log("=== LOG DE VARIÁVEIS DE CÁLCULO (funcs_ficha) ===");
    console.log("Endereço Buscado:", enderecoCompleto);
    console.log("Distância Coord (A pé):", distCoordFoot);
    console.log("Distância Endereço (A pé):", distEndFoot);
    console.log("Diferença Arredondada (>200):", dif);
    console.log("DistDiferentesEntreMapas:", window.DistDiferentesEntreMapas);
    console.log("Perfil Final OSRM:", perfilFinal);
    console.log("Distância Coord Final:", distCoordFinal);
    console.log("Distância Endereço Final:", distEndFinal);
    console.log("Modo Transporte Padrão:", window.modoTransporteAtual || 'pe');
    console.log("=================================================");
};

document.addEventListener('DOMContentLoaded', window.iniciarPaginaFicha);