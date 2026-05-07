window.getAlvoDocument = function() {
    function buscarDocComStatus(doc) {
        if (!doc) return null;
        if (doc.getElementById('status_atendimento') || doc.getElementById('mostra_status_pedido')) {
            return doc;
        }
        const iframes = doc.querySelectorAll('iframe');
        for (let i = 0; i < iframes.length; i++) {
            try {
                const docInterno = iframes[i].contentDocument;
                if (docInterno) {
                    const encontrado = buscarDocComStatus(docInterno);
                    if (encontrado) return encontrado;
                }
            } catch (e) {}
        }
        return null;
    }
    const docAlvo = buscarDocComStatus(document);
    return docAlvo || document; 
};

window.gerenciarBotaoAssistente = function() {
    if (window !== window.top) return;

    const doc = window.getAlvoDocument(); 
    const statusDiv = doc.getElementById('status_atendimento') || doc.getElementById('mostra_status_pedido');
    
    const currentIdInput = doc.querySelector('input[name="id_solicitacao"]') || doc.querySelector('input[name="id"]');
    const currentId = currentIdInput ? currentIdInput.value : 'desconhecido';

    if (window.currentStudentId !== currentId) {
        window.currentStudentId = currentId;
        window.mapaSincronizado = false;
        window.dadosGeograficos = null;
        window.urlEnderecoGlobal = null; 
        window.urlBotaoEnderecoGlobal = null;
        
        if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
        const mod = document.getElementById('modal-assistente-analise');
        if (mod) mod.remove();
    }

    let isVisivel = true;
    if (!statusDiv) {
        isVisivel = false;
    } else {
        if (statusDiv.offsetWidth === 0 && statusDiv.offsetHeight === 0) {
            isVisivel = false;
        }
        const modalSistema = document.getElementById('myModal');
        if (modalSistema && window.getComputedStyle(modalSistema).display === 'none') {
            isVisivel = false;
        }
    }

    let btn = document.getElementById('btn-assistente-transporte');

    if (!isVisivel) {
        if (btn) btn.remove();
        const modal = document.getElementById('modal-assistente-analise');
        if (modal) modal.remove();
        return;
    }

    const textoStatus = statusDiv.innerText.toUpperCase();
    const ehAnalise = textoStatus.includes('EM ANÁLISE') || 
                      textoStatus.includes('EM ANALISE') || 
                      textoStatus.includes('AGUARDANDO ANÁLISE') || 
                      textoStatus.includes('AGUARDANDO ANALISE');

    if (!ehAnalise) {
        if (btn) btn.remove();
        return;
    }

    if (!window.mapaSincronizado && typeof window.sincronizarMapaECoordenadas === 'function') {
        window.sincronizarMapaECoordenadas(doc);
    }

    const paginacao = document.getElementById('barra-paginacao-flutuante');
    if (paginacao) paginacao.style.zIndex = "900"; 

    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'btn-assistente-transporte';
        btn.innerHTML = '🧙‍♂️ Assistente de Análise';
        btn.style = "position:fixed; bottom:20px; right:20px; background:#8e44ad; color:white; border:none; border-radius:50px; padding:15px 20px; font-size:14px; font-weight:bold; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.3); z-index:99999;";
        
        btn.onmouseover = () => btn.style.background = "#9b59b6";
        btn.onmouseout = () => btn.style.background = "#8e44ad";
        
        btn.onclick = (e) => {
            e.preventDefault();
            const modal = document.getElementById('modal-assistente-analise');
            if (modal) {
                modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
            } else {
                window.abrirModalAssistente();
            }
        };
        document.body.appendChild(btn); 
    }
};

window.abrirModalAssistente = function() {
    const doc = window.getAlvoDocument(); 
    
    if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();

    let isMudanca = false;
    const statusDiv = doc.getElementById('status_atendimento') || doc.getElementById('mostra_status_pedido');
    
    if (statusDiv) {
        const textoStatus = statusDiv.innerText.toUpperCase();
        if (textoStatus.includes('MUDANÇA') || textoStatus.includes('MUDANCA')) {
            isMudanca = true;
        }
    }

    const endRua = doc.getElementById('endereco') ? (doc.getElementById('endereco').value || doc.getElementById('endereco').innerText) : '';
    const endNum = doc.getElementById('endereco_numero_residencia') ? (doc.getElementById('endereco_numero_residencia').value || doc.getElementById('endereco_numero_residencia').innerText) : '';
    const endBairro = doc.getElementById('endereco_bairro') ? (doc.getElementById('endereco_bairro').value || doc.getElementById('endereco_bairro').innerText) : '';
    const enderecoCompleto = [endRua, endNum, endBairro].filter(Boolean).join(", "); 

    const nomeRuaTitulo = endRua ? endRua.split(',')[0].trim() : 'Assistente Passo a Passo';

    const inputMae = doc.querySelector('input[name="nome_mae"]');
    const inputPai = doc.querySelector('input[name="nome_pai"]');
    const nomeMae = inputMae ? inputMae.value.trim() : '';
    const nomePai = inputPai ? inputPai.value.trim() : '';
    let nomesResponsaveis = [nomeMae, nomePai].filter(Boolean).join(" e ");
    if (!nomesResponsaveis) nomesResponsaveis = "NÃO INFORMADO";

    function campoPreenchido(id) {
        const el = doc.getElementById(id);
        if (!el) return false;
        const val = (el.value || el.innerText || "").trim().toUpperCase();
        return val !== "" && val !== "NÃO" && val !== "NAO" && val !== "0" && val !== "SELECIONE" && val !== "NENHUMA";
    }

    let sugestaoDeficienciaHtml = null;
    const elCadeirante = doc.getElementById('aluno_cadeirante');
    const isCadeirante = elCadeirante && (elCadeirante.value || elCadeirante.innerText || "").toUpperCase().includes("SIM");

    if (campoPreenchido('tipo_deficiencia') || campoPreenchido('detalhamento_deficiencia') || isCadeirante) {
        sugestaoDeficienciaHtml = 'ALUNO';
    } else if (campoPreenchido('descricao_deficiencia_pais_irmao') || campoPreenchido('descricao_deficiencia_pais_irmao_outro')) {
        sugestaoDeficienciaHtml = 'FAMILIA';
    }

    const modal = document.createElement('div');
    modal.id = 'modal-assistente-analise';
    modal.style = "position:fixed; bottom:80px; right:20px; width:450px; max-width:90%; background:#fff; border-radius:8px; box-shadow:0 5px 25px rgba(0,0,0,0.4); border:1px solid #bdc3c7; z-index:100000; display:flex; flex-direction:column; font-family:verdana; overflow:hidden;";
    
    modal.innerHTML = `
        <div style="background:#2c3e50; color:#fff; padding:15px; font-size:16px; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:10px; overflow:hidden; flex:1;">
                <button id="btn-voltar-assistente" style="background:transparent; border:none; color:#fff; font-size:18px; cursor:pointer; line-height:1; display:none; padding:0; outline:none;" title="Voltar ao passo anterior">⬅️</button>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">📍 ${nomeRuaTitulo}</span>
            </div>
            <button id="btn-fechar-assistente" style="background:transparent; border:none; color:#fff; font-size:24px; cursor:pointer; line-height:1; margin-left:10px;">×</button>
        </div>
        <div id="conteudo-assistente" style="padding:20px; font-size:14px; color:#333; min-height:150px; max-height:70vh; overflow-y:auto;">
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('btn-fechar-assistente').onclick = () => {
        if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
        const btnFinalizar = document.getElementById('btn-aplicar-resultado');
        if (btnFinalizar) {
            btnFinalizar.click();
        } else {
            modal.style.display = 'none';
        }
    };

    let estado = {
        mudancaOk: false,
        escolaProxima: null,
        encaminhamentoOk: null,
        distancia: null,
        deficiencia: null, 
        dificuldadeAcesso: null,
        tentouResgate: false,
        nomeEscolaAtual: "",
        telaFinal: null,
        distanciaSugeridaInput: "",
        distanciasOSRM: {}, 
        buscandoOSRM: false,
        distanciasVerificadasInicialmente: false,
        perfilOSRM: 'foot',
        cacheDistancias: {} 
    };

    let historico = [];
    let listaExibirBase = [];

    function salvarHistorico() {
        historico.push(JSON.parse(JSON.stringify(estado)));
    }

    function voltarPasso() {
        if (historico.length > 0) {
            if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
            estado = historico.pop();
            estado.buscandoOSRM = false; 
            renderizarPasso();
        }
    }

    async function renderizarPasso() {
        const conteudo = document.getElementById('conteudo-assistente');
        if (!conteudo) return; 
        
        const btnVoltar = document.getElementById('btn-voltar-assistente');
        if (btnVoltar) {
            btnVoltar.style.display = historico.length > 0 ? 'inline-block' : 'none';
            btnVoltar.onclick = voltarPasso;
        }

        if (estado.telaFinal) {
            if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();

            const titulo = estado.telaFinal.titulo;
            const mensagem = estado.telaFinal.mensagem;
            const tipoAcao = titulo.includes('INDEFERIR') ? 'INDEFERIR' : 'DEFERIR';
            const corTitulo = tipoAcao === 'DEFERIR' ? '#27ae60' : '#c0392b';

            let termoBusca = "";
            let textoDetalhes = "";

            if (estado.encaminhamentoOk) {
                textoDetalhes = "encaminhado";
            }

            if (tipoAcao === 'DEFERIR') {
                if (estado.deficiencia === 'ALUNO') termoBusca = "ALUNO DEFICIENTE";
                else if (estado.deficiencia === 'FAMILIA') termoBusca = "PAI/MÃE DEFICIENTE";
                else if (estado.distancia >= 1500) { termoBusca = "DISTÂNCIA MAIOR QUE 1500 METROS"; } 
                else if (estado.dificuldadeAcesso === true) termoBusca = "DIFICULDADE DE ACESSO";
                else termoBusca = "ENCAMINHADO PELA SEÇÃO DE MATRICULAS";
            } else {
                if (isMudanca && estado.mudancaOk === false) {
                    termoBusca = ""; 
                } else if (estado.distancia !== null && estado.distancia < 1500) {
                    termoBusca = "DISTÂNCIA MENOR QUE 1500 METROS";
                } else {
                    termoBusca = "ESCOLA POR OPÇÃO";
                }
            }

            conteudo.innerHTML = `
                <div style="text-align:center; padding:10px;">
                    <h2 style="color:${corTitulo}; margin-top:0; font-size:24px;">${titulo}</h2>
                    <p style="font-size:15px; background:#f8f9fa; padding:15px; border-radius:5px; border-left:4px solid ${corTitulo}; text-align:left; margin-bottom:0;">
                        ${mensagem}
                        ${termoBusca ? `<br><br><b>Opção no Sistema:</b> ${termoBusca}` : ''}
                        ${textoDetalhes ? '<br><span style="color:#e67e22; font-size:12px; display:inline-block; margin-top:5px;">⚠️ Obs: Será preenchido como Encaminhado nos detalhes</span>' : ''}
                    </p>
                </div>
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px; justify-content:center;">
                    <button id="btn-aplicar-resultado" style="padding:12px; background:${corTitulo}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold; width:100%; box-shadow:0 2px 5px rgba(0,0,0,0.2);">Finalizar</button>
                </div>
            `;

            document.getElementById('btn-aplicar-resultado').onclick = () => {
                const docFinal = window.getAlvoDocument(); 
                
                try {
                    const camposDist = docFinal.querySelectorAll('input[name="distancia_aferida"], #distancia_aferida');
                    if (estado.distancia !== null && estado.distancia !== undefined) {
                        camposDist.forEach(campo => {
                            campo.value = estado.distancia;
                            campo.setAttribute('value', estado.distancia);
                        });
                    }
                } catch (erro) {}

                try {
                    const camposDet = docFinal.querySelectorAll('textarea[name="status_detalhes"], #status_atual_detalhes, textarea[name="motivo_detalhes"]');
                    camposDet.forEach(campo => {
                        if(textoDetalhes !== "") {
                            campo.value = textoDetalhes;
                            campo.innerHTML = textoDetalhes; 
                        }
                    });
                } catch (erro) {}

                try {
                    if (termoBusca !== "") {
                        const selectsMotivo = docFinal.querySelectorAll('select[name="status_motivo"], #status_motivo');
                        selectsMotivo.forEach((select) => {
                            for (let i = 0; i < select.options.length; i++) {
                                const opt = select.options[i];
                                const txtOpcao = opt.text.toUpperCase();
                                const valOpcao = opt.value.toUpperCase();
                                
                                if (txtOpcao.includes(termoBusca) || valOpcao.includes(termoBusca)) {
                                    select.selectedIndex = i;
                                    try { select.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
                                    break; 
                                }
                            }
                        });
                    }
                } catch (erro) {}

                const modalAssis = document.getElementById('modal-assistente-analise');
                if (modalAssis) modalAssis.remove();

                const windowFinal = docFinal.defaultView || window;
                const isFichaAntigaFinal = windowFinal.location.href.includes('ficha_transporte.php') && !windowFinal.location.href.includes('nova_versao');
                
                if (isFichaAntigaFinal && typeof windowFinal.ShowModal === 'function') {
                    if (tipoAcao === 'DEFERIR') {
                        windowFinal.ShowModal("modal_Deferir");
                    } else {
                        windowFinal.ShowModal("modal_Indeferir");
                    }
                }
            };
            return;
        }

        if (isMudanca && !estado.mudancaOk) {
            conteudo.innerHTML = `
                <h3 style="color:#e67e22; margin-top:0;">⚠️ Mudança de Endereço</h3>
                <p>Verifique se o comprovante de endereço está OK, e se ele contém os seguintes dados compatíveis com a ficha:</p>
                <ul style="background:#f9f9f9; padding:10px 10px 10px 25px; border-radius:4px; border:1px solid #eee;">
                    <li style="margin-bottom:5px;"><b>Endereço:</b> ${enderecoCompleto}</li>
                    <li><b>Responsável(eis):</b> ${nomesResponsaveis}</li>
                </ul>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button id="btn-mudanca-sim" style="flex:1; padding:10px; background:#27ae60; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Sim, comprovante OK</button>
                    <button id="btn-mudanca-nao" style="flex:1; padding:10px; background:#c0392b; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Não, inválido/ausente</button>
                </div>
            `;
            document.getElementById('btn-mudanca-sim').onclick = () => { salvarHistorico(); estado.mudancaOk = true; renderizarPasso(); };
            document.getElementById('btn-mudanca-nao').onclick = () => { salvarHistorico(); estado.telaFinal = { titulo: "❌ INDEFERIR", mensagem: "O comprovante de endereço é inválido ou está ausente no caso de mudança." }; renderizarPasso(); };
            return;
        }

        if (estado.escolaProxima === null) {

            if (window.dadosGeograficos && window.dadosGeograficos.erro && !estado.tentouResgate) {
                estado.tentouResgate = true; 
                
                const iframeMap = doc.getElementById('map_endereco');
                if (iframeMap && iframeMap.src && iframeMap.src.includes('destination=')) {
                    const urlCompleta = iframeMap.src;
                    const matchOrigin = urlCompleta.match(/origin=([^&]+)/i);
                    const matchDest = urlCompleta.match(/destination=([^&]+)/i);
                    const separarCoordenadas = (matchString) => {
                        if (!matchString) return { lat: null, lon: null };
                        const pt = decodeURIComponent(matchString[1]).trim().split(/[\s,]+/);
                        if (pt.length >= 2) return { lat: parseFloat(pt[0].trim()), lon: parseFloat(pt[1].trim()) };
                        return { lat: null, lon: null };
                    };
                    const coordOrigin = separarCoordenadas(matchOrigin);
                    const coordDest = separarCoordenadas(matchDest);
                    
                    if (coordOrigin.lat && coordDest.lat) {
                        window.dadosGeograficos = {
                            erro: false,
                            urlMaps: urlCompleta,
                            geoEndereco_Latit: coordOrigin.lat,
                            geoEndereco_Longit: coordOrigin.lon,
                            geoEscola_Latit: coordDest.lat,
                            geoEscola_Longit: coordDest.lon
                        };
                        renderizarPasso();
                        return;
                    }
                }

                const idSolInput = doc.querySelector('input[name="id_solicitacao"]') || doc.querySelector('input[name="id"]');
                if (idSolInput && idSolInput.value) {
                    window.dadosGeograficos = null; 
                    const windowAlvo = doc.defaultView || window;
                    const baseUrlAberta = windowAlvo.location.href.split('?')[0];
                    const urlFallback = baseUrlAberta.replace('ficha_transporte.php', 'ficha_transporte_nova_versao.php') + '?id_solicitacao=' + idSolInput.value;

                    if (typeof window.extrairDadosGeograficos === 'function') {
                        window.extrairDadosGeograficos(urlFallback).then(dados => {
                            window.dadosGeograficos = dados ? dados : { erro: true };
                            renderizarPasso(); 
                        });
                        return;
                    }
                }
            }

            const campoDistExistente = doc.querySelector('input[name="distancia_aferida"], #distancia_aferida');
            if (estado.distanciaSugeridaInput === "" && campoDistExistente && campoDistExistente.value) {
                estado.distanciaSugeridaInput = campoDistExistente.value;
            }
            
            const falhouCalculo = window.dadosGeograficos && 
                                  (window.dadosGeograficos.erro || (!window.dadosGeograficos.geoEndereco_Latit && estado.tentouResgate));

            if (falhouCalculo) {
                let latA = window.dadosGeograficos ? window.dadosGeograficos.geoEndereco_Latit : null;
                let lonA = window.dadosGeograficos ? window.dadosGeograficos.geoEndereco_Longit : null;
                let linkBotaoErro = (latA && lonA) 
                    ? `https://maps.google.com/maps?saddr=${latA}+${lonA}&daddr=0+0&travelmode=walking&dirflg=w` //nao alterar
                    : `https://maps.google.com/maps?saddr=$`; //nao alterar

                conteudo.innerHTML = `
                    <h3 style="color:#2980b9; margin-top:0;">🏫 Verificação de Escola</h3>
                    <p style="color:#e74c3c; font-weight:bold;">Verifique se está na escola mais próxima.</p>
                    <div style="margin-bottom: 15px; font-size:13px;">
                        <a href="${linkBotaoErro}" target="_blank" onclick="if(window.copiarCoordenadasEndereco) window.copiarCoordenadasEndereco();" style="display:block; text-align:center; padding:8px; background:#3498db; color:#fff; font-weight:bold; text-decoration:none; border-radius:4px; margin-bottom:15px; font-size:12px;">🗺️ Conferir mapa da rede</a>
                    </div>
                    
                    <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
                    <h3 style="color:#f39c12; margin-top:0; margin-bottom:10px; font-size:15px;">📏 Aferição de Distância</h3>
                    <p style="margin-bottom:10px;">Qual é a distância aferida entre a residência e a escola (em metros)?</p>
                    <div style="margin-bottom:20px;">
                        <input type="number" id="input-assistente-dist" value="${estado.distanciaSugeridaInput}" placeholder="Ex: 1650" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px; font-size:14px; box-sizing:border-box;">
                    </div>

                    <div style="display:flex; gap:10px;">
                        <button id="btn-esc-sim" style="flex:1; padding:10px; background:#27ae60; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Está na mais próxima</button>
                        <button id="btn-esc-nao" style="flex:1; padding:10px; background:#c0392b; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Não é a mais próxima</button>
                    </div>
                `;
                
                const inputDist = document.getElementById('input-assistente-dist');
                setTimeout(() => { inputDist.focus(); }, 100);

                inputDist.addEventListener('focus', function() { this.select(); });
                inputDist.addEventListener('keydown', function(e) { if (e.key === 'Enter') e.preventDefault(); });

                document.getElementById('btn-esc-sim').onclick = () => { 
                    const dist = parseInt(inputDist.value);
                    if (isNaN(dist) || dist < 0) return alert("Por favor, insira uma distância válida em metros.");
                    salvarHistorico(); 
                    estado.distancia = dist;
                    estado.escolaProxima = true; 
                    if (estado.distancia >= 1500) {
                        estado.telaFinal = { titulo: "✅ DEFERIR", mensagem: `A distância atinge o requisito mínimo (${estado.distancia}m) e os critérios da escola ou encaminhamento estão corretos.` };
                    }
                    renderizarPasso(); 
                };
                
                document.getElementById('btn-esc-nao').onclick = () => { 
                    const dist = parseInt(inputDist.value);
                    if (isNaN(dist) || dist < 0) return alert("Por favor, insira uma distância válida em metros.");
                    salvarHistorico(); 
                    estado.distancia = dist;
                    estado.escolaProxima = false; 
                    renderizarPasso(); 
                };
                return;
            }

            if (!window.dadosGeograficos || !window.dadosGeograficos.geoEndereco_Latit) {
                conteudo.innerHTML = `<div style="text-align:center; padding:20px; font-weight:bold; color:#2980b9;">⏳ A calcular mapa e coordenadas da rede...</div>`;
                setTimeout(renderizarPasso, 500); 
                return;
            }

            const latAluno = window.dadosGeograficos.geoEndereco_Latit;
            const lonAluno = window.dadosGeograficos.geoEndereco_Longit;
            
            let idEscolaAtual = "";
            let nomeEscolaAtualStr = "Não identificada";
            const inputIdEscola = document.querySelector('input[name="id_unidade"]') || doc.querySelector('input[name="id_unidade"]');
            
            if (inputIdEscola) {
                idEscolaAtual = inputIdEscola.value.trim();
                if (window.escolasDB) {
                    const escFound = window.escolasDB.find(e => String(e.id) === String(idEscolaAtual));
                    if (escFound) nomeEscolaAtualStr = escFound.nome;
                }
            } else {
                const spanNomeEscola = doc.querySelector('span[style*="font-size: 20px"][style*="font-weight: bold"]');
                if (spanNomeEscola && window.escolasDB) {
                    const nomeTela = window.normalizarTexto(spanNomeEscola.innerText).replace('EMEB', '').replace(',', '').trim();
                    const escolaEncontrada = window.escolasDB.find(e => {
                        const nomeBanco = window.normalizarTexto(e.nome).replace('EMEB', '').replace(',', '').trim();
                        return nomeBanco.includes(nomeTela) || nomeTela.includes(nomeBanco);
                    });
                    if (escolaEncontrada) {
                        idEscolaAtual = escolaEncontrada.id;
                        nomeEscolaAtualStr = escolaEncontrada.nome;
                    }
                }
            }
            estado.nomeEscolaAtual = nomeEscolaAtualStr;

            const baseEscolas = window.escolasDB || [];
            let escolaSelecionada = baseEscolas.find(e => String(e.id) === String(idEscolaAtual));

            if (escolaSelecionada && !estado.distanciasVerificadasInicialmente) {
                estado.distanciasVerificadasInicialmente = true;
                if (!window.dadosGeraisRota) {
                    conteudo.innerHTML = `<div style="text-align:center; padding:20px; font-weight:bold; color:#2980b9;">⏳ Carregando dados globais de roteamento...</div>`;
                    setTimeout(renderizarPasso, 500);
                    return;
                }
                estado.perfilOSRM = window.modoTransporteAtual === 'carro' ? 'driving' : 'foot';
            }

            let mapMode = window.modoMapaAtual || (window.top && window.top.modoMapaAtual) || 'coordenada';

            if (window.dadosGeraisRota && !document.getElementById('input-assistente-dist')?.dataset.editado) {
                let distFinalSugerida = (mapMode === 'endereco') ? window.dadosGeraisRota.distanciaEnd : window.dadosGeraisRota.distanciaCoord;
                if (distFinalSugerida !== null) {
                    estado.distanciaSugeridaInput = Math.round(distFinalSugerida / 50) * 50;
                }
            }

            let nivelAlunoOriginal = "";
            const selectNivel = document.getElementById('nivel') || doc.getElementById('nivel');
            
            if (selectNivel) {
                nivelAlunoOriginal = selectNivel.value;
            } else {
                const spans16 = doc.querySelectorAll('span[style*="font-size: 16px"][style*="font-weight: bold"]');
                spans16.forEach(span => {
                    const texto = span.innerText.trim().toUpperCase();
                    if (texto !== "INTEGRAL" && texto !== "PARCIAL" && texto !== "NOITE" && texto !== "") {
                        nivelAlunoOriginal = texto;
                    }
                });
            }
            
            const nivelAlunoNorm = window.normalizarTexto(nivelAlunoOriginal);
            const isBercarioGeral = nivelAlunoNorm === "BERCARIO";

            const escolasAptas = baseEscolas.filter(esc => {
                if (!esc.turmas || !Array.isArray(esc.turmas)) return false;
                const turmasNivel = esc.turmas.filter(turma => {
                    const nivelTurmaNorm = window.normalizarTexto(turma.nivel);
                    if (isBercarioGeral) {
                        return nivelTurmaNorm.includes("BERCARIO");
                    }
                    return nivelTurmaNorm === nivelAlunoNorm;
                });
                
                if (turmasNivel.length > 0) {
                    esc.periodosEncontrados = [...new Set(turmasNivel.map(t => t.periodo))].join(' / ');
                    return true;
                }
                return false;
            });

            // Função para gerar a lista atualizada baseada na origem correta (GPS ou Nominatim)
            function obterEscolasAptasExibicao() {
                let latBase = latAluno;
                let lonBase = lonAluno;
                if (mapMode === 'endereco') {
                    let rota = window.dadosGeraisRota || (window.top && window.top.dadosGeraisRota);
                    if (rota && rota.coordAlunoEnd && rota.coordAlunoEnd.lat) {
                        latBase = rota.coordAlunoEnd.lat;
                        lonBase = rota.coordAlunoEnd.lon;
                    }
                }

                escolasAptas.forEach(esc => {
                    esc.distancia = window.calcularDistanciaHaversine(latBase, lonBase, esc.lat, esc.lon);
                });

                escolasAptas.sort((a, b) => a.distancia - b.distancia);
                
                let indexAtual = escolasAptas.findIndex(e => String(e.id) === String(idEscolaAtual));
                let indexParcial = escolasAptas.findIndex(e => e.periodosEncontrados && e.periodosEncontrados.includes('PARCIAL'));
                let indexIntegral = escolasAptas.findIndex(e => e.periodosEncontrados && e.periodosEncontrados.includes('INTEGRAL'));
                
                let idxAtualValid = indexAtual !== -1 ? indexAtual : -1;
                let idxParcialValid = indexParcial !== -1 ? indexParcial : -1;
                let idxIntegralValid = indexIntegral !== -1 ? indexIntegral : -1;
                
                let limiteFinal = 3; 
                const prioridades = [0, idxParcialValid, idxIntegralValid, idxAtualValid].filter(idx => idx !== -1);
                
                prioridades.forEach(idx => {
                    if (idx >= 3 && idx <= 9) {
                        if ((idx + 1) > limiteFinal) {
                            limiteFinal = idx + 1;
                        }
                    }
                });
                
                return escolasAptas.slice(0, limiteFinal);
            }

            listaExibirBase = obterEscolasAptasExibicao();

            let transpMode = window.modoTransporteAtual || (window.top && window.top.modoTransporteAtual) || 'pe';
            let chaveCache = `${mapMode}_${transpMode}`;
            estado.perfilOSRM = transpMode === 'carro' ? 'driving' : 'foot';

            if (!estado.cacheDistancias) estado.cacheDistancias = {};
            if (!estado.cacheDistancias[chaveCache]) estado.cacheDistancias[chaveCache] = {};
            
            estado.distanciasOSRM = estado.cacheDistancias[chaveCache];
            estado.ultimoModoUsado = chaveCache; // Rastrear qual modo foi usado pela última vez

            // Definir variáveis de modo em escopo mais amplo para uso em atualizarListaEscolasDinamicamente e OSRM
            let mapModeAtual = window.modoMapaAtual || (window.top && window.top.modoMapaAtual) || 'coordenada';
            let transpModeAtual = window.modoTransporteAtual || (window.top && window.top.modoTransporteAtual) || 'pe';

            const atualizarListaEscolasDinamicamente = () => {
                console.log("🔄 Iniciando atualização da lista de escolas dinamicamente");
                
                // Ler o mapMode atual (pode ter mudado ao pressionar o botão)
                mapModeAtual = window.modoMapaAtual || (window.top && window.top.modoMapaAtual) || 'coordenada';
                transpModeAtual = window.modoTransporteAtual || (window.top && window.top.modoTransporteAtual) || 'pe';
                let chaveCacheAtual = `${mapModeAtual}_${transpModeAtual}`;
                
                console.log("📍 Modo atual:", mapModeAtual, "| Transporte:", transpModeAtual, "| Cache:", chaveCacheAtual);
                
                // Se DistDiferentesEntreMapas for true e o modo mudou, recalcular a lista
                if (window.DistDiferentesEntreMapas && chaveCacheAtual !== estado.ultimoModoUsado) {
                    console.log("🔄 Recalculando lista - modo mudou de", estado.ultimoModoUsado, "para", chaveCacheAtual);
                    
                    // Recalcular lista com as coordenadas do novo modo
                    listaExibirBase = [];
                    let latBase = latAluno;
                    let lonBase = lonAluno;
                    
                    if (mapModeAtual === 'endereco') {
                        let rota = window.dadosGeraisRota || (window.top && window.top.dadosGeraisRota);
                        if (rota && rota.coordAlunoEnd && rota.coordAlunoEnd.lat) {
                            latBase = rota.coordAlunoEnd.lat;
                            lonBase = rota.coordAlunoEnd.lon;
                            console.log("✅ Usando coordenadas do Nominatim: LAT", latBase, "LON", lonBase);
                        }
                    } else {
                        console.log("✅ Usando coordenadas GPS: LAT", latBase, "LON", lonBase);
                    }
                    
                    // Recalcular distâncias com as novas coordenadas
                    escolasAptas.forEach(esc => {
                        esc.distancia = window.calcularDistanciaHaversine(latBase, lonBase, esc.lat, esc.lon);
                    });
                    escolasAptas.sort((a, b) => a.distancia - b.distancia);
                    
                    let indexAtual = escolasAptas.findIndex(e => String(e.id) === String(idEscolaAtual));
                    let indexParcial = escolasAptas.findIndex(e => e.periodosEncontrados && e.periodosEncontrados.includes('PARCIAL'));
                    let indexIntegral = escolasAptas.findIndex(e => e.periodosEncontrados && e.periodosEncontrados.includes('INTEGRAL'));
                    
                    let idxAtualValid = indexAtual !== -1 ? indexAtual : -1;
                    let idxParcialValid = indexParcial !== -1 ? indexParcial : -1;
                    let idxIntegralValid = indexIntegral !== -1 ? indexIntegral : -1;
                    
                    let limiteFinal = 3; 
                    const prioridades = [0, idxParcialValid, idxIntegralValid, idxAtualValid].filter(idx => idx !== -1);
                    
                    prioridades.forEach(idx => {
                        if (idx >= 3 && idx <= 9) {
                            if ((idx + 1) > limiteFinal) {
                                limiteFinal = idx + 1;
                            }
                        }
                    });
                    
                    listaExibirBase = escolasAptas.slice(0, limiteFinal);
                    estado.ultimoModoUsado = chaveCacheAtual;
                    console.log("📊 Nova lista calculada com", listaExibirBase.length, "escolas");
                    
                    // Preparar cache para este modo/transporte se não existir
                    if (!estado.cacheDistancias) estado.cacheDistancias = {};
                    if (!estado.cacheDistancias[chaveCacheAtual]) estado.cacheDistancias[chaveCacheAtual] = {};
                    estado.distanciasOSRM = estado.cacheDistancias[chaveCacheAtual];
                    estado.perfilOSRM = transpModeAtual === 'carro' ? 'driving' : 'foot';
                    estado.buscandoOSRM = false; // Reset flag para recalcular OSRM no novo modo
                    console.log("🔄 OSRM reset para modo", chaveCacheAtual, "- será recalculado");
                }
                
                const containerLista = document.getElementById('container-lista-escolas');
                if (!containerLista) {
                    console.log("❌ Container 'container-lista-escolas' não encontrado");
                    return;
                }
                console.log("✅ Container encontrado");
                console.log("📊 listaExibirBase tem", listaExibirBase.length, "itens");

                let listaOrdenada = [...listaExibirBase];
                listaOrdenada.sort((a, b) => {
                    let distA = (estado.distanciasOSRM[a.id] !== undefined && estado.distanciasOSRM[a.id] !== 'Erro') ? estado.distanciasOSRM[a.id] : a.distancia;
                    let distB = (estado.distanciasOSRM[b.id] !== undefined && estado.distanciasOSRM[b.id] !== 'Erro') ? estado.distanciasOSRM[b.id] : b.distancia;
                    return distA - distB;
                });
                console.log("📋 listaOrdenada tem", listaOrdenada.length, "itens após ordenação");

                const ehMaisProxima = (listaOrdenada.length > 0 && String(listaOrdenada[0].id) === String(idEscolaAtual));
                const escolaMaisProximaParcial = listaOrdenada.find(e => e.periodosEncontrados && e.periodosEncontrados.includes('PARCIAL'));
                const ehMaisProximaParcial = (!ehMaisProxima && escolaMaisProximaParcial && String(escolaMaisProximaParcial.id) === String(idEscolaAtual));

                let statusText = "";
                if (listaOrdenada.length === 0) {
                     statusText = `<span style="color:#e67e22; font-weight:bold;">⚠️ Verifique o nível do aluno. Nenhuma opção compatível foi encontrada.</span>`;
                } else if (ehMaisProxima) {
                     statusText = `<span style="color:#27ae60; font-weight:bold;">✅ A escola atual é a MAIS PRÓXIMA com vaga para ${nivelAlunoOriginal}.</span>`;
                } else if (ehMaisProximaParcial) {
                     statusText = `<span style="color:#2980b9; font-weight:bold;">✅ A escola atual é a mais próxima de ENSINO PARCIAL com vaga para ${nivelAlunoOriginal}.</span>`;
                } else {
                     statusText = `<span style="color:#c0392b; font-weight:bold;">⚠️ Existem opções mais próximas para ${nivelAlunoOriginal}:</span>`;
                }

                const btnSim = document.getElementById('btn-esc-sim');
                const btnNao = document.getElementById('btn-esc-nao');
                const destaqueSim = (ehMaisProxima || ehMaisProximaParcial);
                
                if (btnSim && btnNao) {
                    if (destaqueSim) {
                        btnSim.style.cssText = "flex:1; padding:10px; background:#27ae60; color:#fff; border:2px solid #2ecc71; border-radius:4px; cursor:pointer; font-weight:bold; box-shadow:0 0 10px rgba(39, 174, 96, 0.6); transform:scale(1.03);";
                        btnNao.style.cssText = "flex:1; padding:10px; background:#7f8c8d; color:#ecf0f1; border:none; border-radius:4px; cursor:pointer; font-weight:bold; opacity:0.6;";
                    } else {
                        btnNao.style.cssText = "flex:1; padding:10px; background:#c0392b; color:#fff; border:2px solid #e74c3c; border-radius:4px; cursor:pointer; font-weight:bold; box-shadow:0 0 10px rgba(192, 57, 43, 0.6); transform:scale(1.03);";
                        btnSim.style.cssText = "flex:1; padding:10px; background:#7f8c8d; color:#ecf0f1; border:none; border-radius:4px; cursor:pointer; font-weight:bold; opacity:0.6;";
                    }
                    window.destaqueSimGlobal = destaqueSim;
                }

                let listaHtml = `<div style="margin-bottom: 15px; font-size:13px;">${statusText}</div>`;
                listaHtml += `<ul style="background:#f9f9f9; padding:10px 10px 10px 25px; border-radius:4px; border:1px solid #eee; margin-top:10px; transition: all 0.3s ease;">`;
                
                if (listaOrdenada.length === 0) {
                    listaHtml += `<li style="color:#c0392b;">⚠️ Nenhuma escola encontrada na base.</li>`;
                } else {
                    const latOrigemLista = (mapModeAtual === 'endereco' && window.dadosGeraisRota && window.dadosGeraisRota.coordAlunoEnd && typeof window.dadosGeraisRota.coordAlunoEnd !== 'string') ? window.dadosGeraisRota.coordAlunoEnd.lat : latAluno;
                    const lonOrigemLista = (mapModeAtual === 'endereco' && window.dadosGeraisRota && window.dadosGeraisRota.coordAlunoEnd && typeof window.dadosGeraisRota.coordAlunoEnd !== 'string') ? window.dadosGeraisRota.coordAlunoEnd.lon : lonAluno;

                    listaOrdenada.forEach((esc, i) => {
                        const cor = String(esc.id) === String(idEscolaAtual) ? 'color:#27ae60; font-weight:bold;' : 'color:#555;';
                        const tagAtual = String(esc.id) === String(idEscolaAtual) ? ' ⭐ (Escola Solicitada)' : '';
                        
                        let sufixoMaps = estado.perfilOSRM === 'foot' ? "&travelmode=walking&dirflg=w" : "";
                        let urlConfere = "";
                        
                        if (mapModeAtual === 'endereco' && window.dadosGeraisRota && typeof window.dadosGeraisRota.coordAlunoEnd === 'string') {
                            let endStrEncode = encodeURIComponent(window.dadosGeraisRota.coordAlunoEnd);
                            urlConfere = `https://maps.google.com/maps?saddr=${endStrEncode}&daddr=${esc.lat}+${esc.lon}${sufixoMaps}`;
                        } else {
                            urlConfere = `https://maps.google.com/maps?saddr=${latOrigemLista}+${lonOrigemLista}&daddr=${esc.lat}+${esc.lon}${sufixoMaps}`; //nao alterar
                        }
                        
                        let icone = estado.perfilOSRM === 'foot' ? '🚶' : '🚗';
                        let txtDist = `<span style="font-size:11px; color:#f39c12;">${icone} <i>Calculando trajeto...</i></span>`;
                        if (estado.distanciasOSRM[esc.id] !== undefined) {
                            if (estado.distanciasOSRM[esc.id] === 'Erro') {
                                txtDist = `<span style="font-size:11px; color:#e74c3c;">${icone} Trajeto: Falha ao calcular</span>`;
                            } else {
                                let distArredondada = Math.round(estado.distanciasOSRM[esc.id] / 50) * 50;
                                txtDist = `<span style="font-size:11px; color:#d35400;">${icone} Trajeto: <b>${distArredondada}m</b></span>`;
                            }
                        }

                        listaHtml += `<li style="margin-bottom:8px; ${cor}">
                            ${i + 1}º - ${esc.nome} <span style="font-size:11px; color:#8e44ad;">[${esc.periodosEncontrados}]</span>${tagAtual}
                            <br>${txtDist}
                            <br><a href="${urlConfere}" target="_blank" onclick="if(window.copiarCoordenadasEndereco) window.copiarCoordenadasEndereco();" style="font-size:10px; color:#3498db; text-decoration:none; display:inline-block; margin-top:2px;">📍 Ver rota no Google Maps</a>
                        </li>`;
                    });
                }
                listaHtml += `</ul>`;
                
                let linkMapaRede = "";
                let sufixoMaps = estado.perfilOSRM === 'foot' ? "&travelmode=walking&dirflg=w" : ""; //nao alterar
                linkMapaRede = `https://www.google.com/maps/d/u/0/viewer?mid=1ukc8GP3M-X3Da5l4k406MUMz5oyBB0E&femb=1&ll=${latAluno}%2C${lonAluno}&z=18`; //nao alterar
                
                listaHtml += `<a href="${linkMapaRede}" target="_blank" onclick="if(window.copiarCoordenadasEndereco) window.copiarCoordenadasEndereco();" style="display:block; text-align:center; padding:8px; background:#3498db; color:#fff; font-weight:bold; text-decoration:none; border-radius:4px; margin-bottom:15px; font-size:12px;">🗺️ Conferir mapa da rede</a>`;

                console.log("📝 Aplicando HTML à lista:", listaHtml.substring(0, 100) + "...");
                containerLista.innerHTML = listaHtml;
                console.log("✅ Lista de escolas atualizada com sucesso");
                console.log("🎯 Atualização concluída -", listaOrdenada.length, "escolas renderizadas");
                
                // Verificar se há distâncias OSRM ainda não calculadas e iniciar se necessário
                let faltaCalcularAgora = listaExibirBase.some(esc => estado.distanciasOSRM[esc.id] === undefined);
                if (faltaCalcularAgora && typeof window.calcularTrajetoOSRM === 'function' && !estado.buscandoOSRM) {
                    console.log("🔄 Iniciando cálculo OSRM para modo atual:", mapModeAtual);
                    estado.buscandoOSRM = true;
                    
                    if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
                    window.osrmAbortController = new AbortController();

                    (async () => {
                        const latOrigemLista = (mapModeAtual === 'endereco' && window.dadosGeraisRota && window.dadosGeraisRota.coordAlunoEnd) ? window.dadosGeraisRota.coordAlunoEnd.lat : latAluno;
                        const lonOrigemLista = (mapModeAtual === 'endereco' && window.dadosGeraisRota && window.dadosGeraisRota.coordAlunoEnd) ? window.dadosGeraisRota.coordAlunoEnd.lon : lonAluno;

                        for (let esc of listaExibirBase) {
                            if (estado.distanciasOSRM[esc.id] === undefined) {
                                const dist = await window.calcularTrajetoOSRM(latOrigemLista, lonOrigemLista, esc.lat, esc.lon, estado.perfilOSRM, window.osrmAbortController.signal);
                                if (window.osrmAbortController.signal.aborted) break; 
                                
                                estado.distanciasOSRM[esc.id] = dist !== null ? dist : 'Erro';
                                console.log("📞 Chamando atualizarListaEscolasDinamicamente após calcular OSRM para", esc.nome);
                                atualizarListaEscolasDinamicamente();
                                await new Promise(r => setTimeout(r, 250));
                            }
                        }
                        estado.buscandoOSRM = false;
                    })();
                }
            };

            window.atualizarListaEscolasDinamicamente = atualizarListaEscolasDinamicamente;

            conteudo.innerHTML = `
                <h3 style="color:#2980b9; margin-top:0;">🏫 Verificação de Escola</h3>
                <p>Verifique se a escola matriculada é a mais próxima do endereço do aluno.</p>
                
                <div id="container-lista-escolas">
                    </div>
                
                <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
                <h3 style="color:#f39c12; margin-top:0; margin-bottom:10px; font-size:15px;">📏 Aferição de Distância</h3>
                <p style="margin-bottom:10px;">Qual é a distância aferida entre a residência e a escola (em metros)?</p>
                <div style="margin-bottom:20px;">
                    <input type="number" id="input-assistente-dist" value="${estado.distanciaSugeridaInput}" placeholder="Ex: 1650" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px; font-size:14px; box-sizing:border-box;">
                </div>

                <div style="display:flex; gap:10px;">
                    <button id="btn-esc-sim" style="flex:1; padding:10px; background:#27ae60; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Está na mais próxima</button>
                    <button id="btn-esc-nao" style="flex:1; padding:10px; background:#c0392b; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Não é a mais próxima</button>
                </div>
            `;
            
            console.log("📞 Chamando atualizarListaEscolasDinamicamente após renderizar HTML inicial");
            atualizarListaEscolasDinamicamente();

            const inputDist = document.getElementById('input-assistente-dist');
            setTimeout(() => { inputDist.focus(); }, 100);

            inputDist.addEventListener('focus', function() { this.select(); });
            inputDist.addEventListener('input', function() { this.dataset.editado = 'true'; });
            inputDist.addEventListener('keydown', function(e) { 
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (window.destaqueSimGlobal) document.getElementById('btn-esc-sim').click();
                    else document.getElementById('btn-esc-nao').click();
                } 
            });

            document.getElementById('btn-esc-sim').onclick = () => { 
                if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
                const dist = parseInt(inputDist.value);
                if (isNaN(dist) || dist < 0) return alert("Por favor, insira uma distância válida em metros.");
                salvarHistorico(); 
                estado.distancia = dist;
                estado.escolaProxima = true; 
                if (estado.distancia >= 1500) {
                    estado.telaFinal = { titulo: "✅ DEFERIR", mensagem: `A distância atinge o requisito mínimo (${estado.distancia}m) e os critérios da escola ou encaminhamento estão corretos.` };
                }
                renderizarPasso(); 
            };
            
            document.getElementById('btn-esc-nao').onclick = () => { 
                if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
                const dist = parseInt(inputDist.value);
                if (isNaN(dist) || dist < 0) return alert("Por favor, insira uma distância válida em metros.");
                salvarHistorico(); 
                estado.distancia = dist;
                estado.escolaProxima = false; 
                renderizarPasso(); 
            };

            let faltaCalcularInicial = listaExibirBase.some(esc => estado.distanciasOSRM[esc.id] === undefined);

            if (!estado.buscandoOSRM && typeof window.calcularTrajetoOSRM === 'function' && faltaCalcularInicial) {
                estado.buscandoOSRM = true;
                
                if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
                window.osrmAbortController = new AbortController();

                (async () => {
                    const latOrigemLista = (mapModeAtual === 'endereco' && window.dadosGeraisRota && window.dadosGeraisRota.coordAlunoEnd) ? window.dadosGeraisRota.coordAlunoEnd.lat : latAluno;
                    const lonOrigemLista = (mapModeAtual === 'endereco' && window.dadosGeraisRota && window.dadosGeraisRota.coordAlunoEnd) ? window.dadosGeraisRota.coordAlunoEnd.lon : lonAluno;

                    for (let esc of listaExibirBase) {
                        if (estado.distanciasOSRM[esc.id] === undefined) {
                            const dist = await window.calcularTrajetoOSRM(latOrigemLista, lonOrigemLista, esc.lat, esc.lon, estado.perfilOSRM, window.osrmAbortController.signal);
                            if (window.osrmAbortController.signal.aborted) break; 
                            
                            estado.distanciasOSRM[esc.id] = dist !== null ? dist : 'Erro';
                            console.log("📞 Chamando atualizarListaEscolasDinamicamente após calcular OSRM para", esc.nome);
                            atualizarListaEscolasDinamicamente();
                            await new Promise(r => setTimeout(r, 250));
                        }
                    }
                    estado.buscandoOSRM = false;
                })();
            }

            return;
        }

        if (estado.distancia < 1500 && estado.deficiencia === null) {
            let textoPergunta = "<p>O aluno ou responsável legal possui laudo médico válido comprovando <b>deficiência</b>?</p>";
            let estiloAluno = "background:#27ae60;";
            let estiloFamilia = "background:#2980b9;";

            if (sugestaoDeficienciaHtml === 'ALUNO') {
                textoPergunta = "<p style='color:#c0392b; font-weight:bold;'>⚠️ A escola informou deficiência da criança. Verifique se o laudo está ok:</p>";
                estiloAluno = "background:#27ae60; box-shadow: 0 0 12px 3px #f1c40f; border: 2px solid #f39c12; transform: scale(1.02);";
            } else if (sugestaoDeficienciaHtml === 'FAMILIA') {
                textoPergunta = "<p style='color:#c0392b; font-weight:bold;'>⚠️ A escola informou deficiência na família. Verifique se o laudo está ok:</p>";
                estiloFamilia = "background:#2980b9; box-shadow: 0 0 12px 3px #f1c40f; border: 2px solid #f39c12; transform: scale(1.02);";
            }

            conteudo.innerHTML = `
                <h3 style="color:#d35400; margin-top:0;">⚖️ Exceção: Distância Abaixo da Regra (${estado.distancia}m)</h3>
                <p>A distância aferida é <b>inferior a 1500m</b>.</p>
                ${textoPergunta}
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
                    <button id="btn-def-aluno" style="padding:10px; ${estiloAluno} color:#fff; border-radius:4px; cursor:pointer; font-weight:bold; transition:all 0.2s;">A criança tem deficiência</button>
                    <button id="btn-def-familia" style="padding:10px; ${estiloFamilia} color:#fff; border-radius:4px; cursor:pointer; font-weight:bold; transition:all 0.2s;">Pai/Mãe tem deficiência</button>
                    <button id="btn-def-nao" style="padding:10px; background:#c0392b; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Não possui deficiência</button>
                </div>
            `;
            
            document.getElementById('btn-def-aluno').onclick = () => { 
                salvarHistorico(); 
                estado.deficiencia = 'ALUNO'; 
                if (estado.escolaProxima === false) {
                    renderizarPasso();
                } else {
                    estado.telaFinal = { titulo: "✅ DEFERIR", mensagem: "Deferido por motivo de deficiência do aluno." };
                    renderizarPasso(); 
                }
            };
            document.getElementById('btn-def-familia').onclick = () => { 
                salvarHistorico(); 
                estado.deficiencia = 'FAMILIA'; 
                if (estado.escolaProxima === false) {
                    renderizarPasso();
                } else {
                    estado.telaFinal = { titulo: "✅ DEFERIR", mensagem: "Deferido por motivo de deficiência do responsável." };
                    renderizarPasso(); 
                }
            };
            document.getElementById('btn-def-nao').onclick = () => { 
                salvarHistorico(); 
                estado.deficiencia = false; 
                renderizarPasso(); 
            };
            return;
        }

        if (estado.distancia < 1500 && estado.deficiencia === false && estado.dificuldadeAcesso === null) {
            
            let ruaLimpa = endRua.split(',')[0].trim();
            const prefixos = /^(RUA|R\.|AVENIDA|AV\.|AV|TRAVESSA|TRV\.|VIELA|PRA[ÇC]A|ESTRADA|ALAMEDA|RODOVIA|LADEIRA|BECO|MARGINAL)\s+/i;
            ruaLimpa = ruaLimpa.replace(prefixos, '').trim(); 
            
            const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
            // Verifica se a basePath já termina ou contém o caminho do módulo
            const moduloPath = "modulos/transporte_escolar/";
            const prefixo = basePath.includes(moduloPath) ? "" : moduloPath;
            const urlPesquisaRua = `${basePath}${prefixo}solicitacoes_transporte_realizadas.php?endereco=${encodeURIComponent(ruaLimpa)}`;

            conteudo.innerHTML = `
                <h3 style="color:#d35400; margin-top:0;">🚧 Dificuldade de Acesso</h3>
                <p>O trajeto da residência até a escola possui <b>dificuldade de acesso excepcional</b> (barreiras físicas severas, vias intransitáveis) mapeadas?</p>
                
                <div style="text-align:center; margin-bottom:15px;">
                    <a href="${urlPesquisaRua}" target="_blank" style="display:inline-block; padding:8px 12px; background:#ecf0f1; border: 1px solid #bdc3c7; color:#2980b9; font-weight:bold; font-size:13px; text-decoration:none; border-radius:4px;">
                        <span style="font-size:16px;">🔍</span> Ver atendimentos da rua
                    </a>
                </div>

                <div style="display:flex; gap:10px;">
                    <button id="btn-dif-sim" style="flex:1; padding:10px; background:#27ae60; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Sim, há dificuldade</button>
                    <button id="btn-dif-nao" style="flex:1; padding:10px; background:#c0392b; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Não</button>
                </div>
            `;
            
            document.getElementById('btn-dif-sim').onclick = () => { 
                salvarHistorico(); 
                estado.dificuldadeAcesso = true; 
                if (estado.escolaProxima === false) {
                    renderizarPasso();
                } else {
                    estado.telaFinal = { titulo: "✅ DEFERIR", mensagem: "Deferido devido a Dificuldade de Acesso comprovada na rota." };
                    renderizarPasso(); 
                }
            };
            document.getElementById('btn-dif-nao').onclick = () => { 
                salvarHistorico(); 
                estado.dificuldadeAcesso = false; 
                estado.telaFinal = { titulo: "❌ INDEFERIR", mensagem: "A distância não atinge 1500m e o caso não se enquadra nas exceções." };
                renderizarPasso(); 
            };
            return;
        }

        const excecaoGarantida = (estado.deficiencia === 'ALUNO' || estado.deficiencia === 'FAMILIA' || estado.dificuldadeAcesso === true);
        if (estado.escolaProxima === false && (estado.distancia >= 1500 || excecaoGarantida) && estado.encaminhamentoOk === null) {
            const windowAlvo = doc.defaultView || window;
            const docHref = windowAlvo.location.href;
            const isFichaAntiga = docHref.includes('ficha_transporte.php') && !docHref.includes('nova_versao');

            let msgCopiado = "";
            const elDataNasc = doc.getElementById('data_nasc_aluno');
            if (elDataNasc) {
                const dataNasc = elDataNasc.value || elDataNasc.innerText;
                if (dataNasc) {
                    try {
                        const txt = document.createElement('textarea');
                        txt.value = dataNasc.trim();
                        document.body.appendChild(txt);
                        txt.select();
                        document.execCommand('copy');
                        document.body.removeChild(txt);
                        msgCopiado = "<div style='margin-top:10px; padding:8px; background:#d4efdf; color:#27ae60; border-radius:4px; font-size:12px; font-weight:bold; text-align:center;'>✅ Data de nascimento já copiada, basta colar no SOMARH.</div>";
                    } catch(e) {}
                }
            }

            let infoExtraHtml = "";
            if (isFichaAntiga) {
                const elNome = doc.getElementById('nome_aluno');
                const nomeStr = elNome ? (elNome.value || elNome.innerText).trim() : "Não informado";
                infoExtraHtml = `
                    <div style="background:#f9f9f9; padding:10px; border-radius:4px; margin-top:10px; font-size:12px; border:1px solid #ccc;">
                        <b>Nome:</b> ${nomeStr}<br>
                        <b>Endereço:</b> ${enderecoCompleto}<br>
                        <b>Escola Atual:</b> ${estado.nomeEscolaAtual || 'Não identificada'}
                    </div>
                `;
            }

            conteudo.innerHTML = `
                <h3 style="color:#8e44ad; margin-top:0;">🔄 Falta de Vaga / Encaminhamento</h3>
                <p>Verifique no SOMARH e nas planilhas da Central de Matrículas se ele possui um <b>encaminhamento válido</b> por falta de vaga.</p>
                <p style="font-size:12px; color:#555;"><i>(A escola matriculada e o endereço devem bater com o encaminhamento).</i></p>
                ${infoExtraHtml}
                ${msgCopiado}
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button id="btn-enc-sim" style="flex:1; padding:10px; background:#27ae60; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Sim, possui encaminhamento</button>
                    <button id="btn-enc-nao" style="flex:1; padding:10px; background:#c0392b; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Não possui</button>
                </div>
            `;
            document.getElementById('btn-enc-sim').onclick = () => { 
                salvarHistorico(); 
                estado.encaminhamentoOk = true; 
                estado.telaFinal = { titulo: "✅ DEFERIR", mensagem: `A distância atinge o requisito mínimo (${estado.distancia}m) ou possui exceção válida, e os critérios de encaminhamento estão corretos.` };
                renderizarPasso(); 
            };
            document.getElementById('btn-enc-nao').onclick = () => { 
                salvarHistorico(); 
                estado.encaminhamentoOk = false;
                estado.telaFinal = { titulo: "❌ INDEFERIR", mensagem: "O aluno não está na escola mais próxima e NÃO possui encaminhamento justificado por falta de vaga." }; 
                renderizarPasso(); 
            };
            return;
        }
    }

    renderizarPasso(); 
};
