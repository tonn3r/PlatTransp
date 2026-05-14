// --- SECTION: UTILITY FUNCTIONS ---
window.normalizarTexto = function(texto) {
    if (!texto) return "";
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/º|ª/g, "O").trim();
};

// --- SECTION: DOM TARGETING ---
// Technical comments for getAlvoDocument:
// - Iframe DOM traversal: Recursively searches through iframe contentDocuments
// - Looks for elements with IDs 'status_atendimento' or 'mostra_status_pedido'
// - Handles cross-origin access errors gracefully with try/catch
// - Returns the document containing status elements or falls back to main document
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

window.gerarEstilosAssistente = function(targetDoc) {
    targetDoc = targetDoc || document;
    if (targetDoc.getElementById('estilos-assistente-transporte')) return;
    const style = targetDoc.createElement('style');
    style.id = 'estilos-assistente-transporte';
    style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
        
        .assistente-transporte-wrapper {
            font-family: "DM Sans", verdana, sans-serif;
            line-height: 1.5;
            box-sizing: border-box;
        }
        
        .assistente-transporte-wrapper *,
        .assistente-transporte-wrapper *:before,
        .assistente-transporte-wrapper *:after {
            box-sizing: inherit;
        }
        
        .fab-assistente {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #6658d3;
            color: white;
            border: none;
            border-radius: 50px;
            padding: 12px 20px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 88, 211, 0.4);
            z-index: 99999;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: transform 0.2s, box-shadow 0.2s;
            font-family: "DM Sans", verdana, sans-serif;
        }
        .fab-assistente:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 88, 211, 0.5);
        }
        
        .modal-assistente {
            position: fixed;
            bottom: 80px;
            right: 20px;
            width: 450px;
            max-width: 90%;
            background-color: #FFF;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            border: 1px solid #e1e4e8;
            z-index: 100000;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            font-family: "DM Sans", verdana, sans-serif;
        }
        
        .modal-header {
            background-color: #2c3e50;
            color: #fff;
            padding: 15px 20px;
            font-size: 15px;
            font-weight: 700;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .modal-header-info {
            display: flex;
            align-items: center;
            gap: 10px;
            overflow: hidden;
            flex: 1;
        }
        
        .modal-header-info span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .btn-icon-transparent {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 0;
            outline: none;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.2s;
        }
        .btn-icon-transparent:hover { opacity: 0.7; }
        
        .modal-body {
            padding: 20px;
            font-size: 14px;
            color: #333;
            max-height: 70vh;
            overflow-y: auto;
        }
        
        .section-title {
            color: #2c3e50;
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 16px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .text-danger { color: #c0392b; font-weight: 700; }
        .text-warning { color: #d35400; font-weight: 700; }
        .text-success { color: #27ae60; font-weight: 700; }
        .text-info { color: #2980b9; font-weight: 700; }
        .text-primary { color: #6658d3; font-weight: 700; }
        .text-muted { color: #8597a3; }
        
        .divider {
            border: 0;
            border-top: 1px solid #e1e4e8;
            margin: 20px 0;
        }
        
        .school-list-container {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e1e4e8;
            margin-top: 10px;
            margin-bottom: 15px;
        }
        
        .school-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .school-item {
            margin-bottom: 12px;
            color: #555;
            padding-bottom: 12px;
            border-bottom: 1px dashed #e1e4e8;
        }
        .school-item:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
        }
        .school-item.selected {
            color: #27ae60;
            font-weight: 700;
        }
        
        .badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            background: #e8e5fc;
            color: #6658d3;
            font-weight: 700;
            margin-left: 4px;
            display: inline-block;
            vertical-align: middle;
        }
        
        .school-meta {
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 5px;
            margin-top: 4px;
        }
        
        .link-action {
            font-size: 11px;
            color: #6658d3;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-top: 6px;
            font-weight: 500;
        }
        .link-action:hover { text-decoration: underline; }
        
        .input-group {
            display: flex;
            flex-direction: column-reverse;
            position: relative;
            padding-top: 1.5rem;
            margin-bottom: 20px;
        }
        
        .input-label {
            color: #8597a3;
            position: absolute;
            top: 1.5rem;
            left: 0;
            transition: .25s ease;
            pointer-events: none;
            font-size: 14px;
        }
        
        .input-field {
            border: 0;
            z-index: 1;
            background-color: transparent;
            border-bottom: 2px solid #e1e4e8; 
            font: inherit;
            font-size: 16px;
            padding: .25rem 0;
            color: #333;
            width: 100%;
        }
        
        .input-field:focus, 
        .input-field:valid {
            outline: 0;
            border-bottom-color: #6658d3;
        }
        
        .input-field:focus + .input-label, 
        .input-field:valid + .input-label {
            color: #6658d3;
            transform: translateY(-1.5rem);
            font-size: 12px;
            font-weight: 700;
        }
        
        .action-group { display: flex; gap: 10px; }
        .action-group-col { display: flex; flex-direction: column; gap: 10px; }
        
        .btn {
            font-family: inherit;
            font-size: 14px;
            padding: 12px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-weight: 700;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            text-decoration: none;
            box-sizing: border-box;
        }
        
        .btn:focus { outline: none; }
        
        .btn-primary { background-color: #6658d3; color: white; }
        .btn-primary:hover { background-color: #5548c8; }
        .btn-success { background-color: #27ae60; color: white; }
        .btn-info { background-color: #2980b9; color: white; }
        .btn-danger { background-color: #c0392b; color: white; }
        .btn-warning { background-color: #d35400; color: white; }
        .btn-outline { background-color: #f1f3fb; color: #2c3e50; border: 1px solid #d1d5db; }
        .btn-outline:hover { background-color: #e2e6f3; }
        
        .btn.destaque { flex: 1.3; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .btn.dimmed { flex: 0.7; background-color: #e1e4e8; color: #8597a3; opacity: 0.8; }
        
        .toggle-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            cursor: pointer;
            border: 1px solid #d1d5db;
            background-color: #f8f9fa;
            color: #2c3e50;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            font-family: "DM Sans", verdana, sans-serif;
            transition: all 0.2s;
        }
        .toggle-btn:hover {
            background-color: #e2e6f3;
            border-color: #6658d3;
        }
        .toggle-btn.active {
            background-color: #e8e5fc;
            color: #6658d3;
            border-color: #6658d3;
        }
        
        .message-box {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #e1e4e8;
            margin-bottom: 0;
            text-align: left;
            font-size: 15px;
        }
        .message-box.danger { border-left-color: #c0392b; }
        .message-box.success { border-left-color: #27ae60; }
        .message-box.warning { border-left-color: #f39c12; }
    `;
    targetDoc.head.appendChild(style);
};

// --- SECTION: ASSISTENTE INITIALIZATION ---
window.gerenciarBotaoAssistente = function() {
    if (window !== window.top) return;

    const doc = window.getAlvoDocument(); 
    const statusDiv = doc.getElementById('status_atendimento') || doc.getElementById('mostra_status_pedido');
    
    const currentIdInput = doc.querySelector('input[name="id_solicitacao"]') || doc.querySelector('input[name="id"]');
    const currentId = currentIdInput ? currentIdInput.value : 'desconhecido';

    window.gerarEstilosAssistente(document);

    if (window.currentStudentId !== currentId) {
        window.currentStudentId = currentId;
        window.mapaSincronizado = false;
        if (typeof window.setSharedStore === 'function') {
            window.setSharedStore({
                dadosGeograficos: null,
                dadosGeraisRota: null,
                distanciaCoord: null,
                distanciaEnd: null,
                DistDiferentesEntreMapas: false
            });
        }
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

    if (!window.mapaSincronizado && typeof window.sincronizarMapaECoordenadas === 'function') {
        window.mapaSincronizado = true;
        window.sincronizarMapaECoordenadas(doc).catch(e => { window.mapaSincronizado = false; console.error(e); });
    }

    const paginacao = document.getElementById('barra-paginacao-flutuante');
    if (paginacao) paginacao.style.zIndex = "900";

    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'btn-assistente-transporte';
        btn.className = 'fab-assistente assistente-transporte-wrapper';
        btn.innerHTML = `<span class="mdi mdi-lightning-bolt" style="font-size: 18px; margin-right: 4px;"></span> Assistente de Análise`;
        
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

// Cache Utilities Persistentes
window.getCacheAssistente = function(id) {
    try {
        let cache = JSON.parse(localStorage.getItem('plattransp_assistente_cache') || '[]');
        return cache.find(c => String(c.idSolicitacao) === String(id));
    } catch(e) { return null; }
};
window.setCacheAssistente = function(id, dados) {
    if (!id) return;
    try {
        let cache = JSON.parse(localStorage.getItem('plattransp_assistente_cache') || '[]');
        cache = cache.filter(c => String(c.idSolicitacao) !== String(id));
        cache.unshift({ idSolicitacao: String(id), ...dados });
        if (cache.length > 3) cache.pop(); // Mantém apenas os 3 últimos
        localStorage.setItem('plattransp_assistente_cache', JSON.stringify(cache));
    } catch(e) {}
};

window.abrirModalAssistente = async function() {
    if (window.abrindoModalAssistente) return;
    window.abrindoModalAssistente = true;
    
    const doc = window.getAlvoDocument();
    console.log('[ASSISTENTE] abrirModalAssistente');
    
    // Remover modal anterior se existir para evitar duplicação
    const modalAnterior = document.getElementById('modal-assistente-analise');
    if (modalAnterior && modalAnterior.parentNode) {
        modalAnterior.parentNode.removeChild(modalAnterior);
    }
    
    const idSolicitacaoAtual = doc.querySelector('input[name="id_solicitacao"]')?.value || doc.querySelector('input[name="id"]')?.value || '';
    
    console.log('[ASSISTENTE] Lendo dados de ruas.js...');
    let ruasDB = window.ruasData || [];
    if (ruasDB.length === 0) {
        console.warn('[ASSISTENTE] window.ruasData está vazio ou ruas.js não foi carregado corretamente.');
    } else {
        console.log('[ASSISTENTE] Dados de ruas.js carregados com sucesso. Total:', ruasDB.length);
    }

    let cacheSalvo = window.getCacheAssistente(idSolicitacaoAtual);
    if (cacheSalvo && cacheSalvo.ultimoModo) {
        const parts = cacheSalvo.ultimoModo.split('_');
        if (parts.length === 2 && typeof window.setSharedStoreValue === 'function') {
            window.setSharedStoreValue('modoMapaAtual', parts[0]);
            window.setSharedStoreValue('modoTransporteAtual', parts[1]);
        }
    }
    
    if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();

    let isMudanca = false;
    const statusDiv = doc.getElementById('status_atendimento') || doc.getElementById('mostra_status_pedido');
    
    if (statusDiv) {
        const textoStatus = statusDiv.innerText.toUpperCase();
        if (textoStatus.includes('MUDANÇA') || textoStatus.includes('MUDANCA')) {
            isMudanca = true;
        }
    }

    // --- SECTION: UNIFIED STATUS & TOGGLE LOGIC ---
    // Set global MODO_PADRAO based on status
    if (isMudanca) {
        window.MODO_PADRAO = "Endereço"; // "EM ANÁLISE (MUDANÇA)" -> "Endereço"
    } else {
        window.MODO_PADRAO = "Coordenada"; // "EM ANÁLISE" -> "Coordenada"
    }
    // Fallback if status not detected
    if (!window.MODO_PADRAO) window.MODO_PADRAO = "Endereço";

    const endRua = doc.getElementById('endereco') ? (doc.getElementById('endereco').value || doc.getElementById('endereco').innerText) : '';
    const endNum = doc.getElementById('endereco_numero_residencia') ? (doc.getElementById('endereco_numero_residencia').value || doc.getElementById('endereco_numero_residencia').innerText) : '';
    const endBairro = doc.getElementById('endereco_bairro') ? (doc.getElementById('endereco_bairro').value || doc.getElementById('endereco_bairro').innerText) : '';
    const enderecoCompleto = [endRua, endNum, endBairro].filter(Boolean).join(", "); 

    const idUnidadeEl = doc.querySelector('input[name="id_unidade"]') || doc.querySelector('#id_unidade');
    const idUnidade = idUnidadeEl ? idUnidadeEl.value : "";
    const cepEl = doc.querySelector('input[name="cep"]') || doc.querySelector('#cep') || doc.querySelector('#endereco_cep');
    const cepVal = cepEl ? cepEl.value.replace(/\D/g, '') : "";
    
    const endRuaNorm = window.normalizarTexto(endRua.split(',')[0]);
    const endBairroNorm = window.normalizarTexto(endBairro);
    
    let ruaMatch = null;
    if (ruasDB && ruasDB.length > 0) {
        console.log(`[ASSISTENTE] Procurando match para idUnidade=${idUnidade}, CEP=${cepVal}, Rua=${endRuaNorm}, Bairro=${endBairroNorm}`);
        ruaMatch = ruasDB.find(r => {
            const rCep = r.cep ? r.cep.replace(/\D/g, '') : '';
            if (r.id_unidade == idUnidade && rCep && cepVal && rCep === cepVal) {
                console.log('[ASSISTENTE] Match encontrado por CEP!', r);
                return true;
            }
            if (r.id_unidade == idUnidade && window.normalizarTexto(r.logradouro) === endRuaNorm && window.normalizarTexto(r.bairro) === endBairroNorm) {
                console.log('[ASSISTENTE] Match encontrado por Logradouro + Bairro!', r);
                return true;
            }
            return false;
        });
        if (!ruaMatch) console.log('[ASSISTENTE] Nenhum match encontrado no ruas.js para esta solicitação.');
    }

    const textoStatusParaAnalise = statusDiv ? statusDiv.innerText.toUpperCase() : '';
    const ehAnaliseInicial = textoStatusParaAnalise.includes('EM ANÁLISE') || 
                             textoStatusParaAnalise.includes('EM ANALISE') || 
                             textoStatusParaAnalise.includes('AGUARDANDO ANÁLISE') || 
                             textoStatusParaAnalise.includes('AGUARDANDO ANALISE');

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
    modal.className = 'modal-assistente assistente-transporte-wrapper';
    
    modal.innerHTML = `
        <div class="modal-header">
            <div class="modal-header-info">
                <button id="btn-voltar-assistente" class="btn-icon-transparent" style="display:none;" title="Voltar ao passo anterior">
                    <span class="mdi mdi-keyboard-backspace" style="font-size: 18px;"></span>
                </button>
                <span><span class="mdi mdi-map-marker" style="font-size: 16px; margin-right: 4px;"></span> ${nomeRuaTitulo}</span>
            </div>
            <button id="btn-fechar-assistente" class="btn-icon-transparent" style="font-size: 24px;" title="Fechar"><span class="mdi mdi-close" style="font-size: 22px;"></span></button>
        </div>
        <div id="conteudo-assistente" class="modal-body">
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
        ehAnalise: ehAnaliseInicial,
        mudancaOk: null,
        escolaProximaUser: null,
        escolaProximaCalc: null,
        encaminhamentoOk: null,
        isEncaminhamentoDispensado: false,
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
        cacheDistancias: cacheSalvo ? (cacheSalvo.distancias || {}) : {},
        listaEscolasPorModo: cacheSalvo ? (cacheSalvo.listas || {}) : {},
        ultimoModoUsado: cacheSalvo ? cacheSalvo.ultimoModo : null,
        listaEscolas: [],
        ruaMatch: ruaMatch,
        confirmacaoFeita: false,
        ehMaisProximaParcial: false,
        isEspecial: false,
        areaRuralProcessada: false,
        areaRuralEsperaDeficiencia: false,
        deficienciaEspecialProcessada: false
    };
    
    function persistirEstado() {
        let distanciasLimpas = {};
        if (estado.cacheDistancias) {
            for (let modo in estado.cacheDistancias) {
                distanciasLimpas[modo] = {};
                for (let escId in estado.cacheDistancias[modo]) {
                    if (estado.cacheDistancias[modo][escId] !== 'Erro' && estado.cacheDistancias[modo][escId] !== null) {
                        distanciasLimpas[modo][escId] = estado.cacheDistancias[modo][escId];
                    }
                }
            }
        }
        window.setCacheAssistente(idSolicitacaoAtual, {
            distancias: distanciasLimpas,
            listas: estado.listaEscolasPorModo,
            ultimoModo: estado.ultimoModoUsado
        });
    }

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

    // --- SECTION: ASSISTENTE STEP RENDERING ---
    async function renderizarPasso() {
        console.log('[ASSISTENTE] renderizarPasso chamado');
        const conteudo = document.getElementById('conteudo-assistente');
        if (!conteudo) return; 
        
        const btnVoltar = document.getElementById('btn-voltar-assistente');
        if (btnVoltar) {
            btnVoltar.style.display = historico.length > 0 ? 'flex' : 'none';
            btnVoltar.onclick = voltarPasso;
        }

        if (estado.telaFinal) {
            if (isMudanca && estado.mudancaOk === null && !estado.telaFinal.titulo.includes('INDEFERIR')) {
                conteudo.innerHTML = `
                    <h3 class="section-title text-warning">
                        <span class="mdi mdi-map-search" style="font-size: 22px; margin-right: 6px;"></span> Mudança de Endereço
                    </h3>
                    <p>Verifique se o comprovante de endereço está OK, e se ele contém os seguintes dados compatíveis com a ficha:</p>
                    <div class="school-list-container">
                        <ul class="school-list">
                            <li class="school-item"><b>Endereço:</b> ${enderecoCompleto}</li>
                            <li class="school-item" style="border-bottom:none; padding-bottom:0; margin-bottom:0;"><b>Responsável(eis):</b> ${nomesResponsaveis}</li>
                        </ul>
                    </div>
                    <div class="action-group">
                        <button id="btn-mudanca-sim" class="btn btn-success"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Sim, comprovante OK</button>
                        <button id="btn-mudanca-nao" class="btn btn-danger"><span class="mdi mdi-close" style="font-size: 16px; margin-right: 4px;"></span> Não, inválido/ausente</button>
                    </div>
                `;
                document.getElementById('btn-mudanca-sim').onclick = () => { salvarHistorico(); estado.mudancaOk = true; renderizarPasso(); };
                document.getElementById('btn-mudanca-nao').onclick = () => { salvarHistorico(); estado.mudancaOk = false; estado.telaFinal = { titulo: "INDEFERIR", mensagem: "O comprovante de endereço é inválido ou está ausente no caso de mudança." }; renderizarPasso(); };
                return;
            }

            if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();

            const titulo = estado.telaFinal.titulo;
            const mensagem = estado.telaFinal.mensagem;
            const tipoAcao = titulo.includes('INDEFERIR') ? 'INDEFERIR' : 'DEFERIR';
            const corTitulo = tipoAcao === 'DEFERIR' ? '#27ae60' : '#c0392b';

            let termoBusca = "";
            let textoDetalhes = "";

            if (tipoAcao === 'DEFERIR' && estado.encaminhamentoOk === true) {
                textoDetalhes = "encaminhado";
            }

            if (tipoAcao === 'DEFERIR' && estado.ehMaisProximaParcial === true) {
                if (textoDetalhes) {
                    textoDetalhes += " / Está na parcial mais próxima";
                } else {
                    textoDetalhes = "Está na parcial mais próxima";
                }
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
                    <h2 style="color:${corTitulo}; margin-top:0; font-size:24px; display:flex; align-items:center; justify-content:center; gap:8px;">
                        <span class="mdi ${tipoAcao === 'DEFERIR' ? 'mdi-check' : 'mdi-close'}" style="font-size: 28px;"></span>
                        ${titulo}
                    </h2>
                    <div class="message-box ${tipoAcao === 'DEFERIR' ? 'success' : 'danger'}">
                        ${mensagem}
                        ${termoBusca ? `<br><br><b>Opção no Sistema:</b> ${termoBusca}` : ''}
                        ${textoDetalhes ? `<br><span class="text-warning" style="font-size:12px; display:inline-block; margin-top:5px;"><span class="mdi mdi-script-outline" style="font-size: 14px; margin-right: 4px;"></span> Obs: Anotar "Encaminhado" nos detalhes da análise</span>` : ''}
                    </div>
                </div>
                <div class="action-group-col" style="margin-top:20px;">
                    <button id="btn-aplicar-resultado" class="btn ${tipoAcao === 'DEFERIR' ? 'btn-success' : 'btn-danger'}">
                        <span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Finalizar
                    </button>
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
                    if (tipoAcao === 'INDEFERIR') {
                        const selectMotivo = docFinal.querySelector('select[name="status_motivo"], #status_motivo');
                        if (!selectMotivo || selectMotivo.type === 'hidden' || window.getComputedStyle(selectMotivo).display === 'none') {
                            const motivoIndef = termoBusca || estado.telaFinal.mensagem;
                            if (!textoDetalhes || textoDetalhes === "encaminhado") {
                                textoDetalhes = motivoIndef;
                            } else if (!textoDetalhes.includes(motivoIndef)) {
                                textoDetalhes = motivoIndef + " - " + textoDetalhes;
                            }
                        }
                    }
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
                        if (docFinal.getElementById("modal_Deferir")) windowFinal.ShowModal("modal_Deferir");
                    } else {
                        if (docFinal.getElementById("modal_Indeferir")) windowFinal.ShowModal("modal_Indeferir");
                    }
                }
            };
            return;
        }

        if (estado.ruaMatch && estado.ruaMatch.resultado_motivo === "ÁREA RURAL" && !estado.areaRuralProcessada) {
            if ((sugestaoDeficienciaHtml === 'ALUNO' || sugestaoDeficienciaHtml === 'FAMILIA') && estado.deficiencia === null) {
                estado.areaRuralEsperaDeficiencia = true;
            } else {
                estado.areaRuralProcessada = true;
                if (estado.deficiencia === 'ALUNO') {
                    estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por motivo de deficiência do aluno.", termoBusca: "ALUNO DEFICIENTE", textoDetalhes: "ALUNO DEFICIENTE" };
                } else if (estado.deficiencia === 'FAMILIA') {
                    estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por motivo de deficiência do responsável.", termoBusca: "PAI/MÃE DEFICIENTE", textoDetalhes: "PAI/MÃE DEFICIENTE" };
                } else {
                    estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por ser ÁREA RURAL.", termoBusca: "ÁREA RURAL", textoDetalhes: "ÁREA RURAL" };
                }
                return renderizarPasso();
            }
        }

        if (estado.areaRuralEsperaDeficiencia && estado.deficiencia === null) {
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
                <h3 class="section-title text-warning">
                    <span class="mdi mdi-wheelchair-accessibility" style="font-size: 22px; margin-right: 6px;"></span> Exceção: Área Rural e Deficiência
                </h3>
                ${textoPergunta}
                <div class="action-group-col" style="margin-top:20px;">
                    <button id="btn-def-aluno" class="btn btn-success" style="${estiloAluno}">A criança tem deficiência</button>
                    <button id="btn-def-familia" class="btn btn-info" style="${estiloFamilia}">Pai/Mãe tem deficiência</button>
                    <button id="btn-def-nao" class="btn btn-danger">Não possui deficiência</button>
                </div>
            `;
            
            document.getElementById('btn-def-aluno').onclick = () => { 
                salvarHistorico(); estado.deficiencia = 'ALUNO'; renderizarPasso(); 
            };
            document.getElementById('btn-def-familia').onclick = () => { 
                salvarHistorico(); estado.deficiencia = 'FAMILIA'; renderizarPasso(); 
            };
            document.getElementById('btn-def-nao').onclick = () => { 
                salvarHistorico(); estado.deficiencia = false; renderizarPasso(); 
            };
            return;
        }

        if (estado.escolaProximaUser === null) {

            let dadosGeograficos = window.getSharedStoreValue?.('dadosGeograficos');

            if (dadosGeograficos && dadosGeograficos.erro && !estado.tentouResgate) {
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
                        window.setSharedStoreValue('dadosGeograficos', {
                            erro: false,
                            urlMaps: urlCompleta,
                            geoEndereco_Latit: coordOrigin.lat,
                            geoEndereco_Longit: coordOrigin.lon,
                            geoEscola_Latit: coordDest.lat,
                            geoEscola_Longit: coordDest.lon
                        });
                        renderizarPasso();
                        return;
                    }
                }

                const idSolInput = doc.querySelector('input[name="id_solicitacao"]') || doc.querySelector('input[name="id"]');
                if (idSolInput && idSolInput.value) {
                    if (typeof window.setSharedStore === 'function') {
                        window.setSharedStore({ dadosGeograficos: null });
                    }
                    const windowAlvo = doc.defaultView || window;
                    const baseUrlAberta = windowAlvo.location.href.split('?')[0];
                    const urlFallback = baseUrlAberta.replace('ficha_transporte.php', 'ficha_transporte_nova_versao.php') + '?id_solicitacao=' + idSolInput.value;

                    if (typeof window.extrairDadosGeograficos === 'function') {
                        window.extrairDadosGeograficos(urlFallback).then(dados => {
                            window.setSharedStoreValue('dadosGeograficos', dados ? dados : { erro: true });
                            renderizarPasso(); 
                        });
                        return;
                    }
                }
            }

            const campoDistExistente = doc.querySelector('input[name="distancia_aferida"], #distancia_aferida');

            // Definir estado.distanciaSugeridaInput baseado no modo atual
            const rota = window.getSharedStoreValue?.('dadosGeraisRota');
            let mapMode = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';

            let distValue = mapMode === 'endereco' ? rota?.distanciaEnd : rota?.distanciaCoord;

            // Fallbacks cruzados
            if (distValue == null) {
                distValue = mapMode === 'endereco' ? rota?.distanciaCoord : rota?.distanciaEnd;
            }

            // Só usar campoDistExistente se ambos inválidos
            if (distValue == null && campoDistExistente && campoDistExistente.value) {
                distValue = parseInt(campoDistExistente.value) || null;
            }

            estado.distanciaSugeridaInput = distValue || "";
            
            const falhouCalculo = dadosGeograficos && 
                                  (dadosGeograficos.erro || (!dadosGeograficos.geoEndereco_Latit && estado.tentouResgate));

            if (falhouCalculo) {
                if (!estado.ehAnalise) {
                    conteudo.innerHTML = `
                        <h3 class="section-title text-info">
                            <span class="mdi mdi-graph" style="font-size: 22px; margin-right: 6px;"></span> Modo Leitura
                        </h3>
                        <p class="text-danger">Erro ao calcular mapa. Não é possível exibir as escolas próximas.</p>
                    `;
                    return;
                }

                let latA = dadosGeograficos ? dadosGeograficos.geoEndereco_Latit : null;
                let lonA = dadosGeograficos ? dadosGeograficos.geoEndereco_Longit : null;
                let linkBotaoErro = (latA && lonA) 
                    ? `https://maps.google.com/maps?saddr=${latA}+${lonA}&daddr=0+0&travelmode=walking&dirflg=w` //nao alterar
                    : `https://maps.google.com/maps?saddr=$`; //nao alterar

                conteudo.innerHTML = `
                    <h3 class="section-title text-info">
                        <span class="mdi mdi-graph" style="font-size: 22px; margin-right: 6px;"></span> Verificação de Escola
                    </h3>
                    <p class="text-danger">Verifique se está na escola mais próxima.</p>
                    <div style="margin-bottom: 15px;">
                        <a href="${linkBotaoErro}" target="_blank" onclick="if(window.copiarCoordenadasEndereco) window.copiarCoordenadasEndereco();" class="btn btn-outline" style="text-decoration:none;">
                            <span class="mdi mdi-map" style="font-size: 16px; margin-right: 4px;"></span> Conferir mapa da rede
                        </a>
                    </div>
                    
                    <hr class="divider">
                    <h3 class="section-title text-warning">
                        <span class="mdi mdi-map-marker-radius-outline" style="font-size: 22px; margin-right: 6px;"></span> Aferição de Distância
                    </h3>
                    <div class="input-group">
                        <input type="number" id="input-assistente-dist" class="input-field" value="${estado.distanciaSugeridaInput}" required>
                        <label for="input-assistente-dist" class="input-label">Qual é a distância aferida (em metros)?</label>
                    </div>

                    <div class="action-group">
                        <button id="btn-esc-sim" class="btn btn-success"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Está na mais próxima</button>
                        <button id="btn-esc-nao" class="btn btn-danger"><span class="mdi mdi-close" style="font-size: 16px; margin-right: 4px;"></span> Não é a mais próxima</button>
                    </div>
                `;
                
                const inputDist =
    document.getElementById(
        'input-assistente-dist'
    );

if (inputDist) {

    setTimeout(() => {
        inputDist.focus();
    }, 100);

    inputDist.addEventListener(
        'focus',
        function () {
            this.select();
        }
    );

    inputDist.addEventListener(
        'input',
        function () {
            this.dataset.editado = 'true';
        }
    );

    inputDist.addEventListener(
        'keydown',
        function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        }
    );

    const rota = window.getSharedStoreValue?.('dadosGeraisRota') || window.dadosGeraisRota;
    const modoMapa = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';

    if (rota) {
        const distancia = modoMapa === 'endereco' ? rota.distanciaEnd : rota.distanciaCoord;
        atualizarInputDistancia(distancia);
    }
}

                document.getElementById('btn-esc-sim').onclick = () => { 
                    const dist = parseInt(inputDist.value);
                    if (isNaN(dist) || dist < 0) return alert("Por favor, insira uma distância válida em metros.");
                    salvarHistorico(); 
                    estado.distancia = dist;
                    estado.escolaProximaUser = true; 
                    if (estado.distancia >= 1500) {
                        estado.telaFinal = { titulo: "DEFERIR", mensagem: `A distância atinge o requisito mínimo (${estado.distancia}m) e os critérios da escola ou encaminhamento estão corretos.` };
                    }
                    renderizarPasso(); 
                };
                
                document.getElementById('btn-esc-nao').onclick = () => { 
                    const dist = parseInt(inputDist.value);
                    if (isNaN(dist) || dist < 0) return alert("Por favor, insira uma distância válida em metros.");
                    salvarHistorico(); 
                    estado.distancia = dist;
                    estado.escolaProximaUser = false; 
                    renderizarPasso(); 
                };
                return;
            }

            dadosGeograficos = window.getSharedStoreValue?.('dadosGeograficos');
            if (!dadosGeograficos || !dadosGeograficos.geoEndereco_Latit) {
                conteudo.innerHTML = `<div style="text-align:center; padding:20px;" class="text-info"><span class="mdi mdi-refresh" style="font-size: 22px; margin-right: 6px;"></span> <b>A calcular mapa e coordenadas da rede...</b></div>`;
                setTimeout(renderizarPasso, 500); 
                return;
            }

            const latAluno = dadosGeograficos.geoEndereco_Latit;
            const lonAluno = dadosGeograficos.geoEndereco_Longit;
            
            let idEscolaAtual = "";
            let nomeEscolaAtualStr = "Não identificada";
            const inputIdEscola = document.querySelector('input[name="id_unidade"]') || doc.querySelector('input[name="id_unidade"]');
            
            if (inputIdEscola) {
                // --- IDENTIFICAÇÃO PARA ficha_transporte.php ---
                idEscolaAtual = inputIdEscola.value.trim();
                if (window.escolasDB) {
                    const escFound = window.escolasDB.find(e => String(e.id) === String(idEscolaAtual));
                    if (escFound) nomeEscolaAtualStr = escFound.nome;
                }
            } else {
                // --- FALLBACK PARA ficha_transporte_nova_versao.php ---
                // Procurar spans com Latitude e Longitude para identificar escola
                const spans = doc.querySelectorAll('span');
                let latEscola = null;
                let lonEscola = null;
                let nomeEscolaParseado = "";
                
                for (let span of spans) {
                    const texto = span.innerText || span.textContent;
                    
                    if (!latEscola && (texto.includes('Latitude:') || texto.includes('Longitude:'))) {
                        const matchLat = texto.match(/Latitude:\s*([-\d.]+)/);
                        const matchLon = texto.match(/Longitude:\s*([-\d.]+)/);
                        if (matchLat) latEscola = parseFloat(matchLat[1]);
                        if (matchLon) lonEscola = parseFloat(matchLon[1]);
                    }
                    if (!nomeEscolaParseado && span.style.fontSize === '20px' && span.style.fontWeight === 'bold') {
                        nomeEscolaParseado = texto.trim();
                    }
                }
                
                if (latEscola && lonEscola && window.escolasDB) {
                    // Comparar coordenadas com base de dados
                    const escolaPorCoord = window.escolasDB.find(esc => {
                        const dist = window.calcularDistanciaHaversine(latEscola, lonEscola, esc.lat, esc.lon);
                        return dist < 100; // Tolerância de 100m
                    });
                    
                    if (escolaPorCoord) {
                        idEscolaAtual = escolaPorCoord.id;
                        nomeEscolaAtualStr = escolaPorCoord.nome;
                    } else if (nomeEscolaParseado && window.escolasDB) {
                        // Fallback por nome
                        const nomeNorm = window.normalizarTexto(nomeEscolaParseado).replace('EMEB', '').replace(',', '').trim();
                        const escolaPorNome = window.escolasDB.find(e => {
                            const nomeBanco = window.normalizarTexto(e.nome).replace('EMEB', '').replace(',', '').trim();
                            return nomeBanco.includes(nomeNorm) || nomeNorm.includes(nomeBanco);
                        });
                        if (escolaPorNome) {
                            idEscolaAtual = escolaPorNome.id;
                            nomeEscolaAtualStr = escolaPorNome.nome;
                        }
                    }
                }
            }
            estado.nomeEscolaAtual = nomeEscolaAtualStr;

            const baseEscolas = window.escolasDB || [];
            let escolaSelecionada = baseEscolas.find(e => String(e.id) === String(idEscolaAtual));

            if (escolaSelecionada && !estado.distanciasVerificadasInicialmente) {
                estado.distanciasVerificadasInicialmente = true;
                if (!window.getSharedStoreValue?.('dadosGeraisRota')) {
                    conteudo.innerHTML = `<div style="text-align:center; padding:20px;" class="text-info"><span class="mdi mdi-refresh" style="font-size: 22px; margin-right: 6px;"></span> <b>Calculando escolas mais próximas do endereço...</b></div>`;
                    setTimeout(renderizarPasso, 500);
                    return;
                }
                const transporteAtual = window.getSharedStoreValue?.('modoTransporteAtual') || 'pe';
                estado.perfilOSRM = transporteAtual === 'carro' ? 'driving' : 'foot';
            }

            mapMode = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';

            let nivelAlunoOriginal = "";
            
            const tds = doc.querySelectorAll('td.etiqueta');
            for (let td of tds) {
                if (td.innerText.trim() === 'Nível') {
                    const tr = td.parentElement;
                    const nextTr = tr.nextElementSibling;
                    if (nextTr) {
                        const tdValor = nextTr.querySelector('td.texto_dados');
                        if (tdValor) {
                            nivelAlunoOriginal = tdValor.innerText.trim();
                            break;
                        }
                    }
                }
            }

            if (!nivelAlunoOriginal) {
                const spans16 = doc.querySelectorAll('span[style*="font-size: 16px"][style*="font-weight: bold"]');
                spans16.forEach(span => {
                    const texto = span.innerText.trim().toUpperCase();
                    if (texto !== "INTEGRAL" && texto !== "PARCIAL" && texto !== "NOITE" && texto !== "") {
                        nivelAlunoOriginal = texto;
                    }
                });
            }

            let valorSelect = "";
            const selectNivel = document.getElementById('nivel') || doc.getElementById('nivel');
            if (selectNivel && selectNivel.options[selectNivel.selectedIndex]) {
                valorSelect = selectNivel.options[selectNivel.selectedIndex].text || selectNivel.value;
                if (!nivelAlunoOriginal) nivelAlunoOriginal = valorSelect;
            }

            if (!nivelAlunoOriginal || (nivelAlunoOriginal.includes("BERCARIO") && valorSelect === "BERCARIO INICIAL")) {
                let dataNascStr = "";
                const elDataNasc = doc.getElementById('data_nasc_aluno');
                if (elDataNasc) dataNascStr = elDataNasc.value || elDataNasc.innerText;
                if (!dataNascStr) {
                     const tdsData = doc.querySelectorAll('td.etiqueta');
                     for (let td of tdsData) {
                         if (td.innerText.trim() === 'Data de nascimento') {
                             const tr = td.parentElement;
                             const nextTr = tr.nextElementSibling;
                             if (nextTr) {
                                 const idx = Array.from(tr.children).indexOf(td);
                                 const tdValor = nextTr.children[idx];
                                 if (tdValor) dataNascStr = tdValor.innerText.trim();
                             }
                         }
                     }
                }
                if (dataNascStr) {
                    const parts = dataNascStr.split('/');
                    if (parts.length === 3) {
                        const nasc = new Date(parts[2], parts[1] - 1, parts[0]);
                        const hoje = new Date();
                        let idade = hoje.getFullYear() - nasc.getFullYear();
                        const m = hoje.getMonth() - nasc.getMonth();
                        if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
                        
                        const faixasEtarias = [
                            { nivel: "EJA", idade: 14, idadeMaxima: 110 }, { nivel: "5º ANO", idade: 10, idadeMaxima: 13 }, { nivel: "4º ANO", idade: 9, idadeMaxima: 10 }, { nivel: "3º ANO", idade: 8, idadeMaxima: 9 }, { nivel: "2º ANO", idade: 7, idadeMaxima: 8 }, { nivel: "1º ANO", idade: 6, idadeMaxima: 7 }, { nivel: "INFANTIL V", idade: 5, idadeMaxima: 6 }, { nivel: "INFANTIL IV", idade: 4, idadeMaxima: 5 }, { nivel: "INFANTIL III", idade: 3, idadeMaxima: 4 }, { nivel: "INFANTIL II", idade: 2, idadeMaxima: 3 }, { nivel: "INFANTIL I", idade: 1, idadeMaxima: 2 }, { nivel: "BERÇÁRIO FINAL", idade: 1, idadeMaxima: 1 }, { nivel: "BERÇÁRIO INICIAL", idade: 0, idadeMaxima: 1 }
                        ];
                        
                        const faixaEncontrada = faixasEtarias.find(f => idade >= f.idade && idade <= f.idadeMaxima);
                        if (faixaEncontrada) {
                            if (!nivelAlunoOriginal || (nivelAlunoOriginal.includes("BERCARIO") && idade > 1)) {
                                nivelAlunoOriginal = faixaEncontrada.nivel;
                            }
                        }
                    }
                }
            }
            
            let nivelAlunoNorm = window.normalizarTexto(nivelAlunoOriginal);
            nivelAlunoNorm = nivelAlunoNorm.replace(/([0-9]+)\s*[Oº\.]\s*ANO/g, "$1O ANO");
            if (nivelAlunoNorm.includes("EJA")) nivelAlunoNorm = "EJA";
            if (nivelAlunoNorm.includes("ESPECIAL")) nivelAlunoNorm = "ESPECIAL";

            const isBercarioGeral = nivelAlunoNorm.includes("BERCARIO") && nivelAlunoNorm !== "BERCARIO INICIAL" && nivelAlunoNorm !== "BERCARIO FINAL";

            let escolaAtualTemEspecial = false;
            if (escolaSelecionada && escolaSelecionada.turmas) {
                escolaAtualTemEspecial = escolaSelecionada.turmas.some(t => window.normalizarTexto(t.nivel).includes("ESPECIAL"));
            }
            estado.isEspecial = nivelAlunoNorm === "ESPECIAL" || escolaAtualTemEspecial;

            const escolasAptas = baseEscolas.filter(esc => {
                if (!esc.turmas || !Array.isArray(esc.turmas)) return false;
                const turmasNivel = esc.turmas.filter(turma => {
                    const nivelTurmaNorm = window.normalizarTexto(turma.nivel);
                    if (isBercarioGeral) {
                        return nivelTurmaNorm.includes("BERCARIO");
                    }
                    if (nivelAlunoNorm === "ESPECIAL" && nivelTurmaNorm.includes("ESPECIAL")) return true; 
                    if (nivelAlunoNorm === "EJA" && nivelTurmaNorm.includes("EJA")) return true;
                    return nivelTurmaNorm === nivelAlunoNorm;
                });
                
                if (turmasNivel.length > 0) {
                    esc.periodosEncontrados = [...new Set(turmasNivel.map(t => t.periodo))].join(' / ');
                    return true;
                }
                return false;
            });

            // Função para gerar a lista atualizada baseada na origem correta (GPS ou Nominatim)
            function obterEscolasAptasExibicao(modo) {
                let latBase = latAluno;
                let lonBase = lonAluno;
                if (modo === 'endereco') {
                    let rota = window.getSharedStoreValue?.('dadosGeraisRota') || window.dadosGeraisRota;
                    if (rota && rota.coordAlunoEnd && rota.coordAlunoEnd.lat) {
                        latBase = rota.coordAlunoEnd.lat;
                        lonBase = rota.coordAlunoEnd.lon;
                    }
                }
                
                // Cópia para não sobrescrever distância Haversine nos objetos fixos
                let listaCopia = JSON.parse(JSON.stringify(escolasAptas));

                listaCopia.forEach(esc => {
                    esc.distancia = window.calcularDistanciaHaversine(latBase, lonBase, esc.lat, esc.lon);
                });

                listaCopia.sort((a, b) => a.distancia - b.distancia);
                
                let indexAtual = listaCopia.findIndex(e => String(e.id) === String(idEscolaAtual));
                let indexParcial = listaCopia.findIndex(e => e.periodosEncontrados && e.periodosEncontrados.includes('PARCIAL'));
                let indexIntegral = listaCopia.findIndex(e => e.periodosEncontrados && e.periodosEncontrados.includes('INTEGRAL'));
                
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
                
                return listaCopia.slice(0, limiteFinal);
            }

            // Definir variáveis de modo em escopo mais amplo para uso em atualizarListaEscolasDinamicamente e OSRM
            let mapModeAtual = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
            let transpModeAtual = window.getSharedStoreValue?.('modoTransporteAtual') || 'pe';

            // --- SECTION: SCHOOL LIST MANAGEMENT ---
            const atualizarListaEscolasDinamicamente = async (forcarRecalculo = false) => {
                if (estado.buscandoOSRM && !forcarRecalculo) {
                    if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
                    estado.buscandoOSRM = false;
                } else if (estado.buscandoOSRM) {
                    return;
                }

                mapModeAtual = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
                transpModeAtual = window.getSharedStoreValue?.('modoTransporteAtual') || 'pe';
                let chaveCacheAtual = `${mapModeAtual}_${transpModeAtual}`;
                let chaveListaAtual = mapModeAtual;

                if (forcarRecalculo || !estado.listaEscolasPorModo[chaveListaAtual]) {
                    listaExibirBase = obterEscolasAptasExibicao(chaveListaAtual);
                    estado.listaEscolasPorModo[chaveListaAtual] = listaExibirBase;
                    persistirEstado();
                } else {
                    listaExibirBase = estado.listaEscolasPorModo[chaveListaAtual];
                }
                
                estado.ultimoModoUsado = chaveCacheAtual;
                
                if (!estado.cacheDistancias) estado.cacheDistancias = {};
                if (!estado.cacheDistancias[chaveCacheAtual]) estado.cacheDistancias[chaveCacheAtual] = {};
                estado.distanciasOSRM = estado.cacheDistancias[chaveCacheAtual];
                estado.perfilOSRM = transpModeAtual === 'carro' ? 'driving' : 'foot';
                
                const containerLista = document.getElementById('container-lista-escolas');
                if (!containerLista) {
                    return;
                }

                window.rerenderizarListaOSRM = () => {
                    const lis = containerLista.querySelectorAll('li');
                    lis.forEach(li => {
                        const idEsc = li.dataset.id;
                        if (!idEsc) return;
                        let distTexto = '';
                        if (estado.distanciasOSRM[idEsc] !== undefined) {
                            if (estado.distanciasOSRM[idEsc] === 'Erro' || estado.distanciasOSRM[idEsc] === null) {
                                let escDados = listaExibirBase.find(e => String(e.id) === idEsc);
                                let distHaversine = escDados ? Math.round(escDados.distancia + 100) : 0;
                                let iconPath = estado.perfilOSRM === 'foot' ? 'mdi-walk' : 'mdi-car';
                                distTexto = `<span class="text-muted"><span class="mdi ${iconPath}" style="font-size: 14px; margin-right: 2px;"></span> +- ${distHaversine}m (estimativa)</span>`;
                            } else {
                                let distArredondada = Math.round(estado.distanciasOSRM[idEsc] / 50) * 50;
                                let iconPath = estado.perfilOSRM === 'foot' ? 'mdi-walk' : 'mdi-car';
                                distTexto = `<span class="text-warning"><span class="mdi ${iconPath}" style="font-size: 14px; margin-right: 2px;"></span> Trajeto: <b>${distArredondada}m</b></span>`;
                            }
                        } else {
                            distTexto = `<span class="text-warning"><span class="mdi mdi-refresh" style="font-size: 14px; margin-right: 2px;"></span> <i>Calculando trajeto...</i></span>`;
                        }
                        const divMeta = li.querySelector('.dist-texto');
                        if (divMeta) {
                            divMeta.innerHTML = distTexto;
                        }
                    });
                };

                let listaOrdenada = [...listaExibirBase];
                listaOrdenada.sort((a, b) => {
                    let distA = (estado.distanciasOSRM[a.id] !== undefined && estado.distanciasOSRM[a.id] !== 'Erro') ? estado.distanciasOSRM[a.id] : a.distancia;
                    let distB = (estado.distanciasOSRM[b.id] !== undefined && estado.distanciasOSRM[b.id] !== 'Erro') ? estado.distanciasOSRM[b.id] : b.distancia;
                    return distA - distB;
                });
                
                let distMaisProxima = null;
                if (listaOrdenada.length > 0) {
                    let topEscola = listaOrdenada[0];
                    distMaisProxima = (estado.distanciasOSRM[topEscola.id] !== undefined && estado.distanciasOSRM[topEscola.id] !== 'Erro') ? estado.distanciasOSRM[topEscola.id] : topEscola.distancia;
                }

                let escolaMaisProximaParcial = listaOrdenada.find(e => e.periodosEncontrados && e.periodosEncontrados.includes('PARCIAL'));
                let distParcialMaisProxima = null;
                if (escolaMaisProximaParcial) {
                     distParcialMaisProxima = (estado.distanciasOSRM[escolaMaisProximaParcial.id] !== undefined && estado.distanciasOSRM[escolaMaisProximaParcial.id] !== 'Erro') ? estado.distanciasOSRM[escolaMaisProximaParcial.id] : escolaMaisProximaParcial.distancia;
                }

                let escolaAtualNoArray = listaOrdenada.find(e => String(e.id) === String(idEscolaAtual));
                let distEscolaAtual = null;
                if (escolaAtualNoArray) {
                     distEscolaAtual = (estado.distanciasOSRM[idEscolaAtual] !== undefined && estado.distanciasOSRM[idEscolaAtual] !== 'Erro') ? estado.distanciasOSRM[idEscolaAtual] : escolaAtualNoArray.distancia;
                }

                let distInputUser = estado.distanciaSugeridaInput ? parseInt(estado.distanciaSugeridaInput) : null;

                let ehMaisProxima = false;
                if (listaOrdenada.length > 0) {
                    if (String(listaOrdenada[0].id) === String(idEscolaAtual)) {
                        ehMaisProxima = true;
                    } else if (distEscolaAtual !== null && distMaisProxima !== null && distEscolaAtual === distMaisProxima) {
                        ehMaisProxima = true;
                    } else if (distInputUser !== null && distMaisProxima !== null && distInputUser === distMaisProxima) {
                        ehMaisProxima = true;
                    }
                }

                let ehMaisProximaParcial = false;
                if (!ehMaisProxima && escolaMaisProximaParcial) {
                    if (String(escolaMaisProximaParcial.id) === String(idEscolaAtual)) {
                        ehMaisProximaParcial = true;
                    } else if (escolaAtualNoArray && escolaAtualNoArray.periodosEncontrados && escolaAtualNoArray.periodosEncontrados.includes('PARCIAL')) {
                        if (distEscolaAtual !== null && distParcialMaisProxima !== null && distEscolaAtual === distParcialMaisProxima) {
                            ehMaisProximaParcial = true;
                        } else if (distInputUser !== null && distParcialMaisProxima !== null && distInputUser === distParcialMaisProxima) {
                            ehMaisProximaParcial = true;
                        }
                    }
                }

                const escolaMaisProximaIntegral = listaOrdenada.find(e => e.periodosEncontrados && e.periodosEncontrados.includes('INTEGRAL'));
                const ehMaisProximaIntegral = (!ehMaisProxima && !ehMaisProximaParcial && escolaMaisProximaIntegral && String(escolaMaisProximaIntegral.id) === String(idEscolaAtual));
                
                estado.escolaProximaCalc = ehMaisProxima || ehMaisProximaParcial;
                estado.ehMaisProximaParcial = ehMaisProximaParcial;

                // New exception rule for skipping Encaminhamento step
                const temDeficiencia = (estado.deficiencia === 'ALUNO' || estado.deficiencia === 'FAMILIA');
                if (ehMaisProxima || ehMaisProximaParcial || (temDeficiencia && ehMaisProximaIntegral && estado.distancia < 3000) || (temDeficiencia && estado.distancia < 1800)) {
                    estado.isEncaminhamentoDispensado = true;
                }

                let statusText = "";
                if (listaOrdenada.length === 0) {
                     statusText = `<span class="text-warning"><span class="mdi mdi-lightning-bolt" style="font-size: 16px; margin-right: 4px;"></span> Verifique o nível do aluno. Nenhuma opção compatível foi encontrada.</span>`;
                } else if (ehMaisProxima) {
                     statusText = `<span class="text-success"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> A escola atual é a MAIS PRÓXIMA com vaga para ${nivelAlunoOriginal}.</span>`;
                } else if (ehMaisProximaParcial) {
                     statusText = `<span class="text-info"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> A escola atual é a mais próxima de ENSINO PARCIAL com vaga para ${nivelAlunoOriginal}.</span>`;
                } else {
                     statusText = `<span class="text-danger"><span class="mdi mdi-lightning-bolt" style="font-size: 16px; margin-right: 4px;"></span> Existem opções mais próximas para ${nivelAlunoOriginal}:</span>`;
                }

                const btnSim = document.getElementById('btn-esc-sim');
                const btnNao = document.getElementById('btn-esc-nao');
                const destaqueSim = (ehMaisProxima || ehMaisProximaParcial);
                
                if (btnSim && btnNao) {
                    if (destaqueSim) {
                        btnSim.className = "btn btn-success destaque";
                        btnNao.className = "btn btn-danger dimmed";
                    } else {
                        btnNao.className = "btn btn-danger destaque";
                        btnSim.className = "btn btn-success dimmed";
                    }
                    window.destaqueSimGlobal = destaqueSim;
                }

                let listaHtml = `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; position:relative;">
                    ${statusText}
                    <button id="btn-refresh-lista" class="btn-icon-transparent" style="position:absolute; top:0; right:0; display:none;" title="Atualizar lista">
                        <span class="mdi mdi-refresh" style="font-size: 18px;"></span>
                    </button>
                </div>`;
                listaHtml += `<div class="school-list-container" style="margin-top:0;"><ul class="school-list">`;
                
                if (listaOrdenada.length === 0) {
                    listaHtml += `<li class="school-item text-danger">Nenhuma escola encontrada na base.</li>`;
                } else {
                    const rota = window.getSharedStoreValue?.('dadosGeraisRota');
                    const latOrigemLista = (mapModeAtual === 'endereco' && rota && rota.coordAlunoEnd && typeof rota.coordAlunoEnd !== 'string') ? rota.coordAlunoEnd.lat : latAluno;
                    const lonOrigemLista = (mapModeAtual === 'endereco' && rota && rota.coordAlunoEnd && typeof rota.coordAlunoEnd !== 'string') ? rota.coordAlunoEnd.lon : lonAluno;

                    listaOrdenada.forEach((esc, i) => {
                        const cor = String(esc.id) === String(idEscolaAtual) ? 'selected' : '';
                        const tagAtual = String(esc.id) === String(idEscolaAtual) ? ` <span class="mdi mdi-star text-warning" style="font-size: 14px; margin-left: 4px;" title="Escola Solicitada"></span>` : '';
                        
                        let sufixoMaps = estado.perfilOSRM === 'foot' ? "&travelmode=walking&dirflg=w" : "";
                        let urlConfere = "";
                        
                        if (mapModeAtual === 'endereco' && rota && typeof rota.coordAlunoEnd === 'string') {
                            let endStrEncode = encodeURIComponent(rota.coordAlunoEnd);
                            urlConfere = `https://maps.google.com/maps?saddr=${endStrEncode}&daddr=${esc.lat}+${esc.lon}${sufixoMaps}`;
                        } else {
                            urlConfere = `https://maps.google.com/maps?saddr=${latOrigemLista}+${lonOrigemLista}&daddr=${esc.lat}+${esc.lon}${sufixoMaps}`; //nao alterar
                        }
                        
                        let iconPath = estado.perfilOSRM === 'foot' ? 'mdi-walk' : 'mdi-car';
                        let txtDist = `<span class="text-warning"><span class="mdi mdi-refresh" style="font-size: 14px; margin-right: 2px;"></span> <i>Calculando trajeto...</i></span>`;
                        if (estado.distanciasOSRM[esc.id] !== undefined) {
                            if (estado.distanciasOSRM[esc.id] === 'Erro' || estado.distanciasOSRM[esc.id] === null) {
                                // Fallback para Haversine + 100m
                                let distHaversine = Math.round(esc.distancia + 100);
                                txtDist = `<span class="text-muted"><span class="mdi ${iconPath}" style="font-size: 14px; margin-right: 2px;"></span> +- ${distHaversine}m (estimativa)</span>`;
                            } else {
                                let distArredondada = Math.round(estado.distanciasOSRM[esc.id] / 50) * 50;
                                txtDist = `<span class="text-warning"><span class="mdi ${iconPath}" style="font-size: 14px; margin-right: 2px;"></span> Trajeto: <b>${distArredondada}m</b></span>`;
                            }
                        }

                        listaHtml += `<li data-id="${esc.id}" class="school-item ${cor}">
                            ${i + 1}º - ${esc.nome} <span class="badge">${esc.periodosEncontrados}</span>${tagAtual}
                            <div class="school-meta dist-texto">${txtDist}</div>
                            <a href="${urlConfere}" target="_blank" onclick="if(window.copiarCoordenadasEndereco) window.copiarCoordenadasEndereco();" class="link-action">
                                <span class="mdi mdi-map" style="font-size: 14px; margin-right: 2px;"></span> Ver rota no Google Maps
                            </a>
                        </li>`;
                    });
                }
                listaHtml += `</ul></div>`;
                
                let linkMapaRede = "";
                let sufixoMaps = estado.perfilOSRM === 'foot' ? "&travelmode=walking&dirflg=w" : ""; //nao alterar
                linkMapaRede = `https://www.google.com/maps/d/u/0/viewer?mid=1ukc8GP3M-X3Da5l4k406MUMz5oyBB0E&femb=1&ll=${latAluno}%2C${lonAluno}&z=18`; //nao alterar
                
                listaHtml += `<a href="${linkMapaRede}" target="_blank" onclick="if(window.copiarCoordenadasEndereco) window.copiarCoordenadasEndereco();" class="btn btn-outline" style="text-decoration:none; margin-bottom:15px;">
                    <span class="mdi mdi-map" style="font-size: 16px; margin-right: 4px;"></span> Conferir mapa da rede
                </a>`;

                containerLista.innerHTML = listaHtml;
                
                // Verificar se há erros de cálculo e mostrar botão refresh
                const temErros = Object.values(estado.distanciasOSRM).some(dist => dist === 'Erro' || dist === null);
                const btnRefresh = document.getElementById('btn-refresh-lista');
                if (btnRefresh) {
                    btnRefresh.style.display = temErros ? 'block' : 'none';
                }
                
                // Verificar se há distâncias OSRM ainda não calculadas e iniciar se necessário
                let faltaCalcularAgora = listaExibirBase.some(esc => estado.distanciasOSRM[esc.id] === undefined);
                if (faltaCalcularAgora && typeof window.calcularTrajetoOSRM === 'function' && !estado.buscandoOSRM) {
                    console.log('[ASSISTENTE] iniciando recálculo OSRM para lista de escolas');
                    estado.buscandoOSRM = true;
                    
                    if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
                    window.osrmAbortController = new AbortController();

                    (async () => {
                        try {
                            const rota = window.getSharedStoreValue?.('dadosGeraisRota');
                            const latOrigemLista = (mapModeAtual === 'endereco' && rota && rota.coordAlunoEnd) ? rota.coordAlunoEnd.lat : latAluno;
                            const lonOrigemLista = (mapModeAtual === 'endereco' && rota && rota.coordAlunoEnd) ? rota.coordAlunoEnd.lon : lonAluno;

                            for (let esc of listaExibirBase) {
                                if (estado.distanciasOSRM[esc.id] === undefined) {
                                    const dist = await window.calcularTrajetoOSRM(latOrigemLista, lonOrigemLista, esc.lat, esc.lon, estado.perfilOSRM, window.osrmAbortController.signal);
                                    if (window.osrmAbortController.signal.aborted) break; 
                                    
                                    estado.distanciasOSRM[esc.id] = dist !== null ? dist : 'Erro';
                                    persistirEstado();
                                    if (typeof window.rerenderizarListaOSRM === 'function') {
                                        window.rerenderizarListaOSRM();
                                    }
                                    await new Promise(r => setTimeout(r, 250));
                                }
                            }
                        } catch (erro) {
                            console.error('[ASSISTENTE] erro no recálculo OSRM:', erro);
                        } finally {
                            estado.buscandoOSRM = false;
                            const temErros = Object.values(estado.distanciasOSRM).some(dist => dist === 'Erro' || dist === null);
                            const btnRefreshEnd = document.getElementById('btn-refresh-lista');
                            if (btnRefreshEnd) {
                                btnRefreshEnd.style.display = temErros ? 'block' : 'none';
                            }
                            if (typeof window.atualizarListaEscolasDinamicamente === 'function') {
                                window.atualizarListaEscolasDinamicamente(false);
                            }
                        }
                    })();
                }
            };

            window.atualizarListaEscolasDinamicamente = atualizarListaEscolasDinamicamente;

            if (!estado.ehAnalise) {
                conteudo.innerHTML = `
                    <div id="container-lista-escolas">
                    </div>
                `;
                await atualizarListaEscolasDinamicamente();

                const btnRefresh = document.getElementById('btn-refresh-lista');
                if (btnRefresh) {
                    btnRefresh.addEventListener('click', async () => {
                        listaExibirBase.forEach(esc => {
                            if (estado.distanciasOSRM[esc.id] === 'Erro' || estado.distanciasOSRM[esc.id] === null) {
                                delete estado.distanciasOSRM[esc.id];
                            }
                        });
                        persistirEstado();
                        if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
                        estado.buscandoOSRM = false;
                        btnRefresh.style.display = 'none';
                        await atualizarListaEscolasDinamicamente(false);
                    });
                }
                return;
            }

            // --- SECTION: INPUT SYNC & PROTECTION ---
            // Update #input-assistente-dist value whenever atualizarListaEscolasDinamicamente is called or a toggle switch is flipped
            window.atualizarInputDistancia = function(distancia) {
                console.log('[ASSISTENTE] atualizarInputDistancia:', distancia);
                const numero = Number(distancia);
                if (!Number.isFinite(numero) || numero <= 0) {
                    console.warn('[ASSISTENTE] distância inválida:', distancia);
                    return;
                }
                const valorFinal = Math.round(numero / 50) * 50;
                const tentarAtualizar = (tentativa = 0) => {
                    const input = document.getElementById('input-assistente-dist');
                    if (!input) {
                        if (tentativa < 10) {
                            setTimeout(() => tentarAtualizar(tentativa + 1), 200);
                        }
                        return;
                    }
                    input.value = valorFinal;
                    console.log('[ASSISTENTE] input atualizado:', valorFinal);
                };
                tentarAtualizar();
            };

            conteudo.innerHTML = `
    <h3 class="section-title text-info">
        <span class="mdi mdi-graph" style="font-size: 22px; margin-right: 6px;"></span> Verificação de Escola
    </h3>
    <p>Verifique se a escola matriculada é a mais próxima do endereço do aluno.</p>
    
    <div id="container-lista-escolas">
    </div>
    
    <hr class="divider">

    <h3 class="section-title text-warning">
        <span class="mdi mdi-map-marker-radius-outline" style="font-size: 22px; margin-right: 6px;"></span> Aferição de Distância
    </h3>

    <div class="input-group">
        <input
            type="number"
            id="input-assistente-dist"
            class="input-field"
            value="${estado.distanciaSugeridaInput}"
            required
        >
        <label for="input-assistente-dist" class="input-label">Qual é a distância aferida (em metros)?</label>
    </div>

    <div class="action-group">
        <button id="btn-esc-sim" class="btn btn-success"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Está na mais próxima</button>

        <button id="btn-esc-nao" class="btn btn-danger"><span class="mdi mdi-close" style="font-size: 16px; margin-right: 4px;"></span> Não é a mais próxima</button>
    </div>
`;

await atualizarListaEscolasDinamicamente();
// Atualizar input com a distância correta do modo atual
const rotaAtual = window.getSharedStoreValue?.('dadosGeraisRota');
const modoMapaAtual = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
if (rotaAtual) {
    const distancia = modoMapaAtual === 'endereco' ? rotaAtual.distanciaEnd : rotaAtual.distanciaCoord;
    if (typeof window.atualizarInputDistancia === 'function') {
        window.atualizarInputDistancia(distancia);
    }
}


            // Add event listeners for refresh button
const btnRefresh = document.getElementById('btn-refresh-lista');

if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
        listaExibirBase.forEach(esc => {
            if (estado.distanciasOSRM[esc.id] === 'Erro' || estado.distanciasOSRM[esc.id] === null) {
                delete estado.distanciasOSRM[esc.id];
            }
        });
        persistirEstado();
        if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
        estado.buscandoOSRM = false;
        btnRefresh.style.display = 'none';
        await atualizarListaEscolasDinamicamente(false);
    });
}

            const inputDist =
    document.getElementById(
        'input-assistente-dist'
    );

if (inputDist) {

    setTimeout(() => {
        inputDist.focus();
    }, 100);

    inputDist.addEventListener(
        'focus',
        function () {
            this.select();
        }
    );

    inputDist.addEventListener(
        'input',
        function () {
            this.dataset.editado = 'true';
        }
    );

    const rota = window.getSharedStoreValue?.('dadosGeraisRota') || window.dadosGeraisRota;
    const modoMapa = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';

    if (rota) {
        const distancia = modoMapa === 'endereco' ? rota.distanciaEnd : rota.distanciaCoord;
        atualizarInputDistancia(distancia);
    }
}
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
                    estado.escolaProximaUser = true; 
                if (estado.distancia >= 1500) {
                    estado.telaFinal = { titulo: "DEFERIR", mensagem: `A distância atinge o requisito mínimo (${estado.distancia}m) e os critérios da escola ou encaminhamento estão corretos.` };
                }
                renderizarPasso(); 
            };
            
            document.getElementById('btn-esc-nao').onclick = () => { 
                if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
                const dist = parseInt(inputDist.value);
                if (isNaN(dist) || dist < 0) return alert("Por favor, insira uma distância válida em metros.");
                salvarHistorico(); 
                estado.distancia = dist;
                    estado.escolaProximaUser = false; 
                renderizarPasso(); 
            };

            return;
        }

        if (estado.escolaProximaUser !== null && estado.distancia !== null && !estado.confirmacaoFeita) {
            let pergunta = null;
            
            if (estado.escolaProximaUser === false) {
                if (estado.ehMaisProximaParcial) {
                    pergunta = "Confirme se o aluno realmente não está na parcial mais próxima. Na lista ele aparentava estar na escola parcial mais próxima ao endereço.";
                } else if (estado.escolaProximaCalc) {
                    pergunta = "Confirme se o aluno realmente não está na unidade mais próxima. Na lista ele aparentava estar na UE mais próxima ao endereço cadastrado.";
                }
            }
            
            if (!pergunta && estado.ruaMatch) {
                const mot = estado.ruaMatch.resultado_motivo;
                if (mot === "DISTÂNCIA MAIOR QUE 1500 METROS" && estado.distancia < 1500) {
                    pergunta = "Confirma essa distância? Essa rua costuma ser atendida por DISTANCIA MAIOR QUE 1500 METROS.";
                } else if (mot === "DISTÂNCIA MENOR QUE 1500 METROS" && estado.distancia >= 1500) {
                    pergunta = "Confirma essa distância? Essa rua costuma ser indeferida por DISTANCIA MENOR QUE 1500 METROS.";
                } else if (mot === "ESCOLA POR OPÇÃO" && estado.escolaProximaUser === true && !estado.escolaProximaCalc) {
                    pergunta = "Confirma que a escola é a mais próxima? Essa rua costuma ser indeferida por ESCOLA POR OPÇÃO e a calculadora indica que existem opções mais próximas.";
                }
            }

            if (pergunta) {
                    conteudo.innerHTML = `
                    <h3 class="section-title text-warning">
                        <span class="mdi mdi-lightning-bolt" style="font-size: 22px; margin-right: 6px;"></span> Atenção - Confirmação de Dados
                    </h3>
                        <p>${pergunta}</p>
                        <div class="action-group" style="margin-top:20px;">
                            <button id="btn-confirma-sim" class="btn btn-success"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Sim, confirmo</button>
                            <button id="btn-confirma-nao" class="btn btn-danger"><span class="mdi mdi-close" style="font-size: 16px; margin-right: 4px;"></span> Não, corrigir</button>
                        </div>
                    `;
                    document.getElementById('btn-confirma-sim').onclick = () => {
                        salvarHistorico();
                        estado.confirmacaoFeita = true;
                        renderizarPasso();
                    };
                    document.getElementById('btn-confirma-nao').onclick = () => {
                        voltarPasso();
                    };
                    return;
                } else {
                    estado.confirmacaoFeita = true;
                }
        }

        const precisaDeficienciaEspecial = estado.isEspecial && estado.deficiencia === null;
        const precisaDeficienciaDistancia = estado.distancia !== null && estado.distancia < 1500 && estado.deficiencia === null;

        if (precisaDeficienciaEspecial || precisaDeficienciaDistancia) {
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

            let tituloBoxStr = precisaDeficienciaEspecial 
                ? "Exceção: Ensino Especial" 
                : `Exceção: Distância (${estado.distancia}m)`;
            let subTituloBox = precisaDeficienciaEspecial 
                ? "O aluno está matriculado ou necessita de ensino especial." 
                : "A distância aferida é <b>inferior a 1500m</b>.";

            conteudo.innerHTML = `
                <h3 class="section-title text-warning">
                    <span class="mdi mdi-wheelchair-accessibility" style="font-size: 22px; margin-right: 6px;"></span> ${tituloBoxStr}
                </h3>
                <p>${subTituloBox}</p>
                ${textoPergunta}
                <div class="action-group-col" style="margin-top:20px;">
                    <button id="btn-def-aluno" class="btn btn-success" style="${estiloAluno}">A criança tem deficiência</button>
                    <button id="btn-def-familia" class="btn btn-info" style="${estiloFamilia}">Pai/Mãe tem deficiência</button>
                    <button id="btn-def-nao" class="btn btn-danger">Não possui deficiência</button>
                </div>
            `;
            
            document.getElementById('btn-def-aluno').onclick = () => { 
                salvarHistorico(); 
                estado.deficiencia = 'ALUNO'; 
                if (!estado.isEspecial && estado.escolaProximaUser === true) {
                    estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por motivo de deficiência do aluno." };
                }
                renderizarPasso(); 
            };
            document.getElementById('btn-def-familia').onclick = () => { 
                salvarHistorico(); 
                estado.deficiencia = 'FAMILIA'; 
                if (!estado.isEspecial && estado.escolaProximaUser === true) {
                    estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por motivo de deficiência do responsável." };
                }
                renderizarPasso(); 
            };
            document.getElementById('btn-def-nao').onclick = () => { 
                salvarHistorico(); 
                estado.deficiencia = false; 
                renderizarPasso(); 
            };
            return;
        }

        if (estado.deficiencia === 'ALUNO' && estado.isEspecial && !estado.deficienciaEspecialProcessada) {
            estado.deficienciaEspecialProcessada = true;
            estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido automaticamente: Aluno Especial + Deficiência.", termoBusca: "ALUNO DEFICIENTE", textoDetalhes: "ALUNO DEFICIENTE" };
            return renderizarPasso();
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

            if (estado.ruaMatch && estado.ruaMatch.resultado_motivo === "DIFICULDADE DE ACESSO" && estado.escolaProximaUser === true) {
                estado.dificuldadeAcesso = true;
                estado.telaFinal = { 
                    titulo: "DEFERIR", 
                    mensagem: "Essa rua costuma ser atendida por DIFICULDADE DE ACESSO.", 
                    termoBusca: "DIFICULDADE DE ACESSO", 
                    textoDetalhes: "Essa rua costuma ser atendida por DIFICULDADE DE ACESSO.",
                    urlPesquisaRua: urlPesquisaRua
                };
                return renderizarPasso();
            }

            conteudo.innerHTML = `
                <h3 class="section-title text-warning">
                    <span class="mdi mdi-wheelchair-accessibility" style="font-size: 22px; margin-right: 6px;"></span> Dificuldade de Acesso
                </h3>
                <p>O trajeto da residência até a escola possui <b>dificuldade de acesso excepcional</b> (barreiras físicas severas, vias intransitáveis) mapeadas?</p>
                
                <div style="text-align:center; margin-bottom:15px;">
                    <a href="${urlPesquisaRua}" target="_blank" class="btn btn-outline" style="text-decoration:none;">
                        <span class="mdi mdi-map-search" style="font-size: 16px; margin-right: 4px;"></span> Ver atendimentos da rua
                    </a>
                </div>

                <div class="action-group">
                    <button id="btn-dif-sim" class="btn btn-success"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Sim, há dificuldade</button>
                    <button id="btn-dif-nao" class="btn btn-danger"><span class="mdi mdi-close" style="font-size: 16px; margin-right: 4px;"></span> Não</button>
                </div>
            `;
            
            document.getElementById('btn-dif-sim').onclick = () => { 
                salvarHistorico(); 
                estado.dificuldadeAcesso = true; 
                if (estado.escolaProximaUser === false) {
                    renderizarPasso();
                } else {
                    estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido devido a Dificuldade de Acesso comprovada na rota." };
                    renderizarPasso(); 
                }
            };
            document.getElementById('btn-dif-nao').onclick = () => { 
                salvarHistorico(); 
                estado.dificuldadeAcesso = false; 
                estado.telaFinal = { titulo: "INDEFERIR", mensagem: "A distância não atinge 1500m e o caso não se enquadra nas exceções." };
                renderizarPasso(); 
            };
            return;
        }

        const excecaoGarantida = (estado.deficiencia === 'ALUNO' || estado.deficiencia === 'FAMILIA' || estado.dificuldadeAcesso === true);
        if (estado.escolaProximaUser === false && (estado.distancia >= 1500 || excecaoGarantida) && estado.encaminhamentoOk === null) {
            if (estado.isEncaminhamentoDispensado) {
                estado.telaFinal = { titulo: "DEFERIR", mensagem: `A distância atinge o requisito mínimo (${estado.distancia}m) ou possui exceção válida, e a verificação de encaminhamento foi dispensada pelas regras da Secretaria.` };
                renderizarPasso();
                return;
            }

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
                        msgCopiado = `<div class='message-box success' style='font-size:12px; margin-top:10px;'><span class="mdi mdi-check" style="font-size: 14px; margin-right: 4px;"></span> Data de nascimento já copiada, basta colar no SOMARH.</div>`;
                    } catch(e) {}
                }
            }

            let infoExtraHtml = "";
            if (isFichaAntiga) {
                const elNome = doc.getElementById('nome_aluno');
                const nomeStr = elNome ? (elNome.value || elNome.innerText).trim() : "Não informado";
                infoExtraHtml = `
                    <div class="school-list-container" style="font-size:12px; margin-top:10px;">
                        <b>Nome:</b> ${nomeStr}<br>
                        <b>Endereço:</b> ${enderecoCompleto}<br>
                        <b>Escola Atual:</b> ${estado.nomeEscolaAtual || 'Não identificada'}
                    </div>
                `;
            }

            conteudo.innerHTML = `
                <h3 class="section-title text-primary">
                    <span class="mdi mdi-swap-horizontal-variant" style="font-size: 22px; margin-right: 6px;"></span> Falta de Vaga / Encaminhamento
                </h3>
                <p>Verifique no SOMARH e nas planilhas da Central de Matrículas se ele possui um <b>encaminhamento válido</b> por falta de vaga.</p>
                <p class="text-muted" style="font-size:12px;"><i>(A escola matriculada e o endereço devem bater com o encaminhamento).</i></p>
                ${infoExtraHtml}
                ${msgCopiado}
                <div class="action-group" style="margin-top:20px;">
                    <button id="btn-enc-sim" class="btn btn-success"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Sim, possui</button>
                    <button id="btn-enc-nao" class="btn btn-danger"><span class="mdi mdi-close" style="font-size: 16px; margin-right: 4px;"></span> Não possui</button>
                </div>
            `;
            document.getElementById('btn-enc-sim').onclick = () => { 
                salvarHistorico(); 
                estado.encaminhamentoOk = true; 
                estado.telaFinal = { titulo: "DEFERIR", mensagem: `A distância atinge o requisito mínimo (${estado.distancia}m) ou possui exceção válida, e os critérios de encaminhamento estão corretos.` };
                renderizarPasso(); 
            };
            document.getElementById('btn-enc-nao').onclick = () => { 
                salvarHistorico(); 
                estado.encaminhamentoOk = false;
                estado.telaFinal = { titulo: "INDEFERIR", mensagem: "O aluno não está na escola mais próxima e NÃO possui encaminhamento justificado por falta de vaga." }; 
                renderizarPasso(); 
            };
            return;
        }
    }

    window.abrindoModalAssistente = false;
    renderizarPasso(); 
};