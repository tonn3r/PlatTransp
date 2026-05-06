window.iniciarPaginaPesquisa = function() {
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
};