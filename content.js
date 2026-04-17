(function() {
    'use strict';

    // --- INÍCIO DO SISTEMA DE ATUALIZAÇÃO ---
    const VERSAO_ATUAL = "2.9"; // ATENÇÃO: Mude isso aqui e no version.json sempre que lançar atualização
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

})();
