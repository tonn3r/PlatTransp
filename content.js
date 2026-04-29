(function() {
    'use strict';

    // --- INÍCIO DO SISTEMA DE ATUALIZAÇÃO ---
    const VERSAO_ATUAL = "3.0"; // ATENÇÃO: Mude isso aqui, no manifest e no version.json sempre que lançar atualização
    const URL_VERSAO = "https://raw.githubusercontent.com/tonn3r/PlatTransp/main/version.json";

    async function verificarAtualizacao() {
        try {
            // O "?t=" no final evita que o navegador use cache antigo
            const response = await fetch(URL_VERSAO + "?t=" + new Date().getTime());
            const dados = await response.json();
            
            if (dados.version !== VERSAO_ATUAL) {
                if (!document.getElementById('alerta-atualizacao-addon')) {
                    const alerta = document.createElement('div');
                    alerta.id = 'alerta-atualizacao-addon';
                    alerta.style = "position:fixed; top:0; left:0; width:100%; background:#e74c3c; color:white; text-align:center; padding:12px; z-index:999999; font-family:verdana; font-size:13px; font-weight:bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3);";
                    alerta.innerHTML = `⚠️ NOVA VERSÃO DO ADDON DISPONÍVEL (${dados.version})! Sua versão atual é a ${VERSAO_ATUAL}. <br><a href="${dados.url}" style="color:#ffeb3b; text-decoration:underline; font-size:15px; display:inline-block; margin-top:5px;">📥 Clique aqui para baixar o ZIP atualizado</a> <span style="font-size:11px; font-weight:normal; margin-left:10px;">(Após baixar, extraia, substitua os arquivos antigos e clique em 'Atualizar' nas Extensões do Chrome)</span>`;
                    document.body.prepend(alerta);
                }
            }
        } catch (e) {
            console.log("Erro ao verificar atualização do Addon PlatTransp:", e);
        }
    }
    
    // Chama a verificação logo que entra na página
    verificarAtualizacao();
    // --- FIM DO SISTEMA DE ATUALIZAÇÃO ---
    
    const urlAtual = window.location.href;

    // ========================================================================
    // BASE DE DADOS LOCAL DE ESCOLAS (Substitua pelos dados reais das 300 escolas)
    // ========================================================================
    const escolasDB = [
        { nome: "[TESTE] Escola A (Bem perto)", lat: -23.73800, lon: -46.58600, series_atendidas: ["G3", "G4"] },
        { nome: "[TESTE] Escola B (Média distância)", lat: -23.74500, lon: -46.59000, series_atendidas: ["1º ANO"] },
        { nome: "[TESTE] Escola C (Longe)", lat: -23.76000, lon: -46.60000, series_atendidas: ["2º ANO"] },
        { nome: "[TESTE] Escola D (Muito Longe)", lat: -23.80000, lon: -46.65000, series_atendidas: ["BERCARIO"] }
    ];

    // ========================================================================
    // FUNÇÃO MATEMÁTICA: FÓRMULA DE HAVERSINE (Distância em linha reta)
    // ========================================================================
    function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
        const R = 6371; // Raio da Terra em km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distanciaMetros = (R * c) * 1000;
        return Math.round(distanciaMetros); 
    }

    // ========================================================================
    // ROTEADOR
    // ========================================================================
    if (urlAtual.includes('solicitacoes_transporte_realizadas') || document.getElementById('id_unidade_selecionada')) {
        iniciarPaginaPesquisa();
    } else if (urlAtual.includes('ficha_transporte')) {
        iniciarPaginaFicha();
	adicionarBotaoAssistente();
    }

    // ========================================================================
    // CÓDIGO DA PÁGINA: FICHA DE TRANSPORTE
    // ========================================================================
    function iniciarPaginaFicha() {
        
        // Utilitário de armazenamento
        const storageHelper = {
            save: function(key, data, callback) {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    let obj = {}; obj[key] = data;
                    chrome.storage.local.set(obj, callback);
                } else {
                    localStorage.setItem(key, JSON.stringify(data));
                    if(callback) callback();
                }
            },
            get: function(key, callback) {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    chrome.storage.local.get([key], function(result) {
                        callback(result[key]);
                    });
                } else {
                    let data = localStorage.getItem(key);
                    callback(data ? JSON.parse(data) : null);
                }
            }
        };

        const verificarFichaPronta = setInterval(() => {
            const legendEnderecos = Array.from(document.querySelectorAll('legend')).find(el => el.innerText.trim() === 'Endereço');
            const legendSituacao = Array.from(document.querySelectorAll('legend')).find(el => el.innerText.trim() === 'Situação');

            if (legendEnderecos && legendSituacao && !document.getElementById('painel-geoprocessamento')) {
                clearInterval(verificarFichaPronta);
                
                const ruaLimpa = aplicarLinkPesquisaEndereco(legendEnderecos);
                
                // Renderiza o painel visual com distâncias
                storageHelper.get('base_ruas_transporte', (db) => {
                    if (db) {
                        renderizarPainelDistancias(legendEnderecos, db);
                    }
                });

                construirUiSincronizacao(legendSituacao);
                
                if (ruaLimpa) {
                    const spanStatus = document.querySelector('#status_atendimento .texto_dados');
                    if (spanStatus) {
                        const statusAtual = spanStatus.innerText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                        if (statusAtual.includes("ANALISE")) {
                            aplicarSugestaoAtendimento(ruaLimpa);
                        }
                    }
                }
            }
        }, 200);

        function renderizarPainelDistancias(elementoAncora, db) {
            const cep = document.getElementById('cep')?.value || "";
            const rua = document.getElementById('endereco')?.value || "";
            const escolaMatriculada = document.querySelector('input[name="nome_unidade"]')?.value || "Não identificada";
            const idEscolaMatriculada = document.querySelector('input[name="id_unidade"]')?.value || "";
            
            const chaveCep = `${cep.replace(/\D/g, '')}-${idEscolaMatriculada}`;
            const chaveRua = `${rua.toUpperCase().trim()}-${idEscolaMatriculada}`;
            const infoRua = db[chaveCep] || db[chaveRua];

            const painel = document.createElement('div');
            painel.id = 'painel-geoprocessamento';
            painel.style = 'margin-top: 10px; padding: 10px; border: 1px solid #007bff; background: #f0f7ff; border-radius: 5px; font-family: verdana; font-size: 11px;';
            
            let htmlContent = `<strong style="color: #007bff;">📍 ANÁLISE DE PROXIMIDADE (Base de Ruas)</strong><br><br>`;

            if (!infoRua) {
                htmlContent += `<span style="color: red;">⚠️ Rua ou CEP não encontrados na base de dados para a escola selecionada. Importe o CSV atualizado.</span>`;
            } else {
                
                // LOG DE DIAGNÓSTICO: Mostra no console o que o Addon encontrou no CSV
                console.log("📍 [GEO] Dados encontrados para esta rua no CSV:", infoRua);

                let distEscolaAtual = "N/A";
                if (infoRua.distanciamedia || infoRua.distancia) {
                    distEscolaAtual = (infoRua.distanciamedia || infoRua.distancia).replace(/[^0-9]/g, '') + "m";
                }
                
                htmlContent += `
                    <table width="100%" style="border-collapse: collapse;">
                        <tr style="border-bottom: 1px solid #ccc;">
                            <td style="padding: 4px;"><b>Escola Analisada:</b></td>
                            <td style="padding: 4px;">${escolaMatriculada}</td>
                            <td style="padding: 4px; color: blue;"><b>Distância: ${distEscolaAtual}</b></td>
                        </tr>
                    </table>
                `;

                if (infoRua.lat && infoRua.lon && escolasDB.length > 0) {
                    htmlContent += `<div style="margin-top: 8px;"><b>Escolas mais próximas deste endereço (Linha Reta):</b><br><ul style="margin: 5px 0; padding-left: 20px;">`;
                    
                    const escolasCalculadas = escolasDB.map(esc => {
                        return {
                            nome: esc.nome,
                            distancia: calcularDistanciaHaversine(infoRua.lat, infoRua.lon, esc.lat, esc.lon)
                        };
                    }).sort((a, b) => a.distancia - b.distancia);
                    
                    const top3 = escolasCalculadas.slice(0, 3);
                    top3.forEach((esc, index) => {
                        htmlContent += `<li>${index + 1}ª - ${esc.nome} (${esc.distancia}m)</li>`;
                    });
                    htmlContent += `</ul></div>`;
                } else {
                    htmlContent += `<div style="margin-top: 8px; color: #e67e22;"><b>⚠️ Escolas próximas não calculadas:</b> As coordenadas (Latitude e Longitude) desta rua não foram encontradas na planilha CSV importada.</div>`;
                }

                htmlContent += `<p style="margin-top: 5px; font-size: 10px; color: #555;">* Critério: Alunos a menos de 1.5km da escola não possuem direito a transporte gratuito (Res. 96/2025).</p>`;
            }

            //painel.innerHTML = htmlContent;
            //elementoAncora.parentElement.appendChild(painel); //removido temporariamente.
        }
        
        function aplicarLinkPesquisaEndereco(legendElement) {
            const container = legendElement.closest('.set_inner');
            if (!container) return null;
            const elEndereco = container.querySelector('span.texto_dados b u');
            if (!elEndereco) return null;

            const textoOriginal = elEndereco.innerText;
            if (!textoOriginal) return null;

            let ruaLimpa = textoOriginal.split(',')[0].trim();
            const prefixos = /^(RUA|R\.|AVENIDA|AV\.|AV|TRAVESSA|TRV\.|VIELA|PRA[ÇC]A|ESTRADA|ALAMEDA|RODOVIA|LADEIRA|BECO|MARGINAL)\s+/i;
            ruaLimpa = ruaLimpa.replace(prefixos, '').trim(); 

            elEndereco.style.cursor = 'pointer';
            elEndereco.style.color = '#2980b9'; 
            elEndereco.title = `Pesquisar outros alunos na rua: ${ruaLimpa}`;
            
            elEndereco.addEventListener('click', function() {
                const baseUrl = window.location.href.split('ficha_transporte.php')[0];
                const urlPesquisa = `${baseUrl}solicitacoes_transporte_realizadas.php?endereco=${encodeURIComponent(ruaLimpa)}`;
                window.open(urlPesquisa, '_blank');
            });
            
            return ruaLimpa;
        }

        function construirUiSincronizacao(legendSituacao) {
            if(document.getElementById('btn-sincronizar-ruas')) return;
            
            const btnSync = document.createElement('button');
            btnSync.id = 'btn-sincronizar-ruas';
            btnSync.type = 'button';
            btnSync.innerHTML = '📂 Importar CSV Local (Ruas)';
            btnSync.style = 'font-size: 10px; margin-left: 15px; cursor: pointer; border: 1px solid #ccc; background: #fff; padding: 2px 5px; border-radius: 3px; font-weight: normal; color: #333;';
            
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.csv';
            fileInput.style.display = 'none';
            
            fileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;
                
                btnSync.innerHTML = '⏳ Lendo arquivo...';
                
                const reader = new FileReader();
                reader.onload = function(event) {
                    btnSync.innerHTML = '⏳ Construindo Mapa de Ruas...';
                    const csvText = event.target.result;
                    
                    setTimeout(() => {
                        const db = parserCsvBase(csvText);
                        const numRegistros = Object.keys(db).length;
                        
                        storageHelper.save('base_ruas_transporte', db, () => {
                            alert(`✅ Importação concluída com sucesso!\nForam processados ${numRegistros} registros na extensão.`);
                            window.location.reload();
                        });
                    }, 100);
                };
                
                reader.onerror = function() {
                    alert('❌ Falha ao ler o arquivo selecionado.');
                    btnSync.innerHTML = '📂 Importar CSV Local (Ruas)';
                };
                
                reader.readAsText(file);
            });
            
            btnSync.addEventListener('click', () => {
                fileInput.click();
            });
            
            //legendSituacao.appendChild(btnSync);
            //legendSituacao.appendChild(fileInput);
        }

        function parserCsvBase(csv) {
            const lines = csv.split(/\r?\n/);
            const result = {};
            if(lines.length < 2) return result;
            
            // Auto-detecta o delimitador do CSV Brasileiro (;) ou Internacional (,)
            const delimiter = lines[0].includes(';') ? ';' : ',';
            const regex = new RegExp(`${delimiter}(?=(?:(?:[^"]*"){2})*[^"]*$)`);
            
            const headers = lines[0].split(regex).map(h => h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ''));
            const prefixos = /^(RUA|R\.|AVENIDA|AV\.|AV|TRAVESSA|TRV\.|VIELA|PRA[ÇC]A|ESTRADA|ALAMEDA|RODOVIA|LADEIRA|BECO|MARGINAL)\s+/i;
            
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                
                const row = lines[i].split(regex);
                let obj = {};
                let rua = "";
                let cep = "";
                let idEscola = "";
                
                for (let j = 0; j < headers.length; j++) {
                    if(!row[j]) continue;
                    let h = headers[j];
                    let val = row[j].replace(/^"|"$/g, '').trim();
                    
                    if(h.includes('cep')) cep = val.replace(/\D/g, '');
                    if(h === 'idescola' || h === 'idunidade' || h === 'escola' || h === 'unidade' || h === 'idescola') idEscola = val;
                    if(h === 'rua' || h === 'endereco') rua = val.toUpperCase().replace(prefixos, '').trim(); 
                    
                    // Tratamento para Latitude e Longitude garantindo que vire Número
                    if(h === 'latitude' || h === 'lat') {
                         let num = parseFloat(val.replace(',', '.'));
                         if(!isNaN(num)) obj.lat = num;
                    }
                    if(h === 'longitude' || h === 'lon') {
                         let num = parseFloat(val.replace(',', '.'));
                         if(!isNaN(num)) obj.lon = num;
                    }
                    
                    obj[h] = val; 
                }
                
                if(cep && idEscola) result[`${cep}-${idEscola}`] = obj;
                if(rua && idEscola) result[`${rua}-${idEscola}`] = obj;
            }
            return result;
        }

        function aplicarSugestaoAtendimento(ruaPesquisa) {
            const idUnidade = document.querySelector('input[name="id_unidade"]')?.value?.trim();
            const inputCep = document.querySelector('input[name="cep"]')?.value;
            const cepLimpo = inputCep ? inputCep.replace(/\D/g, '') : '';
            
            if(!idUnidade) return;

            storageHelper.get('base_ruas_transporte', (db) => {
                if(!db) return;
                
                const keyCep = `${cepLimpo}-${idUnidade}`;
                const keyRua = `${ruaPesquisa.toUpperCase()}-${idUnidade}`;
                
                const sugestao = db[keyCep] || db[keyRua];
                
                if(sugestao) {
                    const btnDeferir = document.querySelector('td[onclick*="modal_Deferir"]');
                    const btnIndeferir = document.querySelector('td[onclick*="modal_Indeferir"]');
                    
                    let acaoTexto = (sugestao.analise || sugestao.acao || sugestao.status || sugestao.resultado || '').toLowerCase();
                    
                    if(acaoTexto.includes('indeferir') || acaoTexto.includes('negado') || acaoTexto.includes('nao')) {
                        if(btnIndeferir) {
                            btnIndeferir.style.backgroundColor = '#e74c3c';
                            btnIndeferir.style.color = '#fff';
                            btnIndeferir.style.fontWeight = 'bold';
                            btnIndeferir.innerHTML = '⛔ Indeferir (Sugerido)';
                        }
                        preencherFormulario('#form_Indeferir', sugestao);
                        
                    } else if (acaoTexto.includes('deferir') || acaoTexto.includes('aprovado') || acaoTexto.includes('sim')) {
                        if(btnDeferir) {
                            btnDeferir.style.backgroundColor = '#27ae60';
                            btnDeferir.style.color = '#fff';
                            btnDeferir.style.fontWeight = 'bold';
                            btnDeferir.innerHTML = '⭐ Deferir (Sugerido)';
                        }
                        preencherFormulario('#form_Deferir', sugestao);
                    }
                }
            });
        }

        function preencherFormulario(formSelector, dados) {
            const form = document.querySelector(formSelector);
            if(!form) return;

            if(dados.motivo) {
                const selectMotivo = form.querySelector('select[name="status_motivo"]');
                if(selectMotivo) {
                    const dadoMotivoLimpo = dados.motivo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                    Array.from(selectMotivo.options).forEach(opt => {
                        const optText = opt.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                        if(optText.includes(dadoMotivoLimpo) || dadoMotivoLimpo.includes(optText)) {
                            opt.selected = true;
                        }
                    });
                }
            }

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
                
                if(dados.lat && dados.lon && escolasDB.length > 0) {
                    textoArr.push(`\n--- ESCOLAS MAIS PRÓXIMAS (Em linha reta) ---`);
                    const escolasCalculadas = escolasDB.map(esc => {
                        return {
                            nome: esc.nome,
                            distancia: calcularDistanciaHaversine(dados.lat, dados.lon, esc.lat, esc.lon)
                        };
                    }).sort((a, b) => a.distancia - b.distancia);
                    
                    const top3 = escolasCalculadas.slice(0, 3);
                    top3.forEach((esc, index) => {
                        textoArr.push(`${index + 1}º ${esc.nome} - Distância: ${esc.distancia} metros`);
                    });
                }

                if(textoArr.length > 0) textarea.value = textoArr.join('\n');
            }
        }
    }


    // ========================================================================
    // CÓDIGO DA PÁGINA: PESQUISA (solicitacoes_transporte_realizadas.php)
    // ========================================================================
    function iniciarPaginaPesquisa() {
        let paginaAtual = 1;

        function removerAcentosEspeciais(str) {
            if (!str) return "";
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "");
        }

        function dispararEventoChange(elemento) {
            if (!elemento) return;
            elemento.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function temFiltroAtivo() {
            if (typeof $ === 'undefined') return false;
            const unidade = $('#id_unidade_selecionada').val();
            const status = $('#status_selecionado').val();
            const motivo = $('#motivo_selecionado').val();
            const nome = removerAcentosEspeciais($('#nome_aluno_pesquisado').val() || "");
            const endereco = removerAcentosEspeciais($('#endereco').val() || "");

            return (unidade !== "" && unidade !== "0") || 
                   (status !== "" && status !== "0") || 
                   (motivo !== "" && motivo !== "0") || 
                   (nome.trim().length > 0) || 
                   (endereco.trim().length > 0);
        }

        function atualizarVisibilidadeBotaoReset() {
            const btn = document.getElementById('btn-limpar-filtros');
            if (btn) {
                btn.style.display = temFiltroAtivo() ? 'inline-block' : 'none';
            }
        }

        function aplicarPatches() {
            const win = window;

            win.lista_unidade_selecionada = function(reg, pag) {
                if (typeof $ === 'undefined') return;
                let ord = $('#ordenar_por').val();
                if (ord === "0") ord = "1"; 

                $("#mostra_alunos").html("<img src='images/carregando.gif' width='60' height='28'>");
                $.post("lista_alunos_transporte.php", {
                    ano: $('#ano_selecionado').val(),
                    id_unidade: $('#id_unidade_selecionada').val(),
                    motivo_selecionado: $('#motivo_selecionado').val(),
                    status_selecionado: $('#status_selecionado').val(),
                    funcao_utilizada: 2,
                    registro_inicial: reg,
                    pagina: pag,
                    ordenar_por: ord
                }).done(data => { $("#mostra_alunos").html(data); });
            };

            win.lista_ano_selecionado = function(reg, pag) {
                const select_ano = document.getElementById('ano_selecionado');
                if (!select_ano || typeof $ === 'undefined') return;
                
                $(select_ano).off('change').on('change', function() {
                    atualizarVisibilidadeBotaoReset();

                    const unidade = $('#id_unidade_selecionada').val();
                    const status = $('#status_selecionado').val();
                    const motivo = $('#motivo_selecionado').val();
                    const nome = removerAcentosEspeciais($('#nome_aluno_pesquisado').val() || "");
                    const endereco = removerAcentosEspeciais($('#endereco').val() || "");

                    if ((unidade === "" || unidade === "0") && 
                        (status === "" || status === "0") && 
                        (motivo === "" || motivo === "0") && 
                        (nome.trim().length === 0) && 
                        (endereco.trim().length === 0)) {
                        return; 
                    }

                    $("#mostra_alunos").html("<img src='images/carregando.gif' width='60' height='28'>");
                    let ord = $('#ordenar_por').val();
                    if (ord === "0") ord = "1";

                    $.post("lista_alunos_transporte.php", {
                        ano: $(this).val(),
                        id_unidade: unidade,
                        motivo_selecionado: motivo,
                        status_selecionado: status,
                        nome_aluno_pesquisado: nome,
                        endereco: endereco,
                        funcao_utilizada: 1,
                        registro_inicial: reg,
                        pagina: pag,
                        ordenar_por: ord
                    }).done(data => { $("#mostra_alunos").html(data); });
                });
            };

            win.lista_ordenado_por = function(reg, pag) {
                if (typeof $ === 'undefined') return;
                $('#ordenar_por').off('change').on('change', function(){
                    atualizarVisibilidadeBotaoReset();

                    const unidade = $('#id_unidade_selecionada').val();
                    const status = $('#status_selecionado').val();
                    const motivo = $('#motivo_selecionado').val();
                    const nome = removerAcentosEspeciais($('#nome_aluno_pesquisado').val() || "");
                    const endereco = removerAcentosEspeciais($('#endereco').val() || "");

                    if ((unidade === "" || unidade === "0") && 
                        (status === "" || status === "0") && 
                        (motivo === "" || motivo === "0") && 
                        (nome.trim().length === 0) && 
                        (endereco.trim().length === 0)) {
                        return; 
                    }

                    $("#mostra_alunos").html("<img src='images/carregando.gif' width='60' height='28'>");
                    $.post("lista_alunos_transporte.php", {
                        ano: $('#ano_selecionado').val(),
                        id_unidade: unidade,
                        motivo_selecionado: motivo,
                        status_selecionado: status,
                        nome_aluno_pesquisado: nome,
                        endereco: endereco,
                        funcao_utilizada: 1,
                        registro_inicial: reg,
                        pagina: pag,
                        ordenar_por: $(this).val()
                    }).done(data => { $("#mostra_alunos").html(data); });
                });
            };

            const inputNome = document.getElementById('nome_aluno_pesquisado');
            if (inputNome) {
                inputNome.removeAttribute('onkeypress');
                inputNome.addEventListener('focus', function() { this.select(); });
                inputNome.addEventListener('input', atualizarVisibilidadeBotaoReset);
                inputNome.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        paginaAtual = 1;
                        win.lista_alunos_por_nome(0, 1);
                    }
                });
            }

            win.lista_alunos_por_nome = function(reg, pag) {
                if (typeof $ === 'undefined') return;
                let nome = removerAcentosEspeciais($('#nome_aluno_pesquisado').val() || "");
                let ord = $('#ordenar_por').val();
                if (ord === "0") ord = "1";
                nome = nome.replace(/\s+/g, '%');
                if(nome.length > 2) {
                    if(nome.length > 3) { nome = '%' + nome;}
                    $("#mostra_alunos").html("<img src='images/carregando.gif' width='60' height='28'>");
                    $.post("lista_alunos_transporte.php", {
                        ano: $('#ano_selecionado').val(),
                        id_unidade: $('#id_unidade_selecionada').val(),
                        motivo_selecionado: $('#motivo_selecionado').val(),
                        status_selecionado: $('#status_selecionado').val(),
                        funcao_utilizada: 5,
                        registro_inicial: reg,
                        pagina: pag,
                        nome_aluno_pesquisado: nome,
                        ordenar_por: ord
                    }).done(data => { $("#mostra_alunos").html(data); });
                }
            };

            const inputEndereco = document.getElementById('endereco');
            if (inputEndereco) {
                inputEndereco.removeAttribute('onkeypress');
                inputEndereco.addEventListener('focus', function() { this.select(); });
                inputEndereco.addEventListener('input', atualizarVisibilidadeBotaoReset);
                inputEndereco.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        paginaAtual = 1;
                        win.lista_alunos_por_endereco(0, 1);
                    }
                });
            }

            win.lista_alunos_por_endereco = function(reg, pag) {
                if (typeof $ === 'undefined') return;
                let endereco = removerAcentosEspeciais($('#endereco').val() || "");
                let ord = $('#ordenar_por').val();
                if (ord === "0") ord = "2";
                if(endereco.length > 0) {
                    endereco = endereco.replace(/\s+/g, '%');
                    $("#mostra_alunos").html("<img src='images/carregando.gif' width='60' height='28'>");
                    $.post("lista_alunos_transporte.php", {
                        ano: $('#ano_selecionado').val(),
                        id_unidade: $('#id_unidade_selecionada').val(),
                        funcao_utilizada: 6,
                        registro_inicial: reg,
                        pagina: pag,
                        endereco: endereco,
                        ordenar_por: ord
                    }).done(data => { $("#mostra_alunos").html(data); });
                }
            };
        }

        function aplicarMelhorias() {
            const selectUnidade = document.getElementById('id_unidade_selecionada');
            if (!selectUnidade || document.getElementById('unidade-autocomplete')) return;

            aplicarPatches();

            if (typeof window.lista_ano_selecionado === "function") window.lista_ano_selecionado(0, 1);
            if (typeof window.lista_ordenado_por === "function") window.lista_ordenado_por(0, 1);

            const selectAno = document.getElementById('ano_selecionado');
            if (selectAno && (selectAno.value === "0" || selectAno.value === "")) {
                const anoAtual = new Date().getFullYear().toString();
                Array.from(selectAno.options).forEach(opt => { 
                    if (opt.value === anoAtual) opt.selected = true; 
                });
            }

            const mapaOpcoes = new Map();
            const inputBusca = document.createElement('input');
            inputBusca.id = 'unidade-autocomplete';
            inputBusca.setAttribute('list', 'lista-unidades-datalist');
            inputBusca.placeholder = 'Digite a unidade...';
            inputBusca.autocomplete = 'off';
            inputBusca.style = "box-sizing: border-box; background:#fff; color:#000; font-size:12px; font-weight:bold; border:1px solid #C0C0C0; border-radius:3px; height:30px; padding:0 5px; margin-right:5px; width:100%; min-width:100px; max-width:300px;";

            const datalist = document.createElement('datalist');
            datalist.id = 'lista-unidades-datalist';

            Array.from(selectUnidade.options).forEach(opt => {
                if (opt.value !== "" && opt.text.trim() !== "") {
                    mapaOpcoes.set(opt.text, opt.value);
                    const o = document.createElement('option');
                    o.value = opt.text;
                    datalist.appendChild(o);
                }
            });

            selectUnidade.parentNode.insertBefore(inputBusca, selectUnidade);
            selectUnidade.parentNode.insertBefore(datalist, selectUnidade);
            selectUnidade.style.display = 'none';

            const selectOrdenar = document.getElementById('ordenar_por');
            if (selectOrdenar && typeof $ !== 'undefined') {
                const trPai = selectOrdenar.closest('td').parentNode;
                const tdBotao = document.createElement('td');
                tdBotao.style.verticalAlign = "bottom";
                tdBotao.style.paddingLeft = "10px";
                const btnReset = document.createElement('button');
                btnReset.id = 'btn-limpar-filtros';
                btnReset.innerHTML = '✕ Limpar Filtros';
                btnReset.type = 'button';
                btnReset.style = "background:#fff; color:#e74c3c; border:1px solid #e74c3c; border-radius:4px; height:30px; padding:0 12px; cursor:pointer; font-weight:bold; font-size:11px; vertical-align: middle; display:none;";
                btnReset.onclick = () => {
                    $('#id_unidade_selecionada').val('0');
                    $('#unidade-autocomplete').val('');
                    $('#status_selecionado').val('0');
                    $('#motivo_selecionado').val('0');
                    $('#nome_aluno_pesquisado').val('');
                    $('#endereco').val('');
                    $('#mostra_alunos').html('');
                    paginaAtual = 1;
                    atualizarVisibilidadeBotaoReset();
                    carregarTabelaHistorico();
                };
                tdBotao.appendChild(btnReset);
                trPai.appendChild(tdBotao);
            }

            const processarSelecao = () => {
                let val = inputBusca.value.trim();
                let id = mapaOpcoes.get(val);
                if (!id && val !== "") {
                    const primeiraOpcao = Array.from(mapaOpcoes.keys()).find(k => k.toLowerCase().includes(val.toLowerCase()));
                    if (primeiraOpcao) {
                        val = primeiraOpcao;
                        inputBusca.value = val;
                        id = mapaOpcoes.get(val);
                    }
                }
                if(id || val === "") {
                    selectUnidade.value = id || "0";
                    paginaAtual = 1;
                    atualizarVisibilidadeBotaoReset();
                    window.lista_unidade_selecionada(0, 1);
                }
            };

            inputBusca.addEventListener('input', () => { 
                atualizarVisibilidadeBotaoReset();
                if (mapaOpcoes.has(inputBusca.value)) processarSelecao(); 
            });
            inputBusca.addEventListener('keydown', (e) => { if (e.key === 'Enter') processarSelecao(); });

            const idsParaEstilizar = ['ano_selecionado', 'motivo_selecionado', 'status_selecionado', 'unidade-autocomplete', 'nome_aluno_pesquisado', 'endereco', 'ordenar_por'];
            
            idsParaEstilizar.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.width = '100%';
                    el.style.boxSizing = 'border-box';
                    el.style.minWidth = '70px';
                    el.style.maxWidth = '100%'; 
                    
                    const td = el.closest('td');
                    if (td) {
                        td.style.width = 'auto';
                        td.style.padding = '2px 4px';
                    }
                }
            });

            const elAno = document.getElementById('ano_selecionado');
            if (elAno) {
                const trFiltros = elAno.closest('tr');
                if (trFiltros && !document.getElementById('td-spacer-filtros')) {
                    const tdSpacer = document.createElement('td');
                    tdSpacer.id = 'td-spacer-filtros';
                    tdSpacer.style.width = '1%'; 
                    trFiltros.appendChild(tdSpacer);
                }
            }
        }

        function dispararPesquisaPaginada(direcao) {
            if (typeof $ === 'undefined') return;
            if (direcao === 'next') paginaAtual++;
            else if (direcao === 'prev' && paginaAtual > 1) paginaAtual--;
            const reg = (paginaAtual - 1) * 100;
            let ord = $('#ordenar_por').val();
            
            const nomePesq = removerAcentosEspeciais($('#nome_aluno_pesquisado').val() || "");
            const endPesq = removerAcentosEspeciais($('#endereco').val() || "");
            
            if (ord === "0") {
                if (nomePesq.length > 2) ord = "1";
                else if (endPesq.length > 0) ord = "2";
                else if ($('#id_unidade_selecionada').val() !== "0") ord = "1";
            }
            const dados = {
                ano: $('#ano_selecionado').val(),
                id_unidade: $('#id_unidade_selecionada').val(),
                motivo_selecionado: $('#motivo_selecionado').val(),
                status_selecionado: $('#status_selecionado').val(),
                ordenar_por: ord,
                nome_aluno_pesquisado: nomePesq,
                endereco: endPesq,
                registro_inicial: reg,
                pagina: paginaAtual
            };
            if (nomePesq.length > 2) dados.funcao_utilizada = 5;
            else if (endPesq.length > 0) dados.funcao_utilizada = 6;
            else if (dados.id_unidade !== "0") dados.funcao_utilizada = 2;
            else dados.funcao_utilizada = 4;
            $("#mostra_alunos").html("<img src='images/carregando.gif' width='60' height='28'> Carregando página " + paginaAtual + "...");
            $.post("lista_alunos_transporte.php", dados).done(data => {
                $("#mostra_alunos").html(data);
                window.scrollTo(0, 0);
            });
        }

        function atualizarBarraPaginacao() {
            const container = document.getElementById('mostra_alunos');
            if (!container) return;
            const numLinhas = container.querySelectorAll('tr').length;
            let barra = document.getElementById('barra-paginacao-flutuante');
            if (numLinhas >= 101 || paginaAtual > 1) {
                if (!barra) {
                    barra = document.createElement('div');
                    barra.id = 'barra-paginacao-flutuante';
                    barra.style = "position:fixed; bottom:20px; right:20px; background:#2c3e50; color:white; padding:10px 20px; border-radius:50px; box-shadow:0 4px 15px rgba(0,0,0,0.3); z-index:9999; font-family:verdana; font-size:12px; display:flex; align-items:center; gap:15px;";
                    document.body.appendChild(barra);
                }
                barra.innerHTML = `
                    ${paginaAtual > 1 ? '<button id="btn-pag-prev" style="cursor:pointer; background:none; border:1px solid white; color:white; border-radius:20px; padding:5px 15px;">« Anterior</button>' : ''}
                    <span>Página <strong>${paginaAtual}</strong></span>
                    ${numLinhas >= 101 ? '<button id="btn-pag-next" style="cursor:pointer; background:#ecf0f1; border:none; color:#2c3e50; border-radius:20px; padding:5px 15px; font-weight:bold;">Próxima »</button>' : ''}
                `;
                const bPrev = document.getElementById('btn-pag-prev');
                const bNext = document.getElementById('btn-pag-next');
                if (bPrev) bPrev.onclick = () => dispararPesquisaPaginada('prev');
                if (bNext) bNext.onclick = () => dispararPesquisaPaginada('next');
            } else if (barra) { barra.remove(); }
        }

        function carregarTabelaHistorico() {
            const divPrincipal = document.getElementById('mostra_alunos');
            if (!divPrincipal || divPrincipal.innerHTML.replace(/<br\s*\/?>/gi, '').trim() !== "") return;
            
            const historico = JSON.parse(localStorage.getItem('historico_alunos_transporte') || "[]");
            if (historico.length === 0) return;
            
            let html = '<div style="background:#34495e; color:white; padding:10px; font-family:verdana; font-size:11px; border-radius:5px 5px 0 0; margin-top:10px;"><strong>🕒 ÚLTIMOS ACESSADOS</strong></div>';
            html += '<table cellspacing="1" cellpadding="1" border="0" style="width:100%; background: white; border:1px solid #ccc;"><thead><tr style="background:#eee; font-family:verdana; font-size:10px; font-weight:bold;"><td width="1%"></td><td width="2%" align="center">ID</td><td width="1%" align="center">Ano</td><td width="1%" align="center">Empresa</td><td width="1%" align="center">Linha</td><td width="10%" align="center">Unidade</td><td width="1%" align="center">Período</td><td width="3%" align="center">RA</td><td width="15%" align="left">Aluno(a)</td><td width="5%" align="center">Nasc.</td><td width="20%" align="left">Endereço</td><td width="10%" align="center">Detalhes</td><td width="10%" align="center">Status</td><td width="1%"></td><td width="1%"></td><td width="1%">Recl.</td><td width="1%">Abrir</td><td width="1%">V2</td></tr></thead><tbody id="corpo-historico">';
            historico.forEach(item => {
                if (!item.conteudoHtml.includes("Área de Usuários")) {
                    html += `<tr style="border-bottom:1px solid #eee;">${item.conteudoHtml}</tr>`;
                }
            });
            html += '</tbody></table>';
            divPrincipal.innerHTML = html;
            vincularEventosHistorico();
        }

        function vincularEventosHistorico() {
            document.querySelectorAll('.botao').forEach(b => {
                if (b.dataset.eventoHistoricoVinculado) return; 
                b.dataset.eventoHistoricoVinculado = "true";

                b.addEventListener('click', function() {
                    const textoBotao = this.innerText.toLowerCase();
                    if (textoBotao.includes("abrir") || textoBotao.includes("reclama")) {
                        const tr = this.closest('tr');
                        const id = (tr.cells[1] ? tr.cells[1].innerText.trim() : null) || (tr.querySelector('strong')?.innerText.trim());
                        
                        if (id) {
                            let hist = JSON.parse(localStorage.getItem('historico_alunos_transporte') || "[]");
                            hist = hist.filter(i => i.id !== id);
                            
                            const cloneTr = tr.cloneNode(true);
                            const colunas = cloneTr.querySelectorAll('td');
                            if (colunas.length >= 13) {
                                colunas[0].innerHTML = '';  
                                colunas[12].innerHTML = ''; 
                            }

                            hist.unshift({ id: id, conteudoHtml: cloneTr.innerHTML });
                            localStorage.setItem('historico_alunos_transporte', JSON.stringify(hist.slice(0, 100)));
                        }
                    }
                });
            });
        }

        function processarParametrosURL() {
            const params = new URLSearchParams(window.location.search);
            let realizarBuscaAutomatica = false;
            
            const camposDeFiltro = [
                'ano_selecionado', 'id_unidade_selecionada', 'motivo_selecionado', 
                'status_selecionado', 'ordenar_por', 'nome_aluno_pesquisado', 'endereco'
            ];

            camposDeFiltro.forEach(id_campo => {
                if (params.has(id_campo)) {
                    const elemento = document.getElementById(id_campo);
                    if (elemento) {
                        elemento.value = params.get(id_campo);
                        realizarBuscaAutomatica = true;

                        if (id_campo === 'id_unidade_selecionada') {
                            const inputAutocomplete = document.getElementById('unidade-autocomplete');
                            if (inputAutocomplete) {
                                const opcao = Array.from(elemento.options).find(opt => opt.value === params.get(id_campo));
                                if (opcao) inputAutocomplete.value = opcao.text;
                            }
                        }
                    }
                }
            });

            if (realizarBuscaAutomatica) {
                atualizarVisibilidadeBotaoReset();
                
                if (params.has('endereco') && params.get('endereco').trim() !== "") {
                    if (typeof window.lista_alunos_por_endereco === "function") window.lista_alunos_por_endereco(0, 1);
                } else if (params.has('nome_aluno_pesquisado') && params.get('nome_aluno_pesquisado').trim() !== "") {
                    if (typeof window.lista_alunos_por_nome === "function") window.lista_alunos_por_nome(0, 1);
                } else {
                    if (typeof window.lista_unidade_selecionada === "function") window.lista_unidade_selecionada(0, 1);
                }
            }
        }

        const observer = new MutationObserver(() => {
            const container = document.getElementById('mostra_alunos');
            if (container && container.innerHTML.trim() !== "") {
                if (!document.getElementById('btn-copiar-tabela')) {
                    container.insertAdjacentHTML('beforeend', '<br><br><button id="btn-copiar-tabela" style="background:#fff; color:#333; border:1px solid #ccc; border-radius:3px; padding:4px 8px; font-size:11px; cursor:pointer; font-weight:bold; margin-top:5px;">📋 Copiar Tabela</button><br><br>');
                    
                    document.getElementById('btn-copiar-tabela').addEventListener('click', function() {
                        const tabelas = container.querySelectorAll('table');
                        if (tabelas.length === 0) return;
                        
                        let tabela = tabelas[0];
                        for (let i = 1; i < tabelas.length; i++) {
                            if (tabelas[i].rows.length > tabela.rows.length) {
                                tabela = tabelas[i];
                            }
                        }
                        
                        let textoCopia = [];
                        const linhas = tabela.rows; 
                        let pulouCabecalhoColunas = false;
                        
                        for (let i = 0; i < linhas.length; i++) {
                            const linha = linhas[i];
                            const celulas = linha.cells; 
                            
                            if (celulas.length === 0) continue; 
                            if (linha.closest('thead') || (linha.querySelectorAll('th').length > 0 && linha.querySelectorAll('td').length === 0)) {
                                pulouCabecalhoColunas = true; continue;
                            }
                            if (celulas.length === 1 && celulas[0].colSpan > 2) continue;
                            if (!pulouCabecalhoColunas) { pulouCabecalhoColunas = true; continue; }
                            
                            let celulasTexto = [];
                            for (let j = 0; j < celulas.length; j++) {
                                let texto = celulas[j].innerText.trim().replace(/\r?\n|\r/g, ' ');
                                celulasTexto.push(texto);
                                let colspan = celulas[j].colSpan;
                                for (let c = 1; c < colspan; c++) celulasTexto.push("");
                            }
                            textoCopia.push(celulasTexto.join('\t'));
                        }
                        
                        const strFinal = textoCopia.join('\n');
                        
                        if (navigator.clipboard && window.isSecureContext) {
                            navigator.clipboard.writeText(strFinal);
                        } else {
                            const txt = document.createElement('textarea');
                            txt.value = strFinal;
                            txt.style.position = 'fixed';
                            txt.style.opacity = '0';
                            document.body.appendChild(txt);
                            txt.select();
                            try { document.execCommand('copy'); } catch (e) {}
                            document.body.removeChild(txt);
                        }
                        
                        const originalText = this.innerHTML;
                        this.innerHTML = '✅ Copiado sem cabeçalho!';
                        setTimeout(() => { this.innerHTML = originalText; }, 2000);
                    });
                }
            }
            atualizarBarraPaginacao();
            vincularEventosHistorico();
        });

        const target = document.getElementById('mostra_alunos');
        if (target) observer.observe(target, { childList: true });

        const verificarPronto = setInterval(() => {
            if (typeof $ !== 'undefined' && document.getElementById('id_unidade_selecionada')) {
                clearInterval(verificarPronto);
                aplicarMelhorias();
                setTimeout(() => {
                    carregarTabelaHistorico();
                    atualizarVisibilidadeBotaoReset();
                    processarParametrosURL(); 
                }, 500);
            }
        }, 200);

    } // Fim de iniciarPaginaPesquisa()

// ========================================================================
    // NOVO RECURSO: ASSISTENTE DE ANÁLISE (WIZARD)
    // ========================================================================
    function adicionarBotaoAssistente() {
        if (document.getElementById('btn-assistente-transporte')) return;
        
        // 1. VERIFICA O STATUS GERAL ANTES DE CRIAR O BOTÃO
        const statusDiv = document.getElementById('status_atendimento') || document.getElementById('mostra_status_pedido');
        if (!statusDiv) return;
        
        const textoStatus = statusDiv.innerText.toUpperCase();
        // Se NÃO contiver "EM ANÁLISE", o botão não deve aparecer
        if (!textoStatus.includes('EM ANÁLISE') && !textoStatus.includes('EM ANALISE')) {
            return;
        }
        
        const btn = document.createElement('button');
        btn.id = 'btn-assistente-transporte';
        btn.innerHTML = 'Assistente de Análise';
        btn.style = "position:fixed; bottom:20px; right:20px; background:#8e44ad; color:white; border:none; border-radius:50px; padding:15px 20px; font-size:14px; font-weight:bold; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.3); z-index:99999;";
        
        btn.onmouseover = () => btn.style.background = "#9b59b6";
        btn.onmouseout = () => btn.style.background = "#8e44ad";
        
        btn.onclick = (e) => {
            e.preventDefault();
            const modal = document.getElementById('modal-assistente-analise');
            if (modal) {
                // Se já existe, apenas alterna a visibilidade. Isso PRESENVA O ESTADO e a etapa atual.
                modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
            } else {
                // Se não existe, inicia a análise
                abrirModalAssistente();
            }
        };
        
        document.body.appendChild(btn);
    }

    function abrirModalAssistente() {
        // 1. TENTA EXTRAIR DADOS DA TELA
        let isMudanca = false;
        const statusDiv = document.getElementById('status_atendimento') || document.getElementById('mostra_status_pedido');
        
        if (statusDiv) {
            const textoStatus = statusDiv.innerText.toUpperCase();
            if (textoStatus.includes('MUDANÇA') || textoStatus.includes('MUDANCA')) {
                isMudanca = true;
            }
        }

        // --- CAPTURA DE ENDEREÇO E RESPONSÁVEIS (Para caso de mudança) ---
        const endRua = document.getElementById('endereco') ? document.getElementById('endereco').value : '';
        const endNum = document.getElementById('endereco_numero_residencia') ? document.getElementById('endereco_numero_residencia').value : '';
        const endBairro = document.getElementById('endereco_bairro') ? document.getElementById('endereco_bairro').value : '';
        const enderecoCompleto = [endRua, endNum, endBairro].filter(Boolean).join(", "); 

        const inputMae = document.querySelector('input[name="nome_mae"]');
        const inputPai = document.querySelector('input[name="nome_pai"]');
        const nomeMae = inputMae ? inputMae.value.trim() : '';
        const nomePai = inputPai ? inputPai.value.trim() : '';
        let nomesResponsaveis = [nomeMae, nomePai].filter(Boolean).join(" e ");
        if (!nomesResponsaveis) nomesResponsaveis = "NÃO INFORMADO";

        // Função auxiliar ajustada para ignorar a palavra "NENHUMA"
        function campoPreenchido(id) {
            const el = document.getElementById(id);
            if (!el) return false;
            const val = (el.value || el.innerText || "").trim().toUpperCase();
            return val !== "" && val !== "NÃO" && val !== "NAO" && val !== "0" && val !== "SELECIONE" && val !== "NENHUMA";
        }

        // 2. DETECTA DEFICIÊNCIAS AUTOMATICAMENTE PELOS CAMPOS
        let sugestaoDeficienciaHtml = null;
        
        const elCadeirante = document.getElementById('aluno_cadeirante');
        const isCadeirante = elCadeirante && (elCadeirante.value || elCadeirante.innerText || "").toUpperCase().includes("SIM");

        if (campoPreenchido('tipo_deficiencia') || campoPreenchido('detalhamento_deficiencia') || isCadeirante) {
            sugestaoDeficienciaHtml = 'ALUNO';
        } else if (campoPreenchido('descricao_deficiencia_pais_irmao') || campoPreenchido('descricao_deficiencia_pais_irmao_outro')) {
            sugestaoDeficienciaHtml = 'FAMILIA';
        }

        // 3. CRIA A INTERFACE DO MODAL
        const modal = document.createElement('div');
        modal.id = 'modal-assistente-analise';
        modal.style = "position:fixed; bottom:80px; right:20px; width:450px; max-width:90%; background:#fff; border-radius:8px; box-shadow:0 5px 25px rgba(0,0,0,0.4); border:1px solid #bdc3c7; z-index:100000; display:flex; flex-direction:column; font-family:verdana; overflow:hidden;";
        
        modal.innerHTML = `
            <div style="background:#2c3e50; color:#fff; padding:15px; font-size:16px; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
                <span>Assistente Passo a Passo</span>
                <button id="btn-fechar-assistente" style="background:transparent; border:none; color:#fff; font-size:24px; cursor:pointer; line-height:1;">&times;</button>
            </div>
            <div id="conteudo-assistente" style="padding:20px; font-size:14px; color:#333; min-height:150px; max-height:70vh; overflow-y:auto;">
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('btn-fechar-assistente').onclick = () => {
            modal.style.display = 'none';
        };

        // 4. ESTADO E LÓGICA DO ASSISTENTE
        let estado = {
            mudancaOk: false,
            escolaProxima: null,
            encaminhamentoOk: null,
            distancia: null,
            deficiencia: null, 
            dificuldadeAcesso: null
        };

        function renderizarPasso() {
            const conteudo = document.getElementById('conteudo-assistente');

            // --- PASSO 1: Mudança de Endereço ---
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
                document.getElementById('btn-mudanca-sim').onclick = () => { estado.mudancaOk = true; renderizarPasso(); };
                document.getElementById('btn-mudanca-nao').onclick = () => finalizarAssistente("❌ INDEFERIR", "O comprovante de endereço é inválido ou está ausente no caso de mudança.");
                return;
            }

            // --- PASSO 2: Escola Mais Próxima ---
            if (estado.escolaProxima === null) {
                conteudo.innerHTML = `
                    <h3 style="color:#2980b9; margin-top:0;">🏫 Verificação de Escola</h3>
                    <p>O aluno está matriculado na <b>escola mais próxima</b> da sua residência (que possua a etapa de ensino dele)?</p>
                    <p style="font-size:12px; color:#555;"><i>(Nota: Se a mais próxima for Integral, o atendimento na escola Parcial mais próxima é válido).</i></p>
                    <div style="margin-top:20px; display:flex; gap:10px;">
                        <button id="btn-esc-sim" style="flex:1; padding:10px; background:#27ae60; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Sim, na mais próxima</button>
                        <button id="btn-esc-nao" style="flex:1; padding:10px; background:#c0392b; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Não está</button>
                    </div>
                `;
                document.getElementById('btn-esc-sim').onclick = () => { estado.escolaProxima = true; renderizarPasso(); };
                document.getElementById('btn-esc-nao').onclick = () => { estado.escolaProxima = false; renderizarPasso(); };
                return;
            }

            // --- PASSO 2.1: Encaminhamento ---
            if (estado.escolaProxima === false && estado.encaminhamentoOk === null) {
                conteudo.innerHTML = `
                    <h3 style="color:#8e44ad; margin-top:0;">🔄 Encaminhamento</h3>
                    <p>Verifique no SOMARH ou nas planilhas da Central de Matrículas se ele possui um <b>encaminhamento válido</b> por falta de vaga.</p>
                    <p style="font-size:12px; color:#555;"><i>(A escola matriculada e o endereço devem bater com o encaminhamento).</i></p>
                    <div style="margin-top:20px; display:flex; gap:10px;">
                        <button id="btn-enc-sim" style="flex:1; padding:10px; background:#27ae60; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Sim, possui encaminhamento</button>
                        <button id="btn-enc-nao" style="flex:1; padding:10px; background:#c0392b; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Não possui</button>
                    </div>
                `;
                document.getElementById('btn-enc-sim').onclick = () => { estado.encaminhamentoOk = true; renderizarPasso(); };
                document.getElementById('btn-enc-nao').onclick = () => finalizarAssistente("❌ INDEFERIR", "O aluno não está na escola mais próxima e NÃO possui encaminhamento justificado por falta de vaga.");
                return;
            }

            // --- PASSO 3: Distância ---
            if (estado.distancia === null) {
                const campoDistExistente = document.querySelector('input[name="distancia_aferida"], #distancia_aferida');
                const valorSugerido = campoDistExistente && campoDistExistente.value ? campoDistExistente.value : "";

                conteudo.innerHTML = `
                    <h3 style="color:#f39c12; margin-top:0;">📏 Aferição de Distância</h3>
                    <p>Qual é a distância aferida entre a residência e a escola (em metros)?</p>
                    <div style="margin-top:20px; display:flex; gap:10px;">
                        <input type="number" id="input-assistente-dist" value="${valorSugerido}" placeholder="Ex: 1650" style="flex:2; padding:10px; border:1px solid #ccc; border-radius:4px; font-size:14px;">
                        <button id="btn-dist-ok" style="flex:1; padding:10px; background:#2980b9; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Avançar</button>
                    </div>
                `;
                
                const inputDist = document.getElementById('input-assistente-dist');
                setTimeout(() => { 
                    inputDist.focus(); 
                    if (valorSugerido) inputDist.select();
                }, 100);

                inputDist.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('btn-dist-ok').click();
                    }
                });

                document.getElementById('btn-dist-ok').onclick = () => {
                    const dist = parseInt(inputDist.value);
                    if (isNaN(dist) || dist < 0) return alert("Por favor, insira uma distância válida em metros.");
                    estado.distancia = dist;
                    
                    if (estado.distancia >= 1500) {
                        finalizarAssistente("✅ DEFERIR", `A distância atinge o requisito mínimo (${estado.distancia}m) e os critérios da escola ou encaminhamento estão corretos.`);
                    } else {
                        renderizarPasso();
                    }
                };
                return;
            }

            // --- PASSO 4: Exceção -> Deficiência ---
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
                    estado.deficiencia = 'ALUNO'; 
                    finalizarAssistente("✅ DEFERIR", `Deferido por motivo de deficiência do aluno.`); 
                };
                document.getElementById('btn-def-familia').onclick = () => { 
                    estado.deficiencia = 'FAMILIA'; 
                    finalizarAssistente("✅ DEFERIR", `Deferido por motivo de deficiência do responsável.`); 
                };
                document.getElementById('btn-def-nao').onclick = () => { 
                    estado.deficiencia = false; 
                    renderizarPasso(); 
                };
                return;
            }

            // --- PASSO 5: Exceção -> Dificuldade de Acesso ---
            if (estado.distancia < 1500 && estado.deficiencia === false && estado.dificuldadeAcesso === null) {
                conteudo.innerHTML = `
                    <h3 style="color:#d35400; margin-top:0;">🚧 Dificuldade de Acesso</h3>
                    <p>O trajeto da residência até a escola possui <b>dificuldade de acesso excepcional</b> (barreiras físicas severas, vias intransitáveis) mapeadas?</p>
                    <div style="margin-top:20px; display:flex; gap:10px;">
                        <button id="btn-dif-sim" style="flex:1; padding:10px; background:#27ae60; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Sim, há dificuldade</button>
                        <button id="btn-dif-nao" style="flex:1; padding:10px; background:#c0392b; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Não</button>
                    </div>
                `;
                
                document.getElementById('btn-dif-sim').onclick = () => { 
                    estado.dificuldadeAcesso = true; 
                    finalizarAssistente("✅ DEFERIR", `Deferido devido a Dificuldade de Acesso comprovada na rota.`); 
                };
                document.getElementById('btn-dif-nao').onclick = () => { 
                    estado.dificuldadeAcesso = false; 
                    finalizarAssistente("❌ INDEFERIR", `A distância não atinge 1500m e o caso não se enquadra nas exceções.`); 
                };
                return;
            }
        }

        // --- TELA FINAL DE RESULTADO (LÓGICA REFINADA) ---
        function finalizarAssistente(titulo, mensagem) {
            const conteudo = document.getElementById('conteudo-assistente');
            
            const tipoAcao = titulo.includes('INDEFERIR') ? 'INDEFERIR' : 'DEFERIR';
            const corTitulo = tipoAcao === 'DEFERIR' ? '#27ae60' : '#c0392b';

            // 1. Determina o Motivo a ser selecionado na combo
            let termoBusca = "";
            let textoDetalhes = "";

            if (tipoAcao === 'DEFERIR') {
                if (estado.distancia >= 1500) {
                    termoBusca = "DISTÂNCIA MAIOR QUE 1500 METROS";
                    if (estado.encaminhamentoOk === true) {
                        textoDetalhes = "encaminhado";
                    }
                } 
                else if (estado.deficiencia === 'ALUNO') termoBusca = "ALUNO DEFICIENTE";
                else if (estado.deficiencia === 'FAMILIA') termoBusca = "PAI/MÃE DEFICIENTE";
                else if (estado.dificuldadeAcesso === true) termoBusca = "DIFICULDADE DE ACESSO";
                else termoBusca = "ENCAMINHADO PELA SEÇÃO DE MATRICULAS";
            } else {
                if (isMudanca && estado.mudancaOk === false) {
                    termoBusca = ""; // Deixa em branco para o usuário selecionar manualmente ou manter o padrão
                } else if (estado.distancia !== null && estado.distancia < 1500) {
                    termoBusca = "DISTÂNCIA MENOR QUE 1500 METROS";
                } else {
                    termoBusca = "ESCOLA POR OPÇÃO";
                }
            }

            // 2. Monta a exibição (Mostra a mensagem exata do erro/motivo e a opção do sistema)
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
                // ETAPA 1: DISTÂNCIA
                try {
                    const camposDist = document.querySelectorAll('input[name="distancia_aferida"], #distancia_aferida');
                    if (estado.distancia !== null && estado.distancia !== undefined) {
                        camposDist.forEach(campo => {
                            campo.value = estado.distancia;
                            campo.setAttribute('value', estado.distancia);
                        });
                    }
                } catch (erro) {
                    console.error("[ERRO NA DISTÂNCIA]", erro);
                }

                // ETAPA 2: DETALHES
                try {
                    const camposDet = document.querySelectorAll('textarea[name="status_detalhes"], #status_atual_detalhes, textarea[name="motivo_detalhes"]');
                    camposDet.forEach(campo => {
                        campo.value = textoDetalhes;
                        campo.innerHTML = textoDetalhes; 
                    });
                } catch (erro) {
                    console.error("[ERRO NOS DETALHES]", erro);
                }

                // ETAPA 3: SELECTS
                try {
                    if (termoBusca !== "") {
                        const selectsMotivo = document.querySelectorAll('select[name="status_motivo"], #status_motivo');
                        
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
                } catch (erro) {
                    console.error("[ERRO NO MOTIVO]", erro);
                }

                // FECHA O ASSISTENTE
                const modalAssis = document.getElementById('modal-assistente-analise');
                if (modalAssis) modalAssis.remove();
            };
        }

        renderizarPasso(); // Inicia o Wizard
    }
})();
