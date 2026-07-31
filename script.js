/**
 * ============================================================
 * SISTEMA DE MERCADINHO - VERSÃO COMPLETA COM MARGEM DE LUCRO
 * ============================================================
 */

// ============================================================
// BANCO DE DADOS LOCAL (localStorage)
// ============================================================
const DB = {
    get(key, defaultValue = {}) {
        try {
            const data = localStorage.getItem('mercadinho_' + key);
            return data ? JSON.parse(data) : defaultValue;
        } catch {
            return defaultValue;
        }
    },
    set(key, value) {
        localStorage.setItem('mercadinho_' + key, JSON.stringify(value));
    }
};

// ============================================================
// ESTADO GLOBAL
// ============================================================
let state = {
    produtos: DB.get('produtos', {}),
    notas: DB.get('notas', []),
    vendas: DB.get('vendas', []),
    ultimoIdNota: DB.get('ultimoIdNota', 0),
    ultimoIdVenda: DB.get('ultimoIdVenda', 0),
    vendaAtual: { cliente: '', pagamento: 'Dinheiro', itens: [] },
    scannerCampoDestino: null,
    scannerAtivo: false,
};

// ============================================================
// FUNÇÕES DE PERSISTÊNCIA
// ============================================================
function salvarEstado() {
    DB.set('produtos', state.produtos);
    DB.set('notas', state.notas);
    DB.set('vendas', state.vendas);
    DB.set('ultimoIdNota', state.ultimoIdNota);
    DB.set('ultimoIdVenda', state.ultimoIdVenda);
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
function navegar(pagina) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pagina).classList.add('active');

    if (pagina === 'dashboard') atualizarDashboard();
    if (pagina === 'estoque') {
        renderizarEstoque();
        renderizarTabelaLucro();
    }
    if (pagina === 'vendas') {
        renderizarVendasRapidas();
        renderizarCarrinho();
    }
    if (pagina === 'notas') renderizarNotas();
    if (pagina === 'lucro') {
        carregarProdutosLucro();
        renderizarTabelaLucro();
        limparFormLucro();
    }

    fecharModalNota();
    fecharScanner();
}

// ============================================================
// ALERTAS
// ============================================================
function mostrarAlerta(mensagem, tipo = 'info', tempo = 5000) {
    const el = document.getElementById('alertGlobal');
    el.textContent = mensagem;
    el.className = 'alert alert-' + tipo + ' show';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => {
        el.classList.remove('show');
    }, tempo);
}

function mostrarAlertaEstoque(mensagem, tipo = 'info') {
    const el = document.getElementById('alertEstoque');
    el.textContent = mensagem;
    el.className = 'alert alert-' + tipo + ' show';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => {
        el.classList.remove('show');
    }, 4000);
}

function mostrarAlertaVenda(mensagem, tipo = 'info') {
    const el = document.getElementById('alertVenda');
    el.textContent = mensagem;
    el.className = 'alert alert-' + tipo + ' show';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => {
        el.classList.remove('show');
    }, 4000);
}

function mostrarAlertaLucro(mensagem, tipo = 'info') {
    const el = document.getElementById('alertLucro');
    el.textContent = mensagem;
    el.className = 'alert alert-' + tipo + ' show';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => {
        el.classList.remove('show');
    }, 4000);
}

// ============================================================
// DASHBOARD
// ============================================================
function atualizarDashboard() {
    const produtos = Object.values(state.produtos);
    const total = produtos.length;
    const baixo = produtos.filter(p => p.quantidade <= 5).length;
    const vendas = state.vendas.length;
    const notas = state.notas.length;
    const faturamento = state.vendas.reduce((acc, v) => acc + v.total, 0);

    document.getElementById('total-produtos').textContent = total;
    document.getElementById('total-baixo').textContent = baixo;
    document.getElementById('total-vendas').textContent = vendas;
    document.getElementById('total-notas').textContent = notas;
    document.getElementById('faturamento-total').textContent = faturamento.toFixed(2);

    const alertasDiv = document.getElementById('alertas-estoque');
    const alertas = produtos.filter(p => p.quantidade <= 5);
    if (alertas.length === 0) {
        alertasDiv.innerHTML = '<p style="color:#4CAF50;">✅ Todos os produtos estão com estoque adequado!</p>';
    } else {
        alertasDiv.innerHTML = alertas.map(p =>
            `<p style="color:var(--danger-light);margin:4px 0;">
                        ⚠️ <strong>${p.nome}</strong> - Estoque: <strong>${p.quantidade}</strong> unidades
                        ${p.quantidade === 0 ? ' (ESGOTADO!)' : ' (baixo)'}
                    </p>`
        ).join('');
    }

    const tbody = document.getElementById('ultimos-produtos');
    const ultimos = produtos.slice(-5).reverse();
    if (ultimos.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Nenhum produto cadastrado ainda.</td></tr>';
    } else {
        tbody.innerHTML = ultimos.map(p => `
                    <tr>
                        <td>${p.codigo}</td>
                        <td>${p.nome}</td>
                        <td>R$ ${p.preco.toFixed(2)}</td>
                        <td>${p.quantidade}</td>
                        <td><span class="status-badge ${p.quantidade <= 5 ? 'status-baixo' : p.quantidade <= 20 ? 'status-medio' : 'status-alto'}">
                            ${p.quantidade <= 5 ? 'Baixo' : p.quantidade <= 20 ? 'Médio' : 'Alto'}
                        </span></td>
                    </tr>
                `).join('');
    }
}

// ============================================================
// ESTOQUE - CRUD
// ============================================================
function salvarProduto(event) {
    event.preventDefault();

    const codigo = document.getElementById('prod-codigo').value.trim();
    const nome = document.getElementById('prod-nome').value.trim();
    const preco = parseFloat(document.getElementById('prod-preco').value);
    const quantidade = parseInt(document.getElementById('prod-qtd').value);
    const editCodigo = document.getElementById('edit-codigo').value;

    if (!codigo || !nome || isNaN(preco) || isNaN(quantidade)) {
        mostrarAlertaEstoque('Preencha todos os campos corretamente!', 'danger');
        return;
    }

    if (preco < 0 || quantidade < 0) {
        mostrarAlertaEstoque('Preço e quantidade não podem ser negativos!', 'danger');
        return;
    }

    if (editCodigo && editCodigo !== codigo) {
        delete state.produtos[editCodigo];
    }

    state.produtos[codigo] = {
        codigo: codigo,
        nome: nome,
        preco: preco,
        quantidade: quantidade
    };

    salvarEstado();
    limparFormProduto();
    renderizarEstoque();
    atualizarDashboard();
    renderizarTabelaLucro();

    mostrarAlertaEstoque(`Produto "${nome}" salvo com sucesso!`, 'success');
}

function editarProduto(codigo) {
    const p = state.produtos[codigo];
    if (!p) return;

    document.getElementById('prod-codigo').value = p.codigo;
    document.getElementById('prod-nome').value = p.nome;
    document.getElementById('prod-preco').value = p.preco;
    document.getElementById('prod-qtd').value = p.quantidade;
    document.getElementById('edit-codigo').value = p.codigo;

    document.getElementById('estoque-title').textContent = '✏️ Editar Produto';
    document.getElementById('btn-salvar-produto').textContent = '💾 Atualizar';
    document.getElementById('btn-excluir-produto').style.display = 'inline-block';

    document.getElementById('formProduto').scrollIntoView({ behavior: 'smooth' });
}

function excluirProduto() {
    const codigo = document.getElementById('edit-codigo').value;
    if (!codigo) return;

    if (!confirm(`Tem certeza que deseja excluir o produto "${state.produtos[codigo]?.nome}"?`)) return;

    delete state.produtos[codigo];
    delete margensLucro[codigo];
    salvarEstado();
    salvarMargensLucro();
    limparFormProduto();
    renderizarEstoque();
    atualizarDashboard();
    renderizarTabelaLucro();
    mostrarAlertaEstoque('Produto excluído com sucesso!', 'success');
}

function limparFormProduto() {
    document.getElementById('prod-codigo').value = '';
    document.getElementById('prod-nome').value = '';
    document.getElementById('prod-preco').value = '';
    document.getElementById('prod-qtd').value = '';
    document.getElementById('edit-codigo').value = '';
    document.getElementById('estoque-title').textContent = '📦 Cadastrar Produto';
    document.getElementById('btn-salvar-produto').textContent = '➕ Cadastrar';
    document.getElementById('btn-excluir-produto').style.display = 'none';
    document.getElementById('alertEstoque').classList.remove('show');
}

function renderizarEstoque() {
    const filtro = document.getElementById('filtro-estoque').value.toLowerCase().trim();
    const produtos = Object.values(state.produtos);
    const filtrados = filtro ?
        produtos.filter(p =>
            p.codigo.toLowerCase().includes(filtro) ||
            p.nome.toLowerCase().includes(filtro)
        ) :
        produtos;

    document.getElementById('qtd-produtos').textContent = produtos.length;

    const tbody = document.getElementById('tabela-estoque');
    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Nenhum produto encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = filtrados.map(p => {
        const status = p.quantidade <= 5 ? 'Baixo' :
            p.quantidade <= 20 ? 'Médio' : 'Alto';
        const statusClass = p.quantidade <= 5 ? 'status-baixo' :
            p.quantidade <= 20 ? 'status-medio' : 'status-alto';
        return `
                    <tr>
                        <td><strong>${p.codigo}</strong></td>
                        <td>${p.nome}</td>
                        <td>R$ ${p.preco.toFixed(2)}</td>
                        <td class="qtd-display ${p.quantidade <= 5 ? 'qtd-baixa' : p.quantidade <= 20 ? 'qtd-media' : 'qtd-alta'}">${p.quantidade}</td>
                        <td><span class="status-badge ${statusClass}">${status}</span></td>
                        <td class="actions-cell">
                            <button class="btn btn-info btn-sm" onclick="editarProduto('${p.codigo}')">✏️</button>
                            <button class="btn btn-danger btn-sm" onclick="excluirProdutoDireto('${p.codigo}')">🗑️</button>
                            <button class="btn btn-secondary btn-sm" onclick="navegar('lucro');setTimeout(()=>{document.getElementById('lucro-produto').value='${p.codigo}';carregarProdutoLucro();},300);">📊</button>
                        </td>
                    </tr>
                `;
    }).join('');
}

function excluirProdutoDireto(codigo) {
    const p = state.produtos[codigo];
    if (!p) return;
    if (!confirm(`Excluir "${p.nome}" permanentemente?`)) return;
    delete state.produtos[codigo];
    delete margensLucro[codigo];
    salvarEstado();
    salvarMargensLucro();
    renderizarEstoque();
    atualizarDashboard();
    renderizarTabelaLucro();
    mostrarAlertaEstoque(`"${p.nome}" removido.`, 'success');
}

// ============================================================
// BUSCA DE PRODUTOS NA VENDA (AUTOSSUGESTÃO)
// ============================================================
function buscarProdutoVenda(event) {
    const busca = document.getElementById('venda-busca').value.trim().toLowerCase();
    const sugestoes = document.getElementById('sugestoes-produtos');

    if (!busca || busca.length < 1) {
        sugestoes.style.display = 'none';
        return;
    }

    const produtos = Object.values(state.produtos);
    const filtrados = produtos.filter(p =>
        p.nome.toLowerCase().includes(busca) ||
        p.codigo.toLowerCase().includes(busca)
    ).slice(0, 8);

    if (filtrados.length === 0) {
        sugestoes.style.display = 'none';
        return;
    }

    sugestoes.style.display = 'block';
    sugestoes.innerHTML = filtrados.map(p =>
        `<div onclick="selecionarProdutoVenda('${p.codigo}')">
                    ${p.codigo} - ${p.nome} (R$ ${p.preco.toFixed(2)}) - Estoque: ${p.quantidade}
                </div>`
    ).join('');
}

function selecionarProdutoVenda(codigo) {
    document.getElementById('venda-busca').value = codigo;
    document.getElementById('sugestoes-produtos').style.display = 'none';
    adicionarItemVenda();
}

// ============================================================
// VENDAS
// ============================================================
function adicionarItemVenda() {
    const codigoInput = document.getElementById('venda-busca').value.trim();
    
    let codigo = codigoInput || document.getElementById('venda-codigo-scanner')?.value?.trim();
    
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;

    if (!codigo) {
        mostrarAlertaVenda('Informe o código ou nome do produto.', 'danger');
        return;
    }

    let produto = state.produtos[codigo];
    if (!produto) {
        const produtos = Object.values(state.produtos);
        const encontrado = produtos.find(p => 
            p.nome.toLowerCase().includes(codigo.toLowerCase())
        );
        if (encontrado) {
            produto = encontrado;
            codigo = encontrado.codigo;
        }
    }

    if (!produto) {
        mostrarAlertaVenda(`Produto "${codigo}" não encontrado!`, 'danger');
        return;
    }

    if (qtd <= 0) {
        mostrarAlertaVenda('Quantidade deve ser maior que zero.', 'danger');
        return;
    }

    const existente = state.vendaAtual.itens.find(i => i.codigo === produto.codigo);
    if (existente) {
        existente.quantidade += qtd;
        existente.subtotal = existente.quantidade * produto.preco;
    } else {
        state.vendaAtual.itens.push({
            codigo: produto.codigo,
            nome: produto.nome,
            preco: produto.preco,
            quantidade: qtd,
            subtotal: qtd * produto.preco
        });
    }

    document.getElementById('venda-busca').value = '';
    document.getElementById('venda-codigo-scanner').value = '';
    document.getElementById('venda-qtd').value = '1';
    document.getElementById('sugestoes-produtos').style.display = 'none';
    renderizarCarrinho();
    calcularTrocoJuros();
    mostrarAlertaVenda(`"${produto.nome}" adicionado!`, 'success');
}

function removerItemVenda(index) {
    state.vendaAtual.itens.splice(index, 1);
    renderizarCarrinho();
    calcularTrocoJuros();
}

function renderizarCarrinho() {
    const tbody = document.getElementById('tabela-venda');
    const itens = state.vendaAtual.itens;

    if (itens.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Nenhum item adicionado.</td></tr>';
        document.getElementById('venda-total').textContent = '0.00';
        return;
    }

    let total = 0;
    tbody.innerHTML = itens.map((item, index) => {
        total += item.subtotal;
        return `
                    <tr>
                        <td>${item.codigo}</td>
                        <td>${item.nome}</td>
                        <td>${item.quantidade}</td>
                        <td>R$ ${item.subtotal.toFixed(2)}</td>
                        <td><button class="btn btn-danger btn-sm" onclick="removerItemVenda(${index})">✕</button></td>
                    </tr>
                `;
    }).join('');

    document.getElementById('venda-total').textContent = total.toFixed(2);
}

// ============================================================
// CÁLCULO DE TROCO E JUROS
// ============================================================
function calcularTrocoJuros() {
    const pagamento = document.getElementById('venda-pagamento').value;
    const total = state.vendaAtual.itens.reduce((acc, i) => acc + i.subtotal, 0);
    const campoJuros = document.getElementById('campo-juros');
    const campoTroco = document.getElementById('campo-troco');

    if (pagamento === 'Cartão Crédito') {
        campoJuros.style.display = 'block';
        const juros = parseFloat(document.getElementById('venda-juros').value) || 0;
        const totalComJuros = total * (1 + juros / 100);
        document.getElementById('venda-total').textContent = totalComJuros.toFixed(2);
    } else {
        campoJuros.style.display = 'none';
        document.getElementById('venda-total').textContent = total.toFixed(2);
    }

    if (pagamento === 'Dinheiro') {
        campoTroco.style.display = 'block';
        const recebido = parseFloat(document.getElementById('venda-recebido').value) || 0;
        const totalFinal = parseFloat(document.getElementById('venda-total').textContent) || 0;
        const troco = recebido - totalFinal;
        const resultado = document.getElementById('resultado-troco');
        if (recebido > 0) {
            if (troco >= 0) {
                resultado.innerHTML = `Troco: R$ ${troco.toFixed(2)} ✅`;
                resultado.style.color = 'var(--primary-light)';
            } else {
                resultado.innerHTML = `Faltam: R$ ${Math.abs(troco).toFixed(2)} ❌`;
                resultado.style.color = 'var(--danger-light)';
            }
        } else {
            resultado.innerHTML = '';
        }
    } else {
        campoTroco.style.display = 'none';
        document.getElementById('resultado-troco').innerHTML = '';
    }
}

// ============================================================
// FINALIZAR VENDA
// ============================================================
function finalizarVenda(event) {
    event.preventDefault();

    const cliente = document.getElementById('venda-cliente').value.trim() || 'Cliente não informado';
    const pagamento = document.getElementById('venda-pagamento').value;
    let itens = state.vendaAtual.itens;

    if (itens.length === 0) {
        mostrarAlertaVenda('Adicione pelo menos um item à venda!', 'danger');
        return;
    }

    let total = itens.reduce((acc, i) => acc + i.subtotal, 0);

    if (pagamento === 'Cartão Crédito') {
        const juros = parseFloat(document.getElementById('venda-juros').value) || 0;
        total = total * (1 + juros / 100);
    }

    state.ultimoIdVenda++;
    const venda = {
        id: state.ultimoIdVenda,
        cliente: cliente,
        total: total,
        pagamento: pagamento,
        data: new Date().toISOString(),
        itens: itens.map(i => ({ ...i }))
    };
    state.vendas.push(venda);

    for (const item of itens) {
        if (state.produtos[item.codigo]) {
            state.produtos[item.codigo].quantidade -= item.quantidade;
        }
    }

    state.ultimoIdNota++;
    const nota = {
        id: state.ultimoIdNota,
        cliente: cliente,
        pagamento: pagamento,
        total: total,
        data: new Date().toISOString(),
        itens: itens.map(i => ({ ...i })),
        itensDetalhados: itens.map(i => `${i.quantidade}x ${i.nome} (R$ ${i.subtotal.toFixed(2)})`).join('\n')
    };
    state.notas.push(nota);

    state.vendaAtual.itens = [];
    document.getElementById('venda-cliente').value = '';
    document.getElementById('venda-recebido').value = '';
    document.getElementById('resultado-troco').innerHTML = '';

    salvarEstado();
    renderizarCarrinho();
    renderizarVendasRapidas();
    atualizarDashboard();
    renderizarEstoque();

    exibirNota(nota);

    mostrarAlertaVenda(`Venda finalizada! Total: R$ ${total.toFixed(2)}`, 'success');
}

function renderizarVendasRapidas() {
    const tbody = document.getElementById('tabela-vendas-rapidas');
    const vendas = state.vendas.slice(-10).reverse();

    if (vendas.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Nenhuma venda realizada.</td></tr>';
        return;
    }

    tbody.innerHTML = vendas.map(v => `
                <tr>
                    <td>#${v.id}</td>
                    <td>${v.cliente}</td>
                    <td>R$ ${v.total.toFixed(2)}</td>
                    <td>${new Date(v.data).toLocaleDateString('pt-BR')}</td>
                    <td><span class="status-badge status-alto">✅ Finalizada</span></td>
                </tr>
            `).join('');
}

// ============================================================
// NOTAS FISCAIS
// ============================================================
function renderizarNotas() {
    const filtro = document.getElementById('filtro-notas').value.toLowerCase().trim();
    let notas = state.notas;

    if (filtro) {
        notas = notas.filter(n =>
            n.cliente.toLowerCase().includes(filtro) ||
            n.itens.some(i => i.nome.toLowerCase().includes(filtro))
        );
    }

    document.getElementById('qtd-notas').textContent = state.notas.length;

    const container = document.getElementById('lista-notas');

    if (notas.length === 0) {
        container.innerHTML = '<p style="color:#888;">Nenhuma nota fiscal emitida ainda.</p>';
        return;
    }

    container.innerHTML = notas.map((n, index) => `
                <div class="card" style="margin-bottom:12px;padding:16px;cursor:pointer;" onclick="exibirNotaPorIndex(${state.notas.indexOf(n)})">
                    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                        <div>
                            <strong style="color:var(--text-light);">#${n.id}</strong>
                            <span style="color:#888;margin-left:12px;">${new Date(n.data).toLocaleString('pt-BR')}</span>
                        </div>
                        <div>
                            <span style="color:var(--text-light);">Cliente: ${n.cliente}</span>
                            <span style="margin-left:16px;color:var(--primary-light);font-weight:700;">R$ ${n.total.toFixed(2)}</span>
                        </div>
                    </div>
                    <div style="margin-top:8px;color:#888;font-size:0.9rem;">
                        ${n.itens.map(i => `${i.quantidade}x ${i.nome}`).join(' | ')}
                    </div>
                    <div style="margin-top:6px;">
                        <span class="status-badge status-alto">${n.pagamento}</span>
                        <button class="btn btn-info btn-sm" onclick="event.stopPropagation();exibirNotaPorIndex(${state.notas.indexOf(n)})">👁️ Ver</button>
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();gerarPDFNotaPorIndex(${state.notas.indexOf(n)})">📄 PDF</button>
                    </div>
                </div>
            `).join('');
}

function exibirNotaPorIndex(index) {
    const nota = state.notas[index];
    if (!nota) return;
    exibirNota(nota);
}

let notaAtualExibindo = null;

function exibirNota(nota) {
    notaAtualExibindo = nota;
    const container = document.getElementById('conteudo-nota');

    let texto = `══════════════════════════════════════════════════\n`;
    texto += `              NOTA FISCAL #${nota.id}\n`;
    texto += `══════════════════════════════════════════════════\n`;
    texto += `Data: ${new Date(nota.data).toLocaleString('pt-BR')}\n`;
    texto += `Cliente: ${nota.cliente}\n`;
    texto += `Pagamento: ${nota.pagamento}\n`;
    texto += `──────────────────────────────────────────────────\n`;
    texto += `ITENS:\n`;
    nota.itens.forEach(i => {
        texto += `  ${i.quantidade}x ${i.nome} - R$ ${i.subtotal.toFixed(2)}\n`;
    });
    texto += `──────────────────────────────────────────────────\n`;
    texto += `TOTAL: R$ ${nota.total.toFixed(2)}\n`;
    texto += `══════════════════════════════════════════════════\n`;

    container.textContent = texto;
    document.getElementById('modalNota').classList.add('active');
}

function fecharModalNota() {
    document.getElementById('modalNota').classList.remove('active');
    notaAtualExibindo = null;
}

function imprimirNota() {
    const conteudo = document.getElementById('conteudo-nota').textContent;
    const win = window.open('', '_blank');
    win.document.write(`
                <html><head><title>Nota Fiscal</title>
                <style>body { background:#1a1a2e; color:#e0e0e0; font-family:monospace; padding:40px; white-space:pre-wrap; }
                </style></head>
                <body>${conteudo}</body></html>
            `);
    win.document.close();
    win.print();
}

// ============================================================
// NOTA FISCAL EM PDF
// ============================================================
function gerarPDFNota() {
    if (!notaAtualExibindo) {
        mostrarAlerta('Nenhuma nota selecionada!', 'danger');
        return;
    }
    gerarPDFNotaPorIndex(state.notas.indexOf(notaAtualExibindo));
}

function gerarPDFNotaPorIndex(index) {
    const nota = state.notas[index];
    if (!nota) return;

    const element = document.createElement('div');
    element.style.cssText = `
                background: white;
                color: black;
                padding: 40px;
                font-family: monospace;
                font-size: 14px;
                max-width: 800px;
                margin: 0 auto;
                white-space: pre-wrap;
                line-height: 1.6;
            `;

    let texto = `══════════════════════════════════════════════════\n`;
    texto += `              NOTA FISCAL #${nota.id}\n`;
    texto += `══════════════════════════════════════════════════\n\n`;
    texto += `Data: ${new Date(nota.data).toLocaleString('pt-BR')}\n`;
    texto += `Cliente: ${nota.cliente}\n`;
    texto += `Pagamento: ${nota.pagamento}\n`;
    texto += `──────────────────────────────────────────────────\n\n`;
    texto += `ITENS:\n\n`;
    nota.itens.forEach(i => {
        texto += `  ${i.quantidade}x ${i.nome} - R$ ${i.subtotal.toFixed(2)}\n`;
    });
    texto += `\n──────────────────────────────────────────────────\n`;
    texto += `TOTAL: R$ ${nota.total.toFixed(2)}\n`;
    texto += `\n══════════════════════════════════════════════════\n`;
    texto += `       Obrigado pela preferência!\n`;
    texto += `══════════════════════════════════════════════════\n`;

    element.textContent = texto;

    const opt = {
        margin: 1,
        filename: `nota_fiscal_${nota.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, letterRendering: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
}

function baixarNotaTXT() {
    if (!notaAtualExibindo) return;
    const conteudo = document.getElementById('conteudo-nota').textContent;
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nota_fiscal_${notaAtualExibindo.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
// RELATÓRIOS
// ============================================================
function gerarRelatorio(tipo) {
    const filtroData = document.getElementById('filtro-data');
    const resultado = document.getElementById('relatorio-resultado');
    const agora = new Date();
    let inicio = new Date();
    let fim = new Date();

    if (tipo === 'personalizado') {
        filtroData.style.display = 'block';
        resultado.innerHTML = '<p style="color:#888;">Selecione as datas e clique em "Gerar Relatório".</p>';
        return;
    }

    filtroData.style.display = 'none';

    switch (tipo) {
        case 'semanal':
            inicio = new Date(agora);
            inicio.setDate(agora.getDate() - 7);
            break;
        case 'mensal':
            inicio = new Date(agora);
            inicio.setMonth(agora.getMonth() - 1);
            break;
        case 'anual':
            inicio = new Date(agora);
            inicio.setFullYear(agora.getFullYear() - 1);
            break;
    }

    gerarRelatorioPorPeriodo(inicio, fim, tipo);
}

function gerarRelatorioPersonalizado() {
    const inicio = new Date(document.getElementById('data-inicio').value);
    const fim = new Date(document.getElementById('data-fim').value);

    if (!inicio || !fim || isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
        mostrarAlerta('Selecione as datas corretamente!', 'danger');
        return;
    }

    if (inicio > fim) {
        mostrarAlerta('Data inicial não pode ser maior que a data final!', 'danger');
        return;
    }

    gerarRelatorioPorPeriodo(inicio, fim, 'personalizado');
}

function gerarRelatorioPorPeriodo(inicio, fim, tipo) {
    const resultado = document.getElementById('relatorio-resultado');

    const vendas = state.vendas.filter(v => {
        const data = new Date(v.data);
        return data >= inicio && data <= fim;
    });

    const totalVendas = vendas.length;
    const faturamento = vendas.reduce((acc, v) => acc + v.total, 0);
    const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;

    const produtosVendidos = {};
    vendas.forEach(v => {
        v.itens.forEach(item => {
            if (!produtosVendidos[item.codigo]) {
                produtosVendidos[item.codigo] = {
                    nome: item.nome,
                    quantidade: 0,
                    total: 0
                };
            }
            produtosVendidos[item.codigo].quantidade += item.quantidade;
            produtosVendidos[item.codigo].total += item.subtotal;
        });
    });

    const topProdutos = Object.values(produtosVendidos)
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);

    const periodoLabel = tipo === 'personalizado' 
        ? `${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}`
        : tipo.charAt(0).toUpperCase() + tipo.slice(1);

    let html = `
                <div class="card" style="background:var(--bg-card);border:2px solid var(--primary);">
                    <h3 style="color:var(--text-light);">📊 Relatório ${periodoLabel}</h3>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:16px 0;">
                        <div style="background:var(--bg-input);padding:16px;border-radius:8px;">
                            <strong style="color:#888;">Total de Vendas</strong>
                            <p style="font-size:1.5rem;color:var(--primary-light);">${totalVendas}</p>
                        </div>
                        <div style="background:var(--bg-input);padding:16px;border-radius:8px;">
                            <strong style="color:#888;">Faturamento</strong>
                            <p style="font-size:1.5rem;color:var(--text-light);">R$ ${faturamento.toFixed(2)}</p>
                        </div>
                        <div style="background:var(--bg-input);padding:16px;border-radius:8px;">
                            <strong style="color:#888;">Ticket Médio</strong>
                            <p style="font-size:1.5rem;color:var(--secondary-light);">R$ ${ticketMedio.toFixed(2)}</p>
                        </div>
                    </div>
                    <h4 style="color:var(--text-light);margin:16px 0 8px;">🏆 Produtos Mais Vendidos</h4>
                    ${topProdutos.length > 0 ? `
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">
                            ${topProdutos.map(p => `
                                <div style="background:var(--bg-input);padding:12px;border-radius:8px;">
                                    <strong style="color:var(--text-light);">${p.nome}</strong>
                                    <p style="color:#888;">${p.quantidade} unidades</p>
                                    <p style="color:var(--primary-light);">R$ ${p.total.toFixed(2)}</p>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p style="color:#888;">Nenhum produto vendido neste período.</p>'}
                    <div style="margin-top:16px;">
                        <button class="btn btn-primary btn-sm" onclick="gerarPDFRelatorio(${JSON.stringify(vendas).replace(/"/g, '&quot;')}, '${periodoLabel}')">📄 Gerar PDF</button>
                        <button class="btn btn-secondary btn-sm" onclick="exportarRelatorioCSV(${JSON.stringify(vendas).replace(/"/g, '&quot;')}, '${periodoLabel}')">📊 Exportar CSV</button>
                    </div>
                </div>
            `;

    resultado.innerHTML = html;
}

function gerarPDFRelatorio(vendas, periodo) {
    const element = document.createElement('div');
    element.style.cssText = `
                background: white;
                color: black;
                padding: 40px;
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                line-height: 1.6;
            `;

    let html = `
                <h1 style="text-align:center;">📊 Relatório de Vendas</h1>
                <p style="text-align:center;color:#666;">Período: ${periodo}</p>
                <hr style="margin:20px 0;">
                <h2>Resumo</h2>
                <p><strong>Total de Vendas:</strong> ${vendas.length}</p>
                <p><strong>Faturamento:</strong> R$ ${vendas.reduce((acc, v) => acc + v.total, 0).toFixed(2)}</p>
                <p><strong>Ticket Médio:</strong> R$ ${vendas.length > 0 ? (vendas.reduce((acc, v) => acc + v.total, 0) / vendas.length).toFixed(2) : '0.00'}</p>
                <hr style="margin:20px 0;">
                <h2>Lista de Vendas</h2>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <thead>
                        <tr style="background:#f0f0f0;">
                            <th style="border:1px solid #ddd;padding:8px;text-align:left;">ID</th>
                            <th style="border:1px solid #ddd;padding:8px;text-align:left;">Cliente</th>
                            <th style="border:1px solid #ddd;padding:8px;text-align:left;">Total</th>
                            <th style="border:1px solid #ddd;padding:8px;text-align:left;">Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${vendas.map(v => `
                            <tr>
                                <td style="border:1px solid #ddd;padding:8px;">#${v.id}</td>
                                <td style="border:1px solid #ddd;padding:8px;">${v.cliente}</td>
                                <td style="border:1px solid #ddd;padding:8px;">R$ ${v.total.toFixed(2)}</td>
                                <td style="border:1px solid #ddd;padding:8px;">${new Date(v.data).toLocaleDateString('pt-BR')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <p style="text-align:center;color:#666;margin-top:20px;">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
            `;

    element.innerHTML = html;

    const opt = {
        margin: 1,
        filename: `relatorio_${periodo.replace(/\s/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, letterRendering: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
}

function exportarRelatorioCSV(vendas, periodo) {
    let csv = 'ID,Cliente,Total,Data,Itens\n';
    vendas.forEach(v => {
        const itens = v.itens.map(i => `${i.quantidade}x ${i.nome}`).join('; ');
        csv += `${v.id},"${v.cliente}",${v.total.toFixed(2)},${new Date(v.data).toLocaleDateString('pt-BR')},"${itens}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${periodo.replace(/\s/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
// MARGEM DE LUCRO
// ============================================================

// Dados de margem de lucro (armazenados por produto)
let margensLucro = DB.get('margensLucro', {});

function salvarMargensLucro() {
    DB.set('margensLucro', margensLucro);
}

function carregarProdutosLucro() {
    const select = document.getElementById('lucro-produto');
    const produtos = Object.values(state.produtos);
    
    select.innerHTML = '<option value="">Selecione um produto...</option>';
    produtos.forEach(p => {
        select.innerHTML += `<option value="${p.codigo}">${p.codigo} - ${p.nome}</option>`;
    });
}

function carregarProdutoLucro() {
    const codigo = document.getElementById('lucro-produto').value;
    if (!codigo) {
        document.getElementById('lucro-custo').value = '';
        document.getElementById('lucro-venda').value = '';
        return;
    }
    
    const produto = state.produtos[codigo];
    if (produto) {
        document.getElementById('lucro-venda').value = produto.preco.toFixed(2);
        
        if (margensLucro[codigo]) {
            document.getElementById('lucro-custo').value = margensLucro[codigo].custo.toFixed(2);
            document.getElementById('lucro-qtd').value = margensLucro[codigo].quantidade || 1;
            document.getElementById('lucro-custos').value = margensLucro[codigo].custosOperacionais || 10;
        }
    }
}

function calcularLucro(event) {
    event.preventDefault();
    
    const codigo = document.getElementById('lucro-produto').value;
    const custo = parseFloat(document.getElementById('lucro-custo').value);
    const venda = parseFloat(document.getElementById('lucro-venda').value);
    const quantidade = parseInt(document.getElementById('lucro-qtd').value) || 1;
    const custosOp = parseFloat(document.getElementById('lucro-custos').value) || 0;
    
    if (!codigo) {
        mostrarAlertaLucro('Selecione um produto!', 'danger');
        return;
    }
    
    if (isNaN(custo) || isNaN(venda) || custo <= 0 || venda <= 0) {
        mostrarAlertaLucro('Preencha os preços de compra e venda corretamente!', 'danger');
        return;
    }
    
    if (custo >= venda) {
        mostrarAlertaLucro('Preço de venda deve ser maior que o preço de compra!', 'danger');
        return;
    }
    
    const lucroBrutoUnitario = venda - custo;
    const margemBruta = (lucroBrutoUnitario / venda) * 100;
    
    const custoOpUnitario = venda * (custosOp / 100);
    const lucroLiquidoUnitario = lucroBrutoUnitario - custoOpUnitario;
    const margemLiquida = (lucroLiquidoUnitario / venda) * 100;
    
    const lucroBrutoTotal = lucroBrutoUnitario * quantidade;
    const lucroLiquidoTotal = lucroLiquidoUnitario * quantidade;
    const faturamentoTotal = venda * quantidade;
    const custoTotal = custo * quantidade;
    const custoOpTotal = custoOpUnitario * quantidade;
    
    margensLucro[codigo] = {
        custo: custo,
        venda: venda,
        quantidade: quantidade,
        custosOperacionais: custosOp,
        margemBruta: margemBruta,
        margemLiquida: margemLiquida,
        lucroBrutoUnitario: lucroBrutoUnitario,
        lucroLiquidoUnitario: lucroLiquidoUnitario,
        atualizadoEm: new Date().toISOString()
    };
    salvarMargensLucro();
    
    const sugestoes = gerarSugestoesPreco(custo, custosOp);
    
    const resultado = document.getElementById('resultado-lucro');
    const produto = state.produtos[codigo];
    
    let statusClass = 'status-alto';
    let statusText = 'Excelente';
    if (margemLiquida < 10) {
        statusClass = 'status-baixo';
        statusText = 'Crítico';
    } else if (margemLiquida < 20) {
        statusClass = 'status-medio';
        statusText = 'Baixo';
    } else if (margemLiquida < 35) {
        statusClass = 'status-medio';
        statusText = 'Médio';
    }
    
    resultado.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;">
                <strong style="color:#888;">Produto</strong>
                <p style="color:var(--text-light);font-size:1.1rem;">${produto?.nome || codigo}</p>
            </div>
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;">
                <strong style="color:#888;">Código</strong>
                <p style="color:var(--text-light);font-size:1.1rem;">${codigo}</p>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;">
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;">
                <strong style="color:#888;">Preço de Compra</strong>
                <p style="color:var(--text-light);">R$ ${custo.toFixed(2)}</p>
            </div>
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;">
                <strong style="color:#888;">Preço de Venda</strong>
                <p style="color:var(--text-light);">R$ ${venda.toFixed(2)}</p>
            </div>
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;">
                <strong style="color:#888;">Quantidade (mês)</strong>
                <p style="color:var(--text-light);">${quantidade}</p>
            </div>
        </div>
        <hr style="border-color:var(--border);margin:12px 0;" />
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;border-left:4px solid var(--primary);">
                <strong style="color:#888;">Margem Bruta</strong>
                <p style="color:var(--primary-light);font-size:1.3rem;font-weight:700;">${margemBruta.toFixed(1)}%</p>
                <small style="color:#888;">Lucro bruto: R$ ${lucroBrutoUnitario.toFixed(2)}/un</small>
            </div>
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;border-left:4px solid var(--secondary);">
                <strong style="color:#888;">Margem Líquida</strong>
                <p style="color:var(--secondary-light);font-size:1.3rem;font-weight:700;">${margemLiquida.toFixed(1)}%</p>
                <small style="color:#888;">Lucro líquido: R$ ${lucroLiquidoUnitario.toFixed(2)}/un</small>
            </div>
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;border-left:4px solid var(--info);">
                <strong style="color:#888;">Lucro Total (mês)</strong>
                <p style="color:var(--info-light);font-size:1.3rem;font-weight:700;">R$ ${lucroLiquidoTotal.toFixed(2)}</p>
                <small style="color:#888;">Faturamento: R$ ${faturamentoTotal.toFixed(2)}</small>
            </div>
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;border-left:4px solid ${margemLiquida < 20 ? 'var(--danger)' : 'var(--primary)'};">
                <strong style="color:#888;">Status</strong>
                <p><span class="status-badge ${statusClass}" style="font-size:1rem;padding:4px 16px;">${statusText}</span></p>
                <small style="color:#888;">Custos op: ${custosOp}%</small>
            </div>
        </div>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="salvarMargemNoProduto('${codigo}')">💾 Salvar no Produto</button>
            <button class="btn btn-info btn-sm" onclick="gerarPDFLucro('${codigo}')">📄 Gerar PDF</button>
        </div>
    `;
    
    const sugestaoDiv = document.getElementById('sugestao-precos');
    const produtoNome = produto?.nome || codigo;
    sugestaoDiv.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
            <div style="background:${sugestoes.minimo.margem < 10 ? 'var(--bg-input)' : 'var(--bg-input)'};padding:16px;border-radius:8px;border-left:4px solid var(--danger);">
                <strong style="color:var(--danger-light);">⚠️ Preço Mínimo</strong>
                <p style="font-size:1.4rem;font-weight:700;color:var(--text-light);">R$ ${sugestoes.minimo.preco.toFixed(2)}</p>
                <small style="color:#888;">Margem: ${sugestoes.minimo.margem.toFixed(1)}% (cobre custos)</small>
                <p style="color:#888;font-size:0.8rem;margin-top:4px;">${sugestoes.minimo.descricao}</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:8px;border-left:4px solid var(--secondary);">
                <strong style="color:var(--secondary-light);">📊 Preço Médio</strong>
                <p style="font-size:1.4rem;font-weight:700;color:var(--text-light);">R$ ${sugestoes.medio.preco.toFixed(2)}</p>
                <small style="color:#888;">Margem: ${sugestoes.medio.margem.toFixed(1)}% (mercado)</small>
                <p style="color:#888;font-size:0.8rem;margin-top:4px;">${sugestoes.medio.descricao}</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:8px;border-left:4px solid var(--primary);">
                <strong style="color:var(--primary-light);">⭐ Preço Máximo</strong>
                <p style="font-size:1.4rem;font-weight:700;color:var(--text-light);">R$ ${sugestoes.maximo.preco.toFixed(2)}</p>
                <small style="color:#888;">Margem: ${sugestoes.maximo.margem.toFixed(1)}% (lucro ideal)</small>
                <p style="color:#888;font-size:0.8rem;margin-top:4px;">${sugestoes.maximo.descricao}</p>
            </div>
        </div>
        <div style="margin-top:16px;padding:12px;background:var(--bg-input);border-radius:8px;">
            <strong style="color:var(--text-light);">💡 Recomendação:</strong>
            <span style="color:#888;">${sugestoes.recomendacao}</span>
        </div>
    `;
    
    renderizarTabelaLucro();
    mostrarAlertaLucro(`Margem calculada para "${produtoNome}"!`, 'success');
}

function gerarSugestoesPreco(custo, custosOp) {
    const margemMinima = 10;
    const margemMedia = 30;
    const margemMaxima = 50;
    
    const precoMinimo = custo / (1 - (custosOp / 100) - (margemMinima / 100));
    const precoMedio = custo / (1 - (custosOp / 100) - (margemMedia / 100));
    const precoMaximo = custo / (1 - (custosOp / 100) - (margemMaxima / 100));
    
    return {
        minimo: {
            preco: precoMinimo,
            margem: margemMinima,
            descricao: 'Preço mínimo para não ter prejuízo'
        },
        medio: {
            preco: precoMedio,
            margem: margemMedia,
            descricao: 'Preço médio de mercado'
        },
        maximo: {
            preco: precoMaximo,
            margem: margemMaxima,
            descricao: 'Preço com margem ideal'
        },
        recomendacao: `Sugerimos vender entre R$ ${precoMinimo.toFixed(2)} e R$ ${precoMaximo.toFixed(2)}. O preço médio recomendado é R$ ${precoMedio.toFixed(2)} com margem de ${margemMedia}%.`
    };
}

function salvarMargemNoProduto(codigo) {
    const produto = state.produtos[codigo];
    if (!produto) {
        mostrarAlertaLucro('Produto não encontrado!', 'danger');
        return;
    }
    
    if (!margensLucro[codigo]) {
        mostrarAlertaLucro('Calcule a margem primeiro!', 'danger');
        return;
    }
    
    const margem = margensLucro[codigo];
    state.produtos[codigo].preco = margem.venda;
    salvarEstado();
    renderizarEstoque();
    renderizarTabelaLucro();
    mostrarAlertaLucro(`Preço do produto "${produto.nome}" atualizado para R$ ${margem.venda.toFixed(2)}`, 'success');
}

function renderizarTabelaLucro() {
    const tbody = document.getElementById('tabela-lucro');
    const produtos = Object.values(state.produtos);
    const produtosComMargem = produtos.filter(p => margensLucro[p.codigo]);
    
    document.getElementById('qtd-produtos-lucro').textContent = produtosComMargem.length;
    
    if (produtosComMargem.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Nenhum produto com margem calculada.</td></tr>';
        return;
    }
    
    tbody.innerHTML = produtosComMargem.map(p => {
        const m = margensLucro[p.codigo];
        const margem = m.margemLiquida || 0;
        
        let statusClass = 'status-alto';
        let statusText = 'Excelente';
        if (margem < 10) {
            statusClass = 'status-baixo';
            statusText = 'Crítico';
        } else if (margem < 20) {
            statusClass = 'status-medio';
            statusText = 'Baixo';
        } else if (margem < 35) {
            statusClass = 'status-medio';
            statusText = 'Médio';
        }
        
        return `
            <tr>
                <td><strong>${p.codigo}</strong></td>
                <td>${p.nome}</td>
                <td>R$ ${p.preco.toFixed(2)}</td>
                <td>R$ ${m.custo.toFixed(2)}</td>
                <td style="font-weight:700;color:${margem < 20 ? 'var(--danger-light)' : margem < 35 ? 'var(--secondary-light)' : 'var(--primary-light)'};">${margem.toFixed(1)}%</td>
                <td>R$ ${m.lucroLiquidoUnitario?.toFixed(2) || (p.preco - m.custo).toFixed(2)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

function limparFormLucro() {
    document.getElementById('lucro-produto').value = '';
    document.getElementById('lucro-custo').value = '';
    document.getElementById('lucro-venda').value = '';
    document.getElementById('lucro-qtd').value = '1';
    document.getElementById('lucro-custos').value = '10';
    document.getElementById('resultado-lucro').innerHTML = '<p style="color:#888;">Selecione um produto e calcule a margem de lucro.</p>';
    document.getElementById('sugestao-precos').innerHTML = '<p style="color:#888;">Calcule a margem de um produto para ver as sugestões de preço.</p>';
    document.getElementById('alertLucro').classList.remove('show');
}

function gerarPDFLucro(codigo) {
    const produto = state.produtos[codigo];
    const margem = margensLucro[codigo];
    if (!produto || !margem) {
        mostrarAlertaLucro('Produto ou margem não encontrados!', 'danger');
        return;
    }
    
    const sugestoes = gerarSugestoesPreco(margem.custo, margem.custosOperacionais);
    
    const element = document.createElement('div');
    element.style.cssText = `
        background: white;
        color: black;
        padding: 40px;
        font-family: Arial, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        line-height: 1.6;
    `;
    
    element.innerHTML = `
        <h1 style="text-align:center;color:#2E7D32;">📊 Análise de Margem de Lucro</h1>
        <p style="text-align:center;color:#666;">${produto.nome} (${codigo})</p>
        <hr style="margin:20px 0;">
        <h2>Resumo</h2>
        <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Preço de Compra</strong></td><td style="padding:8px;border:1px solid #ddd;">R$ ${margem.custo.toFixed(2)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Preço de Venda</strong></td><td style="padding:8px;border:1px solid #ddd;">R$ ${margem.venda.toFixed(2)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Margem Bruta</strong></td><td style="padding:8px;border:1px solid #ddd;">${margem.margemBruta.toFixed(1)}%</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Margem Líquida</strong></td><td style="padding:8px;border:1px solid #ddd;">${margem.margemLiquida.toFixed(1)}%</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Lucro Unitário</strong></td><td style="padding:8px;border:1px solid #ddd;">R$ ${margem.lucroLiquidoUnitario.toFixed(2)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Lucro Mensal (${margem.quantidade} un)</strong></td><td style="padding:8px;border:1px solid #ddd;">R$ ${(margem.lucroLiquidoUnitario * margem.quantidade).toFixed(2)}</td></tr>
        </table>
        <hr style="margin:20px 0;">
        <h2>Sugestão de Preços</h2>
        <table style="width:100%;border-collapse:collapse;">
            <tr style="background:#f0f0f0;">
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Tipo</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Preço</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Margem</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Descrição</th>
            </tr>
            <tr>
                <td style="padding:8px;border:1px solid #ddd;">⚠️ Mínimo</td>
                <td style="padding:8px;border:1px solid #ddd;">R$ ${sugestoes.minimo.preco.toFixed(2)}</td>
                <td style="padding:8px;border:1px solid #ddd;">${sugestoes.minimo.margem.toFixed(1)}%</td>
                <td style="padding:8px;border:1px solid #ddd;">${sugestoes.minimo.descricao}</td>
            </tr>
            <tr>
                <td style="padding:8px;border:1px solid #ddd;">📊 Médio</td>
                <td style="padding:8px;border:1px solid #ddd;">R$ ${sugestoes.medio.preco.toFixed(2)}</td>
                <td style="padding:8px;border:1px solid #ddd;">${sugestoes.medio.margem.toFixed(1)}%</td>
                <td style="padding:8px;border:1px solid #ddd;">${sugestoes.medio.descricao}</td>
            </tr>
            <tr>
                <td style="padding:8px;border:1px solid #ddd;">⭐ Máximo</td>
                <td style="padding:8px;border:1px solid #ddd;">R$ ${sugestoes.maximo.preco.toFixed(2)}</td>
                <td style="padding:8px;border:1px solid #ddd;">${sugestoes.maximo.margem.toFixed(1)}%</td>
                <td style="padding:8px;border:1px solid #ddd;">${sugestoes.maximo.descricao}</td>
            </tr>
        </table>
        <p style="margin-top:16px;background:#f5f5f5;padding:12px;border-radius:4px;">
            <strong>💡 Recomendação:</strong> ${sugestoes.recomendacao}
        </p>
        <hr style="margin:20px 0;">
        <p style="text-align:center;color:#666;font-size:12px;">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    `;
    
    const opt = {
        margin: 1,
        filename: `analise_lucro_${codigo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, letterRendering: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
}

// ============================================================
// QR CODE / BARCODE SCANNER
// ============================================================
function abrirScanner(campoId) {
    state.scannerCampoDestino = campoId;
    document.getElementById('modalScanner').classList.add('active');
    document.getElementById('scanner-status').textContent = '🔄 Aguardando permissão da câmera...';
    iniciarScanner();
}

function fecharScanner() {
    document.getElementById('modalScanner').classList.remove('active');
    pararScanner();
    state.scannerCampoDestino = null;
}

let scannerStream = null;
let scannerDetector = null;

async function iniciarScanner() {
    try {
        if (!('BarcodeDetector' in window)) {
            document.getElementById('scanner-status').textContent = '❌ Seu navegador não suporta leitura de código. Use Chrome/Edge atualizado.';
            return;
        }

        const video = document.getElementById('scanner-video');

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        scannerStream = stream;
        video.srcObject = stream;
        await video.play();

        document.getElementById('scanner-status').textContent = '📷 Câmera ativa. Aponte para um código...';

        scannerDetector = new BarcodeDetector({
            formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'codabar', 'upc_a', 'upc_e']
        });

        detectarCodigo();
    } catch (err) {
        console.error('Erro ao iniciar scanner:', err);
        document.getElementById('scanner-status').textContent = `❌ Erro ao acessar câmera: ${err.message}`;
    }
}

let scannerRodando = false;

function detectarCodigo() {
    if (!scannerStream) return;
    scannerRodando = true;

    const video = document.getElementById('scanner-video');

    async function detectar() {
        if (!scannerRodando || !scannerDetector) return;

        try {
            const barcodes = await scannerDetector.detect(video);
            if (barcodes.length > 0) {
                const codigo = barcodes[0].rawValue;
                document.getElementById('scanner-status').textContent = `✅ Código lido: ${codigo}`;

                if (state.scannerCampoDestino) {
                    if (state.scannerCampoDestino === 'prod-codigo') {
                        document.getElementById(state.scannerCampoDestino).value = codigo;
                        const produto = state.produtos[codigo];
                        if (produto) {
                            document.getElementById('prod-nome').value = produto.nome;
                            document.getElementById('prod-preco').value = produto.preco;
                            document.getElementById('prod-qtd').value = produto.quantidade;
                            document.getElementById('edit-codigo').value = produto.codigo;
                            document.getElementById('estoque-title').textContent = '✏️ Editar Produto';
                            document.getElementById('btn-salvar-produto').textContent = '💾 Atualizar';
                            document.getElementById('btn-excluir-produto').style.display = 'inline-block';
                            mostrarAlertaEstoque(`Produto "${produto.nome}" carregado!`, 'success');
                        } else {
                            mostrarAlertaEstoque('Produto não encontrado. Cadastre-o!', 'warning');
                        }
                    }
                    
                    if (state.scannerCampoDestino === 'venda-busca' || state.scannerCampoDestino === 'venda-codigo-scanner') {
                        document.getElementById('venda-busca').value = codigo;
                        const produto = state.produtos[codigo];
                        if (produto) {
                            adicionarItemVenda();
                        } else {
                            const produtos = Object.values(state.produtos);
                            const encontrado = produtos.find(p => 
                                p.nome.toLowerCase().includes(codigo.toLowerCase())
                            );
                            if (encontrado) {
                                document.getElementById('venda-busca').value = encontrado.codigo;
                                adicionarItemVenda();
                            } else {
                                mostrarAlertaVenda('Produto não encontrado!', 'danger');
                            }
                        }
                    }
                }

                setTimeout(() => {
                    fecharScanner();
                }, 1500);
                return;
            }

            requestAnimationFrame(detectar);
        } catch (err) {
            console.error('Erro na detecção:', err);
            requestAnimationFrame(detectar);
        }
    }

    detectar();
}

function pararScanner() {
    scannerRodando = false;
    if (scannerStream) {
        scannerStream.getTracks().forEach(track => track.stop());
        scannerStream = null;
    }
    scannerDetector = null;
    const video = document.getElementById('scanner-video');
    video.srcObject = null;
}

// ============================================================
// EXPORTAÇÃO DE DADOS
// ============================================================
function exportarDados() {
    const dados = {
        produtos: state.produtos,
        notas: state.notas,
        vendas: state.vendas,
        margensLucro: margensLucro,
        exportadoEm: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mercadinho_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    mostrarAlerta('Dados exportados com sucesso!', 'success');
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
function init() {
    if (Object.keys(state.produtos).length === 0) {
        const exemplos = [
            { codigo: '7891234567890', nome: 'Arroz 5kg', preco: 22.90, quantidade: 30 },
            { codigo: '7899876543210', nome: 'Feijão 1kg', preco: 8.50, quantidade: 25 },
            { codigo: '1234567890123', nome: 'Óleo de Soja 900ml', preco: 9.99, quantidade: 15 },
            { codigo: '4567890123456', nome: 'Leite UHT 1L', preco: 4.79, quantidade: 40 },
            { codigo: '7890123456789', nome: 'Café 500g', preco: 14.50, quantidade: 4 },
            { codigo: '3210987654321', nome: 'Açúcar 5kg', preco: 18.90, quantidade: 8 },
            { codigo: '6543210987654', nome: 'Farinha de Trigo 1kg', preco: 4.20, quantidade: 12 },
        ];
        exemplos.forEach(p => {
            state.produtos[p.codigo] = p;
        });
        salvarEstado();
        console.log('✅ Produtos de exemplo adicionados!');
    }

    // Carregar margens de lucro
    margensLucro = DB.get('margensLucro', {});

    document.getElementById('filtro-estoque').addEventListener('input', renderizarEstoque);
    document.getElementById('filtro-notas').addEventListener('input', renderizarNotas);
    document.getElementById('venda-pagamento').addEventListener('change', calcularTrocoJuros);

    atualizarDashboard();
    renderizarEstoque();
    renderizarVendasRapidas();
    renderizarNotas();
    renderizarCarrinho();
    carregarProdutosLucro();
    renderizarTabelaLucro();

    console.log('🚀 Sistema de Mercadinho Melhorado iniciado!');
    console.log('📊 Aba "Margem de Lucro" disponível!');
}

document.addEventListener('DOMContentLoaded', init);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        fecharModalNota();
        fecharScanner();
    }
});

document.getElementById('modalNota').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) fecharModalNota();
});
document.getElementById('modalScanner').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) fecharScanner();
});

console.log('✅ Scripts carregados com sucesso!');