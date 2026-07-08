// ==============
// SECTION: UTILITÁRIOS E HELPERS
// ==============

// Normaliza um texto removendo acentos, convertendo para maiúsculas e ajustando espaços.
if (typeof window.normalizarTexto !== 'function') {
    window.normalizarTexto = function(texto) {
        if (!texto) return "";
        return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/º|ª/g, "O").trim();
    };
}

// Percorre iframes até achar o documento com o status da ficha de atendimento (ignora erros de cross-origin).
window.getAlvoDocument = function() {
    // Busca no documento o elemento que indica o status do pedido.
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

// Vincula um evento a um elemento HTML apenas uma vez, usando dataset para controle.
function vincularEventoUnico(elemento, evento, handler) {
    if (!elemento) return;
    const chave = 'bound' + evento;
    if (elemento.dataset[chave]) return;
    elemento.dataset[chave] = 'true';
    elemento.addEventListener(evento, handler);
}

// Extrai o valor de um elemento de formulário (input) ou o seu texto interno (innerText).
function lerValorElemento(el) {
    if (!el) return '';
    return (el.value != null && el.value !== '') ? String(el.value).trim() : String(el.innerText || '').trim();
}

// Verifica se um campo do formulário foi preenchido com um valor válido.
function campoPreenchidoNoDoc(doc, id) {
    const el = doc.getElementById(id);
    if (!el) return false;
    const val = lerValorElemento(el).toUpperCase();
    return val !== '' && val !== 'NÃO' && val !== 'NAO' && val !== '0' && val !== 'SELECIONE' && val !== 'NENHUMA';
}

// Busca em uma tabela HTML o valor associado a rótulos (labels) específicos.
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

// Obtém o nome do aluno da ficha, buscando em inputs ou rótulos da tabela.
function extrairNomeAluno(doc) {
    const elNome = doc.querySelector('input[name="nome_aluno"]') || doc.querySelector('input[name="nome"]') || doc.getElementById('nome_aluno');
    let nome = elNome ? elNome.value.trim() : '';
    if (!nome) nome = extrairTextoEtiqueta(doc, ['Nome do aluno', 'Nome', 'Candidato']);
    return nome || 'Não identificado';
}

// Obtém a data de nascimento do aluno da ficha.
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

window.calcularNivelPorIdade = function(doc) {
    const dataNascStr = extrairDataNascimento(doc);
    if (!dataNascStr) return null;
    
    const parts = dataNascStr.split('/');
    if (parts.length !== 3) return null;
    
    const nasc = new Date(parts[2], parts[1] - 1, parts[0]);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    
    const faixa = FAIXAS_ETARIAS_NIVEL.find(f => idade >= f.idade && idade <= f.idadeMaxima);
    return faixa ? window.normalizarTexto(faixa.nivel) : null;
};

// Extrai o nível de ensino do aluno (ex: Infantil I, 1º Ano, etc.) e o normaliza.
function extrairNivelAluno(doc) {
    let nivelOriginal = extrairTextoEtiqueta(doc, ['Nível']);
    
    // Fallback: Tenta buscar por elemento bold se não achar na etiqueta
    if (!nivelOriginal) {
        doc.querySelectorAll('span[style*="font-size: 16px"][style*="font-weight: bold"]').forEach(span => {
            const texto = span.innerText.trim().toUpperCase();
            if (texto && texto !== 'INTEGRAL' && texto !== 'PARCIAL' && texto !== 'NOITE') nivelOriginal = texto;
        });
    }

    // Fallback: Tenta buscar pelo select
    const selectNivel = doc.getElementById('nivel');
    const valorSelect = (selectNivel?.options[selectNivel.selectedIndex]) ? (selectNivel.options[selectNivel.selectedIndex].text || selectNivel.value) : '';
    if (!nivelOriginal) nivelOriginal = valorSelect;

    // 1. Verifica se o nível obtido existe em alguma escola da base
    const nivelExisteNaBase = escolasDB.some(esc => 
        esc.turmas && esc.turmas.some(t => window.normalizarTexto(t.nivel) === nivelOriginal)
    );


    // --- LOGICA DE FALLBACK UNIFICADA ---
    // Se o nível extraído for ambíguo (ex: Berçário Inicial) ou vazio, calcula pela idade
    const ehAmbiguo = !nivelOriginal || !nivelExisteNaBase || (nivelOriginal.includes('BERCARIO') && valorSelect === 'BERCARIO INICIAL');
    
    if (ehAmbiguo) {
        const nivelPorIdade = window.calcularNivelPorIdade(doc);
        if (nivelPorIdade) {
            nivelOriginal = nivelPorIdade;
        }
    }

    let nivelNorm = window.normalizarTexto(nivelOriginal);
    nivelNorm = nivelNorm.replace(/([0-9]+)\s*[Oº\.]\s*ANO/g, '$1O ANO');
    if (nivelNorm.includes('EJA')) nivelNorm = 'EJA';
    if (nivelNorm.includes('ESPECIAL')) nivelNorm = 'ESPECIAL';
    
    return { 
        nivelOriginal, 
        nivelNorm, 
        isBercarioGeral: nivelNorm.includes('BERCARIO') && nivelNorm !== 'BERCARIO INICIAL' && nivelNorm !== 'BERCARIO FINAL' 
    };
}

// Identifica qual é a escola atual do aluno com base no ID da unidade ou pelas coordenadas do mapa.
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

// Busca a rua do endereço nas informações carregadas do banco de ruas.js.
function buscarMatchRua(ruasDB, idUnidade, cepVal, endRuaNorm, endBairroNorm) {
    if (!ruasDB?.length) return null;
    return ruasDB.find(r => {
        const rCep = r.cep ? String(r.cep).replace(/\D/g, '') : '';
        if (r.id_unidade == idUnidade && rCep && cepVal && rCep === cepVal) return true;
        return r.id_unidade == idUnidade && window.normalizarTexto(r.logradouro) === endRuaNorm && window.normalizarTexto(r.bairro) === endBairroNorm;
    }) || null;
}

/** Lê a array ruasData e salva os dados encontrados sobre a rua na variável. */
window.analisarBdRuas = function(ruaMatch, ruasDB, cepVal, endRuaNorm, endBairroNorm) {
    const motivo_rua = ruaMatch?.resultado_motivo || '';
    
    let bloqueiaDificuldadeAcesso = false;
    if (ruasDB && ruasDB.length > 0) {
        let matchRua = false;
        let deferidoDificuldade = false;
        let indeferidoRua = false;

        for (let r of ruasDB) {
            const rCep = r.cep ? String(r.cep).replace(/\D/g, '') : '';
            const matchCep = rCep && cepVal && rCep === cepVal;
            const matchLogradouro = r.logradouro && window.normalizarTexto(r.logradouro) === endRuaNorm && window.normalizarTexto(r.bairro) === endBairroNorm;

            if (matchCep || matchLogradouro) {
                matchRua = true;
                const rRes = r.resultado ? r.resultado.toUpperCase() : '';
                const rMotivo = r.resultado_motivo ? r.resultado_motivo.toUpperCase() : '';
                if (rRes === "DEFERIDO" && rMotivo === "DIFICULDADE DE ACESSO") {
                    deferidoDificuldade = true;
                }
                if (rRes === "INDEFERIDO") {
                    indeferidoRua = true;
                }
            }
        }

        if (matchRua) {
            if (indeferidoRua && !deferidoDificuldade) {
                bloqueiaDificuldadeAcesso = true;
            }
        } else {
            for (let r of ruasDB) {
                if ((!r.logradouro || window.normalizarTexto(r.logradouro) === "") && window.normalizarTexto(r.bairro) === endBairroNorm) {
                    const rRes = r.resultado ? r.resultado.toUpperCase() : '';
                    if (rRes === "INDEFERIDO") {
                        bloqueiaDificuldadeAcesso = true;
                        break;
                    }
                }
            }
        }
    }

    return {
        motivo: motivo_rua,
        temMatch: !!ruaMatch,
        ehAreaRural: motivo_rua === 'ÁREA RURAL',
        ehDificuldadeAcesso: motivo_rua === 'DIFICULDADE DE ACESSO',
        ehDistanciaMaior1500: motivo_rua === 'DISTÂNCIA MAIOR QUE 1500 METROS',
        ehDistanciaMenor1500: motivo_rua === 'DISTÂNCIA MENOR QUE 1500 METROS',
        ehEscolaPorOpcao: motivo_rua === 'ESCOLA POR OPÇÃO',
        bloqueiaDificuldadeAcesso: bloqueiaDificuldadeAcesso,
        totalAlunosRua: 0,
        irmaosAtendidos: 0,
        historicoDificuldadeAcesso: 0,
        historicoAreaRural: 0,
        historicoDistMenor: 0,
        historicoDistMaior: 0,
        historicoEscolaOpcao: 0,
        erroFetch: false
    };
};

window.analisarRuaFetch = async function(resultadoFinal, logradouro, numeroStr, idUnidade) {
    if (!logradouro || !idUnidade) {
        console.warn("[ASSISTENTE] ⚠️ Fetch abortado: Faltam parâmetros (logradouro ou idUnidade)");
        return resultadoFinal;
    }

    const ctxSeguro = (typeof ctx !== 'undefined') ? ctx : (window.dadosGeograficos || {});
    
    let raAlunoAtual = ctxSeguro.ra_aluno || ctxSeguro.raAluno || "";
    if (!raAlunoAtual && typeof window.getSharedStoreValue === 'function') {
        raAlunoAtual = window.getSharedStoreValue('ra_aluno') || window.getSharedStoreValue('raAluno');
    }
    if (!raAlunoAtual) {
        const elRa = document.querySelector('input[type="hidden"][name="ra_aluno"]') || 
                     document.getElementById('ra_aluno') || 
                     document.querySelector('[id*="ra_prodesp"]');
        if (elRa) raAlunoAtual = elRa.value;
    }
    const raAtualLimpo = String(raAlunoAtual || "").replace(/\D/g, '').replace(/^0+/, '');

    let idSolicitacaoAtual = ctxSeguro.idSolicitacao || ctxSeguro.id_solicitacao || "";
    if (!idSolicitacaoAtual && typeof window.getSharedStoreValue === 'function') {
        idSolicitacaoAtual = window.getSharedStoreValue('idSolicitacao') || window.getSharedStoreValue('id_solicitacao');
    }
    if (!idSolicitacaoAtual) {
        const elIdSol = document.querySelector('input[type="hidden"][name="id_solicitacao"]') || 
                        document.querySelector('input[type="hidden"][name="id"]') || 
                        document.getElementById('id_solicitacao');
        if (elIdSol) idSolicitacaoAtual = elIdSol.value;
    }
    const idSolAtualLimpo = String(idSolicitacaoAtual || "").replace(/\D/g, '').replace(/^0+/, '');

    const anoSelect = document.getElementById('ano_selecionado');
    const anoLetivo = anoSelect ? anoSelect.value : new Date().getFullYear().toString();
    const baseUrl = "/administrador/modulos/transporte_escolar/lista_alunos_transporte.php";
    
    const formData = new URLSearchParams();
    formData.append("ano", anoLetivo);
    formData.append("id_unidade", idUnidade);
    formData.append("funcao_utilizada", "6"); 
    formData.append("registro_inicial", "0");
    formData.append("pagina", "1");
    formData.append("endereco", window.removerAcentosEspeciais ? window.removerAcentosEspeciais(logradouro).replace(/\s+/g, '%') : logradouro.replace(/\s+/g, '%'));
    formData.append("ordenar_por", "2");

    const urlVisivelParaLog = `${window.location.origin}/administrador/modulos/transporte_escolar/solicitacoes_transporte_realizadas.php?endereco=${encodeURIComponent(logradouro)}&id_unidade_selecionada=${idUnidade}`;

    try {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
        });

        if (!response.ok) {
            resultadoFinal.erroFetch = true;
            return resultadoFinal;
        }
        
        const htmlTabela = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlTabela, 'text/html');
        
        const lines = Array.from(doc.querySelectorAll('tr')).filter(tr => {
             const celulas = tr.querySelectorAll('td');
             return celulas.length > 12 && celulas[0].querySelector('img');
        });
        
        if (lines.length === 0) {
             return resultadoFinal;
        }
        
        const regexNumero = new RegExp(`\\b${numeroStr}\\b`, 'i');
        const logradouroUpper = window.normalizarTexto(logradouro);
        
        resultadoFinal.dadosIrmaos = [];
        resultadoFinal.irmaosAtendidos = 0; // Reinicia contador específico de irmãos válidos para o fluxo

        lines.forEach(linha => {
            const colunas = linha.querySelectorAll('td');
            
            // obter ID solicitacao
            let idSolicitacaoTabela = "";
                if (colunas[1]) {
                    // 1ª Tentativa: Busca o valor de forma limpa de dentro da tag <strong> se ela existir
                const strongEl = colunas[1].querySelector('strong');
                if (strongEl) {
        idSolicitacaoTabela = strongEl.innerText.trim();
                } else {
        // 2ª Tentativa: Se não houver strong, remove tudo a partir da primeira barra da data "/"
        const textoPuro = colunas[1].innerText.trim();
        idSolicitacaoTabela = textoPuro.split('/')[0].replace(/\D/g, '').trim();
            }
    
                // Fallback de Segurança Máxima: Se o ID capturado ainda for longo demais, mantém apenas os 6 primeiros dígitos
                if (idSolicitacaoTabela.length > 7) {
            idSolicitacaoTabela = idSolicitacaoTabela.substring(0, 6);
             }
            }

            const raTabela = (colunas[7] ? colunas[7].innerText.trim() : "") || (colunas[6] ? colunas[6].innerText.trim() : "");
            const nomeTabela = colunas[8] ? colunas[8].innerText.trim() : (colunas[7] ? colunas[7].innerText.trim() : "");
            
            const idSolTabelaLimpo = idSolicitacaoTabela.replace(/\D/g, '').replace(/^0+/, '');
            const raTabelaLimpo = raTabela.replace(/\D/g, '').replace(/^0+/, '');

            if ((idSolAtualLimpo && idSolTabelaLimpo === idSolAtualLimpo) || (raAtualLimpo && raTabelaLimpo === raAtualLimpo)) {
                return; 
            }

            const enderecoTabela = window.normalizarTexto(colunas[10].innerText || "");
            const detalhes = window.normalizarTexto(colunas[11].innerText || "");
            const status = window.normalizarTexto(colunas[12].innerText || "");
            
            // Definição estrita se este registro é fisicamente um irmão no mesmo número
            const ehIrmao = enderecoTabela.includes(logradouroUpper) && regexNumero.test(enderecoTabela);
            const emAtend = status.includes('EM ATENDIMENTO') || status.includes('DEFERIDO');
            const indeferido = status.includes('INDEFERIDO') || (status.includes('CANCELADO') && (detalhes.includes('MUDANÇA DE ENDEREÇO') || detalhes.includes('ATENDIMENTO INDEVIDO'))); // Considera como indeferido se for cancelado por mudança de endereço, mesmo que o status seja "cancelado"
            // Filtros originais restritivos do sistema
            const atendeFiltrosPadrao = !status.includes('CANCELADO') && !status.includes('ANALISE') && !status.includes('ANÁLISE') && !detalhes.includes('DEFICIEN') && !detalhes.includes('DEFICIÊN') && !detalhes.includes('CADEIRANTE') && !detalhes.includes('CADEIRA DE RODAS') && !detalhes.includes('AUTISMO') && !detalhes.includes('AUTISTA') && !detalhes.includes('CASOS OMISSOS') && !detalhes.includes('ART.') && !detalhes.includes('ENCAMINHAD') && !detalhes.includes('PRIORIZAD') && !detalhes.includes('MANDADO') && !detalhes.includes('JUDICIAL');
            
            // Nova regra condicionada por você: Linha é válida se passar nos filtros normais OU se for comprovadamente um irmão
            const LinhasValidas = ehIrmao || atendeFiltrosPadrao;
            
            if (LinhasValidas) {
                // Estatísticas gerais da rua só incrementam se o registro passar no filtro geral limpo
                if (atendeFiltrosPadrao) {
                    resultadoFinal.totalAlunosRua++;
                    
                    if (detalhes.includes('DIFICULDADE DE ACESSO') && !status.includes('INDEFERIDO')) {
                        resultadoFinal.historicoDificuldadeAcesso++;
                    }
                    if (!status.includes('INDEFERIDO') && (detalhes.includes('AREA RURAL') || detalhes.includes('ÁREA RURAL') || detalhes.includes('REA RURAL'))) {
                        resultadoFinal.historicoAreaRural++;
                    }
                    if (!status.includes('INDEFERIDO') && (detalhes.includes('DISTANCIA MAIOR QUE 1500 METROS') || detalhes.includes('DISTÂNCIA MAIOR QUE 1500 METROS'))) {
                        resultadoFinal.historicoDistMaior++;
                    }
                    if (status.includes('INDEFERIDO') && (detalhes.includes('NCIA MENOR QUE 1500') || detalhes.includes('DISTANCIA MENOR QUE 1500 METROS') || detalhes.includes('DISTÂNCIA MENOR QUE 1500 METROS'))) {
                        resultadoFinal.historicoDistMenor++;
                    }
                    if (status.includes('INDEFERIDO') && (detalhes.includes('ESCOLA POR OPÇÃO') || detalhes.includes('ESCOLA DE OPÇAO') || detalhes.includes('ESCOLA POR OP'))) {
                        resultadoFinal.historicoEscolaOpcao++;
                    }
                }

                // Ingestão no array de dados residenciais
                if (ehIrmao) {
                    // É considerado apto para deferimento se NÃO for cancelado/análise e se passar no filtro de motivos padrão
                    const validoParaDeferir = emAtend;
                    
                    if (validoParaDeferir) {
                        resultadoFinal.irmaosAtendidos++; 
                    }else if (indeferido) {
                        resultadoFinal.irmaosIndeferidos++;
                    }

                    resultadoFinal.dadosIrmaos.push({
                        nome: nomeTabela,
                        ra: raTabela,
                        id_solicitacao: idSolicitacaoTabela,
                        status: colunas[12].innerText.trim(), // preserva caixa original para exibição
                        status_motivo: colunas[11].innerText.trim(),
                        validoParaDeferir: validoParaDeferir
                    });
                }
            }
        });
        
        doc.open(); doc.write(''); doc.close();
        return resultadoFinal;
    } catch (error) {
        console.error(`[ASSISTENTE] Erro no Fetch`, error);
        resultadoFinal.erroFetch = true;
        return resultadoFinal;
    }
};

// Constrói a URL para pesquisar solicitações anteriores de transporte na mesma rua.
function montarUrlPesquisaRua(endRua) {
    let ruaLimpa = (endRua || '').split(',')[0].trim();
    const prefixos = /^(RUA|R\.|AVENIDA|AV\.|AV|TRAVESSA|TRV\.|VIELA|PRA[ÇC]A|ESTRADA|ALAMEDA|RODOVIA|LADEIRA|BECO|MARGINAL)\s+/i;
    ruaLimpa = ruaLimpa.replace(prefixos, '').trim();
    const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const moduloPath = 'modulos/transporte_escolar/';
    const prefixo = basePath.includes(moduloPath) ? '' : moduloPath;
    return `${basePath}${prefixo}solicitacoes_transporte_realizadas.php?endereco=${encodeURIComponent(ruaLimpa)}`;
}


/**
 * Verifica se dois endereços estão aproximadamente na mesma direção
 * em relação a uma escola de referência.
 *
 * Retorna:
 * {
 * mesmaDirecao: boolean,
 * diferencaAngular: number,
 * bearingFicha: number,
 * bearingEnc: number
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

        const y = Math.sin(λ2 - λ1) * Math.cos(φ2);

        const x = Math.cos(φ1) * Math.sin(φ2) -
                  Math.sin(φ1) * Math.cos(φ2) *
                  Math.cos(λ2 - λ1);

        let brng = Math.atan2(y, x) * 180 / Math.PI;

        return (brng + 360) % 360;
    };

    const bearingFicha = calcularBearing(escolaLat, escolaLon, latFicha, lonFicha);
    const bearingEnc = calcularBearing(escolaLat, escolaLon, latEnc, lonEnc);

    let diferencaAngular = Math.abs(bearingFicha - bearingEnc);

    if (diferencaAngular > 180) {
        diferencaAngular = 360 - diferencaAngular;
    }

    return {
        mesmaDirecao: diferencaAngular <= toleranciaGraus,
        diferencaAngular,
        bearingFicha,
        bearingEnc
    };
} 

/** Resolve o encaminhamento uma única vez cruzando RA e banco de dados; evita reler o banco principal no fluxo. */
function resolverEncaminhamentoAluno(doc, dbEncaminhamentos, ctx, estado) {
    ctx = ctx || {};
    estado = estado || {};

    let raAlunoRaw = '';
    const inputRa = doc.getElementById('ra_prodesp_search') || 
                   doc.getElementById('ra_prodesp_search') || 
                   doc.querySelector('[id*="ra_prodesp"]');
    if (inputRa) raAlunoRaw = inputRa.value || inputRa.innerText || '';
    if (!raAlunoRaw) {
        raAlunoRaw = window.getSharedStoreValue?.('raAluno') || window.getSharedStoreValue?.('ra_prodesp_search') || '';
    }
    const raAluno = raAlunoRaw.replace(/\D/g, '');
    let msgEncaminhamentoHtml = '';
    let maisRecente = null;

    if (raAluno && dbEncaminhamentos) {
        let lista = dbEncaminhamentos[raAluno];
        
        if (!lista && raAluno.length > 5) {
            lista = dbEncaminhamentos[raAluno.slice(0, -1)]; 
        }
        
        const raSemZeros = raAluno.replace(/^0+/, '');
        if (!lista && raSemZeros) {
            lista = dbEncaminhamentos[raSemZeros]; 
        }
        
        if (!lista && raSemZeros.length > 5) {
            lista = dbEncaminhamentos[raSemZeros.slice(0, -1)]; 
        }

        if (Array.isArray(lista) && lista.length > 0) {
            maisRecente = lista.reduce((prev, current) => (prev.ano > current.ano) ? prev : current);
            const compSalva = maisRecente.compatibilidade || window.currentCompatibilidade;
            
            // CORRIGIDO: Agora passa o ctx e estado válidos recebidos por argumento
            msgEncaminhamentoHtml = montarHtmlEncaminhamento(maisRecente, compSalva, ctx, estado);
        }
    } else if (!raAluno || !dbEncaminhamentos) {
        console.error('[ASSISTENTE] Falha ao pesquisar encaminhamentos.', {
            'RA Capturado': raAluno || 'NENHUM RA ENCONTRADO NO DOM',
            'Banco Carregado?': dbEncaminhamentos ? 'SIM' : 'NÃO'
        });
    }
    return { raAluno, maisRecente, msgEncaminhamentoHtml };
}


/**
 * Cria o texto básico de instruções para o SOMARH de forma condicional e programática.
 */
function gerarTextoInstrucoesSOMARH(ctx, estado, exibirDetalhesFicha = true) {
    ctx = ctx || {};
    estado = estado || {};

    const nomeStr = ctx.nomeAluno || estado.nomeAluno || 'Não identificado';
    const enderecoCompleto = ctx.enderecoCompleto || estado.enderecoCompleto || 'Não informado';

    // Captura segura da URL da ficha atual (funciona mesmo dentro de frames)
    const windowAlvo = document.defaultView || window;
    const docAlvo = (typeof window.getAlvoDocument === 'function' ? window.getAlvoDocument() : windowAlvo.document);
    const docHref = docAlvo?.location?.href || windowAlvo.location.href;
    const isFichaAntiga = docHref.includes('ficha_transporte.php') && !docHref.includes('nova_versao');

    let msgCopiado = "";
    let dataNasc = ctx.dataNascimento || estado.dataNascimento || 'Não informada';
    
    if (dataNasc && dataNasc !== 'Não informada') {
        const dn = dataNasc.trim();
        try {
            const txt = document.createElement('textarea');
            txt.value = dn;
            document.body.appendChild(txt);
            txt.select();
            document.execCommand('copy');
            document.body.removeChild(txt);
            msgCopiado = `<div class='message-box success' style='font-size:12px; margin-top:10px; background-color: #d4efdf; color: #27ae60; padding: 8px; border-radius: 4px; border: 1px solid #a9dfbf;'><span class="mdi mdi-check" style="font-size: 14px; margin-right: 4px;"></span> Data de nascimento já copiada, basta colar no SOMARH.</div>`;
        } catch(e) {}
    }

    let infoExtraHtml = "";
    // A lista detalhada de checagem só entra se for a ficha antiga E a condicional de negócio permitir
    if (isFichaAntiga && exibirDetalhesFicha) {
        const textoEscolasFormatado = (Array.isArray(estado.top3EscolasNomes) && estado.top3EscolasNomes.length > 0)
            ? estado.top3EscolasNomes.map((esc, idx) => `${idx + 1}º ${esc.nome}`).join('<br>')
            : '<span class="text-warning" style="font-size:12px;font-weight:normal;"><i>Não foi possivel obter UEs. Verifique manualmente a lista de mais próximas</i></span>';

        const nomeEscolaFormatado = estado.nomeEscolaAtual ? estado.nomeEscolaAtual.split(',')[0] : 'Escola Atual';

        infoExtraHtml = `
            <div class="school-list-container" style="font-size:12px; margin-top:10px;">
                <b>Nome:</b> ${nomeStr}<br>
                <b>Nasc:</b> ${dataNasc}<br><br>
                <ul style="padding-left: 15px; margin: 0; display: flex; flex-direction: column; gap: 8px;">
                    <li><b>Em <u>Verificação de Semelhança</u></b> não pode haver menção a <span style="color: #922b1f;">Transf. - Outros</span> em nenhum campo, especialmente em <i>Tipo Inscrição</i> e <i>Observações</i>.</li>
                    <li><b>Em <u>dados do candidato</u>, o endereço deve ser:</b><br><span style="font-size:13px;">${enderecoCompleto}</span></li>
                    <li><b>Em <u>Unidades Escolares</u>, deve ter escolhido as escolas mais próximas (nessa ordem):</b><br>${textoEscolasFormatado}</li>
                    <li><b>Em <u>Status Inscrição</u>, deve constar:</b><br>"encaminhado(a) para ${nomeEscolaFormatado}..."</li>
                </ul>
            </div>
        `;
    }

    // Se a regra de negócio ocultar os detalhes, retorna apenas o texto básico enxuto
    if (!exibirDetalhesFicha) {
        return `
            <p>Confirme se há <b>encaminhamento válido</b> por falta de vaga na UE mais próxima de casa.</p>
            ${msgCopiado}
        `;
    }

    return `
        <h3 class="section-title text-primary">
            <span class="mdi mdi-swap-horizontal-variant" style="font-size: 22px; margin-right: 6px;"></span> Encaminhamento por falta de vaga
        </h3>
        <p>Verifique no SOMARH e nas planilhas da Central de Matrículas se há <b>encaminhamento válido</b> por falta de vaga na UE mais próxima de casa.</p>
        <p class="text-muted" style="font-size:12px;"><i>(As informações do encaminhamento devem estar como abaixo:).</i></p>
        ${infoExtraHtml}
        ${msgCopiado}
    `;
}

/**
 * Monta o HTML completo integrando o histórico mapeado no banco com as instruções básicas.
 */
function montarHtmlEncaminhamento(maisRecente, compatibilidade, ctx, estado) {
    ctx = ctx || {};
    estado = estado || {};

    // Caso base: Aluno sem nenhum encaminhamento no banco (Gera instruções completas com detalhes)
    if (!maisRecente || Object.keys(maisRecente).length === 0 || !maisRecente.unidade) {
        console.warn("[ASSISTENTE] 'maisRecente' ausente ou inválido. Renderizando apenas instruções básicas.");
        let textoInstrucoesSOMARH = gerarTextoInstrucoesSOMARH(ctx, estado, true);
        return `
            ${textoInstrucoesSOMARH}
            <div class="action-group" style="margin-top:20px;">
                <button id="btn-enc-sim" class="btn btn-success"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Sim, possui encaminhamento</button>
                <button id="btn-enc-nao" class="btn btn-danger"><span class="mdi mdi-close" style="font-size: 16px; margin-right: 4px;"></span> Não possui encaminhamento</button>
            </div>
        `;
    }

    const comp = compatibilidade || (maisRecente ? maisRecente.compatibilidade : null) || window.currentCompatibilidade;
    const escolaMatch = comp ? comp.escolaCompativel : true;
    const enderecoMatch = comp ? comp.enderecoCompativel : true;

    let finalTexto = '';
    let precisaBuscarApi = false;
    let idUnicoSpan = `geo-endereco-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const estiloEnderecoVermelho = !enderecoMatch ? ' style="color: red;"' : '';
    
    if (maisRecente.endereco) {
        finalTexto = `<br>Endereço: <b${estiloEnderecoVermelho}>${maisRecente.endereco}</b>`;
    } else if (maisRecente.latitude && maisRecente.longitude) {
        precisaBuscarApi = true;
        finalTexto = `<span id="${idUnicoSpan}"${estiloEnderecoVermelho}><br>Coordenadas: <b>${maisRecente.latitude}</b>, <b>${maisRecente.longitude}</b></span>`;
    }

    if (precisaBuscarApi && typeof window.obterEnderecoPorCoordenadas === 'function') {
        window.obterEnderecoPorCoordenadas(maisRecente.latitude, maisRecente.longitude)
            .then(enderecoResolvido => {
                if (enderecoResolvido) {
                    let tentativas = 0;
                    const maxTentativas = 10; 
                    let timerId = null;
                    const atualizarElemento = () => {
                        const elementoSpan = document.getElementById(idUnicoSpan);
                        if (elementoSpan) {
                            elementoSpan.innerHTML = ` e endereço (via GPS) <b${estiloEnderecoVermelho}>${enderecoResolvido}</b>`;
                            if (timerId) clearTimeout(timerId);
                            return; 
                        } 
                        if (tentativas < maxTentativas) {
                            tentativas++;
                            timerId = setTimeout(atualizarElemento, 200);
                        }
                    };
                    timerId = setTimeout(atualizarElemento, 100);
                }
            }).catch(err => console.error("[ASSISTENTE] Erro ao buscar endereço:", err));
    }

    const isDeferido = maisRecente.situacao !== 'NÃO ATENDER';
    let corPainel = isDeferido ? 'success' : 'danger';
    let corTexto = isDeferido ? '#27ae60' : '#c0392b';
    let iconeStatus = isDeferido ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline';
    let diretrizTexto = isDeferido ? '✓ Verificar encaminhamento' : '⚠️ NÃO ATENDER / INDEFERIR';
    
    if(!enderecoMatch || !escolaMatch){
        diretrizTexto = 'Verificar encaminhamento';
        corPainel = 'info';
        corTexto = '#2980b9';
        iconeStatus = 'mdi-information-outline';
    }

    const estiloEscolaVermelho = !escolaMatch ? ' style="color: red;"' : '';
    let complEnc = "";
    let ClasseSim = maisRecente.situacao === 'ATENDER' ? " destaque" : "";
    let ClasseNao = maisRecente.situacao === 'NÃO ATENDER' ? " destaque" : "";
    
    // REVISÃO DAS CONDICIONAIS ORIGINAIS: Define se exibe ou oculta a lista detalhada do candidato
    let exibirDetalhesFicha = true;

    if(comp && !enderecoMatch && escolaMatch){
        complEnc = " mas o endereço era outro.";
        exibirDetalhesFicha = false; 
        ClasseNao = " destaque";
        ClasseSim = " dimmed";
    }else if(comp && enderecoMatch && !escolaMatch){
        complEnc = " mas a escola aparentemente era outra.";
        exibirDetalhesFicha = false; 
        ClasseNao = " destaque";
        ClasseSim = " dimmed";
    }else if(comp && !enderecoMatch && !escolaMatch){
        complEnc = " mas as informações não batem com a ficha atual:";
        exibirDetalhesFicha = true; 
        ClasseNao = " destaque";
        ClasseSim = " dimmed";
    }else if(!comp){
        complEnc = " mas <b>não foi possível verificar se os dados batem com os da ficha</b>. Verifique abaixo:";
        exibirDetalhesFicha = true;
    }else if(comp && enderecoMatch && escolaMatch){
        exibirDetalhesFicha = false; 
        ClasseSim = " destaque";
        ClasseNao = " dimmed";
    }

    // Chama a geração passando o booleano calculado com precisão cirúrgica
    let textoInstrucoesSOMARH = gerarTextoInstrucoesSOMARH(ctx, estado, exibirDetalhesFicha);

    return `
        <div class="message-box ${corPainel}" style="margin-bottom: 15px;">
            <h4 style="margin: 0 0 10px 0; color: ${corTexto}; display: flex; align-items: center; gap: 6px; font-size: 15px;">
                <span class="mdi ${iconeStatus}" style="font-size: 18px;"></span>
                <b>${diretrizTexto}</b>
            </h4>
            <p style="margin-top: 0; margin-bottom: 8px; color: #2c3e50;">Foi encontrado um encaminhamento para esse aluno no ano de <b>${maisRecente.ano}</b>${complEnc}<br>Unidade: <b${estiloEscolaVermelho}>${maisRecente.unidade}</b>${finalTexto}</p>
            <table style="width:100%; font-size:13px; border-collapse: collapse; color:#555;">
                ${maisRecente.unidadeOrigem ? `<tr style="border-bottom: 1px dashed #e1e4e8;"><td style="padding: 4px 0; font-weight:bold; width: 120px;">Escola de Origem:</td><td>${maisRecente.unidadeOrigem}</td></tr>` : ''}
                ${maisRecente.motivo ? `<tr style="border-bottom: 1px dashed #e1e4e8;"><td style="padding: 4px 0; font-weight:bold;">Motivo/Prioridade:</td><td>${maisRecente.motivo}</td></tr>` : ''}
            </table>
            <div style="margin-top: 8px; font-size: 11px; color: #8597a3;">Origem dos dados: ${maisRecente.descricao || 'Desconhecida'}</div>
        </div>
        ${textoInstrucoesSOMARH}
        <div class="action-group" style="margin-top:20px;">
            <button id="btn-enc-sim" class="btn btn-success${ClasseSim}"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Sim, é encaminhado</button>
            <button id="btn-enc-nao" class="btn btn-danger${ClasseNao}"><span class="mdi mdi-close" style="font-size: 16px; margin-right: 4px;"></span> Não é encaminhado</button>
        </div>
    `;
}

async function verificarCompatibilidadeEncaminhamento(ctx, maisRecente) {
    console.log("[DEBUG ENC] Dados do Encaminhamento (maisRecente):", maisRecente);
    ctx = ctx || {};

    if (!maisRecente) {
        console.warn("[DEBUG ENC] Falha: O objeto 'maisRecente' está vazio ou indefinido.");
        const resultadoFalha = { compativel: false, escolaCompativel: false, enderecoCompativel: false, motivo: "O objeto maisRecente está indefinido ou vazio" };
        window.currentCompatibilidade = resultadoFalha;
        return resultadoFalha;
    }

    // REGRA DE NEGÓCIO CRÍTICA: Se o status for "NÃO ATENDER", recusa imediatamente sem gastar processamento
    if (maisRecente.situacao === "NÃO ATENDER" || (maisRecente.descricao && maisRecente.descricao.toUpperCase().includes("NAO ATENDER"))) {
        console.warn("[DEBUG ENC] 🛑 Bloqueado: Registro marcado explicitamente como NÃO ATENDER.");
        const resultadoNaoAtender = { compativel: false, escolaCompativel: false, enderecoCompativel: false, motivo: "Registro pertence a um lote de NÃO ATENDER (Escola de Opção)" };
        maisRecente.compatibilidade = resultadoNaoAtender;
        window.currentCompatibilidade = resultadoNaoAtender;
        return resultadoNaoAtender;
    }

    // PASSO 1: OBTER NOMES ALTERNATIVOS DA ESCOLA DA FICHA NO ESCOLAS_DB
    let schoolIdTarget = maisRecente.idUnidadeEncaminhamento || maisRecente.idUnidade || maisRecente.id_unidade;
    let poolEscolas = ctx.escolasDB || window.escolasDB; 
    let escolaMapeadaDB = null;
    
    if (poolEscolas && Array.isArray(poolEscolas) && ctx.idUnidade) {
        escolaMapeadaDB = poolEscolas.find(esc => String(esc.id).trim() === String(ctx.idUnidade).trim());
    }

    if (!escolaMapeadaDB && poolEscolas && ctx.nomeEscolaAtual) {
        const nomeFichaNormalizado = window.normalizarTexto(ctx.nomeEscolaAtual);
        escolaMapeadaDB = poolEscolas.find(esc => {
            return window.normalizarTexto(esc.nome) === nomeFichaNormalizado ||
                   window.normalizarTexto(esc.nome_unidade_SOMAR) === nomeFichaNormalizado ||
                   window.normalizarTexto(esc.nome_prodesp_sed) === nomeFichaNormalizado;
        });
    }

    if (!escolaMapeadaDB) {
        console.warn("[DEBUG ENC] Falha crítica: Não foi possível mapear a escola da ficha no escolasDB.");
        const resultadoSemEscola = { compativel: false, escolaCompativel: false, enderecoCompativel: false, motivo: "Não foi possível encontrar o mapeamento da escola no banco de dados" };
        maisRecente.compatibilidade = resultadoSemEscola;
        window.currentCompatibilidade = resultadoSemEscola;
        return resultadoSemEscola;
    }

    const idEscolaFicha = String(escolaMapeadaDB.id || ctx.idUnidade).trim();
    const nomeFichaSomar = window.normalizarTexto(escolaMapeadaDB.nome_unidade_SOMAR);
    const nomeFichaProdesp = window.normalizarTexto(escolaMapeadaDB.nome_prodesp_sed);
    const nomeFichaPadrao = window.normalizarTexto(escolaMapeadaDB.nome);

    // PASSO 2: COMPARAÇÃO DA UNIDADE/ESCOLA
    let escolaCompativeis = false;

    if (schoolIdTarget) {
        if (String(schoolIdTarget).trim() === idEscolaFicha) {
            escolaCompativeis = true;
        }
    }

    if (!escolaCompativeis && maisRecente.unidade) {
        const nomeEncaminhamento = window.normalizarTexto(maisRecente.unidade);
        
        const removerTermosInstitucionais = (t) => {
            if (!t) return "";
            return t.replace(/\b(EMEB|PROFA|PROFESSOR|PROFESSORA|DR|DRA|CEU|EE|CRECHE|EMEF|EI|EICI)\b/g, "")
                    .replace(/[^A-Z0-9]/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
        };

        const encLimpo = removerTermosInstitucionais(nomeEncaminhamento);
        const fichaPadraoLimpo = removerTermosInstitucionais(nomeFichaPadrao);
        const fichaSomarLimpo = removerTermosInstitucionais(nomeFichaSomar);

        if (nomeFichaSomar && (nomeEncaminhamento.includes(nomeFichaSomar) || nomeFichaSomar.includes(nomeEncaminhamento))) {
            escolaCompativeis = true;
        } else if (nomeFichaProdesp && (nomeEncaminhamento.includes(nomeFichaProdesp) || nomeFichaProdesp.includes(nomeEncaminhamento))) {
            escolaCompativeis = true;
        } else if (nomeFichaPadrao && (nomeEncaminhamento.includes(nomeFichaPadrao) || nomeFichaPadrao.includes(nomeEncaminhamento))) {
            escolaCompativeis = true;
        } else if (encLimpo.length > 4 && (fichaPadraoLimpo.includes(encLimpo) || encLimpo.includes(fichaPadraoLimpo))) {
            escolaCompativeis = true;
        } else if (fichaSomarLimpo && encLimpo.length > 4 && (fichaSomarLimpo.includes(encLimpo) || encLimpo.includes(fichaSomarLimpo))) {
            escolaCompativeis = true;
        }
    }

    if (!escolaCompativeis) {
        console.warn("[DEBUG ENC] ❌ Bloqueado: A escola gravada no encaminhamento não condiz com a ficha.");
        const resultadoIncompativelEscola = { compativel: false, escolaCompativel: false, enderecoCompativel: false, motivo: "A unidade de encaminhamento difere da unidade da ficha do aluno" };
        maisRecente.compatibilidade = resultadoIncompativelEscola;
        window.currentCompatibilidade = resultadoIncompativelEscola;
        return resultadoIncompativelEscola;
    }

    // PASSO 3: COMPARAÇÃO DA GEOLOCALIZAÇÃO / ENDEREÇO
    let enderecoCompativel = false;
    let latFichaAluno = null;
    let lonFichaAluno = null;

    if (typeof dadosGeograficos !== 'undefined' && dadosGeograficos) {
        latFichaAluno = parseFloat(dadosGeograficos.geoEndereco_Latit);
        lonFichaAluno = parseFloat(dadosGeograficos.geoEndereco_Longit);
    }

    if ((isNaN(latFichaAluno) || !latFichaAluno) && ctx.iframeMapa && ctx.iframeMapa.src) {
        const urlCompleta = ctx.iframeMapa.src;
        const originMatch = urlCompleta.match(/origin=([^&]+)/i);
        if (originMatch) {
            const partes = decodeURIComponent(originMatch[1]).trim().split(/[\s,]+/);
            if (partes.length >= 2) {
                latFichaAluno = parseFloat(partes[0].trim());
                lonFichaAluno = parseFloat(partes[1].trim());
            }
        }
    }

    if ((isNaN(latFichaAluno) || !latFichaAluno) && ctx.enderecoCompleto && typeof window.obterCoordenadasPorEndereco === 'function') {
        try {
            const coords = await window.obterCoordenadasPorEndereco(ctx.enderecoCompleto);
            if (coords && coords.lat && coords.lon) {
                latFichaAluno = parseFloat(coords.lat);
                lonFichaAluno = parseFloat(coords.lon);
            }
        } catch (e) {
            console.error("[DEBUG ENC] Erro crítico ao chamar obterCoordenadasPorEndereco:", e);
        }
    }

    console.log(`[DEBUG ENC] Coordenadas obtidas da Ficha do Aluno: Lat(${latFichaAluno}), Lon(${lonFichaAluno})`);

    const enderecoEncText = maisRecente.endereco ? window.normalizarTexto(maisRecente.endereco) : "";
    const ruaFichaText = ctx.endRua ? window.normalizarTexto(ctx.endRua) : "";
    const termoLimpoRua = ruaFichaText.replace(/^(RUA|R.|AVENIDA|AV.|AV|TRAVESSA|TRV.|VIELA|PRA[ÇC]A|ESTRADA|ALAMEDA|RODOVIA|LADEIRA|BECO|MARGINAL)\s+/i, "").trim();

    const cepEnc = maisRecente.cep ? maisRecente.cep.replace(/\D/g, '') : "";
    const cepFicha = ctx.cepVal ? ctx.cepVal.replace(/\D/g, '') : "";

    const latEnc = maisRecente.latitude ? parseFloat(maisRecente.latitude) : null;
    const lonEnc = maisRecente.longitude ? parseFloat(maisRecente.longitude) : null;

    const isCepValido  = (cepEnc.length > 0 && cepEnc === cepFicha);
    const isRuaValida  = (enderecoEncText.length > 0 && ruaFichaText.length > 0 && 
                          (enderecoEncText.includes(ruaFichaText) || ruaFichaText.includes(enderecoEncText) || 
                          (termoLimpoRua.length > 3 && enderecoEncText.includes(termoLimpoRua))));
    const isCoordenadaIdentica =
(
    Number.isFinite(latFichaAluno) &&
    Number.isFinite(lonFichaAluno) &&
    Number.isFinite(latEnc) &&
    Number.isFinite(lonEnc) &&
    Math.abs(latFichaAluno - latEnc) < 0.000001 &&
    Math.abs(lonFichaAluno - lonEnc) < 0.000001
);
    const isTextoExatamenteIgual = (enderecoEncText && ruaFichaText && enderecoEncText === ruaFichaText);

    if (isCoordenadaIdentica || isCepValido || isRuaValida || isTextoExatamenteIgual) {
        console.log("[DEBUG ENC] ✅ Sucesso Inicial: Informações textuais ou coordenadas idênticas.");
        let mSucesso = "Match direto de dados residenciais (";
        if (isCoordenadaIdentica) mSucesso += "Coordenadas idênticas";
        else if (isCepValido) mSucesso += "CEP correspondente";
        else if (isRuaValida) mSucesso += "Logradouro compatível";
        else if (isTextoExatamenteIgual) mSucesso += "Texto exato";
        mSucesso += ")";
        
        const resultadoDireto = { compativel: true, escolaCompativel: true, enderecoCompativel: true, motivo: mSucesso };
        maisRecente.compatibilidade = resultadoDireto;
        window.currentCompatibilidade = resultadoDireto;
        return resultadoDireto;
    }

    let metros = Infinity;
    if (
    Number.isFinite(latEnc) &&
    Number.isFinite(lonEnc) &&
    Number.isFinite(latFichaAluno) &&
    Number.isFinite(lonFichaAluno)
) {
        if (!isNaN(latEnc) && !isNaN(lonEnc)) {
            if (typeof window.calcularDistanciaHaversine === 'function') {
                metros = window.calcularDistanciaHaversine(latEnc, lonEnc, latFichaAluno, lonFichaAluno);
            } else {
                const R = 6371e3; 
                const phi1 = latEnc * Math.PI/180;
                const phi2 = latFichaAluno * Math.PI/180;
                const deltaPhi = (latFichaAluno-latEnc) * Math.PI/180;
                const deltaLambda = (lonFichaAluno-lonEnc) * Math.PI/180;
                const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
                          Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                metros = R * c;
            }
            console.log(`[DEBUG ENC] Distância calculada entre locais: +-${metros.toFixed(2)} metros.`);
        }
    }

    const isGeoProxima = (metros <= 700);
    let motivoFinal = "";
    let enderecoCompativelFinal = false;

    if (isGeoProxima) {
        enderecoCompativelFinal = true;
        motivoFinal = "Aprovado por raio de proximidade geográfica limite (até 700m)";
    } else if (metros > 700) {
        const escolaLat = escolaMapeadaDB.lat ? parseFloat(escolaMapeadaDB.lat) : null;
        const escolaLon = escolaMapeadaDB.lon ? parseFloat(escolaMapeadaDB.lon) : null;

        let distAlunoEscolaRaw = ctx.distancia || ctx.distanciaFinal || (window.estado && window.estado.distancia) || (window.dadosGeraisRota && window.dadosGeraisRota.distancia);
        let distAlunoEscola = Infinity;
        if (distAlunoEscolaRaw !== undefined && distAlunoEscolaRaw !== null) {
            distAlunoEscola = parseFloat(String(distAlunoEscolaRaw).replace(/[^\d.]/g, ''));
        }

        if (distAlunoEscola === Infinity && latFichaAluno && lonFichaAluno) {
            if (typeof window.calcularDistanciaHaversine === 'function' && Number.isFinite(escolaLat) && Number.isFinite(escolaLon)) {
                distAlunoEscola = window.calcularDistanciaHaversine(latFichaAluno, lonFichaAluno, escolaLat, escolaLon);
            }
        }

        let distEncEscola = null;
        const fnCalcularTrajeto = window.calcularTrajeto || window.calcularTrajetoOSRM;
        if (typeof fnCalcularTrajeto === 'function' && Number.isFinite(escolaLat) && Number.isFinite(escolaLon) && latEnc && lonEnc) {
            const resultadoTrajeto = await fnCalcularTrajeto(
    latEnc,
    lonEnc,
    escolaLat,
    escolaLon
);

distEncEscola =
    resultadoTrajeto &&
    Number.isFinite(Number(resultadoTrajeto.distancia))
        ? Number(resultadoTrajeto.distancia)
        : null;
        }

        if ((distEncEscola === null || isNaN(distEncEscola)) && Number.isFinite(escolaLat) && Number.isFinite(escolaLon) && latEnc && lonEnc) {
            if (typeof window.calcularDistanciaHaversine === 'function') {
                distEncEscola = window.calcularDistanciaHaversine(latEnc, lonEnc, escolaLat, escolaLon);
            }
        }

        if (distEncEscola !== null && !isNaN(distEncEscola) && distAlunoEscola < distEncEscola) {
            if (typeof analisarDirecaoRelativa === 'function') {
                const resultadoAngulo = analisarDirecaoRelativa(escolaLat, escolaLon, latFichaAluno, lonFichaAluno, latEnc, lonEnc);
                if (resultadoAngulo.mesmaDirecao) {
                    enderecoCompativelFinal = true;
                    motivoFinal = "Aprovado excepcionalmente por possuir mesma direção angular e distância menor do que a mapeada";
                } else {
                    motivoFinal = `O endereço dista ${metros.toFixed(0)}m e não pertence à mesma direção vetorial da escola`;
                }
            } else {
                motivoFinal = `O endereço dista ${metros.toFixed(0)}m (Função analisarDirecaoRelativa não definida)`;
            }
        } else {
            motivoFinal = `O endereço dista ${metros.toFixed(0)}m e a distância atual não reduz em relação ao encaminhamento antigo`;
        }
    } else {
        motivoFinal = "Não foi possível coletar coordenadas válidas suficientes para processar a proximidade";
    }

    const resultadoFinal = {
        compativel: escolaCompativeis && enderecoCompativelFinal,
        escolaCompativel: escolaCompativeis,
        enderecoCompativel: enderecoCompativelFinal,
        motivo: motivoFinal
    };

    maisRecente.compatibilidade = resultadoFinal;
    window.currentCompatibilidade = resultadoFinal;
    
    return resultadoFinal;
}

// Verifica na ficha se há indicações de deficiência para o aluno ou familiares e sugere a análise.
function calcularSugestaoDeficiencia(doc) {
    const elCadeirante = doc.getElementById('aluno_cadeirante');
    const isCadeirante = elCadeirante && lerValorElemento(elCadeirante).toUpperCase().includes('SIM');
    if (campoPreenchidoNoDoc(doc, 'tipo_deficiencia') || campoPreenchidoNoDoc(doc, 'detalhamento_deficiencia') || isCadeirante) return 'ALUNO';
    if (campoPreenchidoNoDoc(doc, 'descricao_deficiencia_pais_irmao') || campoPreenchidoNoDoc(doc, 'descricao_deficiencia_pais_irmao_outro')) return 'FAMILIA';
    return null;
}

// Coleta todos os dados do aluno presentes na tela e em bancos de dados locais e os organiza num objeto de contexto.
async function extrairContextoFicha(doc) {
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
    let nivel = extrairNivelAluno(doc);
        
    // 3. Filtra as escolas com o nível validado ou corrigido
    const escolasAptas = filtrarEscolasAptas(escolasDB, nivel.nivelNorm, nivel.isBercarioGeral);

    const endRuaNorm = window.normalizarTexto(endRua.split(',')[0]);
    const endBairroNorm = window.normalizarTexto(endBairro);
    const ruaMatch = buscarMatchRua(ruasDB, idUnidade, cepVal, endRuaNorm, endBairroNorm);
    let historicoRua = window.analisarBdRuas(ruaMatch, ruasDB, cepVal, endRuaNorm, endBairroNorm);
    if (ruaMatch) console.log('[ASSISTENTE] Match de rua:', historicoRua.motivo);

    let isEspecial = nivel.nivelNorm === 'ESPECIAL';
    if (escolaAtual.escolaRegistro?.turmas) {
        isEspecial = isEspecial || escolaAtual.escolaRegistro.turmas.some(t => window.normalizarTexto(t.nivel).includes('ESPECIAL'));
    }

    const inputRa = doc.getElementById('ra_prodesp_search') || 
                   doc.getElementById('ra_prodesp_search') || 
                   doc.querySelector('[id*="ra_prodesp"]');
    if (inputRa) raAlunoRaw = inputRa.value || inputRa.innerText || '';
    if (!raAlunoRaw) {
        raAlunoRaw = window.getSharedStoreValue?.('raAluno') || window.getSharedStoreValue?.('ra_prodesp_search') || '';
    }
    const raAluno = raAlunoRaw.replace(/\D/g, '');
        
    const urlPesquisaRua = montarUrlPesquisaRua(endRua);

    // SOLUÇÃO DA REFERÊNCIA: Monta um pacote de contexto prévio com dados já extraídos nas linhas anteriores
    const partialCtx = {
        nomeAluno: extrairNomeAluno(doc),
        dataNascimento: extrairDataNascimento(doc),
        enderecoCompleto: enderecoCompleto
    };
    const partialEstado = {
        nomeEscolaAtual: escolaAtual?.nomeEscola || '',
        top3EscolasNomes: window.assistenteEstado?.top3EscolasNomes || [] // Garante o fallback ao estado persistido se houver
    };

    // Alimenta a função de resolução com o contexto provisório estável
    const encaminhamento = resolverEncaminhamentoAluno(doc, dbEncaminhamentos, partialCtx, partialEstado);

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
        ra_aluno: raAluno,
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
        ehCreche: nivel.isBercarioGeral || nivel.nivelNorm.includes('BERCARIO') || nivel.nivelNorm === 'INFANTIL I' || nivel.nivelNorm === 'INFANTIL II',
        ehEJA: nivel.nivelAlunoOriginal === "EJA Anos Iniciais 1o Segmento" || nivel.nivelAlunoOriginal === "EJA Anos Iniciais 2o Segmento" || nivel.nivelNorm === "EJA Anos Iniciais 1o Segmento" || nivel.nivelNorm === "EJA Anos Iniciais 2o Segmento" || nivel.nivelAlunoOriginal === "EJA Anos Finais 1o Segmento" || nivel.nivelAlunoOriginal === "EJA Anos Finais 2o Segmento" || nivel.nivelNorm === "EJA Anos Finais 1o Segmento" || nivel.nivelNorm === "EJA Anos Finais 2o Segmento" || nivel.nivelNorm === 'EJA ' || nivel.nivelNorm?.includes('EJA ') || nivel.nivelNorm === ' EJA' || nivel.nivelNorm?.includes(' EJA') || nivel.nivelAlunoOriginal === 'EJA ' || nivel.nivelAlunoOriginal?.includes('EJA ') || nivel.nivelAlunoOriginal === ' EJA' || nivel.nivelAlunoOriginal?.includes(' EJA'),
        isEspecial,
        iframeMapa: doc.getElementById('map_endereco'),
        inputDistanciaFicha: doc.querySelector('input[name="distancia_aferida"], #distancia_aferida'),
        encaminhamento: encaminhamento
    };
}

// Filtra a base de escolas retornando apenas aquelas compatíveis com o nível de ensino atual do aluno.
function filtrarEscolasAptas(baseEscolas, nivelAlunoNorm, isBercarioGeral) {
    const filtradas = baseEscolas.filter(esc => {
        if (!esc.turmas || !Array.isArray(esc.turmas)) return false;
        
        const turmasNivel = esc.turmas.filter(turma => {
            const nivelTurmaNorm = window.normalizarTexto(turma.nivel);
            if (isBercarioGeral) return nivelTurmaNorm.includes('BERCARIO');
            return nivelTurmaNorm === nivelAlunoNorm;
        });

        if (turmasNivel.length > 0) {
            esc.periodosEncontrados = [...new Set(turmasNivel.map(t => t.periodo))].join(' / ');
            return true;
        }
        return false;
    });
    
    if (filtradas.length === 0) {
        console.warn(`[ASSISTENTE] Nenhuma escola encontrada para o nível: ${nivelAlunoNorm}`);
    }
    return filtradas;
}

// Monta a lista de escolas mais próximas e as ordena para exibição, limitando a quantidade exibida.
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
        esc.distancia = window.calcularProximidadeRapida(latBase, lonBase, esc.lat, esc.lon);
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

// Obtém do estado da sessão a distância já calculada do aluno para a escola, conforme o modo do mapa.
function obterDistanciaSugeridaInput(ctx, modoMapa, rotaSessao) {
    const rota = rotaSessao ?? window.getSharedStoreValue?.('dadosGeraisRota');
    let distValue = modoMapa === 'endereco' ? rota?.distanciaEnd : rota?.distanciaCoord;
    if (distValue == null) distValue = modoMapa === 'endereco' ? rota?.distanciaCoord : rota?.distanciaEnd;
    if (distValue == null && ctx.inputDistanciaFicha?.value) {
        distValue = parseInt(ctx.inputDistanciaFicha.value, 10) || null;
    }
    return distValue || '';
}

// Pega os parâmetros do Google Maps no iframe e os converte em um objeto de Latitude e Longitude.
function separarCoordenadasIframe(matchString) {
    if (!matchString) return { lat: null, lon: null };
    const partes = decodeURIComponent(matchString[1]).trim().split(/[\s,]+/);
    if (partes.length >= 2) return { lat: parseFloat(partes[0].trim()), lon: parseFloat(partes[1].trim()) };
    return { lat: null, lon: null };
}

// Busca o objeto com o banco de dados de encaminhamentos disponíveis na página global.
function obterBancoEncaminhamentos() {
    if (typeof encaminhamentos !== 'undefined') return encaminhamentos;
    if (typeof window.encaminhamentos !== 'undefined') return window.encaminhamentos;
    if (typeof window.encaminhamentosDB !== 'undefined') return window.encaminhamentosDB;
    if (typeof window.encaminhamentosData !== 'undefined') return window.encaminhamentosData;
    if (typeof HISTORICO_MASTER !== 'undefined') return HISTORICO_MASTER.encaminhamentos;
    return null;
}

// Preenche automaticamente o formulário de análise da solicitação e abre os modais do sistema SE2.
function preencheAnalise(resultado, resultado_motivo, resultado_detalhes, distancia, idEscolaMaisProxima = null) {
    const docFinal = window.getAlvoDocument();
    console.debug('[ASSISTENTE] Preenchendo análise:', { resultado, resultado_motivo, resultado_detalhes, distancia, idEscolaMaisProxima });

    // 1. Normalização de Distância
    if (!distancia) {
        const modoMapa = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
        const rota = window.getSharedStoreValue?.('dadosGeraisRota');
        distancia = modoMapa === 'endereco' ? rota?.distanciaEnd : rota?.distanciaCoord;
        
        if (distancia == null) {
            const inputDist = docFinal.getElementById('input-assistente-dist') || docFinal.querySelector('input[name="distancia_aferida"], #distancia_aferida');
            if (inputDist?.value) distancia = parseInt(inputDist.value, 10);
        }
    }
    
    let baseArred = 50; // Valor padrão

if (distancia != null && !isNaN(distancia)) {
    let dist = Number(distancia);
    if (dist >= 10000) {
        baseArred = 500;
    } else if (dist >= 1000) {
        baseArred = 100;
    }else if (dist < 300) {
        baseArred = 10;
}
}
    distancia = (distancia != null && !isNaN(distancia)) ? Math.round(Number(distancia) / baseArred) * baseArred : 0;

    // 2. Normalização de Dados Visuais (Fallback do DOM)
    if (!resultado) {
        const h2 = docFinal.querySelector('#modal-assistente-analise h2');
        resultado = h2?.textContent.toUpperCase().includes('INDEFERIR') ? 'INDEFERIR' : 'DEFERIR';
    }
    
    if (!resultado_motivo) {
        const bMotivo = Array.from(docFinal.querySelectorAll('#modal-assistente-analise .message-box b')).find(b => b.textContent.includes('Motivo:'));
        resultado_motivo = bMotivo?.nextSibling?.textContent.trim() || "";
    }

    // [NOVA LÓGICA]: Captura o top3EscolasNomes do estado caso haja mais de uma escola mais próxima
    const top3EscolasNomes = window.getSharedStoreValue?.('top3EscolasNomes') || [];
    
    if (!resultado_detalhes) {
        const spanObs = docFinal.querySelector('#modal-assistente-analise .message-box .text-warning');
        resultado_detalhes = spanObs?.textContent.replace('Obs:', '').trim() || "";
    }

    // [NOVA LÓGICA]: Se houver mais de 1 escola elegível no top3, anexa os nomes no campo de detalhes
    if (resultado === 'INDEFERIR' && window.normalizarTexto(resultado_motivo).includes('ESCOLA') && window.normalizarTexto(resultado_motivo).includes('OPCAO') && top3EscolasNomes.length > 1) {
        const listaNomesFormatada = "UEs mais próximas: " + top3EscolasNomes.map((esc) => `${esc.nome} (${esc.distancia})`).join('; ');
        
        if (!resultado_detalhes.includes('UEs mais próximas:')) {
            resultado_detalhes = resultado_detalhes ? (resultado_detalhes + " / " + listaNomesFormatada) : listaNomesFormatada;
        }
    }

    // 3. Preenchimento de Campos no DOM
    try {
        docFinal.querySelectorAll('input[name="distancia_aferida"], #distancia_aferida').forEach(c => { c.value = distancia; c.setAttribute('value', distancia); });
        
        const camposDet = docFinal.querySelectorAll('textarea[name="status_detalhes"], #status_atual_detalhes, textarea[name="motivo_detalhes"]');
        camposDet.forEach(c => { if(resultado_detalhes) c.value = c.innerHTML = resultado_detalhes; });
    } catch (e) { console.error(e); }

    // 4. Seleção do Motivo (com Regex para ignorar acentos e case)
    if (resultado_motivo) {
        const selector = (resultado === 'INDEFERIR') ? 'select[name="status_motivo"], #status_motivo_' : 'select[name="status_motivo"], #status_motivo';
        const selectsMotivo = docFinal.querySelectorAll(selector);
        const alvo = window.normalizarTexto(resultado_motivo);

        selectsMotivo.forEach(select => {
            for (let i = 0; i < select.options.length; i++) {
                const opt = select.options[i];
                if (window.normalizarTexto(opt.text).includes(alvo) || window.normalizarTexto(opt.value).includes(alvo)) {
                    select.selectedIndex = i;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                }
            }
        });
    }

    // 5. Caso Específico: Escola por Opção
    if (resultado === 'INDEFERIR' && window.normalizarTexto(resultado_motivo).includes('ESCOLA') && window.normalizarTexto(resultado_motivo).includes('OPCAO')) {
        const selectEscola = docFinal.getElementById('escola_mais_proxima');
        
        if (selectEscola) {
            // [NOVA LÓGICA]: Atualiza o select apenas se houver EXATAMENTE 1 escola mais próxima na lista do estado
            if (top3EscolasNomes.length <= 1 && idEscolaMaisProxima && window.escolasDB) {
                const escolaObj = window.escolasDB.find(e => String(e.id) === String(idEscolaMaisProxima));
                if (escolaObj) {
                    const nomesPossiveis = [
                        escolaObj.nome_select_analise,
                        escolaObj.nome, 
                        escolaObj.nome_unidade_SOMAR, 
                        escolaObj.nome_prodesp_sed, 
                        escolaObj.nome_abreviado_unidade
                    ].filter(Boolean).map(n => window.normalizarTexto(n));

                    for (let i = 0; i < selectEscola.options.length; i++) {
                        const opt = selectEscola.options[i];
                        if (nomesPossiveis.includes(window.normalizarTexto(opt.text)) || nomesPossiveis.includes(window.normalizarTexto(opt.value))) {
                            selectEscola.selectedIndex = i;
                            selectEscola.dispatchEvent(new Event('change', { bubbles: true }));
                            break;
                        }
                    }
                }
            } else {
                // [NOVA LÓGICA]: Se houver mais de 1 escola no top3, limpa/reseta a seleção do combo nativo
                selectEscola.selectedIndex = 0; 
                selectEscola.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    // 6. Finalização e Abertura do Modal do Sistema
    const modalAssis = document.getElementById('modal-assistente-analise');
    if (modalAssis) modalAssis.remove();

    const win = docFinal.defaultView || window;
    if (win.location.href.includes('ficha_transporte.php') && !win.location.href.includes('nova_versao') && typeof win.ShowModal === 'function') {
        const modalId = (resultado === 'DEFERIR') ? "modal_Deferir" : "modal_Indeferir";
        if (docFinal.getElementById(modalId)) win.ShowModal(modalId);
    }
}

// ==============
// SECTION: ESTILOS E UI BASE
// ==============

// Injeta na página os estilos CSS utilizados pela interface do Assistente.
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
        .btn.dimmed { 
    flex: 0.7; 
    background-color: transparent; /* Remove o fundo cinza */
    opacity: 1; /* Retira a opacidade que dá aspecto de "desligado" */
    font-weight: 500; /* Opcional: um peso de fonte ligeiramente menor que o botão principal */
    transition: all 0.2s ease-in-out; /* Suaviza a interação */
}

/* Sucesso - Secundário */
.btn-success.dimmed { 
    border: 2px solid #27ae60; /* Borda da cor principal */
    color: #27ae60; /* Texto da cor principal (em vez de branco/cinza) */
}

/* Danger - Secundário */
.btn-danger.dimmed { 
    border: 2px solid #c0392b; 
    color: #c0392b; 
}

.btn-success.dimmed:hover, 
.btn-success.dimmed:focus {
    background-color: rgba(39, 174, 96, 0.1); 
}

.btn-danger.dimmed:hover, 
.btn-danger.dimmed:focus {
    background-color: rgba(192, 57, 43, 0.1); 
}


.btn-success:not(.dimmed):hover, 
.btn-success:not(.dimmed):focus {
    background-color: #239c56; 
}

.btn-danger:not(.dimmed):hover, 
.btn-danger:not(.dimmed):focus {
    background-color: #b33628; 
}


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


window.atualizarListaEscolasDinamicamente = null;

// ==============
// SECTION: INICIALIZAÇÃO DO BOTÃO DO ASSISTENTE
// ==============

// Gerencia a criação, exibição e estado do botão flutuante para abrir o assistente de análise.
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

    // --- IDENTIFICAÇÃO DO USUÁRIO TESTADOR (EVERTON MONTEIRO) ---
    const userInput = document.querySelector('input[name="nome_usuario_alt"]') || (doc && doc.querySelector('input[name="nome_usuario_alt"]'));
    const nomeUsuario = userInput ? userInput.value : "";
    const ehUsuarioTestador = /EVERTON.*MONTEIRO/i.test(nomeUsuario);

    const textoStatus = statusDiv.innerText.toUpperCase();
    const ehAnalise = textoStatus.includes('EM ANÁLISE') || 
                      textoStatus.includes('EM ANALISE') || 
                      textoStatus.includes('AGUARDANDO ANÁLISE') || 
                      textoStatus.includes('AGUARDANDO ANALISE');

    // Se NÃO for o usuário testador E NÃO estiver em modo de análise, remove botão/modal e encerra.
    if (!ehUsuarioTestador && !ehAnalise) {
        if (btn) btn.remove();
        const modal = document.getElementById('modal-assistente-analise');
        if (modal) modal.remove();
        return;
    }

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

// Recupera o cache de análise (ex: distâncias) salvo anteriormente no localStorage para o pedido.
// Recupera o cache de análise adaptado para a nova regra global (Expiração de 7 dias e teto de 100 itens)
window.getCacheAssistente = function(id) {
    try {
        let cacheCompleto = JSON.parse(localStorage.getItem('plattransp_assistente_cache_v2') || '{}');
        const agora = Date.now();
        const LIMITE_EXPIRACAO_MS = 7 * 24 * 60 * 60 * 1000; // 7 Dias

        if (cacheCompleto[id]) {
            // Se o cache da solicitação passou de 7 dias, invalida reativamente
            if (agora - cacheCompleto[id].timestamp > LIMITE_EXPIRACAO_MS) {
                delete cacheCompleto[id];
                localStorage.setItem('plattransp_assistente_cache_v2', JSON.stringify(cacheCompleto));
                return null;
            }
            return cacheCompleto[id].dados;
        }
    } catch(e) { 
        return null; 
    }
    return null;
};

window.setCacheAssistente = function(id, dados) {
    if (!id) return;
    try {
        let cacheCompleto = JSON.parse(localStorage.getItem('plattransp_assistente_cache_v2') || '{}');
        const agora = Date.now();
        const LIMITE_EXPIRACAO_MS = 7 * 24 * 60 * 60 * 1000; // 7 Dias

        // 1. Limpa registros expirados com mais de 7 dias
        for (let k in cacheCompleto) {
            if (cacheCompleto[k] && cacheCompleto[k].timestamp && (agora - cacheCompleto[k].timestamp > LIMITE_EXPIRACAO_MS)) {
                delete cacheCompleto[k];
            }
        }

        // 2. Atualiza ou insere a ficha atual com o carimbo do tempo
        cacheCompleto[id] = {
            dados: dados,
            timestamp: agora
        };

        // 3. Aplica o limite estrito de no máximo os últimos 100 registros gravados no histórico
        let listaChaves = Object.keys(cacheCompleto);
        if (listaChaves.length > 100) {
            listaChaves.sort((a, b) => (cacheCompleto[a]?.timestamp || 0) - (cacheCompleto[b]?.timestamp || 0));
            while (listaChaves.length > 100) {
                const chaveDeletar = listaChaves.shift();
                delete cacheCompleto[chaveDeletar];
            }
        }

        localStorage.setItem('plattransp_assistente_cache_v2', JSON.stringify(cacheCompleto));
    } catch(e) {
        console.error("❌ Falha de gravação no cache de fichas do assistente:", e);
    }
};

// ==============
// SECTION: ABERTURA DO MODAL E MÁQUINA DE ESTADOS
// ==============

// Inicializa o Assistente de Análise processando o contexto e os dados para mostrar o modal.
window.abrirModalAssistente = async function() {
    if (window.abrindoModalAssistente) return;
    window.abrindoModalAssistente = true;
    
    const ctx = await extrairContextoFicha(window.getAlvoDocument());
    const doc = ctx.doc;
    if (typeof console !== 'undefined' && console.debug) console.debug('[ASSISTENTE] abrirModalAssistente');

    const modalAnterior = document.getElementById('modal-assistente-analise');
    if (modalAnterior?.parentNode) modalAnterior.parentNode.removeChild(modalAnterior);

    const idSolicitacaoAtual = ctx.idSolicitacao;
    let historicoRua = ctx.historicoRua;
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
    const endCEP = ctx.cepVal;
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
        ehMaisProxima: null,
        ehMaisProximaParcial: false,
        ehMaisProximaIntegral: false,
        isEspecial: ctx.isEspecial,
        nomeEscolaAtual: ctx.nomeEscolaAtual,
        areaRuralProcessada: false,
        deficienciaEspecialProcessada: false,
        pularDeficiencia: false,
        top3EscolasNomes: "",
        idEscolaMaisProxima: null,
        distMaisProxima: null,
        opcoesMaisProx: '',
        opcoesMaisProxCount: 0,
        opcoesMaisProxItems: [],
        fetchRealizado: false
    };
    
    // Salva as distâncias obtidas ou em erro no cache local para persistência.
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

    // Salva os dados de geolocalização no estado compartilhado da aplicação.
    function gravarDadosGeograficosSessao(valor) {
        dadosGeograficosSessao = valor;
        if (typeof window.setSharedStoreValue === 'function') {
            window.setSharedStoreValue('dadosGeograficos', valor);
        }
    }

    // Armazena o estado atual do assistente no histórico para o botão 'Voltar'.
    function salvarHistorico() {
        historico.push(JSON.parse(JSON.stringify(estado)));
    }

    // Retorna o assistente para a etapa anterior restaurando os dados do histórico.
    function voltarPasso() {
        if (historico.length > 0) {
            if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
            estado = historico.pop();
            estado.telaFinal = false;
            estado.buscandoOSRM = false; 
            renderizarPasso();
        }
    }

    // Gera o texto explicativo sobre o contexto do aluno baseado na rua e encaminhamentos.
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

    if (!ctx.idEscolaAtual) {
    console.error("[ASSISTENTE] ID da escola não detectado na ficha. A lista de escolas próximas não será exibida corretamente.");
    }

    // ==============
    // SECTION: MÁQUINA DE ESTADOS (renderizarPasso)
    // ==============
    // Analisa a situação atual e renderiza no Assistente qual deve ser a próxima pergunta ou a resposta final.
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
            
            
            // =========================================================================
            // VERIFICAÇÃO DE IRMÃOS
            // =========================================================================
            if (historicoRua && historicoRua.dadosIrmaos && historicoRua.dadosIrmaos.length > 0 && estado.verificacaoIrmaosConcluida !== true) {
                console.debug("[ASSISTENTE] Verificando histórico de irmãos para o endereço...");

                vincularEventoUnico(document.getElementById('btn-voltar-assistente'), 'click', () => {
                    console.log("[voltar]");    
                    if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();    
                        //salvarHistorico();
                        
                        estado.verificacaoIrmaosConcluida = null;
                        estado.telaFinal = null;
                        estado.escolaProximaUser = null;
                        estado.mudancaOk = null;
                                                                        
                        renderizarPasso(); // Segue diretamente para a tela final previamente calculada
                    });

                const resultadoCalculado = estado.telaFinal.titulo; // "DEFERIR" ou "INDEFERIR"
                const irmaosAtendidos = historicoRua.irmaosAtendidos || 0;
                const irmaosIndeferidos = historicoRua.irmaosIndeferidos || 0;
                let txtIrmaos = "";
                let introTxtIrmaos = "";
                if ((resultadoCalculado.includes('INDEFERIR') && irmaosAtendidos > 0) || (!resultadoCalculado.includes('INDEFERIR') && irmaosIndeferidos > 0)) {
                         introTxtIrmaos = ` mas `; }else {introTxtIrmaos = ` e `;}
                    if (irmaosAtendidos > 0 || irmaosIndeferidos > 0) {
                        if (irmaosAtendidos > 0) { txtIrmaos = `<b>${irmaosAtendidos} aluno${irmaosAtendidos > 1 ? 's' : ''} ATENDIDO${irmaosAtendidos > 1 ? 'S' : ''}</b>`;}
                        if(irmaosIndeferidos > 0) { txtIrmaos += `${txtIrmaos ? ' e ' : ''}<b>${irmaosIndeferidos} ${txtIrmaos ? '' : `aluno${irmaosIndeferidos > 1 ? 's' : ''}`} INDEFERIDO${irmaosIndeferidos > 1 ? 'S' : ''}</b>`;}
                        if(txtIrmaos) { txtIrmaos = `${introTxtIrmaos} há ${txtIrmaos} no mesmo endereço`; }
                    }

                // Condição 1: Assistente vai indeferir, mas existem irmãos sendo ATENDIDOS
                // Condição 2: Assistente vai deferir, mas existem irmãos INDEFERIDOS
                const deveIntervir = (resultadoCalculado.includes("INDEFERIR") && irmaosAtendidos > 0) || 
                                     (resultadoCalculado.includes("DEFERIR") && !resultadoCalculado.includes("INDEFERIR") && irmaosIndeferidos > 0);

                if (deveIntervir) {
                    const qtdIrmaos = historicoRua.dadosIrmaos.length;
                    const temAtendidos = irmaosAtendidos > 0;
                    const bgCor = temAtendidos ? "#d4edda" : "#fff3cd";
                    const textoCor = temAtendidos ? "#155724" : "#856404";
                    const bordaCor = temAtendidos ? "#c3e6cb" : "#ffeeba";
                    const iconeMdi = temAtendidos ? "mdi-account-multiple-check" : "mdi-account-multiple-remove";

                    let htmlIrmaos = `<h3 class="section-title text-primary"><span class="mdi mdi-human-male-female" style="font-size: 22px; margin-right: 6px;"></span> Validação de Vínculo de Irmãos</h3>`;
                    htmlIrmaos += `<div style='background-color: ${bgCor}; color: ${textoCor}; padding: 12px; border-radius: 5px; margin-bottom: 15px; border: 1px solid ${bordaCor};'>`;
                    htmlIrmaos += `<span class='mdi ${iconeMdi}'></span> Pelas informações coletadas, você deveria <span class="badge ${resultadoCalculado.includes('INDEFERIR') ? 'badge-danger' : 'badge-success'}">${resultadoCalculado}</span>, ${txtIrmaos}:`;
                    htmlIrmaos += `<ul style='margin-top: 8px; margin-bottom: 8px; padding-left: 20px;'>`;

                    // Lista detalhada (limita exibição a até 3 itens de forma limpa)
                    historicoRua.dadosIrmaos.slice(0, 3).forEach(irmao => {
                        // Captura segura e dinâmica do contexto da URL atual da página
                        const windowAlvo = document.defaultView || window;
                        const docAlvo = (typeof window.getAlvoDocument === 'function' ? window.getAlvoDocument() : windowAlvo.document);
                        const docHref = docAlvo?.location?.href || windowAlvo.location.href;
                        
                        // Determina dinamicamente o arquivo correto com base na versão que o usuário está usando
                        const nomeArquivoFicha = (docHref.includes('ficha_transporte.php') && !docHref.includes('nova_versao'))
                            ? 'ficha_transporte.php'
                            : 'ficha_transporte_nova_versao.php';

                        const linkFicha = `modulos/transporte_escolar/${nomeArquivoFicha}?id_solicitacao=${irmao.id_solicitacao}`;
                        const badgeClass = irmao.validoParaDeferir ? "badge-success" : "badge-danger";
                        
                        htmlIrmaos += `
                            <li style="margin-bottom: 5px; font-size: 13px;">
                                Aluno: <b>${irmao.nome}</b> (RA: ${irmao.ra})<br>
                                Status: <span class="badge ${badgeClass}">${irmao.status}</span> | Motivo: <i>${irmao.status_motivo || 'Não informado'}</i><br>
                                <a href="${linkFicha}" target="_blank" style="color: ${textoCor}; text-decoration: underline; font-size: 12px;"><b><span class="mdi mdi-open-in-new"></span> Abrir Ficha</b></a>
                            </li>`;
                    });

                    if (qtdIrmaos > 3) {
                        htmlIrmaos += `<li><i>E mais ${qtdIrmaos - 3} passageiro(s) registrado(s) neste local.</i></li>`;
                    }
                    htmlIrmaos += `</ul></div>`;

                    htmlIrmaos += `
                        <p><b>Atenção:</b> Confirme se o passageiro atual possui vínculo familiar direto com os alunos citados acima (verifique sobrenome, nomes dos pais, o complemento do endereço, etc).</p>
                        <p>São irmãos? Devemos seguir o mesmo critério dos demais?</p>
                        
                        <div class="action-group" style="margin-top: 15px;">
                            <button id="btn-irmao-sim" class="btn btn-primary"><span class="mdi mdi-check-all"></span> Sim, copiar análise dos irmãos</button>
                            <button id="btn-irmao-nao" class="btn btn-secondary"><span class="mdi mdi-scale-balance"></span> Não, manter minha análise</button>
                        </div>
                    `;

                    conteudo.innerHTML = htmlIrmaos;

                    // Ação SIM: Segue a tendência majoritária/histórica dos irmãos encontrados
                    vincularEventoUnico(document.getElementById('btn-irmao-sim'), 'click', () => {
                        salvarHistorico();
                        estado.verificacaoIrmaosConcluida = true;

                        // =========================================================================
                        // LÓGICA DE EXTRAÇÃO DO MOTIVO MAIS RECORRENTE DA MAIORIA
                        // =========================================================================
                        let motivoMaisFrequente = "";
                        let detalheMaisFrequente = "";

                        // Filtra apenas o grupo de irmãos pertencentes à maioria analítica
                        const grupoMaioria = historicoRua.dadosIrmaos.filter(irmao => {
                            if (temAtendidos) {
                                // Se a maioria for ATENDIDOS, filtra os válidos para deferimento
                                return irmao.validoParaDeferir === true || (irmao.status && irmao.status.toUpperCase().includes("ATENDIDO") && irmao.status.toUpperCase() !== "INDEFERIDO" && irmao.status.toUpperCase() !== "NÃO ATENDIDO" && irmao.status.toUpperCase() !== "NAO ATENDIDO") || (irmao.status && (irmao.status.toUpperCase() === "ATENDIDO" || irmao.status.toUpperCase() === "DEFERIDO"));
                            } else {
                                // Se a maioria for INDEFERIDOS, filtra os inválidos para deferimento
                                return irmao.validoParaDeferir === false || (irmao.status && irmao.status.toUpperCase().includes("INDEFERIDO")) || (irmao.status && irmao.status.toUpperCase() === "INDEFERIDO");
                            }
                        });

                        if (grupoMaioria.length > 0) {
                            const contagemMotivos = {};
                            const contagemDetalhes = {};

                            grupoMaioria.forEach(i => {
                                // Conta recorrência dos motivos cadastrados no BD (ex: IDs de motivos ou nomes textuais exatos)
                                if (i.status_motivo) {
                                    contagemMotivos[i.status_motivo] = (contagemMotivos[i.status_motivo] || 0) + 1;
                                }
                                // Opcional: Se houver campo de observações detalhadas no objeto irmão, mapeia aqui
                                if (i.observacao_analise) {
                                    contagemDetalhes[i.observacao_analise] = (contagemDetalhes[i.observacao_analise] || 0) + 1;
                                }
                            });

                            // Localiza o motivo mais votado/repetido da lista
                            let maxMotivos = 0;
                            for (const mot in contagemMotivos) {
                                if (contagemMotivos[mot] > maxMotivos) {
                                    maxMotivos = contagemMotivos[mot];
                                    motivoMaisFrequente = mot;
                                }
                            }

                            // Localiza os detalhes mais votados/repetidos da lista
                            let maxDetalhes = 0;
                            for (const det in contagemDetalhes) {
                                if (contagemDetalhes[det] > maxDetalhes) {
                                    maxDetalhes = contagemDetalhes[det];
                                    detalheMaisFrequente = det;
                                }
                            }
                        }

                        // Aplica as definições dinâmicas dependendo do veredito final
                        if (temAtendidos) {
                            estado.telaFinal = { 
                                titulo: "DEFERIR", 
                                motivo: motivoMaisFrequente || '', // Copia o motivo idêntico ou deixa limpo se indetectável
                                detalhes: detalheMaisFrequente || "Irmão de aluno já atendido no mesmo endereço",
                                mensagem: "Deferido para acompanhar o histórico de atendimento ativo de irmão(s) residente(s) no mesmo endereço." 
                            };
                        } else {
                            estado.telaFinal = { 
                                titulo: "INDEFERIR", 
                                motivo: motivoMaisFrequente || '', // Copia o motivo de indeferimento mais recorrente
                                detalhes: detalheMaisFrequente || "Indeferido para acompanhar o histórico unificado de indeferimento familiar no mesmo endereço.",
                                mensagem: "Indeferido para acompanhar o histórico unificado de indeferimento familiar no mesmo endereço." 
                            };
                        }
                        renderizarPasso();
                    });

                    // Ação NÃO: Ignora o critério de irmãos e mantém o cálculo feito anteriormente
                    vincularEventoUnico(document.getElementById('btn-irmao-nao'), 'click', () => {
                        salvarHistorico();
                        estado.verificacaoIrmaosConcluida = true;
                        renderizarPasso(); // Segue diretamente para a tela final previamente calculada
                    });
                    

                    return; // Interrompe o fluxo para colher a resposta do usuário antes da tela final
                }
            }
            // ===========fim da tela irmãos


            
            
            // Verifica comprovante se for mudança de endereço, mas apenas se o resultado for DEFERIDO ou nulo. (indeferimento não precisa de documento)
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

            if (tipoAcao === 'DEFERIR' && estado.ehMaisProximaParcial === true && estado.ehCreche !== true) {
                if (textoDetalhes) {
                    textoDetalhes += " / Está na parcial mais próxima";
                } else {
                    textoDetalhes = "Está na parcial mais próxima";
                }
            }

            if (tipoAcao === 'INDEFERIR' && ctx.ehEJA === true && (estado.deficiencia !== 'ALUNO' && estado.deficiencia !== 'FAMILIA') && estado.dificuldadeAcesso !== true && estado.ehAreaRural !== true) {
                textoDetalhes = textoDetalhes ? `${textoDetalhes}` : "Alunos de EJA recebem passe escolar.  Só são atendidas as pessoas com deficiência.";
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

    if (tipoAcao === 'INDEFERIR' && motivoAnalise === 'ESCOLA POR OPÇÃO' && estado.opcoesMaisProx) {
        const prefix = estado.opcoesMaisProxCount === 1 ? 'Escola mais próxima: ' : 'Escolas mais próximas: ';
        textoDetalhes = `${prefix}${estado.opcoesMaisProx}`;
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
    preencheAnalise(tipoAcao, motivoAnalise, textoDetalhes, valorDistancia, estado.idEscolaMaisProxima);
});
            return;
        }

        const temSugestaoDeficiencia = sugestaoDeficienciaHtml === 'ALUNO' || sugestaoDeficienciaHtml === 'FAMILIA';
        
        function garantirDistanciaPreenchida() {
            if (estado.distancia === null) {
                const mapMode = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
                const rotaSessao = window.getSharedStoreValue?.('dadosGeraisRota');
                const distSug = obterDistanciaSugeridaInput(ctx, mapMode, rotaSessao);
                if (distSug !== '') estado.distancia = parseInt(distSug, 10);
            }
        }

        if ((historicoRua.ehAreaRural || historicoRua.ehDificuldadeAcesso) && !estado.areaRuralProcessada) {
            if (temSugestaoDeficiencia && estado.deficiencia === null) {
                estado.pularDeficiencia= false;
            } else {
                if (temSugestaoDeficiencia || estado.deficiencia === null) {estado.pularDeficiencia= false;}else{estado.pularDeficiencia= true;}
                estado.areaRuralProcessada = true;
                garantirDistanciaPreenchida();
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
        }else{
            if (estado.deficiencia === 'ALUNO' || estado.deficiencia === 'FAMILIA') {estado.pularDeficiencia= true;}
        }

        // etapa DEFICIENCIA do assistente
        // --- INÍCIO: BLOCO UNIFICADO DA ETAPA DEFICIÊNCIA ---
const precisaDeficienciaEspecial = estado.isEspecial && estado.deficiencia === null;
const precisaDeficienciaDistancia = (estado.distancia !== null && estado.distancia < 1500 && estado.deficiencia === null) || (temSugestaoDeficiencia === true && estado.deficiencia === null && estado.distancia !== null && estado.pularDeficiencia !== true);
const precisaDeficiencia_ = (estado.areaRuralProcessada || (temSugestaoDeficiencia && estado.ehEncaminhado !== null)) && estado.pularDeficiencia === false && estado.deficiencia === null;
const precisaDeficienciaEJA = ((ctx.ehEJA && temSugestaoDeficiencia && estado.deficiencia === null) || (ctx.ehEJA && estado.deficiencia === null && estado.distancia !== null && estado.pularDeficiencia !== true));

if (estado.escolaProximaUser !== null && (precisaDeficienciaEspecial || precisaDeficienciaDistancia || precisaDeficiencia_ || precisaDeficienciaEJA)) {
    let textoPergunta = "<p>O aluno ou responsável legal possui laudo médico válido comprovando <b>deficiência</b>?</p>";
    let estiloAluno = "background:#27ae60;";
    let estiloFamilia = "background:#2980b9;";
    let txt_btn_DeficAluno = "A criança tem deficiência";
    let txt_btn_DeficFamilia = "Pai/Mãe tem deficiência";
    let txt_btn_DeficNao = "Não possui deficiência";

    // Lógica para sugestões (Aluno ou Família)
    if (sugestaoDeficienciaHtml === 'ALUNO') {
        textoPergunta = "<p style='color:#c0392b; font-weight:bold;'>⚠️ A escola informou deficiência da criança. Verifique se o laudo está ok:</p>";
        estiloAluno = "background:#27ae60; box-shadow: 0 0 12px 3px #f1c40f; border: 2px solid #f39c12; transform: scale(1.02);";
        txt_btn_DeficAluno = "Laudo do aluno está ok";
        txt_btn_DeficNao = "Não possui deficiência ou laudo não é aceito";
    } else if (sugestaoDeficienciaHtml === 'FAMILIA') {
        textoPergunta = "<p style='color:#c0392b; font-weight:bold;'>⚠️ A escola informou deficiência na família. Verifique se o laudo está ok:</p>";
        estiloFamilia = "background:#2980b9; box-shadow: 0 0 12px 3px #f1c40f; border: 2px solid #f39c12; transform: scale(1.02);";
        txt_btn_DeficFamilia = "Laudo do responsável está ok";
        txt_btn_DeficNao = "Não possui deficiência ou laudo não é aceito";
    }

    // Títulos e subtítulos dinâmicos
    let tituloBoxStr = (precisaDeficienciaEspecial || estado.isEspecial) ? "Exceção: Ensino Especial" : "Deficiência";
    let subTituloBox = "";
    if ((precisaDeficienciaEspecial || estado.isEspecial) && (temSugestaoDeficiencia || estado.deficiencia === 'ALUNO' || estado.deficiencia === 'FAMILIA')) {
        subTituloBox = "PCD em escola de ensino especial";
    } else if (estado.distancia !== null && estado.distancia < 1500) {
        subTituloBox = "A distância aferida é <b>inferior a 1500m</b>.";
    }

    conteudo.innerHTML = `
        <h3 class="section-title text-warning">
            <span class="mdi mdi-wheelchair-accessibility" style="font-size: 22px; margin-right: 6px;"></span> ${tituloBoxStr}
        </h3>
        ${subTituloBox ? `<p>${subTituloBox}</p>` : ''}
        ${textoPergunta}
        <div class="action-group-col" style="margin-top:20px;">
            <button id="btn-def-aluno" class="btn btn-success" style="${estiloAluno}">${txt_btn_DeficAluno}</button>
            <button id="btn-def-familia" class="btn btn-info" style="${estiloFamilia}">${txt_btn_DeficFamilia}</button>
            <button id="btn-def-nao" class="btn btn-danger">${txt_btn_DeficNao}</button>
        </div>
    `;

    // Eventos com lógica de deferimento (incorporada do segundo bloco)
    vincularEventoUnico(document.getElementById('btn-def-aluno'), 'click', () => { 
        salvarHistorico(); 
        estado.deficiencia = 'ALUNO'; 
        if (!estado.isEspecial && estado.escolaProximaUser === true) { estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por motivo de deficiência do aluno." }; } 
        renderizarPasso(); 
    });
    
    vincularEventoUnico(document.getElementById('btn-def-familia'), 'click', () => { 
        salvarHistorico(); 
        estado.deficiencia = 'FAMILIA'; 
        if (!estado.isEspecial && estado.escolaProximaUser === true) { estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por motivo de deficiência do responsável." }; } 
        renderizarPasso(); 
    });
    
    vincularEventoUnico(document.getElementById('btn-def-nao'), 'click', () => { 
        salvarHistorico(); 
        estado.deficiencia = false; 
        renderizarPasso(); 
    });
    return;
}
// --- FIM: BLOCO DA ETAPA DEFICIÊNCIA ---

        //ETAPA 1:  DISTANCIA E ESCOLAS PROXIMAS
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
            
            // AGUARDANDO DADOS GEOGRÁFICOS ASYNC
            if (!dadosGeograficos && !estado.tentouResgate) {
                if (!estado.tentativasEsperaGeo) estado.tentativasEsperaGeo = 0;
                estado.tentativasEsperaGeo++;
                if (estado.tentativasEsperaGeo <= 15) {
                    conteudo.innerHTML = `<div style="text-align:center; padding:20px;" class="text-info"><span class="mdi mdi-refresh" style="font-size: 22px; margin-right: 6px;"></span> <b>Calculando escolas mais próximas...</b></div>`;
                    setTimeout(renderizarPasso, 500); 
                    return;
                }
            }

            // CAPTURA DOS DADOS (SE PREPARANDO PARA RENDERIZAR A TELA COMPLETA COM LISTA)
            const latAluno = dadosGeograficos?.geoEndereco_Latit || null;
            const lonAluno = dadosGeograficos?.geoEndereco_Longit || null;
            
            estado.nomeEscolaAtual = ctx.nomeEscolaAtual;
            const escolaSelecionada = ctx.escolaRegistro;
            if (escolaSelecionada && !estado.distanciasVerificadasInicialmente) {
                estado.distanciasVerificadasInicialmente = true;
                const transporteAtual = window.getSharedStoreValue?.('modoTransporteAtual') || 'pe';
                estado.perfilOSRM = transporteAtual === 'carro' ? 'driving' : 'foot';
            }
            estado.isEspecial = ctx.isEspecial;

            let mapModeAtual = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
            let transpModeAtual = window.getSharedStoreValue?.('modoTransporteAtual') || 'pe';

            // DEFINIÇÃO DO MOTOR DA LISTA DINÂMICA
            const atualizarListaEscolasDinamicamente = async (forcarRecalculo = false) => {
                
    //funcao arredondar distancia:
    const Arredondar = (distanciaBase = 0, idEscola = 0) => {
    let valorOriginal = 0;

    if (idEscola > 0 && estado.distanciasOSRM[idEscola] !== undefined && estado.distanciasOSRM[idEscola] !== 'Erro' && estado.distanciasOSRM[idEscola] !== null) {
        valorOriginal = Number(estado.distanciasOSRM[idEscola]);
    } else if (idEscola > 0 && Number(distanciaBase) > 0 && (estado.distanciasOSRM[idEscola] === 'Erro' || estado.distanciasOSRM[idEscola] === null)) {
        valorOriginal = Number(distanciaBase);
    } else if (Number(distanciaBase) > 0) {
        valorOriginal = Number(distanciaBase);
    } else {
        return distanciaBase;
    }

    // Aplicação estrita dos limites de arredondamento
    let numBase = 50;
    if (valorOriginal >= 10000) {
        numBase = 500;
    } else if (valorOriginal >= 1000) {
        numBase = 100;
    } else if (valorOriginal < 300) {
        numBase = 10;
    }
    
    return Math.round(valorOriginal / numBase) * numBase;
};

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
        listaExibirBase = montarListaEscolasExibicao(escolasAptas, latAluno || 0, lonAluno || 0, chaveListaAtual, idEscolaAtual, dadosGeraisRotaSessao);
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
    if (!containerLista) return;

    // Averiguação: verifica se TODAS as escolas da lista já possuem cálculo feito (diferente de undefined)
    const verificarTodosCalculados = () => {
        return listaExibirBase.length > 0 && listaExibirBase.every(esc => estado.distanciasOSRM[esc.id] !== undefined);
    };

    // Função interna para gerar a string de status dinamicamente
    const obterStatusText = (lista, ehMaisProx, ehMaisProxParcial) => {
        if (!verificarTodosCalculados()) {
            return `<p>Verifique se a escola matriculada é a mais próxima do endereço do aluno.</p>`;
        }
        
        const possuiEstimativa = lista.some(esc => {
            const valorDist = estado.distanciasOSRM[esc.id];
            const fonteDist = estado.fontesOSRM ? estado.fontesOSRM[esc.id] : null;
            
            return valorDist === 'Erro' || 
                   valorDist === null || 
                   fonteDist === 'OSRM' || 
                   fonteDist === 'HAVERSINE';
        });

        if (possuiEstimativa) {
            return `<span class="text-warning"><span class="mdi mdi-alert-circle-outline" style="font-size: 16px; margin-right: 4px;"></span> Não foi possível calcular as distâncias, verifique a distância correta clicando nos links do Google Maps</span>`;
        }

        if (lista.length === 0) {
            return `<span class="text-warning"><span class="mdi mdi-lightning-bolt" style="font-size: 16px; margin-right: 4px;"></span> Nenhuma opção compatível na base.</span>`;
        } else if (ehMaisProx) {
            return `<span class="text-success"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> A escola atual é a MAIS PRÓXIMA.</span>`;
        } else if (ehMaisProxParcial) {
            return `<span class="text-info"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Escola parcial mais próxima ao endereço.</span>`;
        } else {
            const complementoNivel = nivelAlunoOriginal ? ` de ${nivelAlunoOriginal}` : '';
            return `<span class="text-danger"><span class="mdi mdi-lightning-bolt" style="font-size: 16px; margin-right: 4px;"></span> Parece haver UEs mais próximas${complementoNivel}:</span>`;
        }
    };

    window.rerenderizarListaOSRM = () => {
        const lis = containerLista.querySelectorAll('li');
        lis.forEach(li => {
            const idEsc = li.dataset.id;
            if (!idEsc) return;
            let distTexto = '';
            if (estado.distanciasOSRM[idEsc] !== undefined) {
                if (estado.distanciasOSRM[idEsc] === 'Erro' || estado.distanciasOSRM[idEsc] === null) {
                    let escDados = listaExibirBase.find(e => String(e.id) === idEsc);
                    let distHaversine = escDados ? Math.round(escDados.distancia / 100) * 100 : 0;
                    let perfilReal = (estado.perfisReaisOSRM && estado.perfisReaisOSRM[idEsc]) || estado.perfilOSRM;
                    let iconPath = perfilReal === 'foot' ? 'mdi-walk' : 'mdi-car';
                    distTexto = `<span class="text-muted"><span class="mdi ${iconPath}" style="font-size: 14px; margin-right: 2px;"></span> +- ${distHaversine}m (estimativa)</span>`;
                } else {
                    let distArredondada = Arredondar(estado.distanciasOSRM[idEsc], idEsc);
                    let perfilReal = (estado.perfisReaisOSRM && estado.perfisReaisOSRM[idEsc]) || estado.perfilOSRM;
                    let iconPath = perfilReal === 'foot' ? 'mdi-walk' : 'mdi-car';
                    let sinalExato = (estado.fontesOSRM && (estado.fontesOSRM[idEsc] === 'OSRM' || estado.fontesOSRM[idEsc] === 'HAVERSINE')) ? '+-' : '';
                    distTexto = `<span class="text-warning"><span class="mdi ${iconPath}" style="font-size: 14px; margin-right: 2px;"></span> Trajeto: <b>${sinalExato}${distArredondada}m</b></span>`;
                }
            } else {
                distTexto = `<span class="text-warning"><span class="mdi mdi-refresh" style="font-size: 14px; margin-right: 2px;"></span> <i>Calculando trajeto...</i></span>`;
            }
            const divMeta = li.querySelector('.dist-texto');
            if (divMeta) divMeta.innerHTML = distTexto;
        });

        const divStatusContainer = containerLista.querySelector('.status-text-container');
        if (divStatusContainer) {
            divStatusContainer.innerHTML = obterStatusText(listaOrdenada, estado.ehMaisProxima, estado.ehMaisProximaParcial);
        }
    };

    let listaOrdenada = [...listaExibirBase];
    listaOrdenada.sort((a, b) => {
        let distA = Arredondar(a.distancia, a.id);
        let distB = Arredondar(b.distancia, b.id);
        return distA - distB;
    });
    
    if (listaOrdenada.length > 0) {
        let topEscola = listaOrdenada[0];
        estado.idEscolaMaisProxima = topEscola.id; 
        estado.distMaisProxima = Arredondar(topEscola.distancia, topEscola.id);
    }

    let schoolMaisProximaParcial = listaOrdenada.find(e => e.periodosEncontrados && e.periodosEncontrados.includes('PARCIAL'));
    let distParcialMaisProxima = schoolMaisProximaParcial ? Arredondar(schoolMaisProximaParcial.distancia, schoolMaisProximaParcial.id) : null;

    let schoolAtualNoArray = listaOrdenada.find(e => String(e.id) === String(idEscolaAtual));
    let distEscolaAtual = schoolAtualNoArray ? Arredondar(schoolAtualNoArray.distancia, idEscolaAtual) : null;

    let distInputUser = estado.distanciaSugeridaInput ? parseInt(estado.distanciaSugeridaInput, 10) : null;
    const limparNome = (n) => (typeof n === 'string' ? n.split(',')[0].trim() : n);

    const opcoesMaisProxData = estado.calcularOpcoesMaisProx ? estado.calcularOpcoesMaisProx(distInputUser) : { texto: '', count: 0, items: [] };
    estado.opcoesMaisProx = opcoesMaisProxData.texto;
    estado.opcoesMaisProxCount = opcoesMaisProxData.count;
    estado.opcoesMaisProxItems = opcoesMaisProxData.items || [];

    const todosCalculados = listaOrdenada.length > 0 && listaOrdenada.every(esc => estado.distanciasOSRM[esc.id] !== undefined);

    let ehMaisProxima = false;
    if (todosCalculados && listaOrdenada.length > 0) {
        const topEscola = listaOrdenada[0];
        if (String(topEscola.id) === String(idEscolaAtual)) ehMaisProxima = true;
        else if (distEscolaAtual !== null && estado.distMaisProxima !== null && distEscolaAtual === estado.distMaisProxima) ehMaisProxima = true;
        else if (distInputUser !== null && estado.distMaisProxima !== null && distInputUser === estado.distMaisProxima) ehMaisProxima = true;
        else if (schoolAtualNoArray && schoolAtualNoArray.terreno && topEscola.terreno && String(schoolAtualNoArray.terreno) === String(topEscola.terreno)) ehMaisProxima = true;
    }

    let ehMaisProximaParcial = false;
    if (todosCalculados && !ehMaisProxima && schoolMaisProximaParcial) {
        if (String(schoolMaisProximaParcial.id) === String(idEscolaAtual)) ehMaisProximaParcial = true;
        else if (schoolAtualNoArray && schoolAtualNoArray.periodosEncontrados && schoolAtualNoArray.periodosEncontrados.includes('PARCIAL')) {
            if (distEscolaAtual !== null && distParcialMaisProxima !== null && distEscolaAtual === distParcialMaisProxima) ehMaisProximaParcial = true;
            else if (distInputUser !== null && distParcialMaisProxima !== null && distInputUser === distParcialMaisProxima) ehMaisProximaParcial = true;
            else if (schoolAtualNoArray.terreno && schoolMaisProximaParcial.terreno && String(schoolAtualNoArray.terreno) === String(schoolMaisProximaParcial.terreno)) ehMaisProximaParcial = true;
        }
    }
    
    if(estado.ehCreche){ehMaisProximaParcial = false;}
    estado.escolaProximaCalc = ehMaisProxima || ehMaisProximaParcial;
    estado.ehMaisProximaParcial = ehMaisProximaParcial;
    estado.ehMaisProxima = ehMaisProxima;
    
    // Função auxiliar rápida para garantir que o valor seja puramente numérico
const ehDistanciaValida = (valor) => {
    return valor !== null && valor !== undefined && valor !== '' && !isNaN(Number(valor)) && isFinite(Number(valor));
};

const escolasEfetivamenteMaisProximas = listaOrdenada.filter(e => {
    if (String(e.id) === String(idEscolaAtual)) return false; 
    
    const distArredondadaEscola = Arredondar(e.distancia, e.id);

    // [NOVA LÓGICA]: Se a distância arredondada for inválida (null, NaN, Infinity), descartamos a escola
    if (!ehDistanciaValida(distArredondadaEscola)) {
        return false;
    }
    
    if (ehDistanciaValida(distEscolaAtual)) {
        return distArredondadaEscola < distEscolaAtual; 
    }
    return true;
});

estado.top3EscolasNomes = escolasEfetivamenteMaisProximas.slice(0, 3).map(e => {
    // Como já validamos no filter, é seguro apenas arredondar e concatenar
    const distFinal = Arredondar(e.distancia, e.id);
    return {
        nome: limparNome(e.nome),
        distancia: distFinal + 'm'
    };
});

if (typeof window.setSharedStore === 'function') {
    window.setSharedStore({ top3EscolasNomes: estado.top3EscolasNomes });
}

    estado.isEncaminhamentoDispensado = (estado.escolaProximaUser === true);

    let statusText = obterStatusText(listaOrdenada, ehMaisProxima, ehMaisProximaParcial);

    const btnSim = document.getElementById('btn-esc-sim');
    const btnNao = document.getElementById('btn-esc-nao');
    const destaqueSim = (ehMaisProxima || ehMaisProximaParcial);
    const destaqueNao = (!ehMaisProxima && !ehMaisProximaParcial && !estado.ehMaisProximaIntegral);
    
    if (btnSim && btnNao) {
        if (destaqueSim) {
            btnSim.className = "btn btn-success destaque";
            btnNao.className = "btn btn-danger dimmed";
        } else if (destaqueNao) {
            btnNao.className = "btn btn-danger destaque";
            btnSim.className = "btn btn-success dimmed";
        } else {
            btnNao.className = "btn btn-danger";
            btnSim.className = "btn btn-success";
        }
        window.destaqueSimGlobal = destaqueSim;
    }

    let listaHtml = `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; position:relative;">
        <div class="status-text-container">${statusText}</div>
        <button id="btn-refresh-lista" class="btn-icon-transparent" style="position:absolute; top:0; right:0; display:block;" title="Recalcular distâncias">
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
            let perfilReal = (estado.perfisReaisOSRM && estado.perfisReaisOSRM[esc.id]) || estado.perfilOSRM;
            let iconPath = perfilReal === 'foot' ? 'mdi-walk' : 'mdi-car';

            let sufixoMaps = perfilReal === 'foot' ? "&travelmode=walking&dirflg=w" : "&travelmode=driving&dirflg=d";
            let urlConfere = "";
            
            if (mapModeAtual === 'endereco' && dadosGeraisRotaSessao && typeof dadosGeraisRotaSessao.coordAlunoEnd === 'string') {
                let endStrEncode = encodeURIComponent(dadosGeraisRotaSessao.coordAlunoEnd);
                urlConfere = `https://maps.google.com/maps?saddr=${endStrEncode}&daddr=${esc.lat}+${esc.lon}${sufixoMaps}`;
            } else {
                urlConfere = `https://maps.google.com/maps?saddr=${latOrigemLista}+${lonOrigemLista}&daddr=${esc.lat}+${esc.lon}${sufixoMaps}`;
            }
            
            
            let txtDist = `<span class="text-warning"><span class="mdi mdi-refresh" style="font-size: 14px; margin-right: 2px;"></span> <i>Calculando trajeto...</i></span>`;
            if (estado.distanciasOSRM[esc.id] !== undefined) {
                if (estado.distanciasOSRM[esc.id] === 'Erro' || estado.distanciasOSRM[esc.id] === null) {
                    let distHaversine = Math.round(esc.distancia + 100);
                    txtDist = `<span class="text-muted"><span class="mdi ${iconPath}" style="font-size: 14px; margin-right: 2px;"></span> +- ${distHaversine}m (estimativa)</span>`;
                } else {
                    let distArredondada = Arredondar(estado.distanciasOSRM[esc.id], esc.id);
                    let sinalExato = (estado.fontesOSRM && (estado.fontesOSRM[esc.id] === 'OSRM' || estado.fontesOSRM[esc.id] === 'HAVERSINE')) ? '+-' : '';
                    txtDist = `<span class="text-warning"><span class="mdi ${iconPath}" style="font-size: 14px; margin-right: 2px;"></span> Trajeto: <b>${sinalExato}${distArredondada}m</b></span>`;
                    if(tagAtual !== '' && (estado.distancia === null || estado.distancia === undefined || estado.distancia === 0 || estado.distancia === '') && distArredondada > 0){
                        estado.distancia = distArredondada;
                    }
                }
            }

            let classeBadge = esc.periodosEncontrados.includes('INTEGRAL') ? ' badge-integral' : (esc.periodosEncontrados.includes('PARCIAL') ? ' badge-parcial' : ' badge-noite');

            listaHtml += `<li data-id="${esc.id}" class="school-item ${cor}">
                ${tagAtual}${i + 1}º - ${esc.nome} <span class="badge${classeBadge}">${esc.periodosEncontrados}</span>
                <div class="school-meta dist-texto">${txtDist}
                <a href="${urlConfere}" target="_blank" class="link-action">
                    <span class="mdi mdi-map" style="font-size: 14px; margin-right: 2px;"></span> Ver rota no Google Maps
                </a></div>
            </li>`;
        });
    }
    listaHtml += `</ul></div>`;
    
    const latOrigemLista = (mapModeAtual === 'endereco' && dadosGeraisRotaSessao?.coordAlunoEnd && typeof dadosGeraisRotaSessao.coordAlunoEnd !== 'string') ? dadosGeraisRotaSessao.coordAlunoEnd.lat : latAluno;
    const lonOrigemLista = (mapModeAtual === 'endereco' && dadosGeraisRotaSessao?.coordAlunoEnd && typeof dadosGeraisRotaSessao.coordAlunoEnd !== 'string') ? dadosGeraisRotaSessao.coordAlunoEnd.lon : lonAluno;

    let linkMapaRede = `https://www.google.com/maps/d/u/0/viewer?mid=1ukc8GP3M-X3Da5l4k406MUMz5oyBB0E&femb=1&ll=-23.706568332542187%2C-46.562466610927814&z=13`;
    if(latAluno && lonAluno) {linkMapaRede =  `https://www.google.com/maps/d/u/0/viewer?mid=1ukc8GP3M-X3Da5l4k406MUMz5oyBB0E&femb=1&ll=${latAluno}%2C${lonAluno}&z=18`;
}else if(latOrigemLista && lonOrigemLista) {linkMapaRede = `https://www.google.com/maps/d/u/0/viewer?mid=1ukc8GP3M-X3Da5l4k406MUMz5oyBB0E&femb=1&ll=${latOrigemLista}%2C${lonOrigemLista}&z=18`;
}else if(dadosGeraisRotaSessao?.coordAlunoEnd && typeof dadosGeraisRotaSessao.coordAlunoEnd !== 'string') {linkMapaRede = `https://www.google.com/maps/d/u/0/viewer?mid=1ukc8GP3M-X3Da5l4k406MUMz5oyBB0E&femb=1&ll=${dadosGeraisRotaSessao.coordAlunoEnd.lat}%2C${dadosGeraisRotaSessao.coordAlunoEnd.lon}&z=18`;
}   

    listaHtml += `<a href="${linkMapaRede}" target="_blank" class="btn btn-outline" style="text-decoration:none; margin-bottom:15px;">
        <span class="mdi mdi-map" style="font-size: 16px; margin-right: 4px;"></span> Conferir mapa da rede
    </a>`;

    containerLista.innerHTML = listaHtml;
    
    // --- FUNÇÃO CENTRALIZADA DO REFRESH ---
    window.acionarRefreshLista = async () => {
        // Esvazia completamente o objeto de distâncias para forçar o recálculo do zero de todas as escolas
        estado.distanciasOSRM = {};
        if (estado.cacheDistancias && estado.ultimoModoUsado) {
            estado.cacheDistancias[estado.ultimoModoUsado] = {};
        }
        
        persistirEstado();
        if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
        estado.buscandoOSRM = false;
        
        // Mantém exibido em bloco independente de qualquer ação
        const btnRefresh = document.getElementById('btn-refresh-lista');
        if (btnRefresh) btnRefresh.style.display = 'block';
        
        // Passa o parâmetro como true para forçar nova listagem e recálculos
        await atualizarListaEscolasDinamicamente(true);
    };

    const btnRefreshEnd = document.getElementById('btn-refresh-lista');
    if (btnRefreshEnd) {
        btnRefreshEnd.style.display = 'block';
        // Vincula o evento diretamente toda vez que a lista for gerada no DOM
        btnRefreshEnd.onclick = window.acionarRefreshLista;
    }
    
    let faltaCalcularAgora = latAluno && listaExibirBase.some(esc => estado.distanciasOSRM[esc.id] === undefined);
    if (estado.ehAnalise && faltaCalcularAgora && typeof window.calcularTrajeto === 'function' && !estado.buscandoOSRM) {
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
                        
                        // --- INTERCEPTAÇÃO E OTIMIZAÇÃO DA UNIDADE ATUAL SOLICITADA ---
                        let distanciaCalculadaFinal = null;
                        if (String(esc.id) === String(idEscolaAtual)) {
                            const liAtualDOM = containerLista.querySelector(`li[data-id="${idEscolaAtual}"]`);
                            const textoDistanciaAtual = liAtualDOM ? liAtualDOM.querySelector('.dist-texto')?.innerText || "" : "";
                            
                            const precisaRecalcular = !textoDistanciaAtual || 
                                                      textoDistanciaAtual.includes("+-") || 
                                                      textoDistanciaAtual.toUpperCase().includes("OSRM") || 
                                                      textoDistanciaAtual.toUpperCase().includes("HAVERSINE") ||
                                                      textoDistanciaAtual.includes("Calculando");

                            if (precisaRecalcular) {
                                console.log("[OTIMIZAÇÃO] Distância da escola atual ausente ou imprecisa. Calculando via Google...");
                                const resultadoCalc = await window.calcularTrajeto(latOrigemLista, lonOrigemLista, esc.lat, esc.lon, estado.perfilOSRM, meuSignal);
                                if (resultadoCalc !== null && resultadoCalc.distancia !== undefined) {
                                    distanciaCalculadaFinal = resultadoCalc.distancia;
                                    estado.distanciasOSRM[esc.id] = resultadoCalc.distancia;
                                    if (!estado.fontesOSRM) estado.fontesOSRM = {};
                                    estado.fontesOSRM[esc.id] = resultadoCalc.fonte;
                                    if (!estado.perfisReaisOSRM) estado.perfisReaisOSRM = {};
                                    estado.perfisReaisOSRM[esc.id] = resultadoCalc.modoUtilizado;
                                    window.setSharedStoreValue?.('distanciaPreenchidaAtual', distanciaCalculadaFinal);
                                } else {
                                    estado.distanciasOSRM[esc.id] = 'Erro';
                                }
                            } else {
                                console.log("[OTIMIZAÇÃO] Reutilizando cálculo robusto do Google existente para a unidade atual.");
                                const numeroKm = parseFloat(textoDistanciaAtual.replace(/[^\d,.]/g, '').replace(',', '.'));
                                distanciaCalculadaFinal = isNaN(numeroKm) ? null : Math.round(numeroKm * 1000);
                                estado.distanciasOSRM[esc.id] = distanciaCalculadaFinal;
                            }

                            // Sincroniza em tempo real o input de distância do painel lateral
                            if (distanciaCalculadaFinal !== null) {
                                window.atualizarInputDistancia(distanciaCalculadaFinal);
                            }
                        } else {
                            // Escolas secundárias comuns da lista seguem o fluxo padrão regulamentado
                            console.log(`[ASSISTENTE] 🧭 Calculando trajeto para escola ID: ${esc.id} - ${esc.nome}`);
                            
                            // Cria um mecanismo de proteção contra travamentos eternos (Timeout de 4 segundos)
                            const promessaTrajeto = window.calcularTrajeto(latOrigemLista, lonOrigemLista, esc.lat, esc.lon, estado.perfilOSRM, meuSignal);
                            const promessaTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_PROTETIVO")), 4000));
                            
                            try {
                                const resultadoCalc = await Promise.race([promessaTrajeto, promessaTimeout]);
                                if (meuSignal.aborted) break; 
                                
                                if (resultadoCalc !== null && resultadoCalc.distancia !== undefined && resultadoCalc.distancia !== null) {
                                    console.log(`[ASSISTENTE] ✅ Sucesso no cálculo ID ${esc.id}: ${resultadoCalc.distancia}m via ${resultadoCalc.fonte}`);
                                    estado.distanciasOSRM[esc.id] = resultadoCalc.distancia;
                                    if (!estado.fontesOSRM) estado.fontesOSRM = {};
                                    estado.fontesOSRM[esc.id] = resultadoCalc.fonte;
                                    if (!estado.perfisReaisOSRM) estado.perfisReaisOSRM = {};
                                    estado.perfisReaisOSRM[esc.id] = resultadoCalc.modoUtilizado;
                                } else {
                                    console.warn(`[ASSISTENTE] ⚠️ Retorno nulo ou inválido para escola ID ${esc.id}. Definindo como Erro.`);
                                    estado.distanciasOSRM[esc.id] = 'Erro';
                                }
                            } catch (errTimeout) {
                                console.error(`[ASSISTENTE] ❌ Travamento evitado na escola ID ${esc.id}: Rota demorou demais ou falhou. pulando para próxima.`);
                                estado.distanciasOSRM[esc.id] = 'Erro';
                            }
                        }

                        persistirEstado();
                        if (typeof window.rerenderizarListaOSRM === 'function') window.rerenderizarListaOSRM();
                        
                        // Garante a permanência do botão fixo como block
                        if (btnRefreshEnd) btnRefreshEnd.style.display = 'block';

                        await new Promise(r => setTimeout(r, 250));
                    }
                }
            } catch (erro) {
                console.error('[ASSISTENTE] erro OSRM:', erro);
            } finally {
                estado.buscandoOSRM = false;
                window.osrmAbortController = null;
                if (typeof window.atualizarListaEscolasDinamicamente === 'function') {
                    window.atualizarListaEscolasDinamicamente(false);
                }
            }
        })();
    } else {
        if (estado.distanciasOSRM[idEscolaAtual] !== undefined && estado.distanciasOSRM[idEscolaAtual] !== 'Erro') {
            window.atualizarInputDistancia(Number(estado.distanciasOSRM[idEscolaAtual]));
        }
    }
};

            window.atualizarListaEscolasDinamicamente = atualizarListaEscolasDinamicamente;

            // RENDERIZAÇÃO DA INTERFACE UNIFICADA (A LISTA COMPATÍVEL SEMPRE É EXIBIDA)
            conteudo.innerHTML = `
                <h3 class="section-title text-info">
                    <span class="mdi mdi-graph" style="font-size: 22px; margin-right: 6px;"></span> Verificação de Escola
                </h3>
                                
                <div id="container-lista-escolas">
                    <div style="text-align:center; padding:10px;" class="text-muted">Carregando listagem de UEs...</div>
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

            // DISPARA O MOTOR ASYNC DA LISTA LOGO EM SEGUIDA
            await atualizarListaEscolasDinamicamente();
            
            dadosGeraisRotaSessao = window.getSharedStoreValue?.('dadosGeraisRota') || dadosGeraisRotaSessao;
            if (dadosGeraisRotaSessao) {
                const modoMapaAtual = window.getSharedStoreValue?.('modoMapaAtual') || 'coordenada';
                const distancia = modoMapaAtual === 'endereco' ? dadosGeraisRotaSessao.distanciaEnd : dadosGeraisRotaSessao.distanciaCoord;
                if (typeof window.atualizarInputDistancia === 'function') window.atualizarInputDistancia(distancia);
            }

            const btnRefresh = document.getElementById('btn-refresh-lista');
            if (btnRefresh && typeof window.acionarRefreshLista === 'function') {
                btnRefresh.onclick = window.acionarRefreshLista;
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
                estado.opcoesMaisProx = '';
                estado.opcoesMaisProxCount = 0;
                if (estado.distancia >= 1500) {
                    estado.telaFinal = { titulo: "DEFERIR", mensagem: `A distância atinge o requisito mínimo (1500m) e os critérios da escola ou encaminhamento estão corretos.` };
                }
                renderizarPasso(); 
            });
            
            vincularEventoUnico(document.getElementById('btn-esc-nao'), 'click', () => { 
                if (window.cancelarProcessamentosAssistente) window.cancelarProcessamentosAssistente();
                const dist = parseInt(inputDist.value);
                if (isNaN(dist) || dist < 0) return alert("Por favor, insira uma distância válida em metros.");
                
                salvarHistorico(); 
                estado.distancia = dist;
                
                const distMaisProx = estado.distMaisProxima || 0;
                const ehExcecaoCreche = (ctx.ehCreche === true && distMaisProx >= 1500 && (dist - distMaisProx < 500) && dist >=1500 && dist < 3500);

                if (ehExcecaoCreche) {
                    estado.escolaProximaUser = true;
                    estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido por Exceção: O aluno está em unidade de Creche dentro da margem de tolerância de distância." };
                } else {
                    estado.escolaProximaUser = false;
                }

                try {
                    if (typeof estado.calcularOpcoesMaisProx === 'function') {
                        const recal = estado.calcularOpcoesMaisProx(estado.distancia);
                        estado.opcoesMaisProxItems = recal.items || [];
                        const filtradas = (estado.opcoesMaisProxItems || []).filter(i => Number(i.distancia) < Number(estado.distancia));
                        estado.opcoesMaisProx = filtradas.reduce((acc, it, index) => {
                            const parte = `${it.nome_unidade} (${it.distancia}m)`;
                            if (index === 0) return parte;
                            if (index === filtradas.length - 1) return `${acc} e ${parte}`;
                            return `${acc}, ${parte}`;
                        }, '');
                        estado.opcoesMaisProxCount = filtradas.length;
                    }
                } catch (e) { console.error('Erro recalculando opcoesMaisProx:', e); }
                renderizarPasso(); 
            });

            return;
        }// FIM DA ETAPA 1 - VERIFICAÇÃO DE ESCOLA E DISTÂNCIA

        //confirmação de dados críticos - somente se a informação do usuario for contrária ao que foi calculado
        if (estado.escolaProximaUser !== null && estado.distancia !== null && !estado.confirmacaoFeita) {
            let pergunta = null;
            
            if (estado.escolaProximaUser === false) {
                if (estado.ehMaisProximaParcial  && estado.ehCreche !== true) {
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
        }// fim do bloco de confirmação

        
        //deferir aluno com deficiencia em escola de ensino especial
        if (estado.deficiencia === 'ALUNO' && estado.isEspecial && !estado.deficienciaEspecialProcessada) {
            estado.deficienciaEspecialProcessada = true;
            garantirDistanciaPreenchida();
            estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido automaticamente: Aluno Especial + Deficiência.", motivoAnalise: "ALUNO DEFICIENTE", textoDetalhes: "ALUNO DEFICIENTE" };
            return renderizarPasso();
        }

        //etapa DIFICULDADE DE ACESSO
if (estado.distancia < 1500 && ((estado.deficiencia === false && estado.dificuldadeAcesso === null) || (ctx.ehEJA && historicoRua.ehDificuldadeAcesso))) {

    // A avaliação automática baseada no Banco Local continua rodando imediatamente sem travar
    if (historicoRua.bloqueiaDificuldadeAcesso) {
        estado.dificuldadeAcesso = false; 
        estado.telaFinal = { titulo: "INDEFERIR", mensagem: "A distância não atinge 1500m e o caso não se enquadra nas exceções." };
        return renderizarPasso();
    }

    if (historicoRua.ehDificuldadeAcesso && estado.escolaProximaUser === true && estado.distancia > 350 && estado.distancia < 1500) {
        estado.dificuldadeAcesso = true;
        estado.telaFinal = {
            titulo: "DEFERIR",
            mensagem: "Essa rua costuma ser atendida por DIFICULDADE DE ACESSO.",
            motivoAnalise: "DIFICULDADE DE ACESSO",
            textoDetalhes: "Essa rua costuma ser atendida por DIFICULDADE DE ACESSO.",
            urlPesquisaRua: ctx.urlPesquisaRua
        };
        return renderizarPasso();
    }

    // ======= EXIBIÇÃO DE LOADING =======
    conteudo.innerHTML = `
        <h3 class="section-title text-warning">
            <span class="mdi mdi-highway" style="font-size: 22px; margin-right: 6px;"></span> Dificuldade de Acesso
        </h3>
        <div id="loading-historico-rua" style="text-align: center; padding: 30px;">
            <span class="mdi mdi-loading mdi-spin" style="font-size: 32px; color: #1a73e8;"></span>
            <p style="margin-top: 10px; color: #555; font-size: 13px;">Analisando registros de atendimentos anteriores nesta mesma rua...</p>
        </div>
    `;

    // ======= EXECUÇÃO DO FETCH (PARTE 2) =======
    if (!estado.fetchRealizado && !historicoRua.dadosIrmaos) {
        historicoRua = await window.analisarRuaFetch(historicoRua, ctx.endRua.split(',')[0].trim(), ctx.endNum, ctx.idUnidade);
        estado.fetchRealizado = true;
    }

    // Medidas de totais para regras de automação baseadas no fetch
    let totalEncontrado = historicoRua.historicoDificuldadeAcesso + historicoRua.historicoAreaRural + historicoRua.historicoDistMaior + historicoRua.historicoDistMenor + historicoRua.historicoEscolaOpcao;
    
    let hasDificuldade = historicoRua.historicoDificuldadeAcesso > 0;
    let hasAreaRural = historicoRua.historicoAreaRural > 0;

    // =========================================================================
    // NOVA REGRA 1: CONSENSO DE DIFICULDADE DE ACESSO (DEFERIMENTO AUTOMÁTICO)
    // =========================================================================
    if (!historicoRua.erroFetch && historicoRua.historicoDificuldadeAcesso >= 10 && (historicoRua.totalAlunosRua - historicoRua.historicoDificuldadeAcesso) < 9) {
        salvarHistorico();
        estado.dificuldadeAcesso = true;
        
        if (estado.escolaProximaUser !== false) {
            estado.telaFinal = {
                titulo: "DEFERIR",
                mensagem: `Deferido automaticamente por consenso: Há um histórico massivo (${historicoRua.historicoDificuldadeAcesso} atendimentos) confirmando Dificuldade de Acesso nesta rua.`,
                motivoAnalise: "DIFICULDADE DE ACESSO",
                textoDetalhes: `Consenso de Dificuldade de Acesso (${historicoRua.historicoDificuldadeAcesso} alunos ativos).`
            };
        }
        return renderizarPasso(); 
    }

    // =========================================================================
    // NOVA REGRA 2: VAZIO ABSOLUTO (PULAR ETAPA PARA TELA FINAL DE INDEFERIDO)
    // =========================================================================
    const semMatchBancoLocal = !ctx.ruaMatch || (ctx.ruaMatch.resultado_motivo !== "DIFICULDADE DE ACESSO" && ctx.ruaMatch.resultado_motivo !== "AREA RURAL" && ctx.ruaMatch.resultado_motivo !== "ÁREA RURAL");
    
    if (!historicoRua.erroFetch && semMatchBancoLocal && !hasDificuldade && !hasAreaRural) {
        salvarHistorico();
        estado.dificuldadeAcesso = false; 
        
        estado.telaFinal = { 
            titulo: "INDEFERIR", 
            mensagem: "A distância não atinge 1500m e o caso não se enquadra nas exceções.",
            textoDetalhes: ""
        };
        return renderizarPasso(); 
    }

    // ======= LÓGICA DE MENSAGENS VISUAIS =======
    let MsgDificuldadeAcesso = "";
    let alertasFetch = "";
    
    let hasEscolaPorOpcao = historicoRua.historicoEscolaOpcao > 0;
    let hasDistMaior = historicoRua.historicoDistMaior > 0;
    let hasDistMenor = historicoRua.historicoDistMenor > 0;
    let destaqueSim = false;
    let destaqueNao = false;

    if(!historicoRua.erroFetch && (historicoRua.historicoDificuldadeAcesso > 6 || (historicoRua.historicoDificuldadeAcesso > 1 && (totalEncontrado - historicoRua.historicoDificuldadeAcesso) < 2))){
        destaqueSim = true;
        destaqueNao = false;
    } else {
        if(!historicoRua.erroFetch && (totalEncontrado === 0 || (!hasAreaRural && !hasDificuldade))){
            destaqueSim = false;
            destaqueNao = true;
        }
    }

    const plural = (q, singular, pluralStr) => q > 1 ? pluralStr : singular;
    
    if (!historicoRua.erroFetch) {
        if (semMatchBancoLocal && (!hasDificuldade && !hasAreaRural)) {
            MsgDificuldadeAcesso = "<div style='background-color: #fff3cd; color: #856404; padding: 10px; border-radius: 5px; margin-bottom: 10px; border: 1px solid #ffeeba;'><b>A rua não está mapeada para atendermos por dificuldade de acesso. Além disso, não há ninguém sendo atendido por dificuldade de acesso nessa rua.</b></div>";
            destaqueNao = true; destaqueSim = false;
        } else {
            if (hasDificuldade || hasAreaRural || totalEncontrado > 0) {
                MsgDificuldadeAcesso = ""; 
                
                const corCard = (hasDificuldade || hasAreaRural) ? "background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;" : "background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba;";
                alertasFetch += `<div style='padding: 10px; border-radius: 5px; margin-bottom: 15px; ${corCard}'>`;
                
                if (historicoRua.historicoDificuldadeAcesso > 6 || (historicoRua.historicoDificuldadeAcesso > 1 && (totalEncontrado - historicoRua.historicoDificuldadeAcesso) < 2)) {
                    alertasFetch += `<b><span class='mdi mdi-information-outline'></span> Há <b>${historicoRua.historicoDificuldadeAcesso}</b> ${plural(historicoRua.historicoDificuldadeAcesso, 'atendimento', 'atendimentos')} por <b>dificuldade de acesso</b> nesta rua.</b><br>`;
                }
                else if (historicoRua.historicoAreaRural > 6 || (historicoRua.historicoAreaRural > 1 && (totalEncontrado - historicoRua.historicoAreaRural) < 2)) {
                    alertasFetch += `<b><span class='mdi mdi-information-outline'></span> Há <b>${historicoRua.historicoAreaRural}</b> ${plural(historicoRua.historicoAreaRural, 'atendimento', 'atendimentos')} por <b>área rural</b> nesta rua.</b><br>`;
                }
                else if (hasDificuldade || hasAreaRural || hasEscolaPorOpcao || hasDistMaior || hasDistMenor) {
                     
                    if(!hasDificuldade && !hasAreaRural) {
                        alertasFetch += `<b><span class='mdi mdi-information-outline'></span> NINGUÉM é atendido por dificuldade de acesso/rural nessa rua. Mas constam no histórico:</b><br><ul style='margin-top: 5px; margin-bottom: 0;'>`;
                    } else {
                        alertasFetch += `<b><span class='mdi mdi-information-outline'></span> ${plural(totalEncontrado, 'Foi encontrado', 'Foram encontrados')} nesta rua:</b><br><ul style='margin-top: 5px; margin-bottom: 0;'>`;   
                    }

                    if (hasDificuldade) {
                        alertasFetch += `<li><b>${historicoRua.historicoDificuldadeAcesso}</b> ${plural(historicoRua.historicoDificuldadeAcesso, 'atendimento', 'atendimentos')} por <b>dificuldade de acesso</b>.</li>`;
                    }
                    if (hasAreaRural) {
                        alertasFetch += `<li><b>${historicoRua.historicoAreaRural}</b> ${plural(historicoRua.historicoAreaRural, 'atendimento', 'atendimentos')} por ser <b>área rural</b>.</li>`;
                    }
                    if (hasDistMaior) {
                        alertasFetch += `<li><b>${historicoRua.historicoDistMaior}</b> ${plural(historicoRua.historicoDistMaior, 'atendido', 'atendidos')} por distância maior que 1500m.</li>`;
                    }
                    if (hasDistMenor) {
                        alertasFetch += `<li><b>${historicoRua.historicoDistMenor}</b> ${plural(historicoRua.historicoDistMenor, 'indeferido', 'indeferidos')} por distância menor que 1500m.</li>`;
                    }
                    if (hasEscolaPorOpcao) {
                        alertasFetch += `<li><b>${historicoRua.historicoEscolaOpcao}</b> ${plural(historicoRua.historicoEscolaOpcao, 'indeferido', 'indeferidos')} por escola de opção.</li>`;
                    }
                    alertasFetch += "</ul>";
                } 
                
                alertasFetch += "</div>";
            } else if (totalEncontrado === 0) {
                alertasFetch = "";
                MsgDificuldadeAcesso = ""; 
            } else if(!hasDificuldade && !hasAreaRural) {
                alertasFetch += `<b><span class='mdi mdi-information-outline'></span> NINGUÉM é atendido por dificuldade de acesso nessa rua.</b>`;
                MsgDificuldadeAcesso = ""; 
            } else {
                alertasFetch = "";
                MsgDificuldadeAcesso = ""; 
            }
        }
    }
    
    // Substitui o Loading pelo conteúdo final gerado
    const loadingEl = document.getElementById('loading-historico-rua');
    if (loadingEl) {
        let htmlComplementar = `
            ${alertasFetch}
            ${MsgDificuldadeAcesso}`;
            
        let btnSimClass = "btn btn-success";
        let btnNaoClass = "btn btn-danger";
        if (destaqueSim) {
            btnSimClass = "btn btn-success destaque";
            btnNaoClass = "btn btn-danger dimmed";
        } else if (destaqueNao) {
            btnNaoClass = "btn btn-danger destaque";
            btnSimClass = "btn btn-success dimmed";
        } 

        if (!(hasDificuldade || hasAreaRural)) {
            htmlComplementar += `
                <p style="margin-top:10px;">O trajeto da residência até a escola possui alguma dificuldade de acesso excepcional?</p>
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
                </ul>`;
        } else {
            htmlComplementar += `<p style="margin-top:10px;">A informação acima procede? Você pode visualizar os atendimentos da rua no botão abaixo:</p>`;
        }

        htmlComplementar += `<div style="text-align:center; margin-bottom:15px;">
            <a href="${ctx.urlPesquisaRua}" target="_blank" class="btn btn-outline" style="text-decoration:none;">
                <span class="mdi mdi-map-search" style="font-size: 16px; margin-right: 4px;"></span> Ver atendimentos da rua
            </a>
        </div>

        <div class="action-group">
            <button id="btn-dif-sim" class="${btnSimClass}"><span class="mdi mdi-check" style="font-size: 16px; margin-right: 4px;"></span> Sim, há dificuldade</button>
            <button id="btn-dif-nao" class="${btnNaoClass}"><span class="mdi mdi-close" style="font-size: 16px; margin-right: 4px;"></span> Não</button>
        </div>`;
        
        loadingEl.outerHTML = htmlComplementar;
        
        vincularEventoUnico(document.getElementById('btn-dif-sim'), 'click', () => { salvarHistorico(); estado.dificuldadeAcesso = true; if (estado.escolaProximaUser === false) { renderizarPasso(); } else { estado.telaFinal = { titulo: "DEFERIR", mensagem: "Deferido devido a Dificuldade de Acesso comprovada na rota." }; renderizarPasso(); } });
        vincularEventoUnico(document.getElementById('btn-dif-nao'), 'click', () => { salvarHistorico(); estado.dificuldadeAcesso = false; estado.telaFinal = { titulo: "INDEFERIR", mensagem: "A distância não atinge 1500m e o caso não se enquadra nas exceções." }; renderizarPasso(); });
    }
    
    return;
} //FIM DA etapa DIFICULDADE DE ACESSO

        const excecaoGarantida = (estado.deficiencia === 'ALUNO' || estado.deficiencia === 'FAMILIA' || estado.dificuldadeAcesso === true);
        let msgExcecao = "";
        
        if (excecaoGarantida && estado.distancia < 1500) {
            msgExcecao = "Embora a distância seja inferior a 1500m, ";
        }else
        if (excecaoGarantida && estado.distancia >= 1500) {
            msgExcecao = "Além da distância atingir o requisito mínimo (1500m), ";
        }

        if (excecaoGarantida && estado.deficiencia === 'ALUNO') {
            msgExcecao = msgExcecao + "consta deficiência do aluno, o que garante o direito ao transporte escolar independentemente da distância.";
        }else
        if (excecaoGarantida && estado.deficiencia === 'FAMILIA') {
            msgExcecao = msgExcecao + "consta deficiência na família, o que garante o direito ao transporte escolar independentemente da distância.";
        }else 
        if (excecaoGarantida && estado.distancia < 1500 && estado.dificuldadeAcesso === true) {
            msgExcecao = msgExcecao + "foi confirmada dificuldade de acesso, o que garante o direito ao transporte escolar independentemente da distância.";
        }
        

        const temDeficiencia = (estado.deficiencia === 'ALUNO' || estado.deficiencia === 'FAMILIA');
                if ((temDeficiencia && estado.distancia < 1800) || (temDeficiencia && (estado.ehMaisProximaIntegral || estado.ehMaisProximaParcial)) || (temDeficiencia && estado.distancia < 3000) || (temDeficiencia && estado.isEspecial)) {
                
                    estado.isEncaminhamentoDispensado = true;
                }

//etapa encaminhamento
if (estado.escolaProximaUser === false && (estado.distancia >= 1500 || excecaoGarantida) && estado.ehEncaminhado === null) {

    if (estado.isEncaminhamentoDispensado) {
        estado.ehEncaminhado = false; 
        estado.telaFinal = { titulo: "DEFERIR", mensagem: msgExcecao };
        renderizarPasso();
        return;
    }

    // >>> CHAMADA DO MOTOR DE COMPARAÇÃO CRUZADA <<<
    const dadosMaisRecentes = encaminhamentoResolvido?.maisRecente;
    let objetoCompatibilidade = { compativel: false, schoolCompativel: false, enderecoCompativel: false };

    if (dadosMaisRecentes) {
        const contextoSeguro = (typeof ctx !== 'undefined') ? ctx : (window.dadosGeograficos || {});

        if (typeof verificarCompatibilidadeEncaminhamento === 'function') {
            objetoCompatibilidade = await verificarCompatibilidadeEncaminhamento(contextoSeguro, dadosMaisRecentes);
        }

        if (typeof montarHtmlEncaminhamento === 'function') {
            encaminhamentoResolvido.msgEncaminhamentoHtml = montarHtmlEncaminhamento(
                dadosMaisRecentes, 
                { 
                    escolaCompativel: objetoCompatibilidade.escolaCompativel, 
                    enderecoCompativel: objetoCompatibilidade.enderecoCompativel 
                }, 
                contextoSeguro, 
                estado
            );
        }

        if (objetoCompatibilidade && objetoCompatibilidade.compativel === true) {
            salvarHistorico();
            estado.ehEncaminhado = true; 
            estado.telaFinal = { 
                titulo: "DEFERIR", 
                textoDetalhes: `Encaminhado conforme arquivo ${dadosMaisRecentes.descricao || ''}`,
                mensagem: objetoCompatibilidade.motivo || 'Compatibilidade automática confirmada.'
            };
            renderizarPasso();
            return; 
        }
    } else {
        const contextoSeguro = (typeof ctx !== 'undefined') ? ctx : (window.dadosGeograficos || {});
        const estadoSeguro = (typeof estado !== 'undefined') ? estado : {};

        if (typeof montarHtmlEncaminhamento === 'function') {
            encaminhamentoResolvido.msgEncaminhamentoHtml = montarHtmlEncaminhamento(null, null, contextoSeguro, estadoSeguro);
        }
    }
    // >>> FIM DA COMPARAÇÃO AUTOMÁTICA <<<



    // Renderiza a interface padrão mesclando o HTML original gerado pelo BD com as informações de irmãos descobertas
    const msgEncaminhamentoHtml = encaminhamentoResolvido.msgEncaminhamentoHtml || '';
    conteudo.innerHTML = `
        ${msgEncaminhamentoHtml}
    `;
    
    vincularEventoUnico(document.getElementById('btn-enc-sim'), 'click', () => { 
        salvarHistorico(); 
        estado.ehEncaminhado = true; 
        estado.telaFinal = { titulo: "DEFERIR", mensagem: `Aluno encaminhado ou que atende aos critérios para deferimento.` }; 
        renderizarPasso(); 
    });
    
    vincularEventoUnico(document.getElementById('btn-enc-nao'), 'click', () => { 
        salvarHistorico(); 
        estado.ehEncaminhado = false; 
        estado.telaFinal = { titulo: "INDEFERIR", mensagem: "O aluno não está na escola mais próxima e NÃO possui encaminhamento justificado por falta de vaga." }; 
        renderizarPasso(); 
    });
    return;
}// etapa encaminhamento

    }

    window.abrindoModalAssistente = false;
    renderizarPasso(); 
};