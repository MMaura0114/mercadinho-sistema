/**
 * ============================================================
 * SISTEMA DE MERCADINHO - COMPLETO (JavaScript Puro)
 * ============================================================
 * Funcionalidades:
 * - CRUD de produtos (código, nome, preço, quantidade)
 * - Leitura de QR Code (via câmera)
 * - Vendas com múltiplos itens
 * - Notas fiscais com armazenamento
 * - Alertas de estoque (baixo, médio, alto)
 * - Dashboard com resumo
 * - Exportação de dados
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
// NAVEGAÇÃO ENTRE PÁGINAS
// ============================================================
function navegar(pagina) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pagina).classList.add('active');

    if (pagina === 'dashboard') atualizarDashboard();
    if (pagina === 'estoque') renderizarEstoque();
    if (pagina === 'vendas') renderizarVendasRapidas();
    if (pagina === 'notas') renderizarNotas();

    fecharModalNota();
    fecharScanner();
}

// ============================================================
// ALERTAS GLOBAIS
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

// ============================================================
// DASHBOARD
// ============================================================
function atualizarDashboard() {
    const produtos = Object.values(state.produtos);
    const total = produtos.length;
    const baixo = produtos.filter(p => p.quantidade <= 5).length;
    const vendas = state.vendas.length;
    const notas = state.notas.length;

    document.getElementById('total-produtos').textContent = total;
    document.getElementById('total-baixo').textContent = baixo;
    document.getElementById('total-vendas').textContent = vendas;
    document.getElementById('total-notas').textContent = notas;

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
    salvarEstado();
    limparFormProduto();
    renderizarEstoque();
    atualizarDashboard();
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
    salvarEstado();
    renderizarEstoque();
    atualizarDashboard();
    mostrarAlertaEstoque(`"${p.nome}" removido.`, 'success');
}

// ============================================================
// VENDAS
// ============================================================
function adicionarItemVenda() {
    const codigo = document.getElementById('venda-codigo').value.trim();
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;

    if (!codigo) {
        mostrarAlertaVenda('Informe o código do produto.', 'danger');
        return;
    }

    const produto = state.produtos[codigo];
    if (!produto) {
        mostrarAlertaVenda(`Produto "${codigo}" não encontrado!`, 'danger');
        return;
    }

    if (qtd <= 0) {
        mostrarAlertaVenda('Quantidade deve ser maior que zero.', 'danger');
        return;
    }

    if (qtd > produto.quantidade) {
        mostrarAlertaVenda(`Estoque insuficiente! Disponível: ${produto.quantidade}`, 'danger');
        return;
    }

    const existente = state.vendaAtual.itens.find(i => i.codigo === codigo);
    if (existente) {
        const novaQtd = existente.quantidade + qtd;
        if (novaQtd > produto.quantidade) {
            mostrarAlertaVenda(`Estoque insuficiente! Disponível: ${produto.quantidade}`, 'danger');
            return;
        }
        existente.quantidade = novaQtd;
        existente.subtotal = existente.quantidade * produto.preco;
    } else {
        state.vendaAtual.itens.push({
            codigo: codigo,
            nome: produto.nome,
            preco: produto.preco,
            quantidade: qtd,
            subtotal: qtd * produto.preco
        });
    }

    document.getElementById('venda-codigo').value = '';
    document.getElementById('venda-qtd').value = '1';
    renderizarCarrinho();
    mostrarAlertaVenda(`"${produto.nome}" adicionado!`, 'success');
}

function removerItemVenda(index) {
    state.vendaAtual.itens.splice(index, 1);
    renderizarCarrinho();
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

function finalizarVenda(event) {
    event.preventDefault();

    const cliente = document.getElementById('venda-cliente').value.trim() || 'Cliente não informado';
    const pagamento = document.getElementById('venda-pagamento').value;
    const itens = state.vendaAtual.itens;

    if (itens.length === 0) {
        mostrarAlertaVenda('Adicione pelo menos um item à venda!', 'danger');
        return;
    }

    for (const item of itens) {
        const produto = state.produtos[item.codigo];
        if (!produto) {
            mostrarAlertaVenda(`Produto "${item.codigo}" não encontrado!`, 'danger');
            return;
        }
        if (item.quantidade > produto.quantidade) {
            mostrarAlertaVenda(`Estoque insuficiente para "${produto.nome}"! Disponível: ${produto.quantidade}`, 'danger');
            return;
        }
    }

    let total = itens.reduce((acc, i) => acc + i.subtotal, 0);

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
        state.produtos[item.codigo].quantidade -= item.quantidade;
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

function baixarNota() {
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
// QR CODE SCANNER
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
            document.getElementById('scanner-status').textContent = '❌ Seu navegador não suporta leitura de QR Code. Use um navegador atualizado (Chrome/Edge).';
            return;
        }

        const video = document.getElementById('scanner-video');

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        scannerStream = stream;
        video.srcObject = stream;
        await video.play();

        document.getElementById('scanner-status').textContent = '📷 Câmera ativa. Aponte para um QR Code...';

        scannerDetector = new BarcodeDetector({
            formats: ['qr_code']
        });

        detectarQR();
    } catch (err) {
        console.error('Erro ao iniciar scanner:', err);
        document.getElementById('scanner-status').textContent = `❌ Erro ao acessar câmera: ${err.message}`;
    }
}

let scannerRodando = false;

function detectarQR() {
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
                    document.getElementById(state.scannerCampoDestino).value = codigo;
                    if (state.scannerCampoDestino === 'prod-codigo') {
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
                    if (state.scannerCampoDestino === 'venda-codigo') {
                        const produto = state.produtos[codigo];
                        if (produto) {
                            document.getElementById('venda-codigo').value = codigo;
                            document.getElementById('venda-qtd').value = '1';
                            adicionarItemVenda();
                        } else {
                            mostrarAlertaVenda('Produto não encontrado!', 'danger');
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

    document.getElementById('filtro-estoque').addEventListener('input', renderizarEstoque);
    document.getElementById('filtro-notas').addEventListener('input', renderizarNotas);

    atualizarDashboard();
    renderizarEstoque();
    renderizarVendasRapidas();
    renderizarNotas();
    renderizarCarrinho();

    console.log('🚀 Sistema de Mercadinho iniciado!');
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