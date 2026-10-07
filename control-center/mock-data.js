window.CONTROL_CENTER_MOCK_DATA = {
  meta: {
    schemaVersion: 1,
    generatedAt: "2026-07-25T12:00:00.000Z",
    referenceDate: "2026-07-25",
    dataset: "ROUTflex Control Center Demo",
    fictional: true
  },

  catalogs: {
    modules: [
      {
        key: "Planning",
        slug: "planning",
        name: "ROUTflex Planning",
        description: "Planejamento de demanda, capacidade e rotas em cenários simulados.",
        color: "#7c6df2",
        features: ["scenario-planning", "capacity-forecast", "route-optimization"]
      },
      {
        key: "OPS",
        slug: "ops",
        name: "ROUTflex OPS",
        description: "Operação, monitoramento e gestão de ocorrências em tempo real.",
        color: "#2a9d8f",
        features: ["live-dispatch", "occurrence-center", "sla-monitoring"]
      },
      {
        key: "Palm",
        slug: "palm",
        name: "ROUTflex Palm",
        description: "Execução móvel para equipes, motoristas e operações de campo.",
        color: "#ef8f3c",
        features: ["mobile-routes", "proof-of-delivery", "offline-mode"]
      },
      {
        key: "Sales",
        slug: "sales",
        name: "ROUTflex Sales",
        description: "Gestão comercial, carteira, propostas e inteligência de vendas.",
        color: "#d95b8f",
        features: ["sales-pipeline", "customer-portfolio", "proposal-management"]
      }
    ],
    plans: [
      {
        key: "trial",
        name: "Teste assistido",
        description: "Ambiente temporário para validação guiada.",
        support: "business-hours",
        defaultUserLimit: 5,
        defaultUnitLimit: 1
      },
      {
        key: "starter",
        name: "Starter",
        description: "Operação enxuta com módulos essenciais.",
        support: "business-hours",
        defaultUserLimit: 10,
        defaultUnitLimit: 2
      },
      {
        key: "professional",
        name: "Professional",
        description: "Operação integrada com recursos avançados.",
        support: "priority",
        defaultUserLimit: 30,
        defaultUnitLimit: 8
      },
      {
        key: "enterprise",
        name: "Enterprise",
        description: "Governança ampliada, escala e ambientes dedicados.",
        support: "dedicated",
        defaultUserLimit: 100,
        defaultUnitLimit: 25
      }
    ],
    onboardingSteps: [
      { key: "company_registration", order: 1, label: "Cadastro da empresa", required: true },
      { key: "contract_plan", order: 2, label: "Contrato e plano", required: true },
      { key: "module_definition", order: 3, label: "Definição dos módulos", required: true },
      { key: "admin_creation", order: 4, label: "Criação do administrador", required: true },
      { key: "environment_configuration", order: 5, label: "Configuração de ambiente", required: true },
      { key: "data_preparation", order: 6, label: "Importação e preparação de dados", required: true },
      { key: "validation", order: 7, label: "Validação", required: true },
      { key: "release", order: 8, label: "Liberação", required: true }
    ]
  },

  owner: {
    id: "owner-demo-001",
    name: "Phillips David",
    email: "phillips.david@example.com",
    role: "platform_owner",
    status: "active",
    twoFactor: "enabled",
    lastAccess: "2026-07-25T11:42:00.000Z",
    avatarInitials: "PD"
  },

  companies: [
    {
      id: "cmp-atlas",
      name: "Atlas Logística Demo",
      identifier: "RF-DEMO-001",
      status: "active",
      plan: "enterprise",
      responsible: {
        userId: "usr-atlas-01",
        name: "Helena Duarte",
        email: "helena.duarte@example.com"
      },
      startDate: "2024-02-12",
      lastActivity: "2026-07-25T11:36:00.000Z",
      hosting: {
        model: "dedicated-cloud",
        provider: "ROUTflex Cloud Demo",
        region: "sa-east-1",
        status: "healthy",
        domain: "atlas.control.example.invalid",
        backupFrequency: "6h"
      },
      modules: {
        Planning: {
          active: true,
          activatedAt: "2024-02-20",
          license: "enterprise",
          features: ["scenario-planning", "capacity-forecast", "route-optimization"],
          environment: "env-atlas-prod",
          notes: "Licença corporativa para planejamento nacional.",
          trialEndsAt: null
        },
        OPS: {
          active: true,
          activatedAt: "2024-03-04",
          license: "enterprise",
          features: ["live-dispatch", "occurrence-center", "sla-monitoring"],
          environment: "env-atlas-prod",
          notes: "Operação contínua em todas as unidades demo.",
          trialEndsAt: null
        },
        Palm: {
          active: true,
          activatedAt: "2024-03-18",
          license: "enterprise",
          features: ["mobile-routes", "proof-of-delivery", "offline-mode"],
          environment: "env-atlas-prod",
          notes: "Uso controlado por perfis individuais de campo.",
          trialEndsAt: null
        },
        Sales: {
          active: true,
          activatedAt: "2025-01-13",
          license: "professional",
          features: ["sales-pipeline", "customer-portfolio", "proposal-management"],
          environment: "env-atlas-prod",
          notes: "Entitlement ativo; acesso depende de permissão por usuário.",
          trialEndsAt: null
        }
      },
      limits: [
        { key: "users", label: "Usuários", used: 2, contracted: 100, unit: "usuários" },
        { key: "planningClients", label: "Clientes do Planning", used: 48, contracted: 250, unit: "clientes" },
        { key: "units", label: "Unidades", used: 3, contracted: 25, unit: "unidades" },
        { key: "territories", label: "Territórios", used: 12, contracted: 80, unit: "territórios" },
        { key: "drivers", label: "Motoristas", used: 86, contracted: 400, unit: "motoristas" },
        { key: "storage", label: "Armazenamento", used: 184, contracted: 500, unit: "GB" },
        { key: "integrations", label: "Integrações", used: 7, contracted: 30, unit: "integrações" },
        { key: "concurrentSessions", label: "Sessões simultâneas", used: 2, contracted: 50, unit: "sessões" }
      ],
      units: [
        { id: "unit-atlas-sp", code: "ATL-SP", name: "Unidade São Paulo Demo", city: "São Paulo", state: "SP", status: "active" },
        { id: "unit-atlas-cps", code: "ATL-CPS", name: "Unidade Campinas Demo", city: "Campinas", state: "SP", status: "active" },
        { id: "unit-atlas-cur", code: "ATL-CUR", name: "Unidade Curitiba Demo", city: "Curitiba", state: "PR", status: "active" }
      ],
      alerts: [
        { id: "alert-atlas-01", severity: "info", title: "Revisão trimestral", message: "Revisão de perfis prevista para 30/07.", createdAt: "2026-07-24T14:00:00.000Z", status: "open" }
      ],
      history: [
        { id: "hist-atlas-01", date: "2024-02-12", type: "company", title: "Empresa criada", description: "Cadastro demo aprovado.", actor: "Phillips David" },
        { id: "hist-atlas-02", date: "2025-01-13", type: "license", title: "Sales ativado", description: "Módulo Sales incluído no contrato demo.", actor: "Phillips David" },
        { id: "hist-atlas-03", date: "2026-06-18", type: "plan", title: "Plano renovado", description: "Plano Enterprise renovado em memória demo.", actor: "Phillips David" }
      ]
    },
    {
      id: "cmp-veloz",
      name: "Veloz Distribuição Demo",
      identifier: "RF-DEMO-002",
      status: "onboarding",
      plan: "professional",
      responsible: {
        userId: "usr-veloz-01",
        name: "Bruno Tavares",
        email: "bruno.tavares@example.com"
      },
      startDate: "2026-07-08",
      lastActivity: "2026-07-25T10:18:00.000Z",
      hosting: {
        model: "shared-cloud",
        provider: "ROUTflex Cloud Demo",
        region: "sa-east-1",
        status: "provisioning",
        domain: "veloz.control.example.invalid",
        backupFrequency: "12h"
      },
      modules: {
        Planning: {
          active: true,
          activatedAt: "2026-07-10",
          license: "professional",
          features: ["scenario-planning", "capacity-forecast"],
          environment: "env-veloz-sandbox",
          notes: "Configuração inicial em sandbox.",
          trialEndsAt: null
        },
        OPS: {
          active: true,
          activatedAt: "2026-07-10",
          license: "professional",
          features: ["live-dispatch", "occurrence-center"],
          environment: "env-veloz-sandbox",
          notes: "Aguardando ambiente de produção.",
          trialEndsAt: null
        },
        Palm: {
          active: true,
          activatedAt: "2026-07-15",
          license: "trial",
          features: ["mobile-routes", "proof-of-delivery"],
          environment: "env-veloz-sandbox",
          notes: "Teste assistido para equipe piloto.",
          trialEndsAt: "2026-08-12"
        },
        Sales: {
          active: false,
          activatedAt: null,
          license: "not-contracted",
          features: [],
          environment: null,
          notes: "Módulo não contratado.",
          trialEndsAt: null
        }
      },
      limits: [
        { key: "users", label: "Usuários", used: 2, contracted: 30, unit: "usuários" },
        { key: "planningClients", label: "Clientes do Planning", used: 18, contracted: 100, unit: "clientes" },
        { key: "units", label: "Unidades", used: 2, contracted: 8, unit: "unidades" },
        { key: "territories", label: "Territórios", used: 4, contracted: 20, unit: "territórios" },
        { key: "drivers", label: "Motoristas", used: 22, contracted: 100, unit: "motoristas" },
        { key: "storage", label: "Armazenamento", used: 28, contracted: 200, unit: "GB" },
        { key: "integrations", label: "Integrações", used: 2, contracted: 12, unit: "integrações" },
        { key: "concurrentSessions", label: "Sessões simultâneas", used: 1, contracted: 20, unit: "sessões" }
      ],
      units: [
        { id: "unit-veloz-rio", code: "VLZ-RIO", name: "Unidade Rio Demo", city: "Rio de Janeiro", state: "RJ", status: "active" },
        { id: "unit-veloz-nit", code: "VLZ-NIT", name: "Unidade Niterói Demo", city: "Niterói", state: "RJ", status: "onboarding" }
      ],
      alerts: [
        { id: "alert-veloz-01", severity: "warning", title: "Produção em provisionamento", message: "O ambiente principal ainda não está disponível.", createdAt: "2026-07-25T09:20:00.000Z", status: "open" },
        { id: "alert-veloz-02", severity: "info", title: "Convite pendente", message: "Um administrador ainda não concluiu o primeiro acesso.", createdAt: "2026-07-24T16:12:00.000Z", status: "open" }
      ],
      history: [
        { id: "hist-veloz-01", date: "2026-07-08", type: "company", title: "Onboarding iniciado", description: "Cadastro demo criado para implantação assistida.", actor: "Phillips David" },
        { id: "hist-veloz-02", date: "2026-07-15", type: "license", title: "Trial Palm ativado", description: "Teste de 28 dias iniciado.", actor: "Phillips David" }
      ]
    },
    {
      id: "cmp-nova",
      name: "Nova Rota Foods Demo",
      identifier: "RF-DEMO-003",
      status: "trial",
      plan: "trial",
      responsible: {
        userId: "usr-nova-01",
        name: "Rafael Mendes",
        email: "rafael.mendes@example.com"
      },
      startDate: "2026-07-14",
      lastActivity: "2026-07-25T09:44:00.000Z",
      hosting: {
        model: "trial-cloud",
        provider: "ROUTflex Cloud Demo",
        region: "sa-east-1",
        status: "healthy",
        domain: "nova-rota-trial.control.example.invalid",
        backupFrequency: "24h"
      },
      modules: {
        Planning: {
          active: true,
          activatedAt: "2026-07-14",
          license: "trial",
          features: ["scenario-planning", "route-optimization"],
          environment: "env-nova-trial",
          notes: "Trial focado em planejamento regional.",
          trialEndsAt: "2026-07-29"
        },
        OPS: {
          active: false,
          activatedAt: null,
          license: "not-contracted",
          features: [],
          environment: null,
          notes: "Disponível para expansão do teste.",
          trialEndsAt: null
        },
        Palm: {
          active: false,
          activatedAt: null,
          license: "not-contracted",
          features: [],
          environment: null,
          notes: "Módulo não habilitado no trial atual.",
          trialEndsAt: null
        },
        Sales: {
          active: true,
          activatedAt: "2026-07-14",
          license: "trial",
          features: ["sales-pipeline", "customer-portfolio"],
          environment: "env-nova-trial",
          notes: "Trial expira junto com Planning.",
          trialEndsAt: "2026-07-29"
        }
      },
      limits: [
        { key: "users", label: "Usuários", used: 2, contracted: 5, unit: "usuários" },
        { key: "planningClients", label: "Clientes do Planning", used: 12, contracted: 25, unit: "clientes" },
        { key: "units", label: "Unidades", used: 1, contracted: 1, unit: "unidades" },
        { key: "territories", label: "Territórios", used: 2, contracted: 5, unit: "territórios" },
        { key: "drivers", label: "Motoristas", used: 0, contracted: 0, unit: "motoristas" },
        { key: "storage", label: "Armazenamento", used: 8, contracted: 25, unit: "GB" },
        { key: "integrations", label: "Integrações", used: 1, contracted: 3, unit: "integrações" },
        { key: "concurrentSessions", label: "Sessões simultâneas", used: 2, contracted: 5, unit: "sessões" }
      ],
      units: [
        { id: "unit-nova-bh", code: "NRF-BH", name: "Unidade Belo Horizonte Demo", city: "Belo Horizonte", state: "MG", status: "trial" }
      ],
      alerts: [
        { id: "alert-nova-01", severity: "warning", title: "Trial próximo do fim", message: "O período de teste termina em 29/07/2026.", createdAt: "2026-07-25T08:30:00.000Z", status: "open" }
      ],
      history: [
        { id: "hist-nova-01", date: "2026-07-14", type: "trial", title: "Trial iniciado", description: "Planning e Sales liberados para avaliação.", actor: "Phillips David" },
        { id: "hist-nova-02", date: "2026-07-22", type: "onboarding", title: "Dados demo importados", description: "Carga fictícia validada no ambiente de teste.", actor: "Rafael Mendes" }
      ]
    },
    {
      id: "cmp-horizonte",
      name: "Horizonte Transportes Demo",
      identifier: "RF-DEMO-004",
      status: "attention",
      plan: "professional",
      responsible: {
        userId: "usr-horizonte-01",
        name: "Laura Nascimento",
        email: "laura.nascimento@example.com"
      },
      startDate: "2025-08-04",
      lastActivity: "2026-07-25T10:58:00.000Z",
      hosting: {
        model: "external-database",
        provider: "Infraestrutura externa Demo",
        region: "sa-east-1",
        status: "degraded",
        domain: "horizonte.control.example.invalid",
        backupFrequency: "12h"
      },
      modules: {
        Planning: {
          active: false,
          activatedAt: null,
          license: "not-contracted",
          features: [],
          environment: null,
          notes: "Módulo não contratado.",
          trialEndsAt: null
        },
        OPS: {
          active: true,
          activatedAt: "2025-08-18",
          license: "professional",
          features: ["live-dispatch", "occurrence-center", "sla-monitoring"],
          environment: "env-horizonte-prod",
          notes: "Monitoramento com degradação temporária.",
          trialEndsAt: null
        },
        Palm: {
          active: true,
          activatedAt: "2025-09-02",
          license: "professional",
          features: ["mobile-routes", "proof-of-delivery", "offline-mode"],
          environment: "env-horizonte-prod",
          notes: "Sessões móveis sob revisão de segurança.",
          trialEndsAt: null
        },
        Sales: {
          active: false,
          activatedAt: null,
          license: "not-contracted",
          features: [],
          environment: null,
          notes: "Módulo não contratado.",
          trialEndsAt: null
        }
      },
      limits: [
        { key: "users", label: "Usuários", used: 2, contracted: 30, unit: "usuários" },
        { key: "planningClients", label: "Clientes do Planning", used: 0, contracted: 0, unit: "clientes" },
        { key: "units", label: "Unidades", used: 2, contracted: 8, unit: "unidades" },
        { key: "territories", label: "Territórios", used: 6, contracted: 20, unit: "territórios" },
        { key: "drivers", label: "Motoristas", used: 28, contracted: 80, unit: "motoristas" },
        { key: "storage", label: "Armazenamento", used: 196, contracted: 200, unit: "GB" },
        { key: "integrations", label: "Integrações", used: 7, contracted: 10, unit: "integrações" },
        { key: "concurrentSessions", label: "Sessões simultâneas", used: 1, contracted: 25, unit: "sessões" }
      ],
      units: [
        { id: "unit-horizonte-go", code: "HZN-GO", name: "Unidade Goiânia Demo", city: "Goiânia", state: "GO", status: "active" },
        { id: "unit-horizonte-df", code: "HZN-DF", name: "Unidade Brasília Demo", city: "Brasília", state: "DF", status: "active" }
      ],
      alerts: [
        { id: "alert-horizonte-01", severity: "critical", title: "Ambiente degradado", message: "Fila de sincronização acima do limite demo.", createdAt: "2026-07-25T10:40:00.000Z", status: "open" },
        { id: "alert-horizonte-02", severity: "warning", title: "Tentativas de acesso", message: "Três tentativas fictícias falharam para um usuário bloqueado.", createdAt: "2026-07-25T09:12:00.000Z", status: "investigating" }
      ],
      history: [
        { id: "hist-horizonte-01", date: "2025-08-04", type: "company", title: "Empresa criada", description: "Conta demo Professional ativada.", actor: "Phillips David" },
        { id: "hist-horizonte-02", date: "2026-07-25", type: "environment", title: "Status alterado para atenção", description: "Degradação registrada no ambiente principal.", actor: "Sistema Demo" }
      ]
    },
    {
      id: "cmp-delta",
      name: "Delta Farma Demo",
      identifier: "RF-DEMO-005",
      status: "suspended",
      plan: "enterprise",
      responsible: {
        userId: "usr-delta-01",
        name: "Marta Rezende",
        email: "marta.rezende@example.com"
      },
      startDate: "2023-11-06",
      lastActivity: "2026-07-22T17:20:00.000Z",
      hosting: {
        model: "on-premises",
        provider: "Data center fictício do cliente",
        region: "sa-east-1",
        status: "locked",
        domain: "delta.control.example.invalid",
        backupFrequency: "6h"
      },
      modules: {
        Planning: {
          active: true,
          activatedAt: "2023-11-20",
          license: "enterprise",
          features: ["scenario-planning", "capacity-forecast", "route-optimization"],
          environment: "env-delta-prod",
          notes: "Entitlement preservado durante suspensão da empresa.",
          trialEndsAt: null
        },
        OPS: {
          active: true,
          activatedAt: "2023-12-04",
          license: "enterprise",
          features: ["live-dispatch", "occurrence-center", "sla-monitoring"],
          environment: "env-delta-prod",
          notes: "Acesso efetivo bloqueado pelo status da empresa.",
          trialEndsAt: null
        },
        Palm: {
          active: true,
          activatedAt: "2024-01-08",
          license: "enterprise",
          features: ["mobile-routes", "proof-of-delivery", "offline-mode"],
          environment: "env-delta-prod",
          notes: "Permissões individuais mantidas para eventual reativação.",
          trialEndsAt: null
        },
        Sales: {
          active: false,
          activatedAt: null,
          license: "not-contracted",
          features: [],
          environment: null,
          notes: "Módulo não contratado.",
          trialEndsAt: null
        }
      },
      limits: [
        { key: "users", label: "Usuários", used: 2, contracted: 100, unit: "usuários" },
        { key: "planningClients", label: "Clientes do Planning", used: 64, contracted: 250, unit: "clientes" },
        { key: "units", label: "Unidades", used: 1, contracted: 25, unit: "unidades" },
        { key: "territories", label: "Territórios", used: 8, contracted: 80, unit: "territórios" },
        { key: "drivers", label: "Motoristas", used: 42, contracted: 400, unit: "motoristas" },
        { key: "storage", label: "Armazenamento", used: 312, contracted: 500, unit: "GB" },
        { key: "integrations", label: "Integrações", used: 6, contracted: 30, unit: "integrações" },
        { key: "concurrentSessions", label: "Sessões simultâneas", used: 0, contracted: 50, unit: "sessões" }
      ],
      units: [
        { id: "unit-delta-rec", code: "DLT-REC", name: "Unidade Recife Demo", city: "Recife", state: "PE", status: "suspended" }
      ],
      alerts: [
        { id: "alert-delta-01", severity: "critical", title: "Empresa suspensa", message: "Acesso bloqueado até confirmação de reativação em duas etapas.", createdAt: "2026-07-22T17:20:00.000Z", status: "open" }
      ],
      history: [
        { id: "hist-delta-01", date: "2023-11-06", type: "company", title: "Empresa criada", description: "Conta demo Enterprise criada.", actor: "Phillips David" },
        { id: "hist-delta-02", date: "2026-07-22", type: "security", title: "Empresa suspensa", description: "Suspensão crítica confirmada em duas etapas.", actor: "Phillips David" }
      ]
    },
    {
      id: "cmp-serra",
      name: "Serra Azul Varejo Demo",
      identifier: "RF-DEMO-006",
      status: "active",
      plan: "professional",
      responsible: {
        userId: "usr-serra-01",
        name: "Sofia Barros",
        email: "sofia.barros@example.com"
      },
      startDate: "2025-03-17",
      lastActivity: "2026-07-25T11:05:00.000Z",
      hosting: {
        model: "shared-cloud",
        provider: "ROUTflex Cloud Demo",
        region: "sa-east-1",
        status: "healthy",
        domain: "serra-azul.control.example.invalid",
        backupFrequency: "12h"
      },
      modules: {
        Planning: {
          active: true,
          activatedAt: "2025-03-24",
          license: "professional",
          features: ["scenario-planning", "capacity-forecast"],
          environment: "env-serra-prod",
          notes: "Planejamento integrado às duas unidades demo.",
          trialEndsAt: null
        },
        OPS: {
          active: false,
          activatedAt: null,
          license: "not-contracted",
          features: [],
          environment: null,
          notes: "Sem entitlement para OPS.",
          trialEndsAt: null
        },
        Palm: {
          active: false,
          activatedAt: null,
          license: "not-contracted",
          features: [],
          environment: null,
          notes: "Uma permissão individual não pode habilitar este módulo.",
          trialEndsAt: null
        },
        Sales: {
          active: true,
          activatedAt: "2025-04-07",
          license: "professional",
          features: ["sales-pipeline", "customer-portfolio", "proposal-management"],
          environment: "env-serra-prod",
          notes: "Licença ativa para equipe comercial demo.",
          trialEndsAt: null
        }
      },
      limits: [
        { key: "users", label: "Usuários", used: 2, contracted: 30, unit: "usuários" },
        { key: "planningClients", label: "Clientes do Planning", used: 35, contracted: 120, unit: "clientes" },
        { key: "units", label: "Unidades", used: 2, contracted: 8, unit: "unidades" },
        { key: "territories", label: "Territórios", used: 5, contracted: 20, unit: "territórios" },
        { key: "drivers", label: "Motoristas", used: 0, contracted: 0, unit: "motoristas" },
        { key: "storage", label: "Armazenamento", used: 74, contracted: 200, unit: "GB" },
        { key: "integrations", label: "Integrações", used: 4, contracted: 12, unit: "integrações" },
        { key: "concurrentSessions", label: "Sessões simultâneas", used: 2, contracted: 20, unit: "sessões" }
      ],
      units: [
        { id: "unit-serra-poa", code: "SAZ-POA", name: "Unidade Porto Alegre Demo", city: "Porto Alegre", state: "RS", status: "active" },
        { id: "unit-serra-cax", code: "SAZ-CAX", name: "Unidade Caxias Demo", city: "Caxias do Sul", state: "RS", status: "active" }
      ],
      alerts: [],
      history: [
        { id: "hist-serra-01", date: "2025-03-17", type: "company", title: "Empresa criada", description: "Conta demo Professional criada.", actor: "Phillips David" },
        { id: "hist-serra-02", date: "2025-04-07", type: "license", title: "Sales ativado", description: "Entitlement Sales adicionado.", actor: "Phillips David" }
      ]
    },
    {
      id: "cmp-costa",
      name: "Costa Norte Serviços Demo",
      identifier: "RF-DEMO-007",
      status: "active",
      plan: "starter",
      responsible: {
        userId: "usr-costa-01",
        name: "Alice Freitas",
        email: "alice.freitas@example.com"
      },
      startDate: "2025-11-10",
      lastActivity: "2026-07-25T10:26:00.000Z",
      hosting: {
        model: "shared-cloud",
        provider: "ROUTflex Cloud Demo",
        region: "sa-east-1",
        status: "healthy",
        domain: "costa-norte.control.example.invalid",
        backupFrequency: "24h"
      },
      modules: {
        Planning: {
          active: false,
          activatedAt: null,
          license: "not-contracted",
          features: [],
          environment: null,
          notes: "Módulo não contratado.",
          trialEndsAt: null
        },
        OPS: {
          active: true,
          activatedAt: "2025-11-17",
          license: "starter",
          features: ["live-dispatch", "occurrence-center"],
          environment: "env-costa-prod",
          notes: "Operação principal em produção.",
          trialEndsAt: null
        },
        Palm: {
          active: true,
          activatedAt: "2025-12-01",
          license: "starter",
          features: ["mobile-routes", "proof-of-delivery"],
          environment: "env-costa-prod",
          notes: "Acesso móvel restrito a usuários autorizados.",
          trialEndsAt: null
        },
        Sales: {
          active: true,
          activatedAt: "2026-02-09",
          license: "starter",
          features: ["sales-pipeline", "customer-portfolio"],
          environment: "env-costa-prod",
          notes: "Recursos comerciais essenciais.",
          trialEndsAt: null
        }
      },
      limits: [
        { key: "users", label: "Usuários", used: 2, contracted: 10, unit: "usuários" },
        { key: "planningClients", label: "Clientes do Planning", used: 0, contracted: 0, unit: "clientes" },
        { key: "units", label: "Unidades", used: 2, contracted: 2, unit: "unidades" },
        { key: "territories", label: "Territórios", used: 3, contracted: 5, unit: "territórios" },
        { key: "drivers", label: "Motoristas", used: 18, contracted: 30, unit: "motoristas" },
        { key: "storage", label: "Armazenamento", used: 42, contracted: 75, unit: "GB" },
        { key: "integrations", label: "Integrações", used: 3, contracted: 5, unit: "integrações" },
        { key: "concurrentSessions", label: "Sessões simultâneas", used: 1, contracted: 8, unit: "sessões" }
      ],
      units: [
        { id: "unit-costa-for", code: "CNS-FOR", name: "Unidade Fortaleza Demo", city: "Fortaleza", state: "CE", status: "active" },
        { id: "unit-costa-nat", code: "CNS-NAT", name: "Unidade Natal Demo", city: "Natal", state: "RN", status: "active" }
      ],
      alerts: [
        { id: "alert-costa-01", severity: "info", title: "Manutenção de staging", message: "Ambiente de staging em manutenção programada.", createdAt: "2026-07-25T07:30:00.000Z", status: "open" }
      ],
      history: [
        { id: "hist-costa-01", date: "2025-11-10", type: "company", title: "Empresa criada", description: "Conta demo Starter criada.", actor: "Phillips David" },
        { id: "hist-costa-02", date: "2026-02-09", type: "license", title: "Sales ativado", description: "Módulo Sales incluído no plano demo.", actor: "Phillips David" }
      ]
    }
  ],

  users: [
    {
      id: "usr-atlas-01",
      companyId: "cmp-atlas",
      name: "Helena Duarte",
      email: "helena.duarte@example.com",
      role: "company_admin",
      modules: {
        Planning: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] },
        OPS: { enabled: true, role: "viewer", permissions: ["read"] },
        Palm: { enabled: true, role: "viewer", permissions: ["read"] },
        Sales: { enabled: false, role: null, permissions: [] }
      },
      status: "active",
      twoFactor: "enabled",
      lastAccess: "2026-07-25T11:36:00.000Z",
      inviteOrigin: "platform_owner",
      sessions: [
        { id: "ses-atlas-01-a", device: "Notebook Demo", browser: "Chrome", location: "São Paulo, SP", ip: "192.0.2.11", lastSeenAt: "2026-07-25T11:36:00.000Z", current: true, status: "active" }
      ]
    },
    {
      id: "usr-atlas-02",
      companyId: "cmp-atlas",
      name: "Caio Martins",
      email: "caio.martins@example.com",
      role: "operator",
      modules: {
        Planning: { enabled: true, role: "operator", permissions: ["read", "write"] },
        OPS: { enabled: true, role: "operator", permissions: ["read", "write"] },
        Palm: { enabled: true, role: "operator", permissions: ["read", "write"] },
        Sales: { enabled: true, role: "viewer", permissions: ["read"] }
      },
      status: "active",
      twoFactor: "enabled",
      lastAccess: "2026-07-25T10:54:00.000Z",
      inviteOrigin: "company_admin",
      sessions: [
        { id: "ses-atlas-02-a", device: "Desktop Demo", browser: "Edge", location: "Campinas, SP", ip: "192.0.2.12", lastSeenAt: "2026-07-25T10:54:00.000Z", current: false, status: "active" }
      ]
    },
    {
      id: "usr-veloz-01",
      companyId: "cmp-veloz",
      name: "Bruno Tavares",
      email: "bruno.tavares@example.com",
      role: "company_admin",
      modules: {
        Planning: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] },
        OPS: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] },
        Palm: { enabled: true, role: "viewer", permissions: ["read"] },
        Sales: { enabled: false, role: null, permissions: [] }
      },
      status: "active",
      twoFactor: "enabled",
      lastAccess: "2026-07-25T10:18:00.000Z",
      inviteOrigin: "platform_owner",
      sessions: [
        { id: "ses-veloz-01-a", device: "Notebook Demo", browser: "Firefox", location: "Rio de Janeiro, RJ", ip: "198.51.100.21", lastSeenAt: "2026-07-25T10:18:00.000Z", current: true, status: "active" }
      ]
    },
    {
      id: "usr-veloz-02",
      companyId: "cmp-veloz",
      name: "Júlia Rocha",
      email: "julia.rocha@example.com",
      role: "operator",
      modules: {
        Planning: { enabled: true, role: "operator", permissions: ["read", "write"] },
        OPS: { enabled: false, role: null, permissions: [] },
        Palm: { enabled: false, role: null, permissions: [] },
        Sales: { enabled: false, role: null, permissions: [] }
      },
      status: "invited",
      twoFactor: "pending",
      lastAccess: null,
      inviteOrigin: "company_admin",
      sessions: []
    },
    {
      id: "usr-nova-01",
      companyId: "cmp-nova",
      name: "Rafael Mendes",
      email: "rafael.mendes@example.com",
      role: "company_admin",
      modules: {
        Planning: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] },
        OPS: { enabled: false, role: null, permissions: [] },
        Palm: { enabled: false, role: null, permissions: [] },
        Sales: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] }
      },
      status: "active",
      twoFactor: "enabled",
      lastAccess: "2026-07-25T09:44:00.000Z",
      inviteOrigin: "platform_owner",
      sessions: [
        { id: "ses-nova-01-a", device: "Notebook Demo", browser: "Chrome", location: "Belo Horizonte, MG", ip: "203.0.113.31", lastSeenAt: "2026-07-25T09:44:00.000Z", current: true, status: "active" }
      ]
    },
    {
      id: "usr-nova-02",
      companyId: "cmp-nova",
      name: "Lívia Campos",
      email: "livia.campos@example.com",
      role: "viewer",
      modules: {
        Planning: { enabled: true, role: "viewer", permissions: ["read"] },
        OPS: { enabled: false, role: null, permissions: [] },
        Palm: { enabled: false, role: null, permissions: [] },
        Sales: { enabled: true, role: "viewer", permissions: ["read"] }
      },
      status: "active",
      twoFactor: "disabled",
      lastAccess: "2026-07-24T15:22:00.000Z",
      inviteOrigin: "company_admin",
      sessions: [
        { id: "ses-nova-02-a", device: "Tablet Demo", browser: "Safari", location: "Belo Horizonte, MG", ip: "203.0.113.32", lastSeenAt: "2026-07-24T15:22:00.000Z", current: false, status: "active" }
      ]
    },
    {
      id: "usr-horizonte-01",
      companyId: "cmp-horizonte",
      name: "Laura Nascimento",
      email: "laura.nascimento@example.com",
      role: "company_admin",
      modules: {
        Planning: { enabled: false, role: null, permissions: [] },
        OPS: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] },
        Palm: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] },
        Sales: { enabled: false, role: null, permissions: [] }
      },
      status: "active",
      twoFactor: "enabled",
      lastAccess: "2026-07-25T10:58:00.000Z",
      inviteOrigin: "platform_owner",
      sessions: [
        { id: "ses-horizonte-01-a", device: "Desktop Demo", browser: "Chrome", location: "Goiânia, GO", ip: "192.0.2.41", lastSeenAt: "2026-07-25T10:58:00.000Z", current: true, status: "active" }
      ]
    },
    {
      id: "usr-horizonte-02",
      companyId: "cmp-horizonte",
      name: "Pedro Lima",
      email: "pedro.lima@example.com",
      role: "operator",
      modules: {
        Planning: { enabled: false, role: null, permissions: [] },
        OPS: { enabled: true, role: "viewer", permissions: ["read"] },
        Palm: { enabled: true, role: "operator", permissions: ["read", "write"] },
        Sales: { enabled: false, role: null, permissions: [] }
      },
      status: "blocked",
      twoFactor: "pending",
      lastAccess: "2026-07-24T18:03:00.000Z",
      inviteOrigin: "company_admin",
      sessions: [
        { id: "ses-horizonte-02-a", device: "Celular Demo", browser: "Chrome Mobile", location: "Brasília, DF", ip: "192.0.2.42", lastSeenAt: "2026-07-24T18:03:00.000Z", current: false, status: "revoked" }
      ]
    },
    {
      id: "usr-delta-01",
      companyId: "cmp-delta",
      name: "Marta Rezende",
      email: "marta.rezende@example.com",
      role: "company_admin",
      modules: {
        Planning: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] },
        OPS: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] },
        Palm: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] },
        Sales: { enabled: false, role: null, permissions: [] }
      },
      status: "active",
      twoFactor: "enabled",
      lastAccess: "2026-07-22T17:18:00.000Z",
      inviteOrigin: "platform_owner",
      sessions: [
        { id: "ses-delta-01-a", device: "Notebook Demo", browser: "Edge", location: "Recife, PE", ip: "198.51.100.51", lastSeenAt: "2026-07-22T17:18:00.000Z", current: false, status: "revoked" }
      ]
    },
    {
      id: "usr-delta-02",
      companyId: "cmp-delta",
      name: "Nando Correia",
      email: "nando.correia@example.com",
      role: "operator",
      modules: {
        Planning: { enabled: true, role: "viewer", permissions: ["read"] },
        OPS: { enabled: true, role: "operator", permissions: ["read", "write"] },
        Palm: { enabled: true, role: "operator", permissions: ["read", "write"] },
        Sales: { enabled: false, role: null, permissions: [] }
      },
      status: "active",
      twoFactor: "enabled",
      lastAccess: "2026-07-22T16:52:00.000Z",
      inviteOrigin: "company_admin",
      sessions: [
        { id: "ses-delta-02-a", device: "Celular Demo", browser: "Firefox Mobile", location: "Recife, PE", ip: "198.51.100.52", lastSeenAt: "2026-07-22T16:52:00.000Z", current: false, status: "revoked" }
      ]
    },
    {
      id: "usr-serra-01",
      companyId: "cmp-serra",
      name: "Sofia Barros",
      email: "sofia.barros@example.com",
      role: "company_admin",
      modules: {
        Planning: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] },
        OPS: { enabled: false, role: null, permissions: [] },
        Palm: { enabled: false, role: null, permissions: [] },
        Sales: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] }
      },
      status: "active",
      twoFactor: "enabled",
      lastAccess: "2026-07-25T11:05:00.000Z",
      inviteOrigin: "platform_owner",
      sessions: [
        { id: "ses-serra-01-a", device: "Notebook Demo", browser: "Chrome", location: "Porto Alegre, RS", ip: "203.0.113.61", lastSeenAt: "2026-07-25T11:05:00.000Z", current: true, status: "active" }
      ]
    },
    {
      id: "usr-serra-02",
      companyId: "cmp-serra",
      name: "Igor Neves",
      email: "igor.neves@example.com",
      role: "viewer",
      modules: {
        Planning: { enabled: true, role: "viewer", permissions: ["read"] },
        OPS: { enabled: false, role: null, permissions: [] },
        Palm: { enabled: false, role: null, permissions: [] },
        Sales: { enabled: false, role: null, permissions: [] }
      },
      status: "active",
      twoFactor: "disabled",
      lastAccess: "2026-07-24T13:34:00.000Z",
      inviteOrigin: "company_admin",
      sessions: [
        { id: "ses-serra-02-a", device: "Desktop Demo", browser: "Firefox", location: "Caxias do Sul, RS", ip: "203.0.113.62", lastSeenAt: "2026-07-24T13:34:00.000Z", current: false, status: "active" }
      ]
    },
    {
      id: "usr-costa-01",
      companyId: "cmp-costa",
      name: "Alice Freitas",
      email: "alice.freitas@example.com",
      role: "company_admin",
      modules: {
        Planning: { enabled: false, role: null, permissions: [] },
        OPS: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] },
        Palm: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] },
        Sales: { enabled: true, role: "admin", permissions: ["read", "write", "configure"] }
      },
      status: "active",
      twoFactor: "enabled",
      lastAccess: "2026-07-25T10:26:00.000Z",
      inviteOrigin: "platform_owner",
      sessions: [
        { id: "ses-costa-01-a", device: "Notebook Demo", browser: "Chrome", location: "Fortaleza, CE", ip: "192.0.2.71", lastSeenAt: "2026-07-25T10:26:00.000Z", current: true, status: "active" }
      ]
    },
    {
      id: "usr-costa-02",
      companyId: "cmp-costa",
      name: "Diego Melo",
      email: "diego.melo@example.com",
      role: "operator",
      modules: {
        Planning: { enabled: false, role: null, permissions: [] },
        OPS: { enabled: false, role: null, permissions: [] },
        Palm: { enabled: true, role: "operator", permissions: ["read", "write"] },
        Sales: { enabled: false, role: null, permissions: [] }
      },
      status: "invited",
      twoFactor: "pending",
      lastAccess: null,
      inviteOrigin: "company_admin",
      sessions: []
    }
  ],

  environments: [
    { id: "env-atlas-prod", companyId: "cmp-atlas", name: "Produção", type: "production", status: "healthy", region: "sa-east-1", version: "2026.07.3", endpoint: "atlas-prod.example.invalid", lastHealthCheck: "2026-07-25T11:40:00.000Z", uptime: 99.98, releaseChannel: "stable", modules: ["Planning", "OPS", "Palm", "Sales"] },
    { id: "env-atlas-sandbox", companyId: "cmp-atlas", name: "Sandbox", type: "sandbox", status: "healthy", region: "sa-east-1", version: "2026.08.0-rc1", endpoint: "atlas-sandbox.example.invalid", lastHealthCheck: "2026-07-25T11:38:00.000Z", uptime: 99.91, releaseChannel: "preview", modules: ["Planning", "OPS", "Palm", "Sales"] },
    { id: "env-veloz-prod", companyId: "cmp-veloz", name: "Produção", type: "production", status: "provisioning", region: "sa-east-1", version: null, endpoint: "veloz-prod.example.invalid", lastHealthCheck: null, uptime: null, releaseChannel: "stable", modules: ["Planning", "OPS", "Palm"] },
    { id: "env-veloz-sandbox", companyId: "cmp-veloz", name: "Sandbox", type: "sandbox", status: "healthy", region: "sa-east-1", version: "2026.07.3", endpoint: "veloz-sandbox.example.invalid", lastHealthCheck: "2026-07-25T11:32:00.000Z", uptime: 99.87, releaseChannel: "stable", modules: ["Planning", "OPS", "Palm"] },
    { id: "env-nova-trial", companyId: "cmp-nova", name: "Trial", type: "trial", status: "healthy", region: "sa-east-1", version: "2026.07.3", endpoint: "nova-trial.example.invalid", lastHealthCheck: "2026-07-25T11:30:00.000Z", uptime: 99.76, releaseChannel: "stable", modules: ["Planning", "Sales"] },
    { id: "env-horizonte-prod", companyId: "cmp-horizonte", name: "Produção", type: "production", status: "degraded", region: "sa-east-1", version: "2026.07.2", endpoint: "horizonte-prod.example.invalid", lastHealthCheck: "2026-07-25T11:39:00.000Z", uptime: 97.82, releaseChannel: "stable", modules: ["OPS", "Palm"] },
    { id: "env-delta-prod", companyId: "cmp-delta", name: "Produção", type: "production", status: "locked", region: "sa-east-1", version: "2026.07.2", endpoint: "delta-prod.example.invalid", lastHealthCheck: "2026-07-22T17:20:00.000Z", uptime: null, releaseChannel: "stable", modules: ["Planning", "OPS", "Palm"] },
    { id: "env-serra-prod", companyId: "cmp-serra", name: "Produção", type: "production", status: "healthy", region: "sa-east-1", version: "2026.07.3", endpoint: "serra-prod.example.invalid", lastHealthCheck: "2026-07-25T11:37:00.000Z", uptime: 99.94, releaseChannel: "stable", modules: ["Planning", "Sales"] },
    { id: "env-costa-prod", companyId: "cmp-costa", name: "Produção", type: "production", status: "healthy", region: "sa-east-1", version: "2026.07.3", endpoint: "costa-prod.example.invalid", lastHealthCheck: "2026-07-25T11:35:00.000Z", uptime: 99.89, releaseChannel: "stable", modules: ["OPS", "Palm", "Sales"] },
    { id: "env-costa-staging", companyId: "cmp-costa", name: "Staging", type: "staging", status: "maintenance", region: "sa-east-1", version: "2026.08.0-rc1", endpoint: "costa-staging.example.invalid", lastHealthCheck: "2026-07-25T07:25:00.000Z", uptime: 98.41, releaseChannel: "preview", modules: ["OPS", "Palm", "Sales"] }
  ],

  onboardings: [
    {
      id: "onb-atlas",
      companyId: "cmp-atlas",
      ownerId: "owner-demo-001",
      status: "completed",
      startedAt: "2024-02-12",
      dueAt: "2024-04-05",
      completedAt: "2024-03-29",
      progress: 100,
      blocker: null,
      steps: [
        { key: "company_registration", status: "completed", completedAt: "2024-02-12" },
        { key: "contract_plan", status: "completed", completedAt: "2024-02-15" },
        { key: "module_definition", status: "completed", completedAt: "2024-02-20" },
        { key: "admin_creation", status: "completed", completedAt: "2024-02-21" },
        { key: "environment_configuration", status: "completed", completedAt: "2024-02-23" },
        { key: "data_preparation", status: "completed", completedAt: "2024-03-08" },
        { key: "validation", status: "completed", completedAt: "2024-03-20" },
        { key: "release", status: "completed", completedAt: "2024-03-29" }
      ]
    },
    {
      id: "onb-veloz",
      companyId: "cmp-veloz",
      ownerId: "owner-demo-001",
      status: "in_progress",
      startedAt: "2026-07-08",
      dueAt: "2026-08-08",
      completedAt: null,
      progress: 63,
      blocker: "Credenciais fictícias da integração ainda não foram validadas.",
      steps: [
        { key: "company_registration", status: "completed", completedAt: "2026-07-08" },
        { key: "contract_plan", status: "completed", completedAt: "2026-07-09" },
        { key: "module_definition", status: "completed", completedAt: "2026-07-10" },
        { key: "admin_creation", status: "completed", completedAt: "2026-07-11" },
        { key: "environment_configuration", status: "completed", completedAt: "2026-07-18" },
        { key: "data_preparation", status: "blocked", completedAt: null },
        { key: "validation", status: "pending", completedAt: null },
        { key: "release", status: "pending", completedAt: null }
      ]
    },
    {
      id: "onb-nova",
      companyId: "cmp-nova",
      ownerId: "owner-demo-001",
      status: "in_progress",
      startedAt: "2026-07-14",
      dueAt: "2026-07-29",
      completedAt: null,
      progress: 50,
      blocker: null,
      steps: [
        { key: "company_registration", status: "completed", completedAt: "2026-07-14" },
        { key: "contract_plan", status: "completed", completedAt: "2026-07-14" },
        { key: "module_definition", status: "completed", completedAt: "2026-07-14" },
        { key: "admin_creation", status: "completed", completedAt: "2026-07-14" },
        { key: "environment_configuration", status: "in_progress", completedAt: null },
        { key: "data_preparation", status: "pending", completedAt: null },
        { key: "validation", status: "pending", completedAt: null },
        { key: "release", status: "pending", completedAt: null }
      ]
    },
    {
      id: "onb-horizonte",
      companyId: "cmp-horizonte",
      ownerId: "owner-demo-001",
      status: "completed",
      startedAt: "2025-08-04",
      dueAt: "2025-09-12",
      completedAt: "2025-09-05",
      progress: 100,
      blocker: null,
      steps: [
        { key: "company_registration", status: "completed", completedAt: "2025-08-04" },
        { key: "contract_plan", status: "completed", completedAt: "2025-08-06" },
        { key: "module_definition", status: "completed", completedAt: "2025-08-18" },
        { key: "admin_creation", status: "completed", completedAt: "2025-08-19" },
        { key: "environment_configuration", status: "completed", completedAt: "2025-08-20" },
        { key: "data_preparation", status: "completed", completedAt: "2025-08-27" },
        { key: "validation", status: "completed", completedAt: "2025-09-02" },
        { key: "release", status: "completed", completedAt: "2025-09-05" }
      ]
    },
    {
      id: "onb-delta",
      companyId: "cmp-delta",
      ownerId: "owner-demo-001",
      status: "completed",
      startedAt: "2023-11-06",
      dueAt: "2023-12-22",
      completedAt: "2023-12-18",
      progress: 100,
      blocker: null,
      steps: [
        { key: "company_registration", status: "completed", completedAt: "2023-11-06" },
        { key: "contract_plan", status: "completed", completedAt: "2023-11-09" },
        { key: "module_definition", status: "completed", completedAt: "2023-11-20" },
        { key: "admin_creation", status: "completed", completedAt: "2023-11-21" },
        { key: "environment_configuration", status: "completed", completedAt: "2023-11-24" },
        { key: "data_preparation", status: "completed", completedAt: "2023-12-04" },
        { key: "validation", status: "completed", completedAt: "2023-12-12" },
        { key: "release", status: "completed", completedAt: "2023-12-18" }
      ]
    },
    {
      id: "onb-serra",
      companyId: "cmp-serra",
      ownerId: "owner-demo-001",
      status: "completed",
      startedAt: "2025-03-17",
      dueAt: "2025-04-18",
      completedAt: "2025-04-11",
      progress: 100,
      blocker: null,
      steps: [
        { key: "company_registration", status: "completed", completedAt: "2025-03-17" },
        { key: "contract_plan", status: "completed", completedAt: "2025-03-19" },
        { key: "module_definition", status: "completed", completedAt: "2025-03-24" },
        { key: "admin_creation", status: "completed", completedAt: "2025-03-25" },
        { key: "environment_configuration", status: "completed", completedAt: "2025-03-26" },
        { key: "data_preparation", status: "completed", completedAt: "2025-04-01" },
        { key: "validation", status: "completed", completedAt: "2025-04-08" },
        { key: "release", status: "completed", completedAt: "2025-04-11" }
      ]
    },
    {
      id: "onb-costa",
      companyId: "cmp-costa",
      ownerId: "owner-demo-001",
      status: "completed",
      startedAt: "2025-11-10",
      dueAt: "2025-12-19",
      completedAt: "2025-12-12",
      progress: 100,
      blocker: null,
      steps: [
        { key: "company_registration", status: "completed", completedAt: "2025-11-10" },
        { key: "contract_plan", status: "completed", completedAt: "2025-11-12" },
        { key: "module_definition", status: "completed", completedAt: "2025-11-17" },
        { key: "admin_creation", status: "completed", completedAt: "2025-11-18" },
        { key: "environment_configuration", status: "completed", completedAt: "2025-11-19" },
        { key: "data_preparation", status: "completed", completedAt: "2025-11-28" },
        { key: "validation", status: "completed", completedAt: "2025-12-08" },
        { key: "release", status: "completed", completedAt: "2025-12-12" }
      ]
    }
  ],

  auditEvents: [
    { id: "audit-001", timestamp: "2026-07-25T11:42:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: null, category: "security", action: "auth.login", target: { type: "session", id: "owner-session-demo" }, severity: "info", result: "success", ip: "192.0.2.5", description: "Acesso demo confirmado com segundo fator.", changes: null },
    { id: "audit-002", timestamp: "2026-07-25T10:40:00.000Z", actor: { type: "system", id: "system-demo", name: "Sistema Demo", email: null }, companyId: "cmp-horizonte", category: "environment", action: "environment.degraded", target: { type: "environment", id: "env-horizonte-prod" }, severity: "warning", result: "success", ip: null, description: "Ambiente marcado como degradado após verificação fictícia.", changes: { before: "healthy", after: "degraded" } },
    { id: "audit-003", timestamp: "2026-07-25T09:12:00.000Z", actor: { type: "user", id: "usr-horizonte-02", name: "Pedro Lima", email: "pedro.lima@example.com" }, companyId: "cmp-horizonte", category: "security", action: "auth.login", target: { type: "user", id: "usr-horizonte-02" }, severity: "warning", result: "denied", ip: "192.0.2.42", description: "Acesso negado para usuário bloqueado.", changes: null },
    { id: "audit-004", timestamp: "2026-07-24T16:12:00.000Z", actor: { type: "user", id: "usr-veloz-01", name: "Bruno Tavares", email: "bruno.tavares@example.com" }, companyId: "cmp-veloz", category: "user", action: "user.invited", target: { type: "user", id: "usr-veloz-02" }, severity: "info", result: "success", ip: "198.51.100.21", description: "Convite demo enviado para Júlia Rocha.", changes: { before: null, after: "invited" } },
    { id: "audit-005", timestamp: "2026-07-24T14:05:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: "cmp-atlas", category: "user", action: "user.module_role_changed", target: { type: "user", id: "usr-atlas-02" }, severity: "info", result: "success", ip: "192.0.2.5", description: "Papel individual de Sales alterado para visualizador.", changes: { before: null, after: "viewer" } },
    { id: "audit-006", timestamp: "2026-07-23T15:30:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: "cmp-veloz", category: "onboarding", action: "onboarding.step_completed", target: { type: "step", id: "environment" }, severity: "info", result: "success", ip: "192.0.2.5", description: "Etapa de ambiente concluída no onboarding demo.", changes: { before: "in_progress", after: "completed" } },
    { id: "audit-007", timestamp: "2026-07-22T17:20:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: "cmp-delta", category: "company", action: "company.suspended", target: { type: "company", id: "cmp-delta" }, severity: "critical", result: "success", ip: "192.0.2.5", description: "Suspensão demo confirmada em duas etapas.", changes: { before: "active", after: "suspended" } },
    { id: "audit-008", timestamp: "2026-07-22T17:21:00.000Z", actor: { type: "system", id: "system-demo", name: "Sistema Demo", email: null }, companyId: "cmp-delta", category: "security", action: "sessions.revoked_all", target: { type: "company", id: "cmp-delta" }, severity: "critical", result: "success", ip: null, description: "Sessões demo revogadas após suspensão.", changes: { before: 2, after: 0 } },
    { id: "audit-009", timestamp: "2026-07-21T12:00:00.000Z", actor: { type: "system", id: "system-demo", name: "Sistema Demo", email: null }, companyId: "cmp-nova", category: "license", action: "trial.expiration_warning", target: { type: "module", id: "Planning" }, severity: "warning", result: "success", ip: null, description: "Aviso fictício de expiração do trial criado.", changes: null },
    { id: "audit-010", timestamp: "2026-07-18T13:24:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: "cmp-veloz", category: "environment", action: "environment.provision_requested", target: { type: "environment", id: "env-veloz-prod" }, severity: "info", result: "success", ip: "192.0.2.5", description: "Provisionamento demo solicitado.", changes: { before: null, after: "provisioning" } },
    { id: "audit-011", timestamp: "2026-07-15T10:00:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: "cmp-veloz", category: "license", action: "entitlement.trial_started", target: { type: "module", id: "Palm" }, severity: "info", result: "success", ip: "192.0.2.5", description: "Trial Palm iniciado por 28 dias.", changes: { before: "not-contracted", after: "trial" } },
    { id: "audit-012", timestamp: "2026-07-14T09:20:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: "cmp-nova", category: "company", action: "company.trial_created", target: { type: "company", id: "cmp-nova" }, severity: "info", result: "success", ip: "192.0.2.5", description: "Empresa demo criada em trial.", changes: { before: null, after: "trial" } },
    { id: "audit-013", timestamp: "2026-07-12T11:10:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: null, category: "settings", action: "settings.security_updated", target: { type: "settings", id: "security" }, severity: "warning", result: "success", ip: "192.0.2.5", description: "Confirmação em duas etapas habilitada para ações críticas.", changes: { before: false, after: true } },
    { id: "audit-014", timestamp: "2026-07-10T08:45:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: "cmp-veloz", category: "license", action: "entitlement.activated", target: { type: "module", id: "OPS" }, severity: "info", result: "success", ip: "192.0.2.5", description: "Entitlement OPS ativado.", changes: { before: "not-contracted", after: "professional" } },
    { id: "audit-015", timestamp: "2026-07-09T14:18:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: "cmp-veloz", category: "user", action: "user.invited", target: { type: "user", id: "usr-veloz-01" }, severity: "info", result: "success", ip: "192.0.2.5", description: "Administrador responsável convidado.", changes: { before: null, after: "active" } },
    { id: "audit-016", timestamp: "2026-07-08T10:00:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: "cmp-veloz", category: "company", action: "company.created", target: { type: "company", id: "cmp-veloz" }, severity: "info", result: "success", ip: "192.0.2.5", description: "Empresa demo criada em onboarding.", changes: { before: null, after: "onboarding" } },
    { id: "audit-017", timestamp: "2026-07-20T14:30:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: "cmp-atlas", category: "limit", action: "limit.updated", target: { type: "limit", id: "storage" }, severity: "info", result: "success", ip: "192.0.2.5", description: "Limite fictício de armazenamento ampliado.", changes: { before: 450, after: 500 } },
    { id: "audit-018", timestamp: "2026-07-24T18:05:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: "cmp-horizonte", category: "user", action: "user.blocked", target: { type: "user", id: "usr-horizonte-02" }, severity: "critical", result: "success", ip: "192.0.2.5", description: "Usuário demo bloqueado após revisão administrativa.", changes: { before: "active", after: "blocked" } },
    { id: "audit-019", timestamp: "2026-06-18T13:00:00.000Z", actor: { type: "owner", id: "owner-demo-001", name: "Phillips David", email: "phillips.david@example.com" }, companyId: "cmp-atlas", category: "plan", action: "plan.changed", target: { type: "company", id: "cmp-atlas" }, severity: "info", result: "success", ip: "192.0.2.5", description: "Plano demonstrativo alterado para Enterprise.", changes: { before: "professional", after: "enterprise" } }
  ],

  notifications: [
    { id: "note-001", companyId: "cmp-horizonte", type: "environment", severity: "critical", title: "Ambiente degradado", message: "Horizonte Transportes Demo requer acompanhamento.", createdAt: "2026-07-25T10:40:00.000Z", read: false, action: "open-environment" },
    { id: "note-002", companyId: "cmp-nova", type: "trial", severity: "warning", title: "Trial expira em breve", message: "Planning e Sales expiram em 29/07/2026.", createdAt: "2026-07-25T08:30:00.000Z", read: false, action: "open-licenses" },
    { id: "note-003", companyId: "cmp-veloz", type: "onboarding", severity: "warning", title: "Integração bloqueada", message: "Credenciais fictícias ainda não foram validadas.", createdAt: "2026-07-24T17:10:00.000Z", read: false, action: "open-onboarding" },
    { id: "note-004", companyId: "cmp-veloz", type: "user", severity: "info", title: "Convite pendente", message: "Júlia Rocha ainda não concluiu o acesso.", createdAt: "2026-07-24T16:12:00.000Z", read: true, action: "open-user" },
    { id: "note-005", companyId: "cmp-delta", type: "security", severity: "critical", title: "Empresa suspensa", message: "As permissões foram preservadas, mas o acesso efetivo está bloqueado.", createdAt: "2026-07-22T17:20:00.000Z", read: false, action: "open-company" },
    { id: "note-006", companyId: "cmp-costa", type: "maintenance", severity: "info", title: "Staging em manutenção", message: "Janela demo prevista até 13:00 UTC.", createdAt: "2026-07-25T07:30:00.000Z", read: true, action: "open-environment" },
    { id: "note-007", companyId: "cmp-atlas", type: "review", severity: "info", title: "Revisão de acesso", message: "Revisão trimestral marcada para 30/07.", createdAt: "2026-07-24T14:00:00.000Z", read: true, action: "open-users" },
    { id: "note-008", companyId: "cmp-horizonte", type: "security", severity: "warning", title: "Tentativas negadas", message: "Usuário bloqueado tentou acessar o ambiente demo.", createdAt: "2026-07-25T09:12:00.000Z", read: false, action: "open-audit" }
  ],

  activities: [
    { id: "act-001", companyId: "cmp-atlas", type: "access", title: "Acesso administrativo", description: "Helena Duarte acessou o Control Center demo.", actor: "Helena Duarte", occurredAt: "2026-07-25T11:36:00.000Z" },
    { id: "act-002", companyId: "cmp-horizonte", type: "environment", title: "Degradação detectada", description: "Fila de sincronização acima do limite demo.", actor: "Sistema Demo", occurredAt: "2026-07-25T10:40:00.000Z" },
    { id: "act-003", companyId: "cmp-costa", type: "maintenance", title: "Manutenção iniciada", description: "Staging colocado em manutenção programada.", actor: "Phillips David", occurredAt: "2026-07-25T07:30:00.000Z" },
    { id: "act-004", companyId: "cmp-veloz", type: "user", title: "Convite enviado", description: "Júlia Rocha foi convidada por Bruno Tavares.", actor: "Bruno Tavares", occurredAt: "2026-07-24T16:12:00.000Z" },
    { id: "act-005", companyId: "cmp-atlas", type: "permission", title: "Permissão individual alterada", description: "Caio Martins recebeu acesso de visualização ao Sales.", actor: "Phillips David", occurredAt: "2026-07-24T14:05:00.000Z" },
    { id: "act-006", companyId: "cmp-veloz", type: "onboarding", title: "Etapa concluída", description: "Provisionamento inicial marcado como concluído.", actor: "Phillips David", occurredAt: "2026-07-23T15:30:00.000Z" },
    { id: "act-007", companyId: "cmp-delta", type: "company", title: "Empresa suspensa", description: "Suspensão confirmada em duas etapas.", actor: "Phillips David", occurredAt: "2026-07-22T17:20:00.000Z" },
    { id: "act-008", companyId: "cmp-nova", type: "trial", title: "Aviso de expiração", description: "Trial próximo do vencimento.", actor: "Sistema Demo", occurredAt: "2026-07-21T12:00:00.000Z" },
    { id: "act-009", companyId: "cmp-veloz", type: "environment", title: "Produção solicitada", description: "Ambiente entrou na fila fictícia de provisionamento.", actor: "Phillips David", occurredAt: "2026-07-18T13:24:00.000Z" },
    { id: "act-010", companyId: "cmp-veloz", type: "license", title: "Palm em trial", description: "Licença temporária habilitada.", actor: "Phillips David", occurredAt: "2026-07-15T10:00:00.000Z" },
    { id: "act-011", companyId: "cmp-nova", type: "company", title: "Trial criado", description: "Nova Rota Foods Demo adicionada ao Control Center.", actor: "Phillips David", occurredAt: "2026-07-14T09:20:00.000Z" },
    { id: "act-012", companyId: "cmp-serra", type: "health", title: "Verificação concluída", description: "Ambiente principal permanece saudável.", actor: "Sistema Demo", occurredAt: "2026-07-13T08:10:00.000Z" }
  ],

  settings: {
    general: {
      productName: "ROUTflex Control Center",
      environmentLabel: "Demonstração local",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      dateFormat: "DD/MM/YYYY",
      defaultRegion: "sa-east-1"
    },
    security: {
      requireOwnerTwoFactor: true,
      requireAdminTwoFactor: true,
      sessionTimeoutMinutes: 30,
      maxFailedLoginAttempts: 5,
      criticalConfirmation: {
        enabled: true,
        steps: 2,
        requireTypedPhrase: true,
        phrase: "CONFIRMAR"
      },
      criticalActions: [
        "company.suspend",
        "company.reactivate",
        "entitlement.disable",
        "user.block",
        "sessions.revoke_all",
        "environment.restart",
        "onboarding.go_live"
      ]
    },
    notifications: {
      emailDigest: "daily",
      notifyCriticalImmediately: true,
      notifyTrialBeforeDays: [7, 3, 1],
      notifyOnboardingDelay: true,
      ownerEmail: "phillips.david@example.com"
    },
    onboarding: {
      defaultDueDays: 30,
      requireAllStepsForGoLive: true,
      autoActivateCompanyOnGoLive: true,
      allowStepReopen: true
    },
    demo: {
      persistChanges: false,
      allowInMemoryMutations: true,
      resetOnReload: true,
      simulateLatencyMs: 0,
      integrationsEnabled: false
    }
  }
};
