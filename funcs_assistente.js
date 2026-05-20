// ==============
// SECTION: UTILITÁRIOS E HELPERS
// ==============

if (typeof window.normalizarTexto !== 'function') {
    window.normalizarTexto = function(texto) {
        if (!texto) return "";
        return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/º|ª/g, "O").trim();
    };
}

// Percorre iframes até achar o documento com status da ficha (cross-origin ignorado).
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

function vincularEventoUnico(elemento, evento, handler) {
    if (!elemento) return;
    const chave = 'bound' + evento;
    if (elemento.dataset[chave]) return;
    elemento.dataset[chave] = 'true';
    elemento.addEventListener(evento, handler);
}

function lerValorElemento(el) {
    if (!el) return '';
    return (el.value != null && el.value !== '') ? String(el.value).trim() : String(el.innerText || '').trim();
}

function campoPreenchidoNoDoc(doc, id) {
    const el = doc.getElementById(id);
    if (!el) return false;
    const val = lerValorElemento(el).toUpperCase();
    return val !== '' && val !== 'NÃO' && val !== 'NAO' && val !== '0' && val !== 'SELECIONE' && val !== 'NENHUMA';
}

function extrairTextoEtiqueta(doc, rotulos) {
    const tds = doc.querySelectorAll('td.etiqueta');
    for (const td of tds) {
        const texto = td.innerText.trim();
        if (!rotulos.includes(texto)) continue;
        const tr = td.parentElement;
        const nextTr = tr?.nextElementSibling;
        const tdValor = nextTr?.querySelector('td.texto_dados');
        if (tdValor) return tdValor.innerText.trim();
    }
    return '';
}

function extrairNomeAluno(doc) {
    const elNome = doc.querySelector('input[name="nome_aluno"]') || doc.querySelector('input[name="nome"]') || doc.getElementById('nome_aluno');
    let nome = elNome ? elNome.value.trim() : '';
    if (!nome) nome = extrairTextoEtiqueta(doc, ['Nome do aluno', 'Nome', 'Candidato']);
    return nome || 'Não identificado';
}

function extrairDataNascimento(doc) {
    const el = doc.getElementById('data_nasc_aluno');
    if (el) {
        const dn = lerValorElemento(el);
        if (dn) return dn;
    }
    return extrairTextoEtiqueta(doc, ['Data de nascimento']);
}

const FAIXAS_ETARIAS_NIVEL = [
    { nivel: 'EJA', idade: 14, idadeMaxima: 110 }, { nivel: '5º ANO', idade: 10, idadeMaxima: 13 },
    { nivel: '4º ANO', idade: 9, idadeMaxima: 10 }, { nivel: '3º ANO', idade: 8, idadeMaxima: 9 },
    { nivel: '2º ANO', idade: 7, idadeMaxima: 8 }, { nivel: '1º ANO', idade: 6, idadeMaxima: 7 },
    { nivel: 'INFANTIL V', idade: 5, idadeMaxima: 6 }, { nivel: 'INFANTIL IV', idade: 4, idadeMaxima: 5 },
    { nivel: 'INFANTIL III', idade: 3, idadeMaxima: 4 }, { nivel: 'INFANTIL II', idade: 2, idadeMaxima: 3 },
    { nivel: 'INFANTIL I', idade: 1, idadeMaxima: 2 }, { nivel: 'BERÇÁRIO FINAL', idade: 1, idadeMaxima: 1 },
    { nivel: 'BERÇÁRIO INICIAL', idade: 0, idadeMaxima: 1 }
];

function extrairNivelAluno(doc) {
    let nivelOriginal = extrairTextoEtiqueta(doc, ['Nível']);
    if (!nivelOriginal) {
        doc.querySelectorAll('span[style*="font-size: 16px"][style*="font-weight: bold"]').forEach(span => {
            const texto = span.innerText.trim().toUpperCase();
            if (texto && texto !== 'INTEGRAL' && texto !== 'PARCIAL' && texto !== 'NOITE') nivelOriginal = texto;
        });
    }
    let valorSelect = '';
    const selectNivel = doc.getElementById('nivel');
    if (selectNivel?.options[selectNivel.selectedIndex]) {
        valorSelect = selectNivel.options[selectNivel.selectedIndex].text || selectNivel.value;
        if (!nivelOriginal) nivelOriginal = valorSelect;
    }
    if (!nivelOriginal || (nivelOriginal.includes('BERCARIO') && valorSelect === 'BERCARIO INICIAL')) {
        const dataNascStr = extrairDataNascimento(doc);
        if (dataNascStr) {
            const parts = dataNascStr.split('/');
            if (parts.length === 3) {
                const nasc = new Date(parts[2], parts[1] - 1, parts[0]);
                const hoje = new Date();
                let idade = hoje.getFullYear() - nasc.getFullYear();
                const m = hoje.getMonth() - nasc.getMonth();
                if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
                const faixa = FAIXAS_ETARIAS_NIVEL.find(f => idade >= f.idade && idade <= f.idadeMaxima);
                if (faixa && (!nivelOriginal || (nivelOriginal.includes('BERCARIO') && idade > 1))) {
                    nivelOriginal = faixa.nivel;
                }
            }
        }
    }
    let nivelNorm = window.normalizarTexto(nivelOriginal);
    nivelNorm = nivelNorm.replace(/([0-9]+)\s*[Oº\.]\s*ANO/g, '$1O ANO');
    if (nivelNorm.includes('EJA')) nivelNorm = 'EJA';
    if (nivelNorm.includes('ESPECIAL')) nivelNorm = 'ESPECIAL';
    return { nivelOriginal, nivelNorm, isBercarioGeral: nivelNorm.includes('BERCARIO') && nivelNorm !== 'BERCARIO INICIAL' && nivelNorm !== 'BERCARIO FINAL' };
}

function identificarEscolaAtual(doc, baseEscolas) {
    let idEscola = '';
    let nomeEscola = 'Não identificada';
    const inputId = doc.querySelector('input[name="id_unidade"]');
    if (inputId) {
        idEscola = inputId.value.trim();
        const encontrada = baseEscolas.find(e => String(e.id) === String(idEscola));
        if (encontrada) nomeEscola = encontrada.nome;
        return { idEscola, nomeEscola, escolaRegistro: encontrada || null };
    }
    let latEscola = null;
    let lonEscola = null;
    let nomeParseado = '';
    doc.querySelectorAll('span').forEach(span => {
        const texto = span.innerText || span.textContent || '';
        if (!latEscola && (texto.includes('Latitude:') || texto.includes('Longitude:'))) {
            const mLat = texto.match(/Latitude:\s*([-\d.]+)/);
            const mLon = texto.match(/Longitude:\s*([-\d.]+)/);
            if (mLat) latEscola = parseFloat(mLat[1]);
            if (mLon) lonEscola = parseFloat(mLon[1]);
        }
        if (!nomeParseado && span.style.fontSize === '20px' && span.style.fontWeight === 'bold') {
            nomeParseado = texto.trim();
        }
    });
    if (latEscola && lonEscola && baseEscolas.length) {
        const porCoord = baseEscolas.find(esc => window.calcularDistanciaHaversine(latEscola, lonEscola, esc.lat, esc.lon) < 100);
        if (porCoord) return { idEscola: porCoord.id, nomeEscola: porCoord.nome, escolaRegistro: porCoord };
        if (nomeParseado) {
            const nomeNorm = window.normalizarTexto(nomeParseado).replace('EMEB', '').replace(',', '').trim();
            const porNome = baseEscolas.find(e => {
                const nomeBanco = window.normalizarTexto(e.nome).replace('EMEB', '').replace(',', '').trim();
                return nomeBanco.includes(nomeNorm) || nomeNorm.includes(nomeBanco);
            });
            if (porNome) return { idEscola: porNome.id, nomeEscola: porNome.nome, escolaRegistro: porNome };
        }
    }
    return { idEscola, nomeEscola, escolaRegistro: null };
}

function buscarMatchRua(ruasDB, idUnidade, cepVal, endRuaNorm, endBairroNorm) {
    if (!ruasDB?.length) return null;
    return ruasDB.find(r => {
        const rCep = r.cep ? r.cep.replace(/\D/g, '') : '';
        if (r.id_unidade == idUnidade && rCep && cepVal && rCep === cepVal) return true;
        return r.id_unidade == idUnidade && window.normalizarTexto(r.logradouro) === endRuaNorm && window.normalizarTexto(r.bairro) === endBairroNorm;
    }) || null;
}

/** Ler a array ruasData e salvar dados encontrados */
function analisarHistoricoRua(ruaMatch) {
    const motivo_rua = ruaMatch?.resultado_motivo || '';
    return {
        motivo: motivo_rua,
        temMatch: !!ruaMatch,
        ehAreaRural: motivo_rua === 'ÁREA RURAL',
        ehDificuldadeAcesso: motivo_rua === 'DIFICULDADE DE ACESSO',
        ehDistanciaMaior1500: motivo_rua === 'DISTÂNCIA MAIOR QUE 1500 METROS',
        ehDistanciaMenor1500: motivo_rua === 'DISTÂNCIA MENOR QUE 1500 METROS',
        ehEscolaPorOpcao: motivo_rua === 'ESCOLA POR OPÇÃO'
    };
}

function montarUrlPesquisaRua(endRua) {
    let ruaLimpa = (endRua || '').split(',')[0].trim();
    const prefixos = /^(RUA|R\.|AVENIDA|AV\.|AV|TRAVESSA|TRV\.|VIELA|PRA[ÇC]A|ESTRADA|ALAMEDA|RODOVIA|LADEIRA|BECO|MARGINAL)\s+/i;
    ruaLimpa = ruaLimpa.replace(prefixos, '').trim();
    const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const moduloPath = 'modulos/transporte_escolar/';
    const prefixo = basePath.includes(moduloPath) ? '' : moduloPath;
    return `${basePath}${prefixo}solicitacoes_transporte_realizadas.php?endereco=${encodeURIComponent(ruaLimpa)}`;
}

function montarHtmlEncaminhamento(maisRecente) {
    if (!maisRecente) return '';
    let finalTexto = '';
    if (maisRecente.endereco) {
        finalTexto = ` e endereço <b>${maisRecente.endereco}</b>`;
    } else if (maisRecente.latitude && maisRecente.longitude) {
        finalTexto = ` nas coordenadas <b>${maisRecente.latitude}</b>, <b>${maisRecente.longitude}</b>`;
    }
    const isDeferido = maisRecente.situacao !== 'NÃO ATENDER';
    const corPainel = isDeferido ? 'success' : 'danger';
    const corTexto = isDeferido ? '#27ae60' : '#c0392b';
    const iconeStatus = isDeferido ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline';
    const diretrizTexto = isDeferido ? '✓ ATENDER / DEFERIDO' : '⚠️ NÃO ATENDER / INDEFERIR';
    return `
        <div class="message-box ${corPainel}" style="margin-bottom: 15px;">
            <h4 style="margin: 0 0 10px 0; color: ${corTexto}; display: flex; align-items: center; gap: 6px; font-size: 15px;">
                <span class="mdi ${iconeStatus}" style="font-size: 18px;"></span>
                <b>${diretrizTexto} (Mapeado no Banco)</b>
            </h4>
            <p style="margin-top: 0; margin-bottom: 8px; color: #2c3e50;">Foi encontrado um encaminhamento para esse aluno no ano de <b>${maisRecente.ano}</b>, para a unidade: <b>${maisRecente.unidade}</b>${finalTexto}</p>
            <table style="width:100%; font-size:13px; border-collapse: collapse; color:#555;">
                ${maisRecente.unidadeOrigem ? `<tr style="border-bottom: 1px dashed #e1e4e8;"><td style="padding: 4px 0; font-weight:bold; width: 120px;">Escola de Origem:</td><td>${maisRecente.unidadeOrigem}</td></tr>` : ''}
                ${maisRecente.motivo ? `<tr style="border-bottom: 1px dashed #e1e4e8;"><td style="padding: 4px 0; font-weight:bold;">Motivo/Prioridade:</td><td>${maisRecente.motivo}</td></tr>` : ''}
            </table>
            <div style="margin-top: 8px; font-size: 11px; color: #8597a3;">Origem dos dados: ${maisRecente.descricao || 'Desconhecida'}</div>
        </div>
    `;
}

/** Resolve encaminhamento uma vez (db + RA); evita releitura de HISTORICO_MASTER no fluxo. */
function resolverEncaminhamentoAluno(doc, dbEncaminhamentos) {
    let raAlunoRaw = '';
    const inputRa = doc.getElementById('ra_prodesp_search') || document.getElementById('ra_prodesp_search');
    if (inputRa) raAlunoRaw = inputRa.value || inputRa.innerText || '';
    if (!raAlunoRaw) {
        raAlunoRaw = window.getSharedStoreValue?.('raAluno') || window.getSharedStoreValue?.('ra_prodesp_search') || '';
    }
    const raAluno = raAlunoRaw.replace(/\D/g, '');
    let msgEncaminhamentoHtml = '';
    let maisRecente = null;

    if (raAluno && dbEncaminhamentos) {
        let lista = dbEncaminhamentos[raAluno];
        if (!lista && raAluno.length > 5) lista = dbEncaminhamentos[raAluno.slice(0, -1)];
        if (Array.isArray(lista) && lista.length > 0) {
            maisRecente = lista.reduce((prev, current) => (prev.ano > current.ano) ? prev : current);
            msgEncaminhamentoHtml = montarHtmlEncaminhamento(maisRecente);
        } else {
            console.log('[ASSISTENTE] RA', raAluno, 'não localizado no banco de encaminhamentos.');
        }
    } else if (!raAluno || !dbEncaminhamentos) {
        console.error('[ASSISTENTE] Falha ao pesquisar encaminhamentos.', {
            'RA Capturado': raAluno || 'NENHUM RA ENCONTRADO NO DOM',
            'Banco Carregado?': dbEncaminhamentos ? 'SIM' : 'NÃO'
        });
    }
    return { raAluno, maisRecente, msgEncaminhamentoHtml };
}

function calcularSugestaoDeficiencia(doc) {
    const elCadeirante = doc.getElementById('aluno_cadeirante');
    const isCadeirante = elCadeirante && lerValorElemento(elCadeirante).toUpperCase().includes('SIM');
    if (campoPreenchidoNoDoc(doc, 'tipo_deficiencia') || campoPreenchidoNoDoc(doc, 'detalhamento_deficiencia') || isCadeirante) return 'ALUNO';
    if (campoPreenchidoNoDoc(doc, 'descricao_deficiencia_pais_irmao') || campoPreenchidoNoDoc(doc, 'descricao_deficiencia_pais_irmao_outro')) return 'FAMILIA';
    return null;
}

function extrairContextoFicha(doc) {
    const ruasDB = window.ruasData || [];
    const escolasDB = window.escolasDB || [];
    const dbEncaminhamentos = obterBancoEncaminhamentos();

    if (!ruasDB.length) {
        console.warn('[ASSISTENTE] window.ruasData vazio ou ruas.js não carregado.');
    } else {
        console.log('[ASSISTENTE] ruas.js carregado. Total:', ruasDB.length);
    }

    const statusDiv = doc.getElementById('status_atendimento') || doc.getElementById('mostra_status_pedido');
    const textoStatus = statusDiv ? statusDiv.innerText.toUpperCase() : '';
    const isMudanca = textoStatus.includes('MUDANÇA') || textoStatus.includes('MUDANCA');
    const ehAnalise = textoStatus.includes('EM ANÁLISE') || textoStatus.includes('EM ANALISE') ||
        textoStatus.includes('AGUARDANDO ANÁLISE') || textoStatus.includes('AGUARDANDO ANALISE');

    const elEndereco = doc.getElementById('endereco');
    const elNumero = doc.getElementById('endereco_numero_residencia');
    const elBairro = doc.getElementById('endereco_bairro');
    const endRua = lerValorElemento(elEndereco);
    const endNum = lerValorElemento(elNumero);
    const endBairro = lerValorElemento(elBairro);
    const enderecoCompleto = [endRua, endNum, endBairro].filter(Boolean).join(', ');

    const idUnidadeEl = doc.querySelector('input[name="id_unidade"]') || doc.querySelector('#id_unidade');
    const idUnidade = idUnidadeEl ? idUnidadeEl.value : '';
    const cepEl = doc.querySelector('input[name="cep"]') || doc.querySelector('#cep') || doc.querySelector('#endereco_cep');
    const cepVal = cepEl ? cepEl.value.replace(/\D/g, '') : '';

    const inputMae = doc.querySelector('input[name="nome_mae"]');
    const inputPai = doc.querySelector('input[name="nome_pai"]');
    const nomeMae = inputMae ? inputMae.value.trim() : '';
    const nomePai = inputPai ? inputPai.value.trim() : '';
    let nomesResponsaveis = [nomeMae, nomePai].filter(Boolean).join('; ou<br>');
    if (!nomesResponsaveis) nomesResponsaveis = '';

    const idSolicitacao = doc.querySelector('input[name="id_solicitacao"]')?.value || doc.querySelector('input[name="id"]')?.value || '';
    const escolaAtual = identificarEscolaAtual(doc, escolasDB);
    const nivel = extrairNivelAluno(doc);
    const ruaMatch = buscarMatchRua(ruasDB, idUnidade, cepVal, window.normalizarTexto(endRua.split(',')[0]), window.normalizarTexto(endBairro));
    const historicoRua = analisarHistoricoRua(ruaMatch);
    if (ruaMatch) console.log('[ASSISTENTE] Match de rua:', historicoRua.motivo);

    let isEspecial = nivel.nivelNorm === 'ESPECIAL';
    if (escolaAtual.escolaRegistro?.turmas) {
        isEspecial = isEspecial || escolaAtual.escolaRegistro.turmas.some(t => window.normalizarTexto(t.nivel).includes('ESPECIAL'));
    }

    const escolasAptas = filtrarEscolasAptas(escolasDB, nivel.nivelNorm, nivel.isBercarioGeral);
    const urlPesquisaRua = montarUrlPesquisaRua(endRua);
    const encaminhamento = resolverEncaminhamentoAluno(doc, dbEncaminhamentos);

    return {
        doc,
        ruasDB,
        escolasDB,
        dbEncaminhamentos,
        statusDiv,
        textoStatus,
        isMudanca,
        ehAnalise,
        endRua,
        endNum,
        endBairro,
        enderecoCompleto,
        nomeRuaTitulo: endRua ? endRua.split(',')[0].trim() : 'Assistente Passo a Passo',
        idUnidade,
        cepVal,
        nomesResponsaveis,
        nomeAluno: extrairNomeAluno(doc),
        dataNascimento: extrairDataNascimento(doc),
        idSolicitacao,
        ruaMatch,
        historicoRua,
        escolasAptas,
        urlPesquisaRua,
        encaminhamento,
        sugestaoDeficienciaHtml: calcularSugestaoDeficiencia(doc),
        idEscolaAtual: escolaAtual.idEscola,
        nomeEscolaAtual: escolaAtual.nomeEscola,
        escolaRegistro: escolaAtual.escolaRegistro,
        nivelAlunoOriginal: nivel.nivelOriginal,
        nivelAlunoNorm: nivel.nivelNorm,
        isBercarioGeral: nivel.isBercarioGeral,
        isEspecial,
        iframeMapa: doc.getElementById('map_endereco'),
        inputDistanciaFicha: doc.querySelector('input[name="distancia_aferida"], #distancia_aferida')
    };
}

function filtrarEscolasAptas(baseEscolas, nivelAlunoNorm, isBercarioGeral) {
    return baseEscolas.filter(esc => {
        if (!esc.turmas || !Array.isArray(esc.turmas)) return false;
        const turmasNivel = esc.turmas.filter(turma => {
            const nivelTurmaNorm = window.normalizarTexto(turma.nivel);
            if (isBercarioGeral) return nivelTurmaNorm.includes('BERCARIO');
            if (nivelAlunoNorm === 'ESPECIAL' && nivelTurmaNorm.includes('ESPECIAL')) return true;
            if (nivelAlunoNorm === 'EJA' && nivelTurmaNorm.includes('EJA')) return true;
            return nivelTurmaNorm === nivelAlunoNorm;
        });
        if (turmasNivel.length > 0) {
            esc.periodosEncontrados = [...new Set(turmasNivel.map(t => t.periodo))].join(' / ');
            return true;
        }
        return false;
    });
}

function montarListaEscolasExibicao(escolasAptas, latAluno, lonAluno, modo, idEscolaAtual, rotaSessao) {
    let latBase = latAluno;
    let lonBase = lonAluno;
    if (modo === 'endereco') {
        const rota = rotaSessao ?? window.getSharedStoreValue?.('dadosGeraisRota');
        if (rota?.coordAlunoEnd?.lat) {
            latBase = rota.coordAlunoEnd.lat;
            lonBase = rota.coordAlunoEnd.lon;
        }
    }
    const listaCopia = JSON.parse(JSON.stringify(escolasAptas));
    listaCopia.forEach(esc => {
        esc.distancia = window.calcularDistanciaHaversine(latBase, lonBase, esc.lat, esc.lon);
    });
    listaCopia.sort((a, b) => a.distancia - b.distancia);
    const indexAtual = listaCopia.findIndex(e => String(e.id) === String(idEscolaAtual));
    const indexParcial = listaCopia.findIndex(e => e.periodosEncontrados?.includes('PARCIAL'));
    const indexIntegral = listaCopia.findIndex(e => e.periodosEncontrados?.includes('INTEGRAL'));
    const prioridades = [0, indexParcial, indexIntegral, indexAtual].filter(idx => idx !== -1);
    let limiteFinal = 3;
    prioridades.forEach(idx => {
        if (idx >= 3 && idx <= 9 && idx + 1 > limiteFinal) limiteFinal = idx + 1;
    });
    return listaCopia.slice(0, limiteFinal);
}

function obterDistanciaSugeridaInput(ctx, modoMapa, rotaSessao) {
    const rota = rotaSessao ?? window.getSharedStoreValue?.('dadosGeraisRota');
    let distValue = modoMapa === 'endereco' ? rota?.distanciaEnd : rota?.distanciaCoord;
    if (distValue == null) distValue = modoMapa === 'endereco' ? rota?.distanciaCoord : rota?.distanciaEnd;
    if (distValue == null && ctx.inputDistanciaFicha?.value) {
        distValue = parseInt(ctx.inputDistanciaFicha.value, 10) || null;
    }
    return distValue || '';
}

function separarCoordenadasIframe(matchString) {
    if (!matchString) return { lat: null, lon: null };
    const partes = decodeURIComponent(matchString[1]).trim().split(/[\s,]+/);
    if (partes.length >= 2) return { lat: parseFloat(partes[0].trim()), lon: parseFloat(partes[1].trim()) };
    return { lat: null, lon: null };
}

function obterBancoEncaminhamentos() {
    if (typeof encaminhamentos !== 'undefined') return encaminhamentos;
    if (typeof window.encaminhamentos !== 'undefined') return window.encaminhamentos;
    if (typeof window.encaminhamentosDB !== 'undefined') return window.encaminhamentosDB;
    if (typeof window.encaminhamentosData !== 'undefined') return window.encaminhamentosData;
    if (typeof HISTORICO_MASTER !== 'undefined') return HISTORICO_MASTER.encaminhamentos;
    return null;
}

function preencheAnalise(resultado, resultado_motivo, resultado_detalhes, distancia){
    if (typeof console !== 'undefined' && console.debug) console.debug('[ASSISTENTE] Preenchendo análise com:', { resultado, resultado_motivo, resultado_detalhes, distancia });
    const docFinal = window.getAlvoDocument(); 
    if (resultado_motivo !== "" && resultado_detalhes !== "" && resultado_motivo ===resultado_detalhes) {resultado_detalhes=""; }
                //if (distancia === null || distancia === undefined) {distancia = estado.distancia; }
                //if (resultado_motivo === null || resultado_motivo === undefined) {resultado_motivo = motivoAnalise; } 
                //if(resultado_detalhes === null || resultado_detalhes === undefined) {resultado_detalhes = textoDetalhes; }  
                //if(resultado === null || resultado === undefined) {resultado = tipoAcao; }
                try {
                    const camposDist = docFinal.querySelectorAll('input[name="distancia_aferida"], #distancia_aferida');
                    if (distancia !== null && distancia !== undefined) {
                        camposDist.forEach(campo => {
                            campo.value = distancia;
                            campo.setAttribute('value', distancia);
                        });
                    }
                } catch (erro) {}

                try {
                    if (resultado === 'INDEFERIR') {
                        const selectMotivo = docFinal.querySelector('select[name="status_motivo"], #status_motivo');
                        if (!selectMotivo || selectMotivo.type === 'hidden' || window.getComputedStyle(selectMotivo).display === 'none') {
                            const motivoIndef = resultado_motivo || estado.telaFinal.mensagem;
                            if (!resultado_detalhes || resultado_detalhes === "encaminhado") {
                                resultado_detalhes = motivoIndef;
                            } else if (!resultado_detalhes.includes(motivoIndef)) {
                                resultado_detalhes = motivoIndef + " - " + resultado_detalhes;
                            }
                        }
                    }
                    const camposDet = docFinal.querySelectorAll('textarea[name="status_detalhes"], #status_atual_detalhes, textarea[name="motivo_detalhes"]');
                    camposDet.forEach(campo => {
                        if(resultado_detalhes !== "") {
                            campo.value = resultado_detalhes;
                            campo.innerHTML = resultado_detalhes; 
                        }
                    });
                } catch (erro) {}

                try {
                    if (resultado_motivo !== "" || resultado_detalhes !== "") {
                        const selectsMotivo = docFinal.querySelectorAll('select[name="status_motivo"], #status_motivo');
                        selectsMotivo.forEach((select) => {
                            for (let i = 0; i < select.options.length; i++) {
                                const opt = select.options[i];
                                const txtOpcao = opt.text.toUpperCase();
                                const valOpcao = opt.value.toUpperCase();
                                
                                if (txtOpcao.includes(resultado_motivo) || valOpcao.includes(resultado_motivo)) {
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
                    if (resultado === 'DEFERIR') {
                        if (docFinal.getElementById("modal_Deferir")) windowFinal.ShowModal("modal_Deferir");
                    } else {
                        if (docFinal.getElementById("modal_Indeferir")) windowFinal.ShowModal("modal_Indeferir");
                    }
                }
}

// ==============
// SECTION: ESTILOS E UI BASE
// ==============

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
        
        .mdi mdi-keyboard-backspace{
        color: #fff;
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
            color: #ae2727;
            font-weight: 750;
            font-size: 15px;
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

        .badge-parcial {
            background: #bdf7b6;
            color: #1c660d;
        }

        .badge-integral {
            background: #e8e5fc;
            color: #6658d3;
        }
        .badge-noite {
            background: #115185;
            color: #ffffff;
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

// Atualiza o input de distância do assistente (arredondamento 50m; nunca aceita texto de modo).
window.atualizarInputDistancia = function(distancia) {
    if (distancia === 'endereco' || distancia === 'coordenada') return;
    const numero = Number(distancia);
    if (!Number.isFinite(numero) || numero <= 0) return;
    const valorFinal = Math.round(numero / 50) * 50;
    const tentarAtualizar = (tentativa = 0) => {
        const input = document.getElementById('input-assistente-dist');
        if (!input) {
            if (tentativa < 10) setTimeout(() => tentarAtualizar(tentativa + 1), 200);
            return;
        }
        input.value = valorFinal;
    };
    tentarAtualizar();
};

window.atualizarListaEscolasDinamicamente = null;

// ==============
// SECTION: INICIALIZAÇÃO DO BOTÃO DO ASSISTENTE
// ==============

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
        
        vincularEventoUnico(btn, 'click', (e) => {
            e.preventDefault();
            const modal = document.getElementById('modal-assistente-analise');
            if (modal) {
                modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
            } else {
                window.abrirModalAssistente();
            }
        });
        document.body.appendChild(btn); 
    }
};

// ==============
// SECTION: CACHE DO ASSISTENTE
// ==============

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

// ==============
// SECTION: ABERTURA DO MODAL E MÁQUINA DE ESTADOS
// ==============

window.abrirModalAssistente = async function() {
    if (window.abrindoModalAssistente) return;
    window.abrindoModalAssistente = true;
    
    const ctx = extrairContextoFicha(window.getAlvoDocument());
    const doc = ctx.doc;
    if (typeof console !== 'undefined' && console.debug) console.debug('[ASSISTENTE] abrirModalAssistente');

    const modalAnterior = document.getElementById('modal-assistente-analise');
    if (modalAnterior?.parentNode) modalAnterior.parentNode.removeChild(modalAnterior);

    const idSolicitacaoAtual = ctx.idSolicitacao;
    const historicoRua = ctx.historicoRua;
    const escolasAptas = ctx.escolasAptas;
    const urlPesquisaRua = ctx.urlPesquisaRua;
    const encaminhamentoResolvido = ctx.encaminhamento;

    let cacheSalvo = window.getCacheAssistente(idSolicitacaoAtual);
    if (cacheSalvo && cacheSalvo.ultimoModo) {
        const parts = cacheSalvo.ultimoModo.split('_');
        if (parts.length === 2 && typeof window.setSharedStoreValue === 'function') {
            window.setSharedStoreValue('modoMapaAtual', parts[0]);
            window.setSharedStoreValue('modoTransporteAtual', parts[1]);
        }
    }
    
    if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();

    window.MODO_PADRAO = ctx.isMudanca ? 'Endereço' : 'Coordenada';
    if (!window.MODO_PADRAO) window.MODO_PADRAO = 'Endereço';
    const isMudanca = ctx.isMudanca;

    const enderecoCompleto = ctx.enderecoCompleto;
    const endRua = ctx.endRua;
    const ruaMatch = ctx.ruaMatch;
    const ehAnaliseInicial = ctx.ehAnalise;
    const nomeRuaTitulo = ctx.nomeRuaTitulo;
    const nomeStr = ctx.nomeAluno;
    //const nomesResponsaveis = ctx.nomesResponsaveis;
    const nomesResponsaveis = (nomeStr && ctx.nomesResponsaveis) 
    ? ctx.nomesResponsaveis + '; ou<br>' + nomeStr
    : ctx.nomesResponsaveis;    const sugestaoDeficienciaHtml = ctx.sugestaoDeficienciaHtml;
    let idEscolaAtual = ctx.idEscolaAtual;
    let nivelAlunoOriginal = ctx.nivelAlunoOriginal;
    let nivelAlunoNorm = ctx.nivelAlunoNorm;
    let isBercarioGeral = ctx.isBercarioGeral;

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
    
    vincularEventoUnico(document.getElementById('btn-fechar-assistente'), 'click', () => {
        if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
        const btnFinalizar = document.getElementById('btn-aplicar-resultado');
        if (btnFinalizar) {
            btnFinalizar.click();
        } else {
            modal.style.display = 'none';
        }
    });

    let estado = {
        ehAnalise: ehAnaliseInicial,
        mudancaOk: null,
        escolaProximaUser: null,
        escolaProximaCalc: null,
        ehEncaminhado: null,
        isEncaminhamentoDispensado: false,
        distancia: null,
        deficiencia: null, 
        dificuldadeAcesso: null,
        tentouResgate: false,
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
        isEspecial: ctx.isEspecial,
        nomeEscolaAtual: ctx.nomeEscolaAtual,
        areaRuralProcessada: false,
        deficienciaEspecialProcessada: false,
        pularDeficiencia: false,
        top3EscolasNomes: ""
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

    let dadosGeograficosSessao = window.getSharedStoreValue?.('dadosGeograficos');
    let dadosGeraisRotaSessao = window.getSharedStoreValue?.('dadosGeraisRota');

    function gravarDadosGeograficosSessao(valor) {
        dadosGeograficosSessao = valor;
        if (typeof window.setSharedStoreValue === 'function') {
            window.setSharedStoreValue('dadosGeograficos', valor);
        }
    }

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

    function gerarHtmlMensagensContexto() {
        const mensagens = [];
        if (ctx.historicoRua?.temMatch) {
            mensagens.push(`
                <span class="assistente-info-extra" style="display:block; margin-top:10px; color:#444; font-size:13px;">
                    <strong>Histórico de rua:</strong> ${ctx.historicoRua.motivo || 'Informação presente no cadastro de ruas'}.
                </span>
            `);
        }
        if (ctx.encaminhamento?.maisRecente) {
            const m = ctx.encaminhamento.maisRecente;
            const situacao = m.situacao && m.situacao.toUpperCase().includes('NÃO ATENDER') ? 'NÃO ATENDER' : 'DEFERIDO';
            const unidade = m.unidade || m.unidadeOrigem || 'unidade não informada';
            const ano = m.ano ? ` em ${m.ano}` : '';
            mensagens.push(`
                <span class="assistente-info-extra" style="display:block; margin-top:8px; color:#444; font-size:13px;">
                    <strong>Encaminhamento:</strong> ${situacao} para ${unidade}${ano}.
                </span>
            `);
        }
        return mensagens.join('');
    }

    // ==============
    // SECTION: MÁQUINA DE ESTADOS (renderizarPasso)
    // ==============
    async function renderizarPasso() {
        if (typeof console !== 'undefined' && console.debug) console.debug('[ASSISTENTE] renderizarPasso');
        const conteudo = document.getElementById('conteudo-assistente');
        if (!conteudo) return; 
        
        const btnVoltar = document.getElementById('btn-voltar-assistente');
        if (btnVoltar) {
            btnVoltar.style.display = historico.length > 0 ? 'flex' : 'none';
            vincularEventoUnico(btnVoltar, 'click', voltarPasso);
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
                            <li class="school-item" style="border-bottom:none; padding-bottom:0; margin-bottom:0;"><b>Nome:</b> ${nomesResponsaveis}</li>
                        </ul>
                    </div>
                    <div class="action-group">
                        <button id="btn-mudanca-sim" class="btn btn-success"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Sim, comprovante OK</button>
                        <button id="btn-mudanca-nao" class="btn btn-danger"><span class="mdi mdi-close" style="font-size: 16px; margin-right: 4px;"></span> Não, inválido/ausente</button>
                    </div>
                `;
                vincularEventoUnico(document.getElementById('btn-mudanca-sim'), 'click', () => { salvarHistorico(); estado.mudancaOk = true; renderizarPasso(); });
                vincularEventoUnico(document.getElementById('btn-mudanca-nao'), 'click', () => { salvarHistorico(); estado.mudancaOk = false; estado.telaFinal = { titulo: "INDEFERIR", mensagem: "O comprovante de endereço é inválido ou está ausente no caso de mudança." }; renderizarPasso(); });
                return;
            }

            if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();

            const titulo = estado.telaFinal.titulo;
            const mensagem = estado.telaFinal.mensagem;
            const tipoAcao = titulo.includes('INDEFERIR') ? 'INDEFERIR' : 'DEFERIR';
            const corTitulo = tipoAcao === 'DEFERIR' ? '#27ae60' : '#c0392b';


            // --- CORREÇÃO: Priorizar dados já definidos no estado, depois calcular ---

            let motivoAnalise = estado.telaFinal?.motivoAnalise || "";
            let textoDetalhes = estado.telaFinal?.textoDetalhes || "";

            if (tipoAcao === 'DEFERIR' && estado.ehEncaminhado === true) {
                textoDetalhes = textoDetalhes ? `${textoDetalhes} / encaminhado` : "encaminhado";
            }

            if (tipoAcao === 'DEFERIR' && estado.ehMaisProximaParcial === true) {
                if (textoDetalhes) {
                    textoDetalhes += " / Está na parcial mais próxima";
                } else {
                    textoDetalhes = "Está na parcial mais próxima";
                }
            }

// Se não houver termoBusca definido no estado, tentamos calcular baseados no tipo de ação
if (!motivoAnalise) {
    if (tipoAcao === 'DEFERIR') {
        if (estado.deficiencia === 'ALUNO') motivoAnalise = "ALUNO DEFICIENTE";
        else if (estado.deficiencia === 'FAMILIA') motivoAnalise = "PAI/MÃE DEFICIENTE";
        else if (estado.distancia !== null && estado.distancia >= 1500) motivoAnalise = "DISTÂNCIA MAIOR QUE 1500 METROS";
        else if (estado.dificuldadeAcesso === true) motivoAnalise = "DIFICULDADE DE ACESSO";
        else if (estado.ehAreaRural === true) motivoAnalise = "ÁREA RURAL";
        else if (estado.ehEncaminhado === true) {
            motivoAnalise = "ENCAMINHADO PELA SEÇÃO DE MATRICULAS";
        }

        if (!textoDetalhes && estado.ehEncaminhado === true) {
            textoDetalhes = "Encaminhado pela Central de Matrículas";
        }
    } else {
        // Lógica de Indeferimento
        if (isMudanca && estado.mudancaOk === false) {
            motivoAnalise = ""; 
        } else if (estado.distancia !== null && estado.distancia < 1500) {
            motivoAnalise = "DISTÂNCIA MENOR QUE 1500 METROS";
            if (estado.escolaProximaCalc === false || estado.escolaProximaUser === false) {
                textoDetalhes = "Além de não atingir a distância mínima, é também escola de opção";
            }
        } else {
            motivoAnalise = "ESCOLA POR OPÇÃO";
        }
    }
}


if (typeof console !== 'undefined' && console.debug) console.debug('[ASSISTENTE] Renderizando tela final:', { tipoAcao, motivoAnalise, textoDetalhes, distancia: estado.distancia });
            conteudo.innerHTML = `
                <div style="text-align:center; padding:10px;">
                    <h2 style="color:${corTitulo}; margin-top:0; font-size:24px; display:flex; align-items:center; justify-content:center; gap:8px;">
                        <span class="mdi ${tipoAcao === 'DEFERIR' ? 'mdi-check' : 'mdi-close'}" style="font-size: 28px;"></span>
                        ${titulo}
                    </h2>
                    <div class="message-box ${tipoAcao === 'DEFERIR' ? 'success' : 'danger'}">
                        ${mensagem}
                        ${motivoAnalise && !mensagem.includes(motivoAnalise)? `<br><br><b>Motivo:</b> ${motivoAnalise}` : ''}
                        ${textoDetalhes ? `<br><span class="text-warning" style="font-size:12px; display:inline-block; margin-top:5px;"><span class="mdi mdi-script-outline" style="font-size: 14px; margin-right: 4px;"></span> Obs: ${textoDetalhes}</span>` : ''}
                    </div>
                </div>
                <div class="action-group-col" style="margin-top:20px;">
                    <button id="btn-aplicar-resultado" class="btn ${tipoAcao === 'DEFERIR' ? 'btn-success' : 'btn-danger'}">
                        <span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Finalizar
                    </button>
                </div>
            `;

            vincularEventoUnico(document.getElementById('btn-aplicar-resultado'), 'click', () => {
    const docFinal = window.getAlvoDocument(); 
    
    // Tenta ler o campo de distância do HTML caso o estado esteja vazio
    let valorDistancia = estado.distancia;
    if (valorDistancia === null || valorDistancia === undefined) {
        const campo = docFinal.querySelector('input[name="distancia_aferida"], #distancia_aferida, #input-assistente-dist');
        valorDistancia = campo ? parseInt(campo.value, 10) : null;
    }

    // Agora usa valorDistancia em vez de estado.distancia
    preencheAnalise(tipoAcao, motivoAnalise, textoDetalhes, valorDistancia);
});
            return;
        }

        const temSugestaoDeficiencia = sugestaoDeficienciaHtml === 'ALUNO' || sugestaoDeficienciaHtml === 'FAMILIA';
        if ((historicoRua.ehAreaRural || historicoRua.ehDificuldadeAcesso) && !estado.areaRuralProcessada) {
            if (temSugestaoDeficiencia && estado.deficiencia === null) {
                estado.pularDeficiencia= false;
            } else {
                estado.pularDeficiencia= true;
                estado.areaRuralProcessada = true;
                if (estado.deficiencia === 'ALUNO') {
                    estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por motivo de deficiência do aluno.", motivoAnalise: "ALUNO DEFICIENTE" };
                } else if (estado.deficiencia === 'FAMILIA') {
                    estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por motivo de deficiência do responsável.", motivoAnalise: "PAI/MÃE DEFICIENTE"};
                } else if (historicoRua.ehAreaRural) {
                    estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por ser ÁREA RURAL.", motivoAnalise: "ÁREA RURAL" };
                } else if(historicoRua.ehDificuldadeAcesso || estado.dificuldadeAcesso === true) {
                    estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por motivo de DIFICULDADE DE ACESSO.", motivoAnalise: "DIFICULDADE DE ACESSO" };
                } else {estado.pularDeficiencia= false;}
                return renderizarPasso();
            }
        }

        if (estado.areaRuralProcessada && estado.pularDeficiencia=== false && estado.deficiencia === null) {
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
            
            vincularEventoUnico(document.getElementById('btn-def-aluno'), 'click', () => { salvarHistorico(); estado.deficiencia = 'ALUNO'; renderizarPasso(); });
            vincularEventoUnico(document.getElementById('btn-def-familia'), 'click', () => { salvarHistorico(); estado.deficiencia = 'FAMILIA'; renderizarPasso(); });
            vincularEventoUnico(document.getElementById('btn-def-nao'), 'click', () => { salvarHistorico(); estado.deficiencia = false; renderizarPasso(); });
            return;
        }

        if (estado.escolaProximaUser === null) {

            let dadosGeograficos = dadosGeograficosSessao;

            if (dadosGeograficos && (dadosGeograficos.erro || !dadosGeograficos.geoEndereco_Latit) && !estado.tentouResgate) {
                estado.tentouResgate = true; 
                
                const iframeMap = ctx.iframeMapa;
                if (iframeMap?.src?.includes('destination=')) {
                    const urlCompleta = iframeMap.src;
                    const coordOrigin = separarCoordenadasIframe(urlCompleta.match(/origin=([^&]+)/i));
                    const coordDest = separarCoordenadasIframe(urlCompleta.match(/destination=([^&]+)/i));
                    
                    if (coordOrigin.lat && coordDest.lat) {
                        gravarDadosGeograficosSessao({
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

                if (ctx.idSolicitacao) {
                    dadosGeograficosSessao = null;
                    if (typeof window.setSharedStore === 'function') {
                        window.setSharedStore({ dadosGeograficos: null });
                    }
                    const windowAlvo = doc.defaultView || window;
                    const baseUrlAberta = windowAlvo.location.href.split('?')[0];
                    const urlFallback = baseUrlAberta.replace('ficha_transporte.php', 'ficha_transporte_nova_versao.php') + '?id_solicitacao=' + ctx.idSolicitacao;

                    if (typeof window.extrairDadosGeograficos === 'function') {
                        window.extrairDadosGeograficos(urlFallback).then(dados => {
                            gravarDadosGeograficosSessao(dados ? dados : { erro: true });
                            renderizarPasso();
                        });
                        return;
                    }
                }
            }

            const mapMode = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
            dadosGeraisRotaSessao = window.getSharedStoreValue?.('dadosGeraisRota') || dadosGeraisRotaSessao;
            estado.distanciaSugeridaInput = obterDistanciaSugeridaInput(ctx, mapMode, dadosGeraisRotaSessao);
            
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
                        <span class="mdi mdi-graph" style="font-size: 22px; margin-right: 6px;"></span> Verificação de unidade escolar e distância
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

    setTimeout(() => { inputDist.focus(); }, 100);
    vincularEventoUnico(inputDist, 'focus', function () { this.select(); });
    vincularEventoUnico(inputDist, 'input', function () { this.dataset.editado = 'true'; });
    vincularEventoUnico(inputDist, 'keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); } });

    const modoMapa = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
    const rota = dadosGeraisRotaSessao || window.getSharedStoreValue?.('dadosGeraisRota');
    if (rota) {
        const distancia = modoMapa === 'endereco' ? rota.distanciaEnd : rota.distanciaCoord;
        window.atualizarInputDistancia(distancia);
    }
}

                vincularEventoUnico(document.getElementById('btn-esc-sim'), 'click', () => { 
                    const dist = parseInt(inputDist.value);
                    if (isNaN(dist) || dist < 0) return alert("Por favor, insira uma distância válida em metros.");
                    salvarHistorico(); 
                    estado.distancia = dist;
                    estado.escolaProximaUser = true; 
                    if (estado.distancia >= 1500) {
                        estado.telaFinal = { titulo: "DEFERIR", mensagem: `A distância atinge o requisito mínimo (${estado.distancia}m) e os critérios da escola ou encaminhamento estão corretos.` };
                    }
                    renderizarPasso(); 
                });
                
                vincularEventoUnico(document.getElementById('btn-esc-nao'), 'click', () => { 
                    const dist = parseInt(inputDist.value);
                    if (isNaN(dist) || dist < 0) return alert("Por favor, insira uma distância válida em metros.");
                    salvarHistorico(); 
                    estado.distancia = dist;
                    estado.escolaProximaUser = false; 
                    renderizarPasso(); 
                });
                return;
            }

            dadosGeograficos = dadosGeograficosSessao;
            if (!dadosGeograficos || (!dadosGeograficos.geoEndereco_Latit && !dadosGeograficos.erro)) {
                if (!estado.tentativasEsperaGeo) estado.tentativasEsperaGeo = 0;
                estado.tentativasEsperaGeo++;
                if (estado.tentativasEsperaGeo > 15) {
                    gravarDadosGeograficosSessao({ erro: true });
                    setTimeout(renderizarPasso, 100);
                    return;
                }
                conteudo.innerHTML = `<div style="text-align:center; padding:20px;" class="text-info"><span class="mdi mdi-refresh" style="font-size: 22px; margin-right: 6px;"></span> <b>Calculando escolas mais próximas...</b></div>`;
                setTimeout(renderizarPasso, 500); 
                return;
            }

            const latAluno = dadosGeograficos.geoEndereco_Latit;
            const lonAluno = dadosGeograficos.geoEndereco_Longit;
            
            estado.nomeEscolaAtual = ctx.nomeEscolaAtual;
            const escolaSelecionada = ctx.escolaRegistro;
            if (escolaSelecionada && !estado.distanciasVerificadasInicialmente) {
                estado.distanciasVerificadasInicialmente = true;
                const transporteAtual = window.getSharedStoreValue?.('modoTransporteAtual') || 'pe';
                estado.perfilOSRM = transporteAtual === 'carro' ? 'driving' : 'foot';
            }
            estado.isEspecial = ctx.isEspecial;

            // Definir variáveis de modo em escopo mais amplo para uso em atualizarListaEscolasDinamicamente e OSRM
            let mapModeAtual = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
            let transpModeAtual = window.getSharedStoreValue?.('modoTransporteAtual') || 'pe';

            // --- SECTION: SCHOOL LIST MANAGEMENT ---
            const atualizarListaEscolasDinamicamente = async (forcarRecalculo = false) => {
                dadosGeraisRotaSessao = window.getSharedStoreValue?.('dadosGeraisRota') || dadosGeraisRotaSessao;
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
                    listaExibirBase = montarListaEscolasExibicao(escolasAptas, latAluno, lonAluno, chaveListaAtual, idEscolaAtual, dadosGeraisRotaSessao);
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
                estado.top3EscolasNomes = listaOrdenada.slice(0, 3).map(e => e.nome).join(' / ');

                // New exception rule for skipping Encaminhamento step
                const temDeficiencia = (estado.deficiencia === 'ALUNO' || estado.deficiencia === 'FAMILIA');
                if (estado.escolaProximaUser === true || (temDeficiencia && ehMaisProximaIntegral && estado.distancia < 3000) || (temDeficiencia && estado.distancia < 1800)) {
                    estado.isEncaminhamentoDispensado = true;
                }
                
                // GARANTIA: Se o usuário clicou que NÃO é a mais próxima, força a exibição do Encaminhamento
                if (estado.escolaProximaUser === false) {
                    if (!(temDeficiencia && estado.distancia < 1800)) {
                        estado.isEncaminhamentoDispensado = false;
                    }
                }

                let statusText = "";
                if (listaOrdenada.length === 0) {
                     statusText = `<span class="text-warning"><span class="mdi mdi-lightning-bolt" style="font-size: 16px; margin-right: 4px;"></span> Verifique o nível do aluno. Nenhuma opção compatível foi encontrada.</span>`;
                } else if (ehMaisProxima) {
                     statusText = `<span class="text-success"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> A escola atual parece ser a MAIS PRÓXIMA de ${nivelAlunoOriginal}.</span>`;
                } else if (ehMaisProximaParcial) {
                     statusText = `<span class="text-info"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Parece estar na UE mais próxima de ENSINO PARCIAL para ${nivelAlunoOriginal}.</span>`;
                } else {
                     statusText = `<span class="text-danger"><span class="mdi mdi-lightning-bolt" style="font-size: 16px; margin-right: 4px;"></span> Parece que há UEs mais próximas para ${nivelAlunoOriginal}:</span>`;
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
                    const latOrigemLista = (mapModeAtual === 'endereco' && dadosGeraisRotaSessao?.coordAlunoEnd && typeof dadosGeraisRotaSessao.coordAlunoEnd !== 'string') ? dadosGeraisRotaSessao.coordAlunoEnd.lat : latAluno;
                    const lonOrigemLista = (mapModeAtual === 'endereco' && dadosGeraisRotaSessao?.coordAlunoEnd && typeof dadosGeraisRotaSessao.coordAlunoEnd !== 'string') ? dadosGeraisRotaSessao.coordAlunoEnd.lon : lonAluno;

                    listaOrdenada.forEach((esc, i) => {
                        const cor = String(esc.id) === String(idEscolaAtual) ? 'selected' : '';
                        const tagAtual = String(esc.id) === String(idEscolaAtual) ? `<span class="mdi mdi-star text-warning" style="font-size: 14px; margin-left: 4px;" title="Escola Solicitada"></span> ` : '';
                        
                        let sufixoMaps = estado.perfilOSRM === 'foot' ? "&travelmode=walking&dirflg=w" : "";
                        let urlConfere = "";
                        
                        if (mapModeAtual === 'endereco' && dadosGeraisRotaSessao && typeof dadosGeraisRotaSessao.coordAlunoEnd === 'string') {
                            let endStrEncode = encodeURIComponent(dadosGeraisRotaSessao.coordAlunoEnd);
                            urlConfere = `https://maps.google.com/maps?saddr=${endStrEncode}&daddr=${esc.lat}+${esc.lon}${sufixoMaps}`;
                        } else {
                            urlConfere = `https://maps.google.com/maps?saddr=${latOrigemLista}+${lonOrigemLista}&daddr=${esc.lat}+${esc.lon}${sufixoMaps}`; //nao alterar
                        }
                        
                        let iconPath = estado.perfilOSRM === 'foot' ? 'mdi-walk' : 'mdi-car';
                        let txtDist = `<span class="text-warning"><span class="mdi mdi-refresh" style="font-size: 14px; margin-right: 2px;"></span> <i>Calculando trajeto...</i></span>`;
                        if (estado.distanciasOSRM[esc.id] !== undefined) {
                            if (estado.distanciasOSRM[esc.id] === 'Erro' || estado.distanciasOSRM[esc.id] === null) {
                                let distHaversine = Math.round(esc.distancia + 100);
                                txtDist = `<span class="text-muted"><span class="mdi ${iconPath}" style="font-size: 14px; margin-right: 2px;"></span> +- ${distHaversine}m (estimativa)</span>`;
                            } else {
                                let distArredondada = Math.round(estado.distanciasOSRM[esc.id] / 50) * 50;
                                txtDist = `<span class="text-warning"><span class="mdi ${iconPath}" style="font-size: 14px; margin-right: 2px;"></span> Trajeto: <b>${distArredondada}m</b></span>`;
                            }
                        } else if (!estado.ehAnalise) {
                            const distHaversine = Math.round(esc.distancia + 100);
                            txtDist = `<span class="text-muted"><span class="mdi ${iconPath}" style="font-size: 14px; margin-right: 2px;"></span> +- ${distHaversine}m (estimativa)</span>`;
                        }

                        let classeBadge="";
                        if (esc.periodosEncontrados.includes('INTEGRAL')) {
                            classeBadge = ' badge-integral';
                        } else if (esc.periodosEncontrados.includes('PARCIAL')) {
                            classeBadge = ' badge-parcial';
                        } else if (esc.periodosEncontrados.includes('NOITE')) {
                            classeBadge = ' badge-noite';
                        }

                        listaHtml += `<li data-id="${esc.id}" class="school-item ${cor}">
                            ${tagAtual}${i + 1}º - ${esc.nome} <span class="badge${classeBadge}">${esc.periodosEncontrados}</span>
                            <div class="school-meta dist-texto">${txtDist}
                            <a href="${urlConfere}" target="_blank" onclick="if(window.copiarCoordenadasEndereco) window.copiarCoordenadasEndereco();" class="link-action">
                                <span class="mdi mdi-map" style="font-size: 14px; margin-right: 2px;"></span> Ver rota no Google Maps
                            </a></div>
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
                const extraInfoContainer = document.getElementById('assistente-info-contexto');
                if (extraInfoContainer) {
                    extraInfoContainer.innerHTML = gerarHtmlMensagensContexto();
                }
                
                // Verificar se há erros de cálculo e mostrar botão refresh
                const temErros = Object.values(estado.distanciasOSRM).some(dist => dist === 'Erro' || dist === null);
                const btnRefreshEnd = document.getElementById('btn-refresh-lista');
                if (btnRefreshEnd) {
                    btnRefreshEnd.style.display = temErros ? 'block' : 'none';
                }
                
                // Verificar se há distâncias OSRM ainda não calculadas e iniciar se necessário
                let faltaCalcularAgora = listaExibirBase.some(esc => estado.distanciasOSRM[esc.id] === undefined);
                if (estado.ehAnalise && faltaCalcularAgora && typeof window.calcularTrajetoOSRM === 'function' && !estado.buscandoOSRM) {
                    estado.buscandoOSRM = true;
                    if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
                    window.osrmAbortController = new AbortController();

                    (async () => {
                        const meuSignal = window.osrmAbortController.signal;
                        try {
                            const latOrigemLista = (mapModeAtual === 'endereco' && dadosGeraisRotaSessao?.coordAlunoEnd && typeof dadosGeraisRotaSessao.coordAlunoEnd !== 'string') ? dadosGeraisRotaSessao.coordAlunoEnd.lat : latAluno;
                            const lonOrigemLista = (mapModeAtual === 'endereco' && dadosGeraisRotaSessao?.coordAlunoEnd && typeof dadosGeraisRotaSessao.coordAlunoEnd !== 'string') ? dadosGeraisRotaSessao.coordAlunoEnd.lon : lonAluno;

                            for (let esc of listaExibirBase) {
                                if (estado.distanciasOSRM[esc.id] === undefined) {
                                    const dist = await window.calcularTrajetoOSRM(latOrigemLista, lonOrigemLista, esc.lat, esc.lon, estado.perfilOSRM, meuSignal);
                                    if (meuSignal.aborted) break; 
                                    
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
                            // Garantir que o estado de busca seja sempre resetado
                            try {
                                estado.buscandoOSRM = false;
                            } catch (e) {}

                            // limpar global abort controller se existir
                            try {
                                if (window.osrmAbortController) {
                                    window.osrmAbortController = null;
                                }
                            } catch (e) {}

                            const temErrosFinal = Object.values(estado.distanciasOSRM).some(dist => dist === 'Erro' || dist === null);
                            const btnRefreshEnd = document.getElementById('btn-refresh-lista');
                            if (btnRefreshEnd) {
                                btnRefreshEnd.style.display = temErrosFinal ? 'block' : 'none';
                            }
                            if (typeof window.atualizarListaEscolasDinamicamente === 'function') {
                                window.atualizarListaEscolasDinamicamente(false);
                            }
                        }
                    })();
                }
            };

            window.atualizarListaEscolasDinamicamente = atualizarListaEscolasDinamicamente;
            if (typeof console !== 'undefined' && console.debug) console.debug('[ASSISTENTE] Lista de escolas pronta para modo', mapModeAtual);

            if (!estado.ehAnalise) {
                conteudo.innerHTML = `
                    <div id="container-lista-escolas"></div>
                    <div id="assistente-info-contexto"></div>
                `;
                await atualizarListaEscolasDinamicamente();

                const btnRefresh = document.getElementById('btn-refresh-lista');
                if (btnRefresh) {
                    vincularEventoUnico(btnRefresh, 'click', async () => {
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
                    <input type="number" id="input-assistente-dist" class="input-field" value="${estado.distanciaSugeridaInput}" required>
                    <label for="input-assistente-dist" class="input-label">Qual é a distância aferida (em metros)?</label>
                </div>

                <div class="action-group">
                    <button id="btn-esc-sim" class="btn btn-success"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Está na mais próxima</button>
                    <button id="btn-esc-nao" class="btn btn-danger"><span class="mdi mdi-close" style="font-size: 16px; margin-right: 4px;"></span> Não é a mais próxima</button>
                </div>
            `;

            await atualizarListaEscolasDinamicamente();
            
            dadosGeraisRotaSessao = window.getSharedStoreValue?.('dadosGeraisRota') || dadosGeraisRotaSessao;
            const modoMapaAtual = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
            if (dadosGeraisRotaSessao) {
                const distancia = modoMapaAtual === 'endereco' ? dadosGeraisRotaSessao.distanciaEnd : dadosGeraisRotaSessao.distanciaCoord;
                if (typeof window.atualizarInputDistancia === 'function') {
                    window.atualizarInputDistancia(distancia);
                }
            }

            const btnRefresh = document.getElementById('btn-refresh-lista');
            if (btnRefresh) {
                vincularEventoUnico(btnRefresh, 'click', async () => {
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

            const inputDist = document.getElementById('input-assistente-dist');
            if (inputDist) {
                setTimeout(() => { inputDist.focus(); }, 100);
                vincularEventoUnico(inputDist, 'focus', function () { this.select(); });
                vincularEventoUnico(inputDist, 'input', function () { this.dataset.editado = 'true'; });
                vincularEventoUnico(inputDist, 'keydown', function(e) { 
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (window.destaqueSimGlobal) {
                            const b = document.getElementById('btn-esc-sim'); if (b) b.click();
                        } else {
                            const b = document.getElementById('btn-esc-nao'); if (b) b.click();
                        }
                    } 
                });
            }

            vincularEventoUnico(document.getElementById('btn-esc-sim'), 'click', () => { 
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
            });
            
            vincularEventoUnico(document.getElementById('btn-esc-nao'), 'click', () => { 
                if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
                const dist = parseInt(inputDist.value);
                if (isNaN(dist) || dist < 0) return alert("Por favor, insira uma distância válida em metros.");
                salvarHistorico(); 
                estado.distancia = dist;
                estado.escolaProximaUser = false; 
                renderizarPasso(); 
            });

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
            
            if (!pergunta && historicoRua.temMatch) {
                if (historicoRua.ehDistanciaMaior1500 && estado.distancia < 1500) {
                    pergunta = "Confirma essa distância? Essa rua costuma ser atendida por DISTANCIA MAIOR QUE 1500 METROS.";
                } else if (historicoRua.ehDistanciaMenor1500 && estado.distancia >= 1500) {
                    pergunta = "Confirma essa distância? Essa rua costuma ser indeferida por DISTANCIA MENOR QUE 1500 METROS.";
                } else if (historicoRua.ehEscolaPorOpcao && estado.escolaProximaUser === true && !estado.escolaProximaCalc) {
                    pergunta = "Confirma que a escola é a mais próxima? Essa rua costuma ser indeferida como ESCOLA POR OPÇÃO e a calculadora indica que existem opções mais próximas.";
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
                    vincularEventoUnico(document.getElementById('btn-confirma-sim'), 'click', () => { salvarHistorico(); estado.confirmacaoFeita = true; renderizarPasso(); });
                    vincularEventoUnico(document.getElementById('btn-confirma-nao'), 'click', () => { voltarPasso(); });
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
            
            vincularEventoUnico(document.getElementById('btn-def-aluno'), 'click', () => { salvarHistorico(); estado.deficiencia = 'ALUNO'; if (!estado.isEspecial && estado.escolaProximaUser === true) { estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por motivo de deficiência do aluno." }; } renderizarPasso(); });
            vincularEventoUnico(document.getElementById('btn-def-familia'), 'click', () => { salvarHistorico(); estado.deficiencia = 'FAMILIA'; if (!estado.isEspecial && estado.escolaProximaUser === true) { estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por motivo de deficiência do responsável." }; } renderizarPasso(); });
            vincularEventoUnico(document.getElementById('btn-def-nao'), 'click', () => { salvarHistorico(); estado.deficiencia = false; renderizarPasso(); });
            return;
        }

        if (estado.deficiencia === 'ALUNO' && estado.isEspecial && !estado.deficienciaEspecialProcessada) {
            estado.deficienciaEspecialProcessada = true;
            estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido automaticamente: Aluno Especial + Deficiência.", motivoAnalise: "ALUNO DEFICIENTE", textoDetalhes: "ALUNO DEFICIENTE" };
            return renderizarPasso();
        }

        if (estado.distancia < 1500 && estado.deficiencia === false && estado.dificuldadeAcesso === null) {

            if (historicoRua.ehDificuldadeAcesso && estado.escolaProximaUser === true && estado.distancia > 350) {
                estado.dificuldadeAcesso = true;
                estado.telaFinal = {
                    titulo: "DEFERIR",
                    mensagem: "Essa rua costuma ser atendida por DIFICULDADE DE ACESSO.",
                    motivoAnalise: "DIFICULDADE DE ACESSO",
                    textoDetalhes: "Essa rua costuma ser atendida por DIFICULDADE DE ACESSO.",
                    urlPesquisaRua: urlPesquisaRua
                };
                return renderizarPasso();
            }

            let MsgDificuldadeAcesso = "";
            if (!ruaMatch || !ruaMatch.resultado_motivo === "DIFICULDADE DE ACESSO") {
                MsgDificuldadeAcesso = "<b>Esse local não está cadastrado para atendimento por dificuldade de acesso. </b>";
            }
                
            conteudo.innerHTML = `
                <h3 class="section-title text-warning">
                    <span class="mdi mdi-highway" style="font-size: 22px; margin-right: 6px;"></span> Dificuldade de Acesso
                </h3>
                
                <p>${MsgDificuldadeAcesso}O trajeto da residência até a escola possui alguma dificuldade de acesso excepcional?</p>
                <p>São consideradas dificuldade de acesso:</p>
                <ul>
                  <li>Rodovias;</li>
                  <li>Estradas de terra;</li>
                  <li>Vias sem nenhum tipo de calçada;</li>
                  <li>Locais que proíbam expressamente a passagem de pedestres.</li>
                </ul>
                <p>Não são motivos para dificuldade de acesso:</p>
                <ul>
                <li>Becos e vielas;</li>
                <li>Favelas;</li>
                <li>Escadas, rampas e passarelas;</li>
                <li>Assaltos e problemas de segurança pública;</li>
                <li>Presença de moradores de rua ou usuários de drogas;</li>
                <li>Ruas íngremes;</li>
                <li>Calçadas desniveladas.</li>
                </ul>
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
            
            vincularEventoUnico(document.getElementById('btn-dif-sim'), 'click', () => { salvarHistorico(); estado.dificuldadeAcesso = true; if (estado.escolaProximaUser === false) { renderizarPasso(); } else { estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido devido a Dificuldade de Acesso comprovada na rota." }; renderizarPasso(); } });
            vincularEventoUnico(document.getElementById('btn-dif-nao'), 'click', () => { salvarHistorico(); estado.dificuldadeAcesso = false; estado.telaFinal = { titulo: "INDEFERIR", mensagem: "A distância não atinge 1500m e o caso não se enquadra nas exceções." }; renderizarPasso(); });
            return;
        }

        const excecaoGarantida = (estado.deficiencia === 'ALUNO' || estado.deficiencia === 'FAMILIA' || estado.dificuldadeAcesso === true);
        let msgExcecao = "";
        if (excecaoGarantida && estado.distancia < 1500) {
            msgExcecao = "Embora a distância seja inferior a 1500m, ";
        }
        if (excecaoGarantida && estado.distancia >= 1500) {
            msgExcecao = "Além da distância atingir o requisito mínimo (1500m), ";
        }
        if (excecaoGarantida && estado.deficiencia === 'ALUNO') {
            msgExcecao = msgExcecao + "consta deficiência do aluno, o que garante o direito ao transporte escolar independentemente da distância.";
        }
        if (excecaoGarantida && estado.deficiencia === 'FAMILIA') {
            msgExcecao = msgExcecao + "consta deficiência Na família, o que garante o direito ao transporte escolar independentemente da distância.";
        }
        if (excecaoGarantida && estado.dificuldadeAcesso === true) {
            msgExcecao = msgExcecao + "foi confirmada dificuldade de acesso, o que garante o direito ao transporte escolar independentemente da distância.";
        }

        if (estado.escolaProximaUser === false && (estado.distancia >= 1500 || excecaoGarantida) && estado.ehEncaminhado === null) {
            if (estado.isEncaminhamentoDispensado) {
                estado.telaFinal = { titulo: "DEFERIR", mensagem: msgExcecao };
                renderizarPasso();
                return;
            }

            const windowAlvo = doc.defaultView || window;
            const docHref = windowAlvo.location.href;
            const isFichaAntiga = docHref.includes('ficha_transporte.php') && !docHref.includes('nova_versao');

            let msgCopiado = "";
            let dataNasc = ctx.dataNascimento || 'Não informada';
            if (dataNasc && dataNasc !== 'Não informada') {
                const dn = dataNasc;
                if (dn) {
                    dataNasc = dn.trim();
                    try {
                        const txt = document.createElement('textarea');
                        txt.value = dataNasc;
                        document.body.appendChild(txt);
                        txt.select();
                        document.execCommand('copy');
                        document.body.removeChild(txt);
                        msgCopiado = `<div class='message-box success' style='font-size:12px; margin-top:10px; background-color: #d4efdf; color: #27ae60; padding: 8px; border-radius: 4px; border: 1px solid #a9dfbf;'><span class="mdi mdi-check" style="font-size: 14px; margin-right: 4px;"></span> Data de nascimento já copiada, basta colar no SOMARH.</div>`;
                    } catch(e) {}
                }
            }

            const msgEncaminhamentoHtml = encaminhamentoResolvido.msgEncaminhamentoHtml;

            let infoExtraHtml = "";
            if (isFichaAntiga) {
                infoExtraHtml = `
                    <div class="school-list-container" style="font-size:12px; margin-top:10px;">
                        <b>Nome:</b> ${nomeStr}<br>
                        <b>Nasc:</b> ${dataNasc}<br><br>
                        <ul style="padding-left: 15px; margin: 0; display: flex; flex-direction: column; gap: 8px;">
                            <li><b>Em <u>Verificação de Semelhança</u></b> os campos "Tipo Inscrição" e "Observações" não podem conter o termo "Transf. - Outros".</li>
                            <li><b>Em <u>dados do candidato</u>, o endereço deve ser:</b><br>${enderecoCompleto}</li>
                            <li><b>Em <u>Unidades Escolares</u>, deve ter escolhido as escolas mais próximas:</b><br>${estado.top3EscolasNomes}</li>
                            <li><b>Em <u>Status Inscrição</u>, deve constar:</b><br>"encaminhado(a) para ${estado.nomeEscolaAtual}"</li>
                        </ul>
                    </div>
                `;
            }

            conteudo.innerHTML = `
                ${msgEncaminhamentoHtml}
                <h3 class="section-title text-primary">
                    <span class="mdi mdi-swap-horizontal-variant" style="font-size: 22px; margin-right: 6px;"></span> Encaminhamento por falta de vaga
                </h3>
                <p>Verifique no SOMARH e nas planilhas da Central de Matrículas se há <b>encaminhamento válido</b> por falta de vaga na UE mais próxima de casa.</p>
                <p class="text-muted" style="font-size:12px;"><i>(As informações do encaminhamento devem estar como abaixo:).</i></p>
                ${infoExtraHtml}
                ${msgCopiado}
                <div class="action-group" style="margin-top:20px;">
                    <button id="btn-enc-sim" class="btn btn-success"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Sim, possui</button>
                    <button id="btn-enc-nao" class="btn btn-danger"><span class="mdi mdi-close" style="font-size: 16px; margin-right: 4px;"></span> Não possui</button>
                </div>
            `;
            vincularEventoUnico(document.getElementById('btn-enc-sim'), 'click', () => { salvarHistorico(); estado.ehEncaminhado = true; estado.telaFinal = { titulo: "DEFERIR", mensagem: `A distância atinge o requisito mínimo (${estado.distancia}m) ou possui exceção válida, e os critérios de encaminhamento estão corretos.` }; renderizarPasso(); });
            vincularEventoUnico(document.getElementById('btn-enc-nao'), 'click', () => { salvarHistorico(); estado.ehEncaminhado = false; estado.telaFinal = { titulo: "INDEFERIR", mensagem: "O aluno não está na escola mais próxima e NÃO possui encaminhamento justificado por falta de vaga." }; renderizarPasso(); });
            return;
        }
    }

    window.abrindoModalAssistente = false;
    renderizarPasso(); 
};