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

window.aplicarLinkPesquisaEndereco = function() {
    const docAlvo = document;
    let elEndereco = null;
    let textoOriginal = "";

    const legends = Array.from(docAlvo.querySelectorAll('legend'));
    const legendEnderecos = legends.find(el => el.innerText.trim() === 'Endereço');
    if (legendEnderecos) {
        const container = legendEnderecos.closest('.set_inner');
        if (container) {
            elEndereco = container.querySelector('span.texto_dados b u');
            if (elEndereco) textoOriginal = elEndereco.innerText;
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
    const prefixos = /^(RUA|R\.|AVENIDA|AV\.|AV|TRAVESSA|TRV\.|VIELA|PRA[ÇC]A|ESTRADA|ALAMEDA|RODOVIA|LADEIRA|BECO|MARGINAL)\s+/i;
    ruaLimpa = ruaLimpa.replace(prefixos, '').trim(); 
    const particulas = /\b(DO|DA|DOS|DAS)\b/gi;
    ruaLimpa = ruaLimpa.replace(particulas, '').replace(/\s+/g, ' ').trim();

    const baseUrl = window.location.href.split('ficha_transporte')[0];

    // Verifica se a baseUrl já termina ou contém o caminho do módulo
    const moduloPath = "modulos/transporte_escolar/";
    const prefixo = baseUrl.includes(moduloPath) ? "" : moduloPath;

    const urlPesquisa = `${baseUrl}${prefixo}solicitacoes_transporte_realizadas.php?endereco=${encodeURIComponent(ruaLimpa)}`;

    if (elEndereco.tagName === 'U') {
        elEndereco.style.cursor = 'pointer';
        elEndereco.style.color = '#2980b9'; 
        elEndereco.title = `Pesquisar outros alunos na rua: ${ruaLimpa}`;
        elEndereco.onclick = function() { window.open(urlPesquisa, '_blank'); };
    } else {
        if (!docAlvo.getElementById('link-pesquisa-rua')) {
            const btnPesquisa = docAlvo.createElement('a');
            btnPesquisa.id = 'link-pesquisa-rua';
            btnPesquisa.href = urlPesquisa;
            btnPesquisa.target = '_blank';
            btnPesquisa.innerHTML = ' 🔍 Pesquisar Rua';
            btnPesquisa.style.cssText = 'font-size: 11px; margin-left: 10px; color: #2980b9; text-decoration: none; font-weight: bold; cursor: pointer;';
            btnPesquisa.title = `Pesquisar outros alunos na rua: ${ruaLimpa}`;
            elEndereco.parentNode.insertBefore(btnPesquisa, elEndereco.nextSibling);
        }
    }
};

window.iniciarPaginaFicha = function() {
    if (typeof window.realizarCalculosIniciaisDistancia === 'function') {
        window.realizarCalculosIniciaisDistancia();
    }
    if (typeof window.aplicarLinkPesquisaEndereco === 'function') {
        window.aplicarLinkPesquisaEndereco();
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
                if (spanDados) enderecoCompleto = spanDados.innerText.replace(/\s+/g, ' ').trim();
            }
        }
    }

    let idSolInput = docAlvo.querySelector('input[name="id_solicitacao"]') || docAlvo.querySelector('input[name="id"]');
    let idFicha = idSolInput ? idSolInput.value : '';
    let urlOrigem = window.location.href;
    let basePath = urlOrigem.substring(0, urlOrigem.lastIndexOf('/') + 1);
    let urlFichaNova = basePath + 'ficha_transporte_nova_versao.php?id_solicitacao=' + idFicha;

    let dadosGeo = await window.extrairDadosGeograficos(urlFichaNova);
    if (!dadosGeo || !dadosGeo.geoEscola_Latit) return;

    let coordEndereco = await window.obterCoordenadasPorEndereco(enderecoCompleto);

    console.log("=== ANÁLISE DE COORDENADAS ===");
    console.log("1. Endereço Extraído:", enderecoCompleto);
    
    let distDiferentes = false;
    let diferencaGeografica = 0;
    let distEndFoot = null;

    if (coordEndereco && coordEndereco.lat) {
        console.log(`2. Nominatim Sucesso: LAT ${coordEndereco.lat} / LON ${coordEndereco.lon}`);
        diferencaGeografica = window.calcularDistanciaHaversine(
            dadosGeo.geoEndereco_Latit, dadosGeo.geoEndereco_Longit,
            coordEndereco.lat, coordEndereco.lon
        );
        distDiferentes = (diferencaGeografica > 200);
    } else {
        console.log("2. Nominatim FALHOU: Fallback para a string do endereço ativado.");
        // PLANO B: Se não achar, a variável guardará apenas a STRING do endereço.
        coordEndereco = enderecoCompleto; 
        distDiferentes = false; 
    }
    
    let distCoordFoot = await window.calcularTrajetoOSRM(dadosGeo.geoEndereco_Latit, dadosGeo.geoEndereco_Longit, dadosGeo.geoEscola_Latit, dadosGeo.geoEscola_Longit, 'foot');
    
    // OSRM não suporta textos. Usa o OSRM do Endereço apenas se a coordenada do endereço existir.
    if (typeof coordEndereco === 'string') {
        distEndFoot = distCoordFoot; 
    } else if (distDiferentes) {
        distEndFoot = await window.calcularTrajetoOSRM(coordEndereco.lat, coordEndereco.lon, dadosGeo.geoEscola_Latit, dadosGeo.geoEscola_Longit, 'foot');
    } else {
        distEndFoot = distCoordFoot;
    }

    window.DistDiferentesEntreMapas = distDiferentes;
    try { window.top.DistDiferentesEntreMapas = distDiferentes; } catch(e){}

    let usarCarro = false;
    let distCoordFinal = distCoordFoot;
    let distEndFinal = distEndFoot;
    let perfilFinal = 'foot';

    if (distCoordFoot > 10000 || distEndFoot > 10000) {
        let distCoordCar = distCoordFoot > 10000 ? await window.calcularTrajetoOSRM(dadosGeo.geoEndereco_Latit, dadosGeo.geoEndereco_Longit, dadosGeo.geoEscola_Latit, dadosGeo.geoEscola_Longit, 'driving') : distCoordFoot;
        let distEndCar = distEndFoot;
        
        if (distEndFoot > 10000) {
            if (typeof coordEndereco === 'string') distEndCar = distCoordCar;
            else distEndCar = await window.calcularTrajetoOSRM(coordEndereco.lat, coordEndereco.lon, dadosGeo.geoEscola_Latit, dadosGeo.geoEscola_Longit, 'driving');
        }
        
        if ((distCoordFoot > 10000 && distCoordCar < 5000) || (distEndFoot > 10000 && distEndCar < 5000)) {
            usarCarro = true;
            distCoordFinal = distCoordCar;
            distEndFinal = distEndCar;
            perfilFinal = 'driving';
        }
    }

    let objRota = {
        coordAlunoGPS: { lat: dadosGeo.geoEndereco_Latit, lon: dadosGeo.geoEndereco_Longit },
        coordAlunoEnd: coordEndereco, // <- Carregando a {lat, lon} ou a String
        distanciaCoord: distCoordFinal,
        distanciaEnd: distEndFinal,
        perfilOSRM: perfilFinal
    };

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

    console.log("=== RESULTADOS FINAIS OSRM ===");
    console.log("Perfil Trajeto Final:", perfilFinal);
    console.log("OSRM Coord:", distCoordFinal, "metros");
    console.log("OSRM Endereço:", distEndFinal, "metros");
    console.log("Endereço Buscado:", enderecoCompleto);
    console.log("Distância pelas Coordenadas (A pé):", distCoordFoot);
    console.log("Distância pelo Endereço (A pé):", distEndFoot);
    console.log("Diferença Arredondada (>200):", diferencaGeografica);
    console.log("Locais diferentes entre os mapas:", window.DistDiferentesEntreMapas);
    console.log("Modo Transporte Padrão:", window.modoTransporteAtual || 'pe');
    console.log("=================================================");
};

document.addEventListener('DOMContentLoaded', window.iniciarPaginaFicha);