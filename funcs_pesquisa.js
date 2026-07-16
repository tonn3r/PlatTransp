// Configura os scripts, eventos e modificações visuais aplicados à página de pesquisa de alunos/solicitações.
window.iniciarPaginaPesquisa = function() {
    
    // Interceptador preventivo contra o erro nativo do #framemodal nulo
    // a tela de pesquisa apresenta erros no console ao abrir as Fichas dos alunos.  Essa correção deve eliminar a mensagem de erro no console.
    if (typeof window.AbrirLinkModal === 'function' && !window.AbrirLinkModalBlindado) {
        const originalAbrirLinkModal = window.AbrirLinkModal;
        window.AbrirLinkModalBlindado = true;
        
        window.AbrirLinkModal = function(url) {
            var modal = document.getElementById("myModal");
            var frame = document.getElementById("img01");
            var frame2 = document.getElementById("framemodal");
            
            // Lógica idêntica ao site original, mas com tratamento preventivo contra nulo (Vanilla JS)
            if (frame) frame.src = url;
            if (modal) modal.style.display = "block";
            if (frame) frame.style.display = "block";
            if (frame2) frame2.style.display = "none"; // Só executa se a div existir
        };
    }
        
    
    let paginaAtual = 1;
    let requisicaoAtiva = null; // Armazena a requisição AJAX atual para poder abortá-la

    // Dispara um evento real e nativo de resize simulando a ação física do usuário
    function forcarResizeNativo() {
        try {
            window.dispatchEvent(new UIEvent('resize', { bubbles: true, cancelable: true }));
        } catch (e) {
            if (document.createEvent) {
                var evt = document.createEvent('UIEvent');
                evt.initUIEvent('resize', true, true, window, 0);
                window.dispatchEvent(evt);
            }
        }
    }

    // Limpa acentos e caracteres especiais para ajudar nos filtros de texto.
    function removerAcentosEspeciais(str) {
        if (!str) return "";
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "");
    }

    // Força o gatilho de alteração num elemento, avisando o sistema que o valor mudou.
    function dispararEventoChange(elemento) {
        if (!elemento) return;
        elemento.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Verifica se há alguma restrição (filtro) ativa nas buscas do painel.
    function temFiltroAtivo() {
        if (typeof $ === 'undefined') return false;
        const unidade = $('#id_unidade_selecionada').val();
        const status = $('#status_selecionado').val();
        const motivo = $('#motivo_selecionado').val();
        const nome = removerAcentosEspeciais($('#nome_aluno_pesquisado').val() || "");
        const endereco = removerAcentosEspeciais($('#endereco').val() || "");

        return (unidade !== "" && unidade !== "0" && unidade !== null) || 
               (status !== "" && status !== "0" && status !== null) || 
               (motivo !== "" && motivo !== "0" && motivo !== null) || 
               (nome.trim().length > 0) || 
               (endereco.trim().length > 0);
    }

    // Mostra ou esconde o botão de "limpar filtros" e os botões de "X" individuais.
    function atualizarVisibilidadeBotaoReset() {
        const btn = document.getElementById('btn-limpar-filtros');
        if (btn) {
            btn.style.display = temFiltroAtivo() ? 'inline-block' : 'none';
        }

        // Controla a exibição dos "X" individuais com base nos preenchimentos atuais
        const campos = [
            { id: 'unidade-autocomplete', valorPadrao: '' },
            { id: 'status_selecionado', valorPadrao: '0' },
            { id: 'motivo_selecionado', valorPadrao: '0' },
            { id: 'nome_aluno_pesquisado', valorPadrao: '' },
            { id: 'endereco', valorPadrao: '' }
        ];

        campos.forEach(campo => {
            const el = document.getElementById(campo.id);
            if (el) {
                const wrapper = el.closest('.container-filtro-wrapper');
                if (wrapper) {
                    const btnX = wrapper.querySelector('.btn-clear-individual');
                    if (btnX) {
                        const temValor = el.value !== "" && el.value !== campo.valorPadrao && el.value !== null;
                        btnX.style.display = temValor ? 'flex' : 'none';
                    }
                }
            }
        });
    }

    // Injeta os estilos CSS necessários para os botões "X" flutuantes individuais
    function injetarEstilosReset() {
        if (document.getElementById('estilo-botoes-reset')) return;
        const style = document.createElement('style');
        style.id = 'estilo-botoes-reset';
        style.innerHTML = `
            .container-filtro-wrapper {
                position: relative;
                display: inline-block;
                width: 100%;
            }
            .btn-clear-individual {
                position: absolute;
                right: 16px;
                top: 50%;
                transform: translateY(-50%);
                opacity: 0.5;
                color: grey !important;
                background: #fff;
                border: none;
                border-radius: 50%;
                width: 14px;
                height: 14px;
                font-size: 8px;
                font-weight: bold;
                cursor: pointer;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 0;
                line-height: 1;
                z-index: 10;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                transition: background 0.2s, transform 0.1s, color 0.2s;
            }
            .btn-clear-individual:hover {
                background: #c0392b;
                color: white !important;
                opacity: 1;
                transform: translateY(-50%) scale(1.1);
            }
            /* Garante padding à direita nos campos para o texto não sobrepor o botão X */
            .container-filtro-wrapper input, 
            .container-filtro-wrapper select {
                padding-right: 24px !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Envolve um elemento em um container com o botão "X" de reset individual
    function aplicarResetIndividual(elId, callbackLimpar) {
        const el = document.getElementById(elId);
        if (!el || el.parentNode.classList.contains('container-filtro-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'container-filtro-wrapper';
        el.parentNode.insertBefore(wrapper, el);
        wrapper.appendChild(el);

        const btnX = document.createElement('button');
        btnX.className = 'btn-clear-individual';
        btnX.type = 'button';
        btnX.innerHTML = '✕';
        btnX.title = 'Limpar este filtro';

        btnX.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            callbackLimpar();
            paginaAtual = 1;
            atualizarVisibilidadeBotaoReset();

            // Após remover o filtro atual, decide se exibe histórico ou submete nova busca com o que sobrou
            executarPesquisaPainel();
        });

        wrapper.appendChild(btnX);
    }

    // Função central que gerencia o fluxo de pesquisa baseado no estado do Painel
    function executarPesquisaPainel() {
        if (typeof $ === 'undefined') return;

        if (requisicaoAtiva && typeof requisicaoAtiva.abort === 'function') {
            requisicaoAtiva.abort();
        }

        if (!temFiltroAtivo()) {
            $('#mostra_alunos').html('');
            carregarTabelaHistorico();
            return;
        }

        $("#mostra_alunos").html("<img src='images/carregando.gif' width='60' height='28'>");

        let ord = $('#ordenar_por').val();
        if (ord === "0") ord = "1";

        const nome = removerAcentosEspeciais($('#nome_aluno_pesquisado').val() || "").trim();
        const endereco = removerAcentosEspeciais($('#endereco').val() || "").trim();
        const unidade = $('#id_unidade_selecionada').val();
        const status = $('#status_selecionado').val();

        // Determina a função adequada dinamicamente com base nas regras do site original
        let funcaoUtilizada = 1; 
        if (nome.length > 2) {
            funcaoUtilizada = 5;
        } else if (endereco.length > 0) {
            funcaoUtilizada = 6;
            if (ord === "1") ord = "2"; 
        } else if (unidade !== "" && unidade !== "0") {
            funcaoUtilizada = 2;
        } else if (status !== "" && status !== "0") {
            funcaoUtilizada = 4;
        }

        requisicaoAtiva = $.post("lista_alunos_transporte.php", {
            ano: $('#ano_selecionado').val(),
            id_unidade: unidade,
            motivo_selecionado: $('#motivo_selecionado').val(),
            status_selecionado: status,
            nome_aluno_pesquisado: funcaoUtilizada === 5 ? nome.replace(/\s+/g, '%') : nome,
            endereco: funcaoUtilizada === 6 ? endereco.replace(/\s+/g, '%') : endereco,
            funcao_utilizada: funcaoUtilizada,
            registro_inicial: (paginaAtual - 1) * 100,
            pagina: paginaAtual,
            ordenar_por: ord
        }).done(data => { 
            $("#mostra_alunos").html(data); 
        });
    }

    // Aplica alterações nas funções originais do sistema para que as buscas preservem outros filtros (nome, status, etc).
    function aplicarPatches() {
        const win = window;

        // Redefine as chamadas globais do site para apontar para a nossa função controlada
        win.lista_unidade_selecionada = function(reg, pag) {
            paginaAtual = pag;
            executarPesquisaPainel();
        };

        win.lista_ano_selecionado = function(reg, pag) {
            const select_ano = document.getElementById('ano_selecionado');
            if (!select_ano) return;
            $(select_ano).off('change').on('change', function() {
                atualizarVisibilidadeBotaoReset();
                paginaAtual = 1;
                executarPesquisaPainel();
            });
        };

        win.lista_ordenado_por = function(reg, pag) {
            $('#ordenar_por').off('change').on('change', function(){
                atualizarVisibilidadeBotaoReset();
                paginaAtual = 1;
                executarPesquisaPainel();
            });
        };

        win.lista_status_selecionado = function(reg, pag) {
            $('#status_selecionado').off('change').on('change', function(){
                atualizarVisibilidadeBotaoReset();
                paginaAtual = 1;
                executarPesquisaPainel();
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
                    executarPesquisaPainel();
                }
            });
        }

        win.lista_alunos_por_nome = function(reg, pag) {
            paginaAtual = pag;
            executarPesquisaPainel();
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
                    executarPesquisaPainel();
                }
            });
        }

        win.lista_alunos_por_endereco = function(reg, pag) {
            paginaAtual = pag;
            executarPesquisaPainel();
        };
    }

    // Design, busca autocomplete em tempo real e injeção dos Wrappers com botões "X" individuais.
    function aplicarMelhorias() {
        const selectUnidade = document.getElementById('id_unidade_selecionada');
        if (!selectUnidade || document.getElementById('unidade-autocomplete')) return;

        injetarEstilosReset();
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
            
            // Container alinhado à base para compensar o texto de label superior da linha
            const containerBotoes = document.createElement('div');
            containerBotoes.style.display = "flex";
            containerBotoes.style.gap = "5px";
            containerBotoes.style.marginTop = "14px"; 

            // Novo botão de Pesquisa
            const btnPesquisar = document.createElement('button');
            btnPesquisar.id = 'btn-executar-pesquisa';
            btnPesquisar.innerHTML = '🔍 Pesquisar';
            btnPesquisar.type = 'button';
            btnPesquisar.style = "background:#007BFF; color:#fff; border:1px solid #007BFF; border-radius:4px; height:30px; padding:0 12px; cursor:pointer; font-weight:bold; font-size:11px; vertical-align: middle;";
            btnPesquisar.addEventListener('click', () => {
                paginaAtual = 1;
                executarPesquisaPainel();
            });

            const btnReset = document.createElement('button');
            btnReset.id = 'btn-limpar-filtros';
            btnReset.innerHTML = '✕ Limpar Filtros';
            btnReset.type = 'button';
            btnReset.style = "background:#fff; color:#e74c3c; border:1px solid #e74c3c; border-radius:4px; height:30px; padding:0 12px; cursor:pointer; font-weight:bold; font-size:11px; vertical-align: middle; display:none;";
            btnReset.addEventListener('click', () => {
                $('#id_unidade_selecionada').val('0');
                $('#unidade-autocomplete').val('');
                $('#status_selecionado').val('0');
                $('#motivo_selecionado').val('0');
                $('#nome_aluno_pesquisado').val('');
                $('#endereco').val('');
                if (requisicaoAtiva && typeof requisicaoAtiva.abort === 'function') {
                    requisicaoAtiva.abort();
                }
                $('#mostra_alunos').html('');
                paginaAtual = 1;
                atualizarVisibilidadeBotaoReset();
                carregarTabelaHistorico();
            });

            containerBotoes.appendChild(btnPesquisar);
            containerBotoes.appendChild(btnReset);
            tdBotao.appendChild(containerBotoes);
            trPai.appendChild(tdBotao);
        }

        // Aplicação do wrapper com botão "X" de limpeza individual nos elementos solicitados
        aplicarResetIndividual('unidade-autocomplete', () => {
            selectUnidade.value = '0';
            inputBusca.value = '';
        });
        aplicarResetIndividual('status_selecionado', () => {
            $('#status_selecionado').val('0');
        });
        aplicarResetIndividual('motivo_selecionado', () => {
            $('#motivo_selecionado').val('0');
        });
        aplicarResetIndividual('nome_aluno_pesquisado', () => {
            $('#nome_aluno_pesquisado').val('');
        });
        aplicarResetIndividual('endereco', () => {
            $('#endereco').val('');
        });

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
                atualizarVisibilidadeBotaoReset();
                paginaAtual = 1;
                executarPesquisaPainel();
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
                const wrapperPai = el.closest('.container-filtro-wrapper');
                if (wrapperPai) {
                    wrapperPai.style.width = '100%';
                }
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

    // Dispara via Ajax a listagem de alunos paginada baseada em avançar/voltar no painel melhorado.
    function dispararPesquisaPaginada(direcao) {
        if (direcao === 'next') paginaAtual++;
        else if (direcao === 'prev' && paginaAtual > 1) paginaAtual--;
        executarPesquisaPainel();
    }

    // Cria ou atualiza os botões inferiores de paginação com os botões "Anterior" e "Próxima".
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
            if (bPrev) bPrev.addEventListener('click', () => dispararPesquisaPaginada('prev'));
            if (bNext) bNext.addEventListener('click', () => dispararPesquisaPaginada('next'));
        } else if (barra) { barra.remove(); }
    }

    // Preenche a tabela no topo da página de pesquisa com os alunos abertos recentemente guardados no cache.
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
        
        // Garante redimensionamento de janela (resize) imediato após injetar o Histórico no DOM
        forcarResizeNativo();
    }

    // Adiciona os event listeners de forma ampla e irrestrita para registrar no histórico
    function vincularEventosHistorico() {
        document.querySelectorAll('.botao, button, a, [onclick]').forEach(b => {
            if (b.dataset.eventoHistoricoVinculado) return; 
            
            const textoBotao = (b.innerText || b.value || "").toLowerCase();
            if (textoBotao.includes("abrir") || textoBotao.includes("reclama") || textoBotao.includes("v2")) {
                b.dataset.eventoHistoricoVinculado = "true";

                b.addEventListener('click', function() {
                    const tr = this.closest('tr');
                    if (!tr) return;

                    const id = (tr.cells[1] ? tr.cells[1].innerText.trim() : null) || (tr.querySelector('strong')?.innerText.trim());
                    
                    if (id) {
                        let hist = JSON.parse(localStorage.getItem('historico_alunos_transporte') || "[]");
                        
                        // Limpa strings para correspondência exata de ID e expurga o antigo da lista antes de reinserir no topo (reordenando)
                        const limpaId = id.toString().replace(/\D/g, '');
                        
                        let conteudoHtmlParaSalvar = tr.innerHTML;
                        
                        // Localiza se já existia no histórico e remove o registro antigo
                        hist = hist.filter(i => i.id.toString().replace(/\D/g, '') !== limpaId);
                        
                        // Se o clique não veio do histórico (veio de um TR novo de busca real), faz o clone limpando as ações laterais
                        if (!tr.parentNode || tr.parentNode.id !== 'corpo-historico') {
                            const cloneTr = tr.cloneNode(true);
                            const colunas = cloneTr.querySelectorAll('td');
                            if (colunas.length >= 13) {
                                colunas[0].innerHTML = '';  
                                colunas[12].innerHTML = ''; 
                            }
                            conteudoHtmlParaSalvar = cloneTr.innerHTML;
                        }

                        hist.unshift({ id: id, conteudoHtml: conteudoHtmlParaSalvar });
                        localStorage.setItem('historico_alunos_transporte', JSON.stringify(hist.slice(0, 100)));
                    }
                });
            }
        });
    }

    // Pega os parâmetros do endereço (URL) do navegador para preencher os filtros da página automaticamente.
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
            executarPesquisaPainel();
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
                        if (linha.closest('thead') || (linha.querySelectorAll('th').length > 0 && inline.querySelectorAll('td').length === 0)) {
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
            forcarResizeNativo();
            setTimeout(() => {
                carregarTabelaHistorico();
                atualizarVisibilidadeBotaoReset();
                processarParametrosURL(); 

                //força o resize para a lista se adaptar à tela
                try {
                    if (window.top && window.top.document) {
                        const topDoc = window.top.document;
                        const mainFrame = topDoc.getElementById('MainFrame') || topDoc.getElementById('mainFrame');
                        const leftFrame = topDoc.getElementById('leftFrame');
                        
                        // Dispara o evento de resize no frame pai para recalcular as larguras das tabelas
                        window.top.dispatchEvent(new Event('resize'));
                        
                        // Executa as lógicas de redimensionamento nativo da plataforma
                        if (typeof window.top.forcarResizeNativo === 'function') {
                            window.top.forcarResizeNativo();
                        }
                    }
                } catch (e) {
                    // Fallback seguro caso haja restrição estrita de escopo
                    window.dispatchEvent(new Event('resize'));
                }

                forcarResizeNativo();
                setTimeout(forcarResizeNativo, 100);
                setTimeout(forcarResizeNativo, 300);
                
            }, 500);
        }
    }, 500);
};