/**
 * ============================================================
 * SISTEMA DE MERCADINHO - MULTI-ESTABELECIMENTO
 * Versão 2.4 - Com Cadastro de Proprietário e Aprovação
 * ============================================================
 */

// ============================================================
// MÓDULO 1: BANCO DE DADOS
// ============================================================
const Database = {
    get(key, defaultValue = {}) {
        try {
            const data = localStorage.getItem('mercadinho_' + key);
            return data ? JSON.parse(data) : defaultValue;
        } catch { return defaultValue; }
    },
    set(key, value) {
        localStorage.setItem('mercadinho_' + key, JSON.stringify(value));
    }
};

// ============================================================
// MÓDULO 2: AUTENTICAÇÃO
// ============================================================
const Auth = {
    estabelecimentos: Database.get('estabelecimentos', {}),
    dadosEstabelecimentos: Database.get('dadosEstabelecimentos', {}),
    usuarioLogado: null,
    estabelecimentoAtual: null,
    
    // Credenciais do Super Admin
    SUPER_ADMIN: Database.get('superAdmin', { 
        usuario: 'admin_super', 
        senha: 'Super@2024#Secure' 
    }),
    
    hasEstabelecimentos() {
        return Object.keys(this.estabelecimentos).length > 0;
    },
    
    // Criar estabelecimento via proprietário (JÁ APROVADO AUTOMATICAMENTE)
    criarEstabelecimentoProprietario(dados) {
        const id = 'estab_' + Date.now();
        this.estabelecimentos[id] = {
            nome: dados.nome,
            cnpj: dados.cnpj || '',
            endereco: dados.endereco || '',
            telefone: dados.telefone || '',
            usuarios: {
                [dados.usuario]: { senha: dados.senha, nivel: 'admin' }
            },
            status: 'ativo', // JÁ APROVADO!
            criadoPor: 'proprietario',
            criadoEm: new Date().toISOString(),
            aprovadoEm: new Date().toISOString()
        };
        this.dadosEstabelecimentos[id] = {
            produtos: {},
            notas: [],
            vendas: [],
            ultimoIdNota: 0,
            ultimoIdVenda: 0,
            margensLucro: {}
        };
        
        Database.set('estabelecimentos', this.estabelecimentos);
        Database.set('dadosEstabelecimentos', this.dadosEstabelecimentos);
        return id;
    },
    
    // Criar estabelecimento via Super Admin (já aprovado)
    criarEstabelecimentoAdmin(dados) {
        const id = 'estab_' + Date.now();
        this.estabelecimentos[id] = {
            nome: dados.nome,
            cnpj: dados.cnpj || '',
            endereco: dados.endereco || '',
            telefone: dados.telefone || '',
            usuarios: dados.usuarios || {},
            status: 'ativo',
            criadoPor: 'admin',
            criadoEm: new Date().toISOString(),
            aprovadoEm: new Date().toISOString()
        };
        this.dadosEstabelecimentos[id] = {
            produtos: {},
            notas: [],
            vendas: [],
            ultimoIdNota: 0,
            ultimoIdVenda: 0,
            margensLucro: {}
        };
        
        Database.set('estabelecimentos', this.estabelecimentos);
        Database.set('dadosEstabelecimentos', this.dadosEstabelecimentos);
        return id;
    },
    
    // Aprovar estabelecimento pendente
    aprovarEstabelecimento(id) {
        if (this.estabelecimentos[id] && this.estabelecimentos[id].status === 'pendente') {
            this.estabelecimentos[id].status = 'ativo';
            this.estabelecimentos[id].aprovadoEm = new Date().toISOString();
            Database.set('estabelecimentos', this.estabelecimentos);
            return true;
        }
        return false;
    },
    
    // Rejeitar estabelecimento pendente
    rejeitarEstabelecimento(id) {
        if (this.estabelecimentos[id] && this.estabelecimentos[id].status === 'pendente') {
            delete this.estabelecimentos[id];
            delete this.dadosEstabelecimentos[id];
            Database.set('estabelecimentos', this.estabelecimentos);
            Database.set('dadosEstabelecimentos', this.dadosEstabelecimentos);
            return true;
        }
        return false;
    },
    
    init() {
        const sessao = Database.get('sessao', null);
        if (sessao && sessao.usuario) {
            const user = sessao.usuario;
            if (user.nivel === 'superadmin' && 
                user.usuario === this.SUPER_ADMIN.usuario) {
                this.usuarioLogado = { 
                    usuario: user.usuario, 
                    nivel: 'superadmin' 
                };
                this.estabelecimentoAtual = sessao.estabelecimentoAtual || null;
                return true;
            }
            
            const estabId = sessao.estabelecimentoAtual;
            if (estabId && this.estabelecimentos[estabId] && 
                this.estabelecimentos[estabId].usuarios[user.usuario] &&
                this.estabelecimentos[estabId].status === 'ativo') {
                this.usuarioLogado = {
                    usuario: user.usuario,
                    nivel: this.estabelecimentos[estabId].usuarios[user.usuario].nivel,
                    estabelecimentoId: estabId
                };
                this.estabelecimentoAtual = estabId;
                return true;
            }
        }
        return false;
    },
    
    loginSuperAdmin(usuario, senha) {
        if (usuario === this.SUPER_ADMIN.usuario && 
            senha === this.SUPER_ADMIN.senha) {
            this.usuarioLogado = { 
                usuario: usuario, 
                nivel: 'superadmin' 
            };
            this.estabelecimentoAtual = null;
            Database.set('sessao', { 
                usuario: this.usuarioLogado, 
                estabelecimentoAtual: null 
            });
            return true;
        }
        return false;
    },
    
    loginUser(estabId, usuario, senha) {
        if (!estabId || !this.estabelecimentos[estabId]) return false;
        
        // Verificar se está ativo
        if (this.estabelecimentos[estabId].status !== 'ativo') {
            return false;
        }
        
        if (!this.estabelecimentos[estabId].usuarios[usuario] ||
            this.estabelecimentos[estabId].usuarios[usuario].senha !== senha) {
            return false;
        }
        
        this.usuarioLogado = {
            usuario: usuario,
            nivel: this.estabelecimentos[estabId].usuarios[usuario].nivel,
            estabelecimentoId: estabId
        };
        this.estabelecimentoAtual = estabId;
        Database.set('sessao', { usuario: this.usuarioLogado, estabelecimentoAtual: estabId });
        return true;
    },
    
    logout() {
        this.usuarioLogado = null;
        this.estabelecimentoAtual = null;
        Database.set('sessao', null);
    },
    
    getDados() {
        if (this.isSuperAdmin() && this.estabelecimentoAtual) {
            if (!this.dadosEstabelecimentos[this.estabelecimentoAtual]) {
                this.dadosEstabelecimentos[this.estabelecimentoAtual] = {
                    produtos: {}, notas: [], vendas: [], ultimoIdNota: 0, ultimoIdVenda: 0, margensLucro: {}
                };
            }
            return this.dadosEstabelecimentos[this.estabelecimentoAtual];
        }
        
        if (!this.estabelecimentoAtual) {
            const ids = Object.keys(this.dadosEstabelecimentos);
            if (ids.length > 0) {
                this.estabelecimentoAtual = ids[0];
                return this.dadosEstabelecimentos[ids[0]];
            }
            return { produtos: {}, notas: [], vendas: [], ultimoIdNota: 0, ultimoIdVenda: 0, margensLucro: {} };
        }
        
        if (!this.dadosEstabelecimentos[this.estabelecimentoAtual]) {
            this.dadosEstabelecimentos[this.estabelecimentoAtual] = {
                produtos: {}, notas: [], vendas: [], ultimoIdNota: 0, ultimoIdVenda: 0, margensLucro: {}
            };
        }
        return this.dadosEstabelecimentos[this.estabelecimentoAtual];
    },
    
    salvarDados(dados) {
        if (this.isSuperAdmin() && this.estabelecimentoAtual) {
            this.dadosEstabelecimentos[this.estabelecimentoAtual] = dados;
            Database.set('dadosEstabelecimentos', this.dadosEstabelecimentos);
            return;
        }
        
        if (!this.estabelecimentoAtual) {
            const ids = Object.keys(this.dadosEstabelecimentos);
            if (ids.length > 0) this.estabelecimentoAtual = ids[0];
            else return;
        }
        this.dadosEstabelecimentos[this.estabelecimentoAtual] = dados;
        Database.set('dadosEstabelecimentos', this.dadosEstabelecimentos);
    },
    
    atualizarCredenciaisSuperAdmin(novoUsuario, novaSenha) {
        this.SUPER_ADMIN.usuario = novoUsuario;
        this.SUPER_ADMIN.senha = novaSenha;
        Database.set('superAdmin', this.SUPER_ADMIN);
        
        if (this.isSuperAdmin()) {
            this.usuarioLogado.usuario = novoUsuario;
            Database.set('sessao', { 
                usuario: this.usuarioLogado, 
                estabelecimentoAtual: this.estabelecimentoAtual 
            });
        }
        return true;
    },
    
    // Atualizar dados de um estabelecimento (Super Admin)
    atualizarEstabelecimento(id, dados) {
        if (!this.estabelecimentos[id]) return false;
        
        const estab = this.estabelecimentos[id];
        
        // Atualizar campos básicos
        if (dados.nome) estab.nome = dados.nome;
        if (dados.cnpj !== undefined) estab.cnpj = dados.cnpj;
        if (dados.endereco !== undefined) estab.endereco = dados.endereco;
        if (dados.telefone !== undefined) estab.telefone = dados.telefone;
        if (dados.status) estab.status = dados.status;
        
        // Alterar senha do usuário admin
        if (dados.senha && dados.senha.length >= 6) {
            // Encontrar o usuário admin do estabelecimento
            const adminUser = Object.keys(estab.usuarios).find(u => estab.usuarios[u].nivel === 'admin');
            if (adminUser) {
                estab.usuarios[adminUser].senha = dados.senha;
            }
        }
        
        Database.set('estabelecimentos', this.estabelecimentos);
        return true;
    },
    
    isSuperAdmin() { return this.usuarioLogado?.nivel === 'superadmin'; },
    isAdmin() { return this.usuarioLogado?.nivel === 'admin' || this.isSuperAdmin(); },
    isUsuario() { return this.usuarioLogado?.nivel === 'usuario'; },
    podeEditar() { return this.isSuperAdmin() || this.isAdmin(); }
};

// ============================================================
// MÓDULO 3: ESTADO GLOBAL
// ============================================================
const State = {
    get state() { return Auth.getDados(); },
    set state(dados) { Auth.salvarDados(dados); },
    
    sync() { return Auth.getDados(); },
    save() { Auth.salvarDados(this.state); },
    
    get produtos() { return this.state.produtos || {}; },
    get notas() { return this.state.notas || []; },
    get vendas() { return this.state.vendas || []; },
    get margensLucro() { return this.state.margensLucro || {}; },
    get ultimoIdNota() { return this.state.ultimoIdNota || 0; },
    get ultimoIdVenda() { return this.state.ultimoIdVenda || 0; },
    
    set produtos(v) { this.state.produtos = v; this.save(); },
    set notas(v) { this.state.notas = v; this.save(); },
    set vendas(v) { this.state.vendas = v; this.save(); },
    set margensLucro(v) { this.state.margensLucro = v; this.save(); },
    set ultimoIdNota(v) { this.state.ultimoIdNota = v; this.save(); },
    set ultimoIdVenda(v) { this.state.ultimoIdVenda = v; this.save(); }
};

// ============================================================
// MÓDULO 4: NAVEGAÇÃO
// ============================================================
const Navigation = {
    currentPage: 'dashboard',
    
    goTo(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const el = document.getElementById('page-' + page);
        if (el) el.classList.add('active');
        
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
        if (btn) btn.classList.add('active');
        
        this.currentPage = page;
        this.renderPage(page);
    },
    
    renderPage(page) {
        switch(page) {
            case 'dashboard': renderizarDashboard(); break;
            case 'estoque': renderizarEstoque(); break;
            case 'vendas': renderizarVendasRapidas(); renderizarCarrinho(); break;
            case 'notas': renderizarNotas(); break;
            case 'lucro': carregarProdutosLucro(); renderizarTabelaLucro(); break;
            case 'admin': 
                if (Auth.isSuperAdmin()) {
                    renderizarPendentes();
                    renderizarEstabelecimentos();
                    renderizarUsuarios();
                    carregarSuperAdminEstabelecimentos();
                }
                break;
            case 'config':
                if (Auth.isSuperAdmin()) {
                    carregarConfiguracoes();
                }
                break;
        }
    }
};

// ============================================================
// MÓDULO 5: UI HELPERS
// ============================================================
const UI = {
    showAlert(elementId, message, type = 'info', duration = 4000) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.textContent = message;
        el.className = `alert alert-${type} show`;
        clearTimeout(el._timeout);
        el._timeout = setTimeout(() => el.classList.remove('show'), duration);
    },
    
    showModal(id) {
        document.getElementById(id).classList.add('active');
    },
    
    hideModal(id) {
        document.getElementById(id).classList.remove('active');
    },
    
    updateUserInfo() {
        const isSuperAdmin = Auth.isSuperAdmin();
        const isAdmin = Auth.isAdmin();
        const estab = Auth.estabelecimentoAtual ? Auth.estabelecimentos[Auth.estabelecimentoAtual] : null;
        
        document.getElementById('headerEstabelecimento').textContent = isSuperAdmin ? '🏢 Admin' : estab?.nome || 'Mercadinho';
        document.getElementById('headerUsuario').textContent = Auth.usuarioLogado?.usuario || '';
        document.getElementById('headerEstabNome').textContent = estab?.nome || (isSuperAdmin ? 'Todos os estabelecimentos' : 'Sistema');
        document.getElementById('headerNivel').textContent = isSuperAdmin ? '🌟 Super Admin' : isAdmin ? '👑 Admin' : '👤 Usuário';
        
        const navAdmin = document.getElementById('navAdmin');
        navAdmin.style.display = isSuperAdmin ? 'inline-block' : 'none';
        
        const navConfig = document.getElementById('navConfig');
        navConfig.style.display = isSuperAdmin ? 'inline-block' : 'none';
        
        const selector = document.getElementById('superAdminSelector');
        if (selector) {
            selector.style.display = isSuperAdmin ? 'block' : 'none';
            if (isSuperAdmin) {
                carregarSuperAdminEstabelecimentos();
            }
        }
    },
    
    toggleSetup(show) {
        const setupArea = document.getElementById('setupArea');
        if (setupArea) setupArea.style.display = show ? 'block' : 'none';
    }
};

// ============================================================
// MÓDULO 6: FUNÇÃO PARA MOSTRAR/OCULTAR SENHA
// ============================================================
function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
    } else {
        input.type = 'password';
        button.textContent = '👁️';
    }
}

// ============================================================
// MÓDULO 7: LOGIN TABS
// ============================================================
function switchLoginTab(tab) {
    document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.login-panel').forEach(p => p.classList.remove('active'));
    
    if (tab === 'user') {
        document.getElementById('tabUser').classList.add('active');
        document.getElementById('loginUserPanel').classList.add('active');
    } else if (tab === 'super') {
        document.getElementById('tabSuper').classList.add('active');
        document.getElementById('loginSuperPanel').classList.add('active');
    } else if (tab === 'cadastro') {
        document.getElementById('tabCadastro').classList.add('active');
        document.getElementById('loginCadastroPanel').classList.add('active');
    }
}

// ============================================================
// MÓDULO 8: FUNÇÕES DE LOGIN
// ============================================================

function handleLoginUser(event) {
    event.preventDefault();
    const estabId = document.getElementById('loginEstabelecimento').value;
    const usuario = document.getElementById('loginUsuario').value.trim();
    const senha = document.getElementById('loginSenha').value.trim();
    
    if (!estabId || !usuario || !senha) {
        UI.showAlert('loginAlert', 'Preencha todos os campos!', 'danger');
        return;
    }
    
    const estab = Auth.estabelecimentos[estabId];
    if (estab && estab.status === 'pendente') {
        UI.showAlert('loginAlert', '⏳ Este estabelecimento está aguardando aprovação do Super Admin!', 'warning');
        return;
    }
    
    if (Auth.loginUser(estabId, usuario, senha)) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        UI.updateUserInfo();
        aplicarPermissoes();
        Navigation.goTo('dashboard');
        UI.showAlert('alertGlobal', `Bem-vindo, ${usuario}!`, 'success');
    } else {
        UI.showAlert('loginAlert', 'Usuário, senha inválidos ou estabelecimento inativo!', 'danger');
    }
}

function handleLoginSuper(event) {
    event.preventDefault();
    const usuario = document.getElementById('loginSuperUsuario').value.trim();
    const senha = document.getElementById('loginSuperSenha').value.trim();
    
    if (!usuario || !senha) {
        UI.showAlert('loginAlert', 'Preencha todos os campos!', 'danger');
        return;
    }
    
    if (Auth.loginSuperAdmin(usuario, senha)) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        UI.updateUserInfo();
        aplicarPermissoes();
        Navigation.goTo('admin');
        UI.showAlert('alertGlobal', '🌟 Bem-vindo, Super Admin!', 'success');
    } else {
        UI.showAlert('loginAlert', 'Credenciais do Super Admin inválidas!', 'danger');
    }
}

function handleLogout() {
    if (confirm('Tem certeza que deseja sair?')) {
        Auth.logout();
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('loginSenha').value = '';
        document.getElementById('loginSuperSenha').value = '';
        carregarEstabelecimentosLogin();
        switchLoginTab('user');
        UI.showAlert('loginAlert', 'Logout realizado!', 'info');
    }
}

function navigateTo(page) {
    Navigation.goTo(page);
}

function carregarEstabelecimentosLogin() {
    const select = document.getElementById('loginEstabelecimento');
    const ids = Object.keys(Auth.estabelecimentos);
    
    select.innerHTML = '<option value="">Selecione...</option>';
    ids.forEach(id => {
        const estab = Auth.estabelecimentos[id];
        const statusText = estab.status === 'pendente' ? ' (⏳ Pendente)' : '';
        select.innerHTML += `<option value="${id}">${estab.nome}${statusText}</option>`;
    });
    
    const hasEstab = ids.filter(id => Auth.estabelecimentos[id].status === 'ativo').length > 0;
    UI.toggleSetup(!hasEstab);
    
    if (!hasEstab) {
        document.getElementById('loginUserPanel').style.opacity = '0.5';
        document.getElementById('loginUserPanel').style.pointerEvents = 'none';
    } else {
        document.getElementById('loginUserPanel').style.opacity = '1';
        document.getElementById('loginUserPanel').style.pointerEvents = 'auto';
    }
}

// ============================================================
// MÓDULO 9: CADASTRO DE PROPRIETÁRIO
// ============================================================
function cadastrarEstabelecimentoProprietario(event) {
    event.preventDefault();
    
    const nome = document.getElementById('cadastroNome').value.trim();
    const cnpj = document.getElementById('cadastroCnpj').value.trim();
    const endereco = document.getElementById('cadastroEndereco').value.trim();
    const telefone = document.getElementById('cadastroTelefone').value.trim();
    const usuario = document.getElementById('cadastroUsuario').value.trim();
    const senha = document.getElementById('cadastroSenha').value.trim();
    const confirmarSenha = document.getElementById('cadastroConfirmarSenha').value.trim();
    
    if (!nome) {
        UI.showAlert('loginAlert', 'Digite o nome do estabelecimento!', 'danger');
        return;
    }
    
    if (!usuario) {
        UI.showAlert('loginAlert', 'Digite um nome de usuário!', 'danger');
        return;
    }
    
    if (senha.length < 6) {
        UI.showAlert('loginAlert', 'A senha deve ter pelo menos 6 caracteres!', 'danger');
        return;
    }
    
    if (senha !== confirmarSenha) {
        UI.showAlert('loginAlert', 'As senhas não coincidem!', 'danger');
        return;
    }
    
    // Verificar se já existe um estabelecimento com o mesmo nome ou usuário
    for (const id in Auth.estabelecimentos) {
        const estab = Auth.estabelecimentos[id];
        if (estab.nome.toLowerCase() === nome.toLowerCase()) {
            UI.showAlert('loginAlert', 'Já existe um estabelecimento com este nome!', 'danger');
            return;
        }
        if (estab.usuarios && estab.usuarios[usuario]) {
            UI.showAlert('loginAlert', 'Este usuário já está em uso!', 'danger');
            return;
        }
    }
    
    // Criar estabelecimento (JÁ APROVADO!)
    const id = Auth.criarEstabelecimentoProprietario({
        nome, cnpj, endereco, telefone, usuario, senha
    });
    
    UI.showAlert('loginAlert', 
        `✅ Estabelecimento "${nome}" cadastrado com sucesso!\n\n` +
        `🔑 Você já pode fazer login com suas credenciais.`, 
        'success', 5000
    );
    
    // Limpar formulário
    document.getElementById('cadastroNome').value = '';
    document.getElementById('cadastroCnpj').value = '';
    document.getElementById('cadastroEndereco').value = '';
    document.getElementById('cadastroTelefone').value = '';
    document.getElementById('cadastroUsuario').value = '';
    document.getElementById('cadastroSenha').value = '';
    document.getElementById('cadastroConfirmarSenha').value = '';
    
    // Voltar para aba de login e preencher automaticamente
    switchLoginTab('user');
    carregarEstabelecimentosLogin();
    
    // Selecionar o estabelecimento recém-criado e preencher usuário
    document.getElementById('loginEstabelecimento').value = id;
    document.getElementById('loginUsuario').value = usuario;
    document.getElementById('loginSenha').value = '';
    document.getElementById('loginSenha').focus();
    
    UI.showAlert('loginAlert', `✅ Estabelecimento "${nome}" criado! Faça login para começar.`, 'success');
}

// ============================================================
// MÓDULO 10: PERMISSÕES
// ============================================================
function aplicarPermissoes() {
    const podeEditar = Auth.podeEditar();
    const isUsuario = Auth.isUsuario();
    const isSuperAdmin = Auth.isSuperAdmin();
    
    document.querySelectorAll('.btn-primary, .btn-danger, .btn-secondary, .btn-info').forEach(btn => {
        if (btn.id && btn.id.startsWith('nav-')) return;
        if (btn.closest('.nav-btn')) return;
        if (btn.classList.contains('btn-outline')) return;
        
        if (!podeEditar) {
            btn.classList.add('btn-disabled');
            btn.disabled = true;
        } else {
            btn.classList.remove('btn-disabled');
            btn.disabled = false;
        }
    });
    
    document.querySelectorAll('input, select, textarea').forEach(input => {
        if (input.id && (input.id.startsWith('prod-') || input.id.startsWith('venda-') || 
            input.id.startsWith('lucro-') || input.id === 'editCodigo' ||
            input.id === 'vendaCliente' || input.id === 'vendaPagamento')) {
            if (isUsuario) {
                input.disabled = true;
                input.style.opacity = '0.6';
            } else {
                input.disabled = false;
                input.style.opacity = '1';
            }
        }
    });
}

// ============================================================
// MÓDULO 11: SUPER ADMIN
// ============================================================
function carregarSuperAdminEstabelecimentos() {
    const select = document.getElementById('superAdminEstabelecimento');
    if (!select) return;
    
    const ids = Object.keys(Auth.estabelecimentos).filter(id => 
        Auth.estabelecimentos[id].status === 'ativo'
    );
    select.innerHTML = '<option value="">Selecione um estabelecimento...</option>';
    ids.forEach(id => {
        const e = Auth.estabelecimentos[id];
        const selected = Auth.estabelecimentoAtual === id ? 'selected' : '';
        select.innerHTML += `<option value="${id}" ${selected}>${e.nome}</option>`;
    });
}

function mudarEstabelecimentoSuperAdmin() {
    const select = document.getElementById('superAdminEstabelecimento');
    const estabId = select.value;
    
    Auth.estabelecimentoAtual = estabId || null;
    Database.set('sessao', { 
        usuario: Auth.usuarioLogado, 
        estabelecimentoAtual: Auth.estabelecimentoAtual 
    });
    
    State.sync();
    renderizarDashboard();
    renderizarEstoque();
    renderizarVendasRapidas();
    renderizarNotas();
    carregarProdutosLucro();
    renderizarTabelaLucro();
    
    const estab = estabId ? Auth.estabelecimentos[estabId] : null;
    UI.showAlert('alertGlobal', estab ? `📂 Visualizando: ${estab.nome}` : '📂 Visualizando: Todos os estabelecimentos', 'info');
}

// ============================================================
// MÓDULO 12: ADMIN - PENDENTES
// ============================================================
function renderizarPendentes() {
    const tbody = document.getElementById('tabelaPendentes');
    // Como todos os estabelecimentos são ativos automaticamente, não há pendentes
    const ids = Object.keys(Auth.estabelecimentos).filter(id => 
        Auth.estabelecimentos[id].status === 'pendente'
    );
    
    document.getElementById('qtdPendentes').textContent = ids.length;
    
    if (ids.length === 0) {
        tbody.innerHTML = '<tr class="empty"><td colspan="6">✅ Nenhum estabelecimento pendente. Todos estão ativos!</td></tr>';
        return;
    }
    
    // Mantido para compatibilidade, mas dificilmente será usado
    tbody.innerHTML = ids.map(id => {
        const e = Auth.estabelecimentos[id];
        const adminUser = Object.keys(e.usuarios || {})[0] || '—';
        return `
            <tr>
                <td><strong>${e.nome}</strong></td>
                <td>${e.cnpj || '—'}</td>
                <td>${e.endereco || '—'}</td>
                <td>${e.telefone || '—'}</td>
                <td>${adminUser}</td>
                <td class="actions-cell">
                    <button class="btn btn-aprovar btn-sm" onclick="aprovarEstabelecimento('${id}')">✅ Aprovar</button>
                    <button class="btn btn-rejeitar btn-sm" onclick="rejeitarEstabelecimento('${id}')">❌ Rejeitar</button>
                </td>
            </tr>
        `;
    }).join('');
}

function aprovarEstabelecimento(id) {
    if (!Auth.isSuperAdmin()) {
        UI.showAlert('pendentesAlert', 'Apenas o Super Admin pode aprovar!', 'danger');
        return;
    }
    
    const estab = Auth.estabelecimentos[id];
    if (!estab) return;
    
    if (!confirm(`Aprovar o estabelecimento "${estab.nome}"?`)) return;
    
    if (Auth.aprovarEstabelecimento(id)) {
        renderizarPendentes();
        renderizarEstabelecimentos();
        carregarEstabelecimentosLogin();
        carregarSuperAdminEstabelecimentos();
        UI.showAlert('pendentesAlert', `✅ "${estab.nome}" aprovado com sucesso!`, 'success');
        UI.showAlert('alertGlobal', `🏪 "${estab.nome}" foi aprovado!`, 'success');
    }
}

function rejeitarEstabelecimento(id) {
    if (!Auth.isSuperAdmin()) {
        UI.showAlert('pendentesAlert', 'Apenas o Super Admin pode rejeitar!', 'danger');
        return;
    }
    
    const estab = Auth.estabelecimentos[id];
    if (!estab) return;
    
    if (!confirm(`Rejeitar o estabelecimento "${estab.nome}"? Esta ação será irreversível.`)) return;
    
    if (Auth.rejeitarEstabelecimento(id)) {
        renderizarPendentes();
        renderizarEstabelecimentos();
        carregarEstabelecimentosLogin();
        carregarSuperAdminEstabelecimentos();
        UI.showAlert('pendentesAlert', `❌ "${estab.nome}" rejeitado!`, 'danger');
    }
}

// ============================================================
// MÓDULO 13: ADMIN - ESTABELECIMENTOS
// ============================================================
function cadastrarEstabelecimento(event) {
    event.preventDefault();
    if (!Auth.isSuperAdmin()) {
        UI.showAlert('adminAlert', 'Apenas o Super Admin pode cadastrar estabelecimentos!', 'danger');
        return;
    }
    
    const nome = document.getElementById('estabNome').value.trim();
    const cnpj = document.getElementById('estabCnpj').value.trim();
    const endereco = document.getElementById('estabEndereco').value.trim();
    const telefone = document.getElementById('estabTelefone').value.trim();
    
    if (!nome) {
        UI.showAlert('adminAlert', 'Digite o nome do estabelecimento!', 'danger');
        return;
    }
    
    // Criar com usuário padrão admin
    const usuarios = {
        'admin': { senha: 'admin123', nivel: 'admin' }
    };
    
    Auth.criarEstabelecimentoAdmin({ nome, cnpj, endereco, telefone, usuarios });
    
    document.getElementById('estabNome').value = '';
    document.getElementById('estabCnpj').value = '';
    document.getElementById('estabEndereco').value = '';
    document.getElementById('estabTelefone').value = '';
    
    renderizarEstabelecimentos();
    carregarEstabelecimentosLogin();
    carregarEstabelecimentosUsuarios();
    carregarSuperAdminEstabelecimentos();
    carregarConfiguracoes();
    UI.showAlert('adminAlert', `Estabelecimento "${nome}" cadastrado!`, 'success');
}

function excluirEstabelecimento(id) {
    if (!Auth.isSuperAdmin()) {
        UI.showAlert('adminAlert', 'Apenas o Super Admin pode excluir estabelecimentos!', 'danger');
        return;
    }
    if (!confirm(`Excluir "${Auth.estabelecimentos[id]?.nome}" e todos os dados?`)) return;
    
    delete Auth.estabelecimentos[id];
    delete Auth.dadosEstabelecimentos[id];
    Database.set('estabelecimentos', Auth.estabelecimentos);
    Database.set('dadosEstabelecimentos', Auth.dadosEstabelecimentos);
    
    renderizarEstabelecimentos();
    renderizarPendentes();
    carregarEstabelecimentosLogin();
    carregarEstabelecimentosUsuarios();
    carregarSuperAdminEstabelecimentos();
    carregarConfiguracoes();
    UI.showAlert('adminAlert', 'Estabelecimento excluído!', 'success');
}

function abrirEditarEstabelecimento(id) {
    if (!Auth.isSuperAdmin()) return;
    
    const estab = Auth.estabelecimentos[id];
    if (!estab) return;
    
    const adminUser = Object.keys(estab.usuarios || {}).find(u => estab.usuarios[u].nivel === 'admin') || '';
    
    document.getElementById('editarEstabId').value = id;
    document.getElementById('editarEstabNome').value = estab.nome || '';
    document.getElementById('editarEstabCnpj').value = estab.cnpj || '';
    document.getElementById('editarEstabEndereco').value = estab.endereco || '';
    document.getElementById('editarEstabTelefone').value = estab.telefone || '';
    document.getElementById('editarEstabUsuario').value = adminUser;
    document.getElementById('editarEstabSenha').value = '';
    document.getElementById('editarEstabStatus').value = estab.status || 'ativo';
    
    UI.showModal('modalEditarEstabelecimento');
}

function fecharModalEditarEstabelecimento() {
    UI.hideModal('modalEditarEstabelecimento');
}

function salvarEdicaoEstabelecimento(event) {
    event.preventDefault();
    if (!Auth.isSuperAdmin()) {
        UI.showAlert('editarEstabAlert', 'Apenas o Super Admin pode editar!', 'danger');
        return;
    }
    
    const id = document.getElementById('editarEstabId').value;
    const nome = document.getElementById('editarEstabNome').value.trim();
    const cnpj = document.getElementById('editarEstabCnpj').value.trim();
    const endereco = document.getElementById('editarEstabEndereco').value.trim();
    const telefone = document.getElementById('editarEstabTelefone').value.trim();
    const senha = document.getElementById('editarEstabSenha').value.trim();
    const status = document.getElementById('editarEstabStatus').value;
    
    if (!nome) {
        UI.showAlert('editarEstabAlert', 'Digite o nome do estabelecimento!', 'danger');
        return;
    }
    
    // Se senha for fornecida, deve ter no mínimo 6 caracteres
    if (senha && senha.length < 6) {
        UI.showAlert('editarEstabAlert', 'A senha deve ter pelo menos 6 caracteres!', 'danger');
        return;
    }
    
    const dados = { nome, cnpj, endereco, telefone, status };
    if (senha) dados.senha = senha;
    
    if (Auth.atualizarEstabelecimento(id, dados)) {
        fecharModalEditarEstabelecimento();
        renderizarEstabelecimentos();
        renderizarPendentes();
        carregarEstabelecimentosLogin();
        carregarSuperAdminEstabelecimentos();
        UI.showAlert('adminAlert', '✅ Estabelecimento atualizado com sucesso!', 'success');
    } else {
        UI.showAlert('editarEstabAlert', 'Erro ao atualizar estabelecimento!', 'danger');
    }
}

function renderizarEstabelecimentos() {
    const tbody = document.getElementById('tabelaEstabelecimentos');
    // Mostrar todos os estabelecimentos (ativos e pendentes)
    const ids = Object.keys(Auth.estabelecimentos);
    document.getElementById('qtdEstabelecimentos').textContent = ids.length;
    
    if (ids.length === 0) {
        tbody.innerHTML = '<tr class="empty"><td colspan="6">Nenhum estabelecimento cadastrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = ids.map(id => {
        const e = Auth.estabelecimentos[id];
        const numUsuarios = Object.keys(e.usuarios || {}).length;
        const statusClass = e.status === 'ativo' ? 'badge-ativo' : 'badge-pendente';
        const statusText = e.status === 'ativo' ? '✅ Ativo' : '⏳ Pendente';
        return `
            <tr>
                <td><strong>${e.nome}</strong></td>
                <td>${e.cnpj || '—'}</td>
                <td>${e.endereco || '—'}</td>
                <td>${numUsuarios}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td class="actions-cell">
                    <button class="btn btn-info btn-sm" onclick="abrirEditarEstabelecimento('${id}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirEstabelecimento('${id}')">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================================
// MÓDULO 14: ADMIN - USUÁRIOS
// ============================================================
function cadastrarUsuario(event) {
    event.preventDefault();
    if (!Auth.isSuperAdmin()) {
        UI.showAlert('adminAlert', 'Apenas o Super Admin pode cadastrar usuários!', 'danger');
        return;
    }
    
    const estabId = document.getElementById('userEstabelecimento').value;
    const nome = document.getElementById('userNome').value.trim();
    const senha = document.getElementById('userSenha').value.trim();
    const nivel = document.getElementById('userNivel').value;
    
    if (!estabId || !nome || !senha) {
        UI.showAlert('adminAlert', 'Preencha todos os campos!', 'danger');
        return;
    }
    if (senha.length < 6) {
        UI.showAlert('adminAlert', 'A senha deve ter pelo menos 6 caracteres!', 'danger');
        return;
    }
    if (Auth.estabelecimentos[estabId].usuarios[nome]) {
        UI.showAlert('adminAlert', 'Usuário já existe!', 'danger');
        return;
    }
    
    Auth.estabelecimentos[estabId].usuarios[nome] = { senha, nivel };
    Database.set('estabelecimentos', Auth.estabelecimentos);
    
    document.getElementById('userNome').value = '';
    document.getElementById('userSenha').value = '';
    
    renderizarUsuarios();
    carregarConfiguracoes();
    UI.showAlert('adminAlert', `Usuário "${nome}" cadastrado!`, 'success');
}

function excluirUsuario(estabId, nome) {
    if (!Auth.isSuperAdmin()) {
        UI.showAlert('adminAlert', 'Apenas o Super Admin pode excluir usuários!', 'danger');
        return;
    }
    if (nome === Auth.SUPER_ADMIN.usuario) {
        UI.showAlert('adminAlert', 'Não é possível excluir o Super Admin!', 'danger');
        return;
    }
    if (Auth.usuarioLogado?.usuario === nome && Auth.usuarioLogado?.estabelecimentoId === estabId) {
        UI.showAlert('adminAlert', 'Não é possível excluir seu próprio usuário!', 'danger');
        return;
    }
    if (!confirm(`Excluir usuário "${nome}"?`)) return;
    
    delete Auth.estabelecimentos[estabId].usuarios[nome];
    Database.set('estabelecimentos', Auth.estabelecimentos);
    renderizarUsuarios();
    carregarConfiguracoes();
    UI.showAlert('adminAlert', `Usuário "${nome}" excluído!`, 'success');
}

function renderizarUsuarios() {
    const tbody = document.getElementById('tabelaUsuarios');
    const filtro = document.getElementById('filtroUsuarioEstabelecimento').value;
    
    let usuarios = [];
    Object.keys(Auth.estabelecimentos).forEach(estabId => {
        if (filtro && filtro !== estabId) return;
        const estab = Auth.estabelecimentos[estabId];
        Object.keys(estab.usuarios || {}).forEach(nome => {
            usuarios.push({ nome, estabId, estabNome: estab.nome, nivel: estab.usuarios[nome].nivel });
        });
    });
    
    document.getElementById('qtdUsuarios').textContent = usuarios.length;
    
    if (usuarios.length === 0) {
        tbody.innerHTML = '<tr class="empty"><td colspan="4">Nenhum usuário</td></tr>';
        return;
    }
    
    tbody.innerHTML = usuarios.map(u => {
        const isSuper = u.nome === Auth.SUPER_ADMIN.usuario;
        const isCurrent = u.nome === Auth.usuarioLogado?.usuario && u.estabId === Auth.usuarioLogado?.estabelecimentoId;
        return `
            <tr>
                <td><strong>${u.nome}</strong> ${isCurrent ? ' (você)' : ''}</td>
                <td>${u.estabNome}</td>
                <td><span class="user-badge ${isSuper ? 'superadmin' : u.nivel === 'admin' ? 'admin' : 'usuario'}">${isSuper ? '🌟 Super' : u.nivel === 'admin' ? '👑 Admin' : '👤 Usuário'}</span></td>
                <td>${!isCurrent && !isSuper ? `<button class="btn btn-danger btn-sm" onclick="excluirUsuario('${u.estabId}', '${u.nome}')">🗑️</button>` : '—'}</td>
            </tr>
        `;
    }).join('');
}

function carregarEstabelecimentosUsuarios() {
    const select = document.getElementById('userEstabelecimento');
    const filtro = document.getElementById('filtroUsuarioEstabelecimento');
    
    select.innerHTML = '<option value="">Selecione...</option>';
    filtro.innerHTML = '<option value="">Todos</option>';
    
    Object.keys(Auth.estabelecimentos).forEach(id => {
        const e = Auth.estabelecimentos[id];
        select.innerHTML += `<option value="${id}">${e.nome}</option>`;
        filtro.innerHTML += `<option value="${id}">${e.nome}</option>`;
    });
}

// ============================================================
// MÓDULO 15: CONFIGURAÇÕES DO SUPER ADMIN
// ============================================================
function carregarConfiguracoes() {
    document.getElementById('configUsuarioAtual').textContent = Auth.SUPER_ADMIN.usuario;
    
    const totalEstab = Object.keys(Auth.estabelecimentos).length;
    let totalUsuarios = 0;
    let totalVendas = 0;
    
    Object.keys(Auth.estabelecimentos).forEach(id => {
        const estab = Auth.estabelecimentos[id];
        totalUsuarios += Object.keys(estab.usuarios || {}).length;
        
        const dados = Auth.dadosEstabelecimentos[id];
        if (dados && dados.vendas) {
            totalVendas += dados.vendas.length;
        }
    });
    
    document.getElementById('configQtdEstabelecimentos').textContent = totalEstab;
    document.getElementById('configQtdUsuarios').textContent = totalUsuarios;
    document.getElementById('configQtdVendas').textContent = totalVendas;
}

function alterarCredenciaisSuperAdmin(event) {
    event.preventDefault();
    
    if (!Auth.isSuperAdmin()) {
        UI.showAlert('configAlert', 'Apenas Super Admin pode alterar estas credenciais!', 'danger');
        return;
    }
    
    const novoUsuario = document.getElementById('configNovoUsuario').value.trim();
    const novaSenha = document.getElementById('configNovaSenha').value.trim();
    const confirmarSenha = document.getElementById('configConfirmarSenha').value.trim();
    
    if (!novoUsuario || !novaSenha || !confirmarSenha) {
        UI.showAlert('configAlert', 'Preencha todos os campos!', 'danger');
        return;
    }
    
    if (novaSenha.length < 6) {
        UI.showAlert('configAlert', 'A senha deve ter pelo menos 6 caracteres!', 'danger');
        return;
    }
    
    if (novaSenha !== confirmarSenha) {
        UI.showAlert('configAlert', 'As senhas não coincidem!', 'danger');
        return;
    }
    
    Auth.atualizarCredenciaisSuperAdmin(novoUsuario, novaSenha);
    
    UI.updateUserInfo();
    carregarConfiguracoes();
    limparFormConfig();
    UI.showAlert('configAlert', '✅ Credenciais do Super Admin alteradas com sucesso!', 'success');
    UI.showAlert('alertGlobal', '🔐 Credenciais do Super Admin atualizadas!', 'success');
}

function limparFormConfig() {
    document.getElementById('configNovoUsuario').value = '';
    document.getElementById('configNovaSenha').value = '';
    document.getElementById('configConfirmarSenha').value = '';
}

// ============================================================
// MÓDULO 16: DASHBOARD
// ============================================================
function renderizarDashboard() {
    const state = State.sync();
    const produtos = Object.values(state.produtos);
    const total = produtos.length;
    const baixo = produtos.filter(p => p.quantidade <= 5).length;
    const vendas = state.vendas.length;
    const faturamento = state.vendas.reduce((acc, v) => acc + v.total, 0);

    document.getElementById('statProdutos').textContent = total;
    document.getElementById('statEstoqueBaixo').textContent = baixo;
    document.getElementById('statVendas').textContent = vendas;
    document.getElementById('statFaturamento').textContent = `R$ ${faturamento.toFixed(2)}`;

    const alertasDiv = document.getElementById('alertasEstoque');
    const alertas = produtos.filter(p => p.quantidade <= 5);
    if (alertas.length === 0) {
        alertasDiv.innerHTML = '<p style="color:#4CAF50;">✅ Todos os produtos com estoque adequado!</p>';
    } else {
        alertasDiv.innerHTML = alertas.map(p => `
            <p style="color:var(--danger-light);margin:4px 0;">
                ⚠️ <strong>${p.nome}</strong> - Estoque: <strong>${p.quantidade}</strong> unidades
                ${p.quantidade === 0 ? ' (ESGOTADO!)' : ''}
            </p>
        `).join('');
    }

    const tbody = document.getElementById('ultimosProdutos');
    const ultimos = produtos.slice(-5).reverse();
    if (ultimos.length === 0) {
        tbody.innerHTML = '<tr class="empty"><td colspan="5">Nenhum produto</td></tr>';
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
// MÓDULO 17: ESTOQUE
// ============================================================
function handleSalvarProduto(event) {
    event.preventDefault();
    if (!Auth.podeEditar()) {
        UI.showAlert('estoqueAlert', 'Apenas administradores podem editar!', 'danger');
        return;
    }
    
    const state = State.sync();
    const codigo = document.getElementById('prodCodigo').value.trim();
    const nome = document.getElementById('prodNome').value.trim();
    const preco = parseFloat(document.getElementById('prodPreco').value);
    const quantidade = parseInt(document.getElementById('prodQtd').value);
    const editCodigo = document.getElementById('editCodigo').value;

    if (!codigo || !nome || isNaN(preco) || isNaN(quantidade)) {
        UI.showAlert('estoqueAlert', 'Preencha todos os campos!', 'danger');
        return;
    }
    if (preco < 0 || quantidade < 0) {
        UI.showAlert('estoqueAlert', 'Valores não podem ser negativos!', 'danger');
        return;
    }

    if (editCodigo && editCodigo !== codigo) delete state.produtos[editCodigo];
    state.produtos[codigo] = { codigo, nome, preco, quantidade };
    Auth.salvarDados(state);
    
    limparFormProduto();
    renderizarEstoque();
    renderizarDashboard();
    UI.showAlert('estoqueAlert', `Produto "${nome}" salvo!`, 'success');
}

function handleExcluirProduto() {
    if (!Auth.podeEditar()) {
        UI.showAlert('estoqueAlert', 'Apenas administradores podem excluir!', 'danger');
        return;
    }
    
    const codigo = document.getElementById('editCodigo').value;
    if (!codigo) return;
    if (!confirm('Excluir este produto?')) return;
    
    const state = State.sync();
    delete state.produtos[codigo];
    delete state.margensLucro[codigo];
    Auth.salvarDados(state);
    
    limparFormProduto();
    renderizarEstoque();
    renderizarDashboard();
    renderizarTabelaLucro();
    UI.showAlert('estoqueAlert', 'Produto excluído!', 'success');
}

function editarProduto(codigo) {
    const state = State.sync();
    const p = state.produtos[codigo];
    if (!p) return;

    document.getElementById('prodCodigo').value = p.codigo;
    document.getElementById('prodNome').value = p.nome;
    document.getElementById('prodPreco').value = p.preco;
    document.getElementById('prodQtd').value = p.quantidade;
    document.getElementById('editCodigo').value = p.codigo;

    document.getElementById('estoqueFormTitle').textContent = '✏️ Editar Produto';
    document.getElementById('btnSalvarProduto').textContent = '💾 Atualizar';
    document.getElementById('btnExcluirProduto').style.display = 'inline-block';
}

function limparFormProduto() {
    document.getElementById('prodCodigo').value = '';
    document.getElementById('prodNome').value = '';
    document.getElementById('prodPreco').value = '';
    document.getElementById('prodQtd').value = '';
    document.getElementById('editCodigo').value = '';
    document.getElementById('estoqueFormTitle').textContent = '➕ Novo Produto';
    document.getElementById('btnSalvarProduto').textContent = '➕ Cadastrar';
    document.getElementById('btnExcluirProduto').style.display = 'none';
}

function renderizarEstoque() {
    const state = State.sync();
    const filtro = document.getElementById('filtroEstoque').value.toLowerCase().trim();
    const produtos = Object.values(state.produtos);
    const filtrados = filtro ? produtos.filter(p => 
        p.codigo.toLowerCase().includes(filtro) || p.nome.toLowerCase().includes(filtro)
    ) : produtos;

    document.getElementById('qtdProdutos').textContent = produtos.length;

    const tbody = document.getElementById('tabelaEstoque');
    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr class="empty"><td colspan="6">Nenhum produto</td></tr>';
        return;
    }

    tbody.innerHTML = filtrados.map(p => `
        <tr>
            <td><strong>${p.codigo}</strong></td>
            <td>${p.nome}</td>
            <td>R$ ${p.preco.toFixed(2)}</td>
            <td class="qtd-display ${p.quantidade <= 5 ? 'qtd-baixa' : p.quantidade <= 20 ? 'qtd-media' : 'qtd-alta'}">${p.quantidade}</td>
            <td><span class="status-badge ${p.quantidade <= 5 ? 'status-baixo' : p.quantidade <= 20 ? 'status-medio' : 'status-alto'}">
                ${p.quantidade <= 5 ? 'Baixo' : p.quantidade <= 20 ? 'Médio' : 'Alto'}
            </span></td>
            <td class="actions-cell">
                <button class="btn btn-info btn-sm" onclick="editarProduto('${p.codigo}')">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="excluirProdutoDireto('${p.codigo}')">🗑️</button>
                <button class="btn btn-secondary btn-sm" onclick="navigateTo('lucro');setTimeout(()=>{document.getElementById('lucroProduto').value='${p.codigo}';carregarProdutoLucro();},300);">📊</button>
            </td>
        </tr>
    `).join('');
}

function excluirProdutoDireto(codigo) {
    if (!Auth.podeEditar()) return;
    if (!confirm('Excluir este produto?')) return;
    
    const state = State.sync();
    delete state.produtos[codigo];
    delete state.margensLucro[codigo];
    Auth.salvarDados(state);
    
    renderizarEstoque();
    renderizarDashboard();
    renderizarTabelaLucro();
    UI.showAlert('estoqueAlert', 'Produto excluído!', 'success');
}

// ============================================================
// MÓDULO 18: VENDAS
// ============================================================
let vendaAtual = { cliente: '', pagamento: 'Dinheiro', itens: [] };

function buscarProdutoVenda(event) {
    const state = State.sync();
    const busca = document.getElementById('vendaBusca').value.trim().toLowerCase();
    const container = document.getElementById('sugestoesProdutos');

    if (!busca || busca.length < 1) {
        container.style.display = 'none';
        return;
    }

    const produtos = Object.values(state.produtos);
    const filtrados = produtos.filter(p =>
        p.nome.toLowerCase().includes(busca) || p.codigo.toLowerCase().includes(busca)
    ).slice(0, 8);

    if (filtrados.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    container.innerHTML = filtrados.map(p =>
        `<div onclick="selecionarProdutoVenda('${p.codigo}')">
            ${p.codigo} - ${p.nome} (R$ ${p.preco.toFixed(2)}) - Estoque: ${p.quantidade}
        </div>`
    ).join('');
}

function selecionarProdutoVenda(codigo) {
    document.getElementById('vendaBusca').value = codigo;
    document.getElementById('sugestoesProdutos').style.display = 'none';
    adicionarItemVenda();
}

function adicionarItemVenda() {
    const state = State.sync();
    const codigoInput = document.getElementById('vendaBusca').value.trim();
    const codigo = codigoInput || document.getElementById('vendaCodigoScanner')?.value?.trim();
    const qtd = parseInt(document.getElementById('vendaQtd').value) || 1;

    if (!codigo) {
        UI.showAlert('vendaAlert', 'Informe o código ou nome do produto.', 'danger');
        return;
    }

    let produto = state.produtos[codigo];
    if (!produto) {
        const encontrado = Object.values(state.produtos).find(p => 
            p.nome.toLowerCase().includes(codigo.toLowerCase())
        );
        if (encontrado) {
            produto = encontrado;
        }
    }

    if (!produto) {
        UI.showAlert('vendaAlert', `Produto "${codigo}" não encontrado!`, 'danger');
        return;
    }

    if (qtd <= 0) {
        UI.showAlert('vendaAlert', 'Quantidade deve ser maior que zero.', 'danger');
        return;
    }

    const existente = vendaAtual.itens.find(i => i.codigo === produto.codigo);
    if (existente) {
        existente.quantidade += qtd;
        existente.subtotal = existente.quantidade * produto.preco;
    } else {
        vendaAtual.itens.push({
            codigo: produto.codigo,
            nome: produto.nome,
            preco: produto.preco,
            quantidade: qtd,
            subtotal: qtd * produto.preco
        });
    }

    document.getElementById('vendaBusca').value = '';
    document.getElementById('vendaCodigoScanner').value = '';
    document.getElementById('vendaQtd').value = '1';
    document.getElementById('sugestoesProdutos').style.display = 'none';
    renderizarCarrinho();
    calcularTrocoJuros();
    UI.showAlert('vendaAlert', `"${produto.nome}" adicionado!`, 'success');
}

function removerItemVenda(index) {
    vendaAtual.itens.splice(index, 1);
    renderizarCarrinho();
    calcularTrocoJuros();
}

function renderizarCarrinho() {
    const tbody = document.getElementById('tabelaVenda');
    const itens = vendaAtual.itens;

    if (itens.length === 0) {
        tbody.innerHTML = '<tr class="empty"><td colspan="4">Nenhum item</td></tr>';
        document.getElementById('vendaTotal').textContent = 'R$ 0,00';
        return;
    }

    let total = 0;
    tbody.innerHTML = itens.map((item, index) => {
        total += item.subtotal;
        return `
            <tr>
                <td>${item.nome}</td>
                <td>${item.quantidade}</td>
                <td>R$ ${item.subtotal.toFixed(2)}</td>
                <td><button class="btn btn-danger btn-sm" onclick="removerItemVenda(${index})">✕</button></td>
            </tr>
        `;
    }).join('');

    document.getElementById('vendaTotal').textContent = `R$ ${total.toFixed(2)}`;
}

function calcularTrocoJuros() {
    const pagamento = document.getElementById('vendaPagamento').value;
    const total = vendaAtual.itens.reduce((acc, i) => acc + i.subtotal, 0);
    const campoJuros = document.getElementById('campoJuros');
    const campoTroco = document.getElementById('campoTroco');

    if (pagamento === 'Cartão Crédito') {
        campoJuros.style.display = 'block';
        const juros = parseFloat(document.getElementById('vendaJuros').value) || 0;
        const totalComJuros = total * (1 + juros / 100);
        document.getElementById('vendaTotal').textContent = `R$ ${totalComJuros.toFixed(2)}`;
    } else {
        campoJuros.style.display = 'none';
        document.getElementById('vendaTotal').textContent = `R$ ${total.toFixed(2)}`;
    }

    if (pagamento === 'Dinheiro') {
        campoTroco.style.display = 'block';
        const recebido = parseFloat(document.getElementById('vendaRecebido').value) || 0;
        const totalFinal = parseFloat(document.getElementById('vendaTotal').textContent.replace('R$ ', '')) || 0;
        const troco = recebido - totalFinal;
        const resultado = document.getElementById('resultadoTroco');
        if (recebido > 0) {
            resultado.innerHTML = troco >= 0 ? `Troco: R$ ${troco.toFixed(2)} ✅` : `Faltam: R$ ${Math.abs(troco).toFixed(2)} ❌`;
            resultado.style.color = troco >= 0 ? 'var(--primary-light)' : 'var(--danger-light)';
        } else {
            resultado.innerHTML = '';
        }
    } else {
        campoTroco.style.display = 'none';
        document.getElementById('resultadoTroco').innerHTML = '';
    }
}

function handleFinalizarVenda(event) {
    event.preventDefault();
    if (!Auth.podeEditar()) {
        UI.showAlert('vendaAlert', 'Apenas administradores podem finalizar vendas!', 'danger');
        return;
    }

    const state = State.sync();
    const cliente = document.getElementById('vendaCliente').value.trim() || 'Cliente não informado';
    const pagamento = document.getElementById('vendaPagamento').value;
    const itens = vendaAtual.itens;

    if (itens.length === 0) {
        UI.showAlert('vendaAlert', 'Adicione pelo menos um item!', 'danger');
        return;
    }

    let total = itens.reduce((acc, i) => acc + i.subtotal, 0);
    if (pagamento === 'Cartão Crédito') {
        const juros = parseFloat(document.getElementById('vendaJuros').value) || 0;
        total = total * (1 + juros / 100);
    }

    state.ultimoIdVenda = (state.ultimoIdVenda || 0) + 1;
    const venda = {
        id: state.ultimoIdVenda, cliente, total, pagamento,
        data: new Date().toISOString(),
        itens: itens.map(i => ({ ...i }))
    };
    state.vendas.push(venda);

    for (const item of itens) {
        if (state.produtos[item.codigo]) {
            state.produtos[item.codigo].quantidade -= item.quantidade;
        }
    }

    state.ultimoIdNota = (state.ultimoIdNota || 0) + 1;
    const nota = {
        id: state.ultimoIdNota, cliente, pagamento, total,
        data: new Date().toISOString(),
        itens: itens.map(i => ({ ...i }))
    };
    state.notas.push(nota);

    Auth.salvarDados(state);
    vendaAtual.itens = [];
    document.getElementById('vendaCliente').value = '';
    document.getElementById('vendaRecebido').value = '';
    document.getElementById('resultadoTroco').innerHTML = '';

    renderizarCarrinho();
    renderizarVendasRapidas();
    renderizarDashboard();
    renderizarEstoque();
    exibirNota(nota);

    UI.showAlert('vendaAlert', `Venda finalizada! Total: R$ ${total.toFixed(2)}`, 'success');
}

function renderizarVendasRapidas() {
    const state = State.sync();
    const tbody = document.getElementById('tabelaVendasRapidas');
    const vendas = state.vendas.slice(-10).reverse();

    if (vendas.length === 0) {
        tbody.innerHTML = '<tr class="empty"><td colspan="4">Nenhuma venda</td></tr>';
        return;
    }

    tbody.innerHTML = vendas.map(v => `
        <tr>
            <td>#${v.id}</td>
            <td>${v.cliente}</td>
            <td>R$ ${v.total.toFixed(2)}</td>
            <td>${new Date(v.data).toLocaleDateString('pt-BR')}</td>
        </tr>
    `).join('');
}

// ============================================================
// MÓDULO 19: NOTAS FISCAIS
// ============================================================
let notaAtualExibindo = null;

function renderizarNotas() {
    const state = State.sync();
    const filtro = document.getElementById('filtroNotas').value.toLowerCase().trim();
    let notas = state.notas;

    if (filtro) {
        notas = notas.filter(n =>
            n.cliente.toLowerCase().includes(filtro) ||
            n.itens.some(i => i.nome.toLowerCase().includes(filtro))
        );
    }

    document.getElementById('qtdNotas').textContent = state.notas.length;

    const container = document.getElementById('listaNotas');
    if (notas.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhuma nota fiscal emitida.</p>';
        return;
    }

    container.innerHTML = notas.map((n, index) => `
        <div class="card" style="margin-bottom:12px;padding:16px;cursor:pointer;" onclick="exibirNotaPorIndex(${state.notas.indexOf(n)})">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <div>
                    <strong>#${n.id}</strong>
                    <span class="text-muted" style="margin-left:12px;">${new Date(n.data).toLocaleString('pt-BR')}</span>
                </div>
                <div>
                    <span>Cliente: ${n.cliente}</span>
                    <span style="margin-left:16px;color:var(--primary-light);font-weight:700;">R$ ${n.total.toFixed(2)}</span>
                </div>
            </div>
            <div style="margin-top:8px;color:var(--text-muted);font-size:0.9rem;">
                ${n.itens.map(i => `${i.quantidade}x ${i.nome}`).join(' | ')}
            </div>
            <div style="margin-top:6px;">
                <span class="status-badge status-alto">${n.pagamento}</span>
                <button class="btn btn-info btn-sm" onclick="event.stopPropagation();exibirNotaPorIndex(${state.notas.indexOf(n)})">👁️</button>
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();gerarPDFNotaPorIndex(${state.notas.indexOf(n)})">📄</button>
            </div>
        </div>
    `).join('');
}

function exibirNotaPorIndex(index) {
    const state = State.sync();
    const nota = state.notas[index];
    if (!nota) return;
    exibirNota(nota);
}

function exibirNota(nota) {
    notaAtualExibindo = nota;
    const container = document.getElementById('conteudoNota');

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
    UI.showModal('modalNota');
}

function fecharModalNota() {
    UI.hideModal('modalNota');
    notaAtualExibindo = null;
}

function imprimirNota() {
    const conteudo = document.getElementById('conteudoNota').textContent;
    const win = window.open('', '_blank');
    win.document.write(`
        <html><head><title>Nota Fiscal</title>
        <style>body { background:#1a1a2e; color:#e0e0e0; font-family:monospace; padding:40px; white-space:pre-wrap; }</style>
        </head><body>${conteudo}</body></html>
    `);
    win.document.close();
    win.print();
}

function gerarPDFNota() {
    if (!notaAtualExibindo) return;
    const state = State.sync();
    gerarPDFNotaPorIndex(state.notas.indexOf(notaAtualExibindo));
}

function gerarPDFNotaPorIndex(index) {
    const state = State.sync();
    const nota = state.notas[index];
    if (!nota) return;

    const element = document.createElement('div');
    element.style.cssText = `background:white;color:black;padding:40px;font-family:monospace;font-size:14px;max-width:800px;margin:0 auto;white-space:pre-wrap;line-height:1.6;`;

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

    html2pdf().set({
        margin: 1,
        filename: `nota_fiscal_${nota.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, letterRendering: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    }).from(element).save();
}

function baixarNotaTXT() {
    if (!notaAtualExibindo) return;
    const conteudo = document.getElementById('conteudoNota').textContent;
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nota_fiscal_${notaAtualExibindo.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
// MÓDULO 20: RELATÓRIOS
// ============================================================
function gerarRelatorio(tipo) {
    const filtroData = document.getElementById('filtroData');
    const resultado = document.getElementById('relatorioResultado');
    const agora = new Date();
    let inicio = new Date();

    if (tipo === 'personalizado') {
        filtroData.style.display = 'block';
        resultado.innerHTML = '<p class="text-muted">Selecione as datas e clique em "Gerar Relatório".</p>';
        return;
    }

    filtroData.style.display = 'none';
    const hoje = new Date(agora);

    switch (tipo) {
        case 'semanal': inicio.setDate(hoje.getDate() - 7); break;
        case 'mensal': inicio.setMonth(hoje.getMonth() - 1); break;
        case 'anual': inicio.setFullYear(hoje.getFullYear() - 1); break;
    }

    gerarRelatorioPorPeriodo(inicio, hoje, tipo);
}

function gerarRelatorioPersonalizado() {
    const inicio = new Date(document.getElementById('dataInicio').value);
    const fim = new Date(document.getElementById('dataFim').value);

    if (!inicio || !fim || isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
        UI.showAlert('alertGlobal', 'Selecione as datas corretamente!', 'danger');
        return;
    }
    if (inicio > fim) {
        UI.showAlert('alertGlobal', 'Data inicial não pode ser maior que a final!', 'danger');
        return;
    }

    gerarRelatorioPorPeriodo(inicio, fim, 'personalizado');
}

function gerarRelatorioPorPeriodo(inicio, fim, tipo) {
    const state = State.sync();
    const resultado = document.getElementById('relatorioResultado');

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
                produtosVendidos[item.codigo] = { nome: item.nome, quantidade: 0, total: 0 };
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
        <div class="card" style="border:2px solid var(--primary);">
            <h3 style="color:var(--text-light);">📊 Relatório ${periodoLabel}</h3>
            <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));">
                <div class="stat-card"><div class="stat-info"><span class="stat-value">${totalVendas}</span><span class="stat-label">Vendas</span></div></div>
                <div class="stat-card"><div class="stat-info"><span class="stat-value">R$ ${faturamento.toFixed(2)}</span><span class="stat-label">Faturamento</span></div></div>
                <div class="stat-card"><div class="stat-info"><span class="stat-value">R$ ${ticketMedio.toFixed(2)}</span><span class="stat-label">Ticket Médio</span></div></div>
            </div>
            ${topProdutos.length > 0 ? `
                <h4 style="color:var(--text-light);margin:16px 0 8px;">🏆 Produtos Mais Vendidos</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">
                    ${topProdutos.map(p => `
                        <div style="background:var(--bg-input);padding:12px;border-radius:8px;">
                            <strong>${p.nome}</strong>
                            <p style="color:var(--text-muted);">${p.quantidade} unidades</p>
                            <p style="color:var(--primary-light);">R$ ${p.total.toFixed(2)}</p>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="text-muted">Nenhum produto vendido neste período.</p>'}
        </div>
    `;

    resultado.innerHTML = html;
}

// ============================================================
// MÓDULO 21: MARGEM DE LUCRO
// ============================================================
function carregarProdutosLucro() {
    const state = State.sync();
    const select = document.getElementById('lucroProduto');
    const produtos = Object.values(state.produtos);
    select.innerHTML = '<option value="">Selecione...</option>';
    produtos.forEach(p => {
        select.innerHTML += `<option value="${p.codigo}">${p.codigo} - ${p.nome}</option>`;
    });
}

function carregarProdutoLucro() {
    const state = State.sync();
    const codigo = document.getElementById('lucroProduto').value;
    if (!codigo) {
        document.getElementById('lucroCusto').value = '';
        document.getElementById('lucroVenda').value = '';
        return;
    }
    
    const produto = state.produtos[codigo];
    if (produto) {
        document.getElementById('lucroVenda').value = produto.preco.toFixed(2);
        if (state.margensLucro && state.margensLucro[codigo]) {
            document.getElementById('lucroCusto').value = state.margensLucro[codigo].custo.toFixed(2);
            document.getElementById('lucroQtd').value = state.margensLucro[codigo].quantidade || 1;
            document.getElementById('lucroCustos').value = state.margensLucro[codigo].custosOperacionais || 10;
        }
    }
}

function calcularLucro(event) {
    event.preventDefault();
    if (!Auth.podeEditar()) {
        UI.showAlert('lucroAlert', 'Apenas administradores podem calcular margens!', 'danger');
        return;
    }

    const state = State.sync();
    const codigo = document.getElementById('lucroProduto').value;
    const custo = parseFloat(document.getElementById('lucroCusto').value);
    const venda = parseFloat(document.getElementById('lucroVenda').value);
    const quantidade = parseInt(document.getElementById('lucroQtd').value) || 1;
    const custosOp = parseFloat(document.getElementById('lucroCustos').value) || 0;

    if (!codigo) {
        UI.showAlert('lucroAlert', 'Selecione um produto!', 'danger');
        return;
    }
    if (isNaN(custo) || isNaN(venda) || custo <= 0 || venda <= 0) {
        UI.showAlert('lucroAlert', 'Preencha os preços corretamente!', 'danger');
        return;
    }
    if (custo >= venda) {
        UI.showAlert('lucroAlert', 'Preço de venda deve ser maior que o de compra!', 'danger');
        return;
    }

    const lucroBrutoUnitario = venda - custo;
    const margemBruta = (lucroBrutoUnitario / venda) * 100;
    const custoOpUnitario = venda * (custosOp / 100);
    const lucroLiquidoUnitario = lucroBrutoUnitario - custoOpUnitario;
    const margemLiquida = (lucroLiquidoUnitario / venda) * 100;

    if (!state.margensLucro) state.margensLucro = {};
    state.margensLucro[codigo] = {
        custo, venda, quantidade, custosOperacionais: custosOp,
        margemBruta, margemLiquida,
        lucroBrutoUnitario, lucroLiquidoUnitario,
        atualizadoEm: new Date().toISOString()
    };
    Auth.salvarDados(state);

    const sugestoes = gerarSugestoesPreco(custo, custosOp);
    const produto = state.produtos[codigo];

    let statusClass = 'status-alto', statusText = 'Excelente';
    if (margemLiquida < 10) { statusClass = 'status-baixo'; statusText = 'Crítico'; }
    else if (margemLiquida < 20) { statusClass = 'status-medio'; statusText = 'Baixo'; }
    else if (margemLiquida < 35) { statusClass = 'status-medio'; statusText = 'Médio'; }

    const resultado = document.getElementById('resultadoLucro');
    resultado.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;">
                <strong class="text-muted">Produto</strong>
                <p style="color:var(--text-light);font-size:1.1rem;">${produto?.nome || codigo}</p>
            </div>
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;">
                <strong class="text-muted">Código</strong>
                <p style="color:var(--text-light);font-size:1.1rem;">${codigo}</p>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;">
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;">
                <strong class="text-muted">Compra</strong>
                <p>R$ ${custo.toFixed(2)}</p>
            </div>
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;">
                <strong class="text-muted">Venda</strong>
                <p>R$ ${venda.toFixed(2)}</p>
            </div>
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;">
                <strong class="text-muted">Qtd Mensal</strong>
                <p>${quantidade}</p>
            </div>
        </div>
        <hr style="border-color:var(--border);margin:12px 0;" />
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;border-left:4px solid var(--primary);">
                <strong class="text-muted">Margem Bruta</strong>
                <p style="color:var(--primary-light);font-size:1.3rem;font-weight:700;">${margemBruta.toFixed(1)}%</p>
                <small class="text-muted">Lucro: R$ ${lucroBrutoUnitario.toFixed(2)}/un</small>
            </div>
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;border-left:4px solid var(--secondary);">
                <strong class="text-muted">Margem Líquida</strong>
                <p style="color:var(--secondary-light);font-size:1.3rem;font-weight:700;">${margemLiquida.toFixed(1)}%</p>
                <small class="text-muted">Lucro: R$ ${lucroLiquidoUnitario.toFixed(2)}/un</small>
            </div>
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;border-left:4px solid var(--info);">
                <strong class="text-muted">Lucro Total</strong>
                <p style="color:var(--info-light);font-size:1.3rem;font-weight:700;">R$ ${(lucroLiquidoUnitario * quantidade).toFixed(2)}</p>
                <small class="text-muted">Faturamento: R$ ${(venda * quantidade).toFixed(2)}</small>
            </div>
            <div style="background:var(--bg-input);padding:12px;border-radius:8px;border-left:4px solid ${margemLiquida < 20 ? 'var(--danger)' : 'var(--primary)'};">
                <strong class="text-muted">Status</strong>
                <p><span class="status-badge ${statusClass}" style="font-size:1rem;padding:4px 16px;">${statusText}</span></p>
                <small class="text-muted">Custos: ${custosOp}%</small>
            </div>
        </div>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="salvarMargemNoProduto('${codigo}')">💾 Salvar</button>
            <button class="btn btn-info btn-sm" onclick="gerarPDFLucro('${codigo}')">📄 PDF</button>
        </div>
    `;

    const sugestaoDiv = document.getElementById('sugestaoPrecos');
    sugestaoDiv.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
            <div style="background:var(--bg-input);padding:16px;border-radius:8px;border-left:4px solid var(--danger);">
                <strong style="color:var(--danger-light);">⚠️ Mínimo</strong>
                <p style="font-size:1.4rem;font-weight:700;">R$ ${sugestoes.minimo.preco.toFixed(2)}</p>
                <small class="text-muted">Margem: ${sugestoes.minimo.margem.toFixed(1)}%</small>
                <p style="color:var(--text-muted);font-size:0.8rem;">${sugestoes.minimo.descricao}</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:8px;border-left:4px solid var(--secondary);">
                <strong style="color:var(--secondary-light);">📊 Médio</strong>
                <p style="font-size:1.4rem;font-weight:700;">R$ ${sugestoes.medio.preco.toFixed(2)}</p>
                <small class="text-muted">Margem: ${sugestoes.medio.margem.toFixed(1)}%</small>
                <p style="color:var(--text-muted);font-size:0.8rem;">${sugestoes.medio.descricao}</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:8px;border-left:4px solid var(--primary);">
                <strong style="color:var(--primary-light);">⭐ Máximo</strong>
                <p style="font-size:1.4rem;font-weight:700;">R$ ${sugestoes.maximo.preco.toFixed(2)}</p>
                <small class="text-muted">Margem: ${sugestoes.maximo.margem.toFixed(1)}%</small>
                <p style="color:var(--text-muted);font-size:0.8rem;">${sugestoes.maximo.descricao}</p>
            </div>
        </div>
        <div style="margin-top:16px;padding:12px;background:var(--bg-input);border-radius:8px;">
            <strong>💡 Recomendação:</strong>
            <span class="text-muted">${sugestoes.recomendacao}</span>
        </div>
    `;

    renderizarTabelaLucro();
    UI.showAlert('lucroAlert', 'Margem calculada com sucesso!', 'success');
}

function gerarSugestoesPreco(custo, custosOp) {
    const margemMinima = 10, margemMedia = 30, margemMaxima = 50;
    const precoMinimo = custo / (1 - (custosOp / 100) - (margemMinima / 100));
    const precoMedio = custo / (1 - (custosOp / 100) - (margemMedia / 100));
    const precoMaximo = custo / (1 - (custosOp / 100) - (margemMaxima / 100));

    return {
        minimo: { preco: precoMinimo, margem: margemMinima, descricao: 'Preço mínimo para não ter prejuízo' },
        medio: { preco: precoMedio, margem: margemMedia, descricao: 'Preço médio de mercado' },
        maximo: { preco: precoMaximo, margem: margemMaxima, descricao: 'Preço com margem ideal' },
        recomendacao: `Sugerimos vender entre R$ ${precoMinimo.toFixed(2)} e R$ ${precoMaximo.toFixed(2)}. O preço médio recomendado é R$ ${precoMedio.toFixed(2)} com margem de ${margemMedia}%.`
    };
}

function salvarMargemNoProduto(codigo) {
    if (!Auth.podeEditar()) {
        UI.showAlert('lucroAlert', 'Apenas administradores podem salvar margens!', 'danger');
        return;
    }

    const state = State.sync();
    const produto = state.produtos[codigo];
    if (!produto) {
        UI.showAlert('lucroAlert', 'Produto não encontrado!', 'danger');
        return;
    }
    if (!state.margensLucro || !state.margensLucro[codigo]) {
        UI.showAlert('lucroAlert', 'Calcule a margem primeiro!', 'danger');
        return;
    }

    const margem = state.margensLucro[codigo];
    state.produtos[codigo].preco = margem.venda;
    Auth.salvarDados(state);

    renderizarEstoque();
    renderizarTabelaLucro();
    UI.showAlert('lucroAlert', `Preço do produto "${produto.nome}" atualizado para R$ ${margem.venda.toFixed(2)}`, 'success');
}

function renderizarTabelaLucro() {
    const state = State.sync();
    const tbody = document.getElementById('tabelaLucro');
    const produtos = Object.values(state.produtos);
    const produtosComMargem = produtos.filter(p => state.margensLucro && state.margensLucro[p.codigo]);

    document.getElementById('qtdProdutosLucro').textContent = produtosComMargem.length;

    if (produtosComMargem.length === 0) {
        tbody.innerHTML = '<tr class="empty"><td colspan="6">Nenhum produto com margem</td></tr>';
        return;
    }

    tbody.innerHTML = produtosComMargem.map(p => {
        const m = state.margensLucro[p.codigo];
        const margem = m.margemLiquida || 0;
        let statusClass = 'status-alto', statusText = 'Excelente';
        if (margem < 10) { statusClass = 'status-baixo'; statusText = 'Crítico'; }
        else if (margem < 20) { statusClass = 'status-medio'; statusText = 'Baixo'; }
        else if (margem < 35) { statusClass = 'status-medio'; statusText = 'Médio'; }

        return `
            <tr>
                <td><strong>${p.nome}</strong></td>
                <td>R$ ${p.preco.toFixed(2)}</td>
                <td>R$ ${m.custo.toFixed(2)}</td>
                <td style="font-weight:700;color:${margem < 20 ? 'var(--danger-light)' : margem < 35 ? 'var(--secondary-light)' : 'var(--primary-light)'};">${margem.toFixed(1)}%</td>
                <td>R$ ${(m.lucroLiquidoUnitario || p.preco - m.custo).toFixed(2)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

function limparFormLucro() {
    document.getElementById('lucroProduto').value = '';
    document.getElementById('lucroCusto').value = '';
    document.getElementById('lucroVenda').value = '';
    document.getElementById('lucroQtd').value = '1';
    document.getElementById('lucroCustos').value = '10';
    document.getElementById('resultadoLucro').innerHTML = '<p class="text-muted">Calcule a margem de um produto.</p>';
    document.getElementById('sugestaoPrecos').innerHTML = '<p class="text-muted">Calcule a margem para ver as sugestões.</p>';
}

function gerarPDFLucro(codigo) {
    const state = State.sync();
    const produto = state.produtos[codigo];
    const margem = state.margensLucro ? state.margensLucro[codigo] : null;
    if (!produto || !margem) {
        UI.showAlert('lucroAlert', 'Produto ou margem não encontrados!', 'danger');
        return;
    }

    const sugestoes = gerarSugestoesPreco(margem.custo, margem.custosOperacionais);
    const element = document.createElement('div');
    element.style.cssText = `background:white;color:black;padding:40px;font-family:Arial;max-width:800px;margin:0 auto;line-height:1.6;`;

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
                <th style="padding:8px;border:1px solid #ddd;">Tipo</th>
                <th style="padding:8px;border:1px solid #ddd;">Preço</th>
                <th style="padding:8px;border:1px solid #ddd;">Margem</th>
                <th style="padding:8px;border:1px solid #ddd;">Descrição</th>
            </tr>
            <tr><td>⚠️ Mínimo</td><td>R$ ${sugestoes.minimo.preco.toFixed(2)}</td><td>${sugestoes.minimo.margem.toFixed(1)}%</td><td>${sugestoes.minimo.descricao}</td></tr>
            <tr><td>📊 Médio</td><td>R$ ${sugestoes.medio.preco.toFixed(2)}</td><td>${sugestoes.medio.margem.toFixed(1)}%</td><td>${sugestoes.medio.descricao}</td></tr>
            <tr><td>⭐ Máximo</td><td>R$ ${sugestoes.maximo.preco.toFixed(2)}</td><td>${sugestoes.maximo.margem.toFixed(1)}%</td><td>${sugestoes.maximo.descricao}</td></tr>
        </table>
        <p style="margin-top:16px;background:#f5f5f5;padding:12px;border-radius:4px;">
            <strong>💡 Recomendação:</strong> ${sugestoes.recomendacao}
        </p>
        <p style="text-align:center;color:#666;font-size:12px;">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    `;

    html2pdf().set({
        margin: 1,
        filename: `analise_lucro_${codigo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, letterRendering: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    }).from(element).save();
}

// ============================================================
// MÓDULO 22: SCANNER
// ============================================================
let scannerStream = null;
let scannerDetector = null;
let scannerRodando = false;
let scannerCampoDestino = null;

function openScanner(campoId) {
    scannerCampoDestino = campoId;
    UI.showModal('modalScanner');
    document.getElementById('scannerStatus').textContent = '🔄 Aguardando permissão...';
    iniciarScanner();
}

function fecharScanner() {
    UI.hideModal('modalScanner');
    pararScanner();
    scannerCampoDestino = null;
}

async function iniciarScanner() {
    try {
        if (!('BarcodeDetector' in window)) {
            document.getElementById('scannerStatus').textContent = '❌ Navegador não suporta leitura de código.';
            return;
        }

        const video = document.getElementById('scannerVideo');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        scannerStream = stream;
        video.srcObject = stream;
        await video.play();

        document.getElementById('scannerStatus').textContent = '📷 Aponte para um código...';
        scannerDetector = new BarcodeDetector({
            formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'codabar', 'upc_a', 'upc_e']
        });
        detectarCodigo();
    } catch (err) {
        document.getElementById('scannerStatus').textContent = `❌ Erro: ${err.message}`;
    }
}

function detectarCodigo() {
    if (!scannerStream) return;
    scannerRodando = true;
    const video = document.getElementById('scannerVideo');

    async function detectar() {
        if (!scannerRodando || !scannerDetector) return;
        try {
            const barcodes = await scannerDetector.detect(video);
            if (barcodes.length > 0) {
                const codigo = barcodes[0].rawValue;
                document.getElementById('scannerStatus').textContent = `✅ Código: ${codigo}`;

                if (scannerCampoDestino) {
                    document.getElementById(scannerCampoDestino).value = codigo;
                    
                    if (scannerCampoDestino === 'prodCodigo') {
                        const state = State.sync();
                        const produto = state.produtos[codigo];
                        if (produto) {
                            document.getElementById('prodNome').value = produto.nome;
                            document.getElementById('prodPreco').value = produto.preco;
                            document.getElementById('prodQtd').value = produto.quantidade;
                            document.getElementById('editCodigo').value = produto.codigo;
                            document.getElementById('estoqueFormTitle').textContent = '✏️ Editar Produto';
                            document.getElementById('btnSalvarProduto').textContent = '💾 Atualizar';
                            document.getElementById('btnExcluirProduto').style.display = 'inline-block';
                            UI.showAlert('estoqueAlert', `Produto "${produto.nome}" carregado!`, 'success');
                        } else {
                            UI.showAlert('estoqueAlert', 'Produto não encontrado. Cadastre-o!', 'warning');
                        }
                    }
                    
                    if (scannerCampoDestino === 'vendaBusca') {
                        adicionarItemVenda();
                    }
                }

                setTimeout(fecharScanner, 1500);
                return;
            }
            requestAnimationFrame(detectar);
        } catch (err) {
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
    document.getElementById('scannerVideo').srcObject = null;
}

// ============================================================
// MÓDULO 23: EXPORTAÇÃO
// ============================================================
function exportarDados() {
    if (Auth.isSuperAdmin()) {
        const dados = {
            estabelecimentos: Auth.estabelecimentos,
            dadosEstabelecimentos: Auth.dadosEstabelecimentos,
            superAdmin: { usuario: Auth.SUPER_ADMIN.usuario },
            exportadoEm: new Date().toISOString()
        };
        baixarJSON(dados, `backup_completo_${new Date().toISOString().slice(0,10)}.json`);
        UI.showAlert('alertGlobal', 'Dados completos exportados!', 'success');
    } else {
        const state = State.sync();
        const estab = Auth.estabelecimentoAtual ? Auth.estabelecimentos[Auth.estabelecimentoAtual] : null;
        const dados = {
            estabelecimento: Auth.estabelecimentoAtual,
            nome: estab?.nome || 'Desconhecido',
            dados: state,
            exportadoEm: new Date().toISOString()
        };
        baixarJSON(dados, `backup_${estab?.nome || 'estabelecimento'}_${new Date().toISOString().slice(0,10)}.json`);
        UI.showAlert('alertGlobal', 'Dados exportados!', 'success');
    }
}

function baixarJSON(dados, nome) {
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
// MÓDULO 24: INICIALIZAÇÃO
// ============================================================
function init() {
    if (Auth.init()) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        UI.updateUserInfo();
        aplicarPermissoes();
        
        if (Auth.isSuperAdmin()) {
            Navigation.goTo('admin');
            UI.showAlert('alertGlobal', '🌟 Super Admin - Você tem acesso total ao sistema!', 'success');
        } else {
            const state = State.sync();
            if (Auth.estabelecimentoAtual && Object.keys(state.produtos).length === 0) {
                const exemplos = [
                    { codigo: '7891234567890', nome: 'Arroz 5kg', preco: 22.90, quantidade: 30 },
                    { codigo: '7899876543210', nome: 'Feijão 1kg', preco: 8.50, quantidade: 25 },
                    { codigo: '1234567890123', nome: 'Óleo de Soja 900ml', preco: 9.99, quantidade: 15 },
                    { codigo: '4567890123456', nome: 'Leite UHT 1L', preco: 4.79, quantidade: 40 },
                    { codigo: '7890123456789', nome: 'Café 500g', preco: 14.50, quantidade: 4 },
                    { codigo: '3210987654321', nome: 'Açúcar 5kg', preco: 18.90, quantidade: 8 },
                    { codigo: '6543210987654', nome: 'Farinha de Trigo 1kg', preco: 4.20, quantidade: 12 },
                ];
                exemplos.forEach(p => { state.produtos[p.codigo] = p; });
                Auth.salvarDados(state);
            }
            Navigation.goTo('dashboard');
        }
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        carregarEstabelecimentosLogin();
        switchLoginTab('user');
    }

    document.getElementById('filtroEstoque').addEventListener('input', renderizarEstoque);
    document.getElementById('filtroNotas').addEventListener('input', renderizarNotas);
    document.getElementById('vendaPagamento').addEventListener('change', calcularTrocoJuros);

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

    console.log('🚀 Sistema Multi-Estabelecimento iniciado!');
}

document.addEventListener('DOMContentLoaded', init);