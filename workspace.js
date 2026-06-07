(function initWorkspaceMock() {
  const sessionRaw = sessionStorage.getItem("routflexWorkspaceMock");
  const session = sessionRaw ? JSON.parse(sessionRaw) : null;
  const navLinks = Array.from(document.querySelectorAll(".workspace-nav a"));
  const sections = navLinks
    .map(link => document.getElementById(link.dataset.section))
    .filter(Boolean);

  if (!session) {
    sessionStorage.setItem("routflexWorkspaceMock", JSON.stringify({
      company: "Distribuidora Alfa LTDA",
      plan: "Enterprise",
      environment: "Produção",
      user: "empresa@demo.com",
      authenticatedAt: new Date().toISOString(),
    }));
  }

  function setActive(id) {
    navLinks.forEach(link => {
      link.classList.toggle("is-active", link.dataset.section === id);
    });

    const section = document.getElementById(id);
    if (section) {
      section.classList.remove("is-section-focus");
      window.requestAnimationFrame(() => section.classList.add("is-section-focus"));
    }
  }

  navLinks.forEach(link => {
    link.addEventListener("click", () => setActive(link.dataset.section));
  });

  if ("IntersectionObserver" in window && sections.length) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { threshold: [0.28, 0.48, 0.68] });
    sections.forEach(section => observer.observe(section));
  }

  const logoutTrigger = document.getElementById("logoutTrigger");
  const logoutModal = document.getElementById("logoutModal");
  const logoutCancelButtons = document.querySelectorAll("[data-logout-cancel]");
  const logoutConfirm = document.querySelector("[data-logout-confirm]");

  function openLogoutModal() {
    if (!logoutModal) return;
    logoutModal.hidden = false;
    logoutConfirm?.focus();
  }

  function closeLogoutModal() {
    if (!logoutModal) return;
    logoutModal.hidden = true;
    logoutTrigger?.focus();
  }

  logoutTrigger?.addEventListener("click", openLogoutModal);
  logoutCancelButtons.forEach(button => button.addEventListener("click", closeLogoutModal));
  logoutConfirm?.addEventListener("click", () => {
    sessionStorage.removeItem("routflexWorkspaceMock");
    window.location.href = "index.html";
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && logoutModal && !logoutModal.hidden) closeLogoutModal();
  });

  const assistantTrigger = document.getElementById("assistantTrigger");
  const assistantPanel = document.getElementById("assistantPanel");
  const assistantClose = document.getElementById("assistantClose");
  const assistantConversation = document.getElementById("assistantConversation");
  const assistantForm = document.getElementById("assistantQuestionForm");
  const assistantQuestion = document.getElementById("assistantQuestion");

  const assistantAnswers = {
    modulos: {
      title: "Módulos ROUTflex",
      intro: "Claro. Sobre qual módulo você gostaria de saber mais?",
      actions: [["Planning", "planning"], ["OPS", "ops"], ["Palm", "palm"], ["Sales", "sales"]],
    },
    planning: {
      title: "ROUTflex Planning",
      intro: "Planejamento territorial e roteirização operacional para equipes de campo.",
      items: ["Balanceamento territorial", "Distribuição de clientes", "Planejamento de visitas", "Simulação operacional", "Controle de rotas"],
      actions: [["Conhecer OPS", "ops"], ["Voltar", "modulos"]],
    },
    ops: {
      title: "ROUTflex OPS",
      intro: "Centro de controle operacional para acompanhar execução, auditoria e rotina de campo.",
      items: ["Auditoria operacional", "Controle de execução", "Supply Chain", "Telemetria", "WhatsApp Operacional"],
      actions: [["Conhecer Palm", "palm"], ["Voltar", "modulos"]],
    },
    palm: {
      title: "ROUTflex Palm",
      intro: "Mobilidade em campo para registrar visitas, evidências e execução de rotas.",
      items: ["Execução de rotas", "Check-ins", "Telemetria", "Coleta de evidências", "Controle de visitas"],
      actions: [["Conhecer Sales", "sales"], ["Voltar", "modulos"]],
    },
    sales: {
      title: "ROUTflex Sales",
      intro: "CRM/ERP comercial para conectar vendas, pedidos e indicadores ao ecossistema ROUTflex.",
      items: ["CRM", "Pedidos", "Estoque", "Financeiro", "Indicadores comerciais"],
      actions: [["Conhecer Planning", "planning"], ["Voltar", "modulos"]],
    },
    plano: {
      title: "Meu Plano",
      intro: "Sua empresa está no plano Enterprise, com ambiente de produção ativo.",
      items: ["Plano atual: Enterprise", "Usuários: 14 de 20", "Status: Ativo", "Renovação: 15 dias"],
    },
    licencas: {
      title: "Licenciamento",
      intro: "O uso de licenças está saudável no momento.",
      items: ["Licenças utilizadas: 14", "Licenças disponíveis: 6", "Utilização: 70%"],
    },
    renovacao: {
      title: "Renovação",
      intro: "A próxima renovação mockada está prevista para daqui a 15 dias.",
      items: ["Plano: Enterprise", "Status: Contrato ativo", "Recomendação: revisar usuários e módulos antes da renovação"],
    },
    marketplace: {
      title: "Marketplace ROUTflex",
      intro: "Estes módulos estão disponíveis para expandir o ecossistema:",
      items: ["ROUTflex Sales", "ROUTflex BI", "ROUTflex Supply Chain", "Telemetria Avançada"],
    },
    seguranca: {
      title: "Segurança",
      intro: "Seu ambiente possui controles corporativos essenciais habilitados.",
      items: ["2FA: Ativo", "SSO: Em breve", "Logs: Disponíveis", "Política de senha: Ativa"],
    },
    integracoes: {
      title: "Integrações",
      intro: "As integrações ajudam o Workspace a centralizar informações do ecossistema.",
      items: ["Integrações conectadas: 5", "Monitoramento: 2 integrações em observação", "Status geral: Operacional"],
    },
    usuarios: {
      title: "Usuários",
      intro: "A Distribuidora Alfa possui 14 usuários ativos no Workspace.",
      items: ["Administradores gerenciam acessos", "Gestores acompanham módulos", "Operadores acessam rotinas permitidas"],
    },
    fallback: {
      title: "ROUTflex Assistant",
      intro: "Esta funcionalidade será expandida em futuras versões do ROUTflex Assistant.",
    },
  };

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char]));
  }

  function normalizeTerm(value) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function findAssistantTopic(value) {
    const term = normalizeTerm(value);
    if (term.includes("planning") || term.includes("roteir") || term.includes("territ")) return "planning";
    if (term.includes("ops") || term.includes("operacion") || term.includes("auditoria")) return "ops";
    if (term.includes("palm") || term.includes("campo") || term.includes("check")) return "palm";
    if (term.includes("sales") || term.includes("crm") || term.includes("comercial")) return "sales";
    if (term.includes("plano") || term.includes("enterprise")) return "plano";
    if (term.includes("licen")) return "licencas";
    if (term.includes("renov")) return "renovacao";
    if (term.includes("market") || term.includes("contrat")) return "marketplace";
    if (term.includes("segur") || term.includes("2fa") || term.includes("sso") || term.includes("senha")) return "seguranca";
    if (term.includes("integr")) return "integracoes";
    if (term.includes("usuario") || term.includes("user") || term.includes("acesso")) return "usuarios";
    if (term.includes("modulo") || term.includes("modulos")) return "modulos";
    return "fallback";
  }

  function scrollAssistantToEnd() {
    if (assistantConversation) assistantConversation.scrollTop = assistantConversation.scrollHeight;
  }

  function appendAssistantMessage(html, fromUser = false) {
    if (!assistantConversation) return;
    const message = document.createElement("article");
    message.className = fromUser
      ? "assistant-message assistant-message-user"
      : "assistant-message assistant-message-system";
    message.innerHTML = html;
    assistantConversation.appendChild(message);
    scrollAssistantToEnd();
  }

  function renderActionButtons(actions) {
    if (!actions || !actions.length) return "";
    return `
      <div class="assistant-inline-actions">
        ${actions.map(([label, topic]) => `<button type="button" data-assistant-topic="${topic}">${label}</button>`).join("")}
      </div>
    `;
  }

  function renderAssistantAnswer(topic, userLabel = "") {
    const answer = assistantAnswers[topic] || assistantAnswers.fallback;
    if (userLabel) appendAssistantMessage(`<p>${escapeHtml(userLabel)}</p>`, true);
    const list = answer.items
      ? `<ul>${answer.items.map(item => `<li>${item}</li>`).join("")}</ul>`
      : "";
    appendAssistantMessage(`
      <h3>${answer.title}</h3>
      ${answer.intro ? `<p>${answer.intro}</p>` : ""}
      ${list}
      ${renderActionButtons(answer.actions)}
    `);
  }

  function openAssistant() {
    if (!assistantPanel) return;
    assistantPanel.classList.add("is-open");
    assistantPanel.setAttribute("aria-hidden", "false");
    assistantTrigger?.setAttribute("aria-expanded", "true");
    window.setTimeout(() => assistantQuestion?.focus(), 180);
  }

  function closeAssistant() {
    if (!assistantPanel) return;
    assistantPanel.classList.remove("is-open");
    assistantPanel.setAttribute("aria-hidden", "true");
    assistantTrigger?.setAttribute("aria-expanded", "false");
    assistantTrigger?.focus();
  }

  assistantTrigger?.addEventListener("click", openAssistant);
  assistantClose?.addEventListener("click", closeAssistant);
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-assistant-topic]");
    if (!button || !assistantPanel?.contains(button)) return;
    renderAssistantAnswer(button.dataset.assistantTopic, button.textContent.trim());
  });
  assistantForm?.addEventListener("submit", event => {
    event.preventDefault();
    const value = assistantQuestion?.value.trim() || "";
    if (!value) return;
    renderAssistantAnswer(findAssistantTopic(value), value);
    if (assistantQuestion) assistantQuestion.value = "";
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && assistantPanel?.classList.contains("is-open")) closeAssistant();
  });

  document.querySelectorAll("button").forEach(button => {
    if (button.closest(".logout-modal") || button.closest(".assistant-panel") || button.id === "logoutTrigger" || button.id === "assistantTrigger") return;
    button.addEventListener("click", () => {
      const original = button.textContent;
      button.textContent = original.includes("Solicitar") ? "Solicitação registrada" : "Ação simulada";
      button.disabled = true;
      window.setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 1200);
    });
  });
})();
