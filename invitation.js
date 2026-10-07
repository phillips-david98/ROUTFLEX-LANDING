(function initInvitation() {
  "use strict";
  const Core = window.RoutflexCore;
  const $ = (id) => document.getElementById(id);
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  let token = fragment.get("token") || "";
  const expectedTenantId = fragment.get("tenantId") || undefined;
  // O segredo não permanece no histórico, no storage ou na URL de navegação.
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  fragment.delete("token");
  let preview = null;
  let accepting = false;
  let canAccept = false;

  function showError(error) {
    $("acceptError").textContent = Core.friendlyError(error);
    $("acceptError").hidden = false;
  }

  async function loadInvitation() {
    if (!token) {
      $("inviteTitle").textContent = "Link de convite necessário";
      $("inviteDescription").textContent = "Abra o link completo enviado pelo responsável da empresa.";
      return;
    }
    try {
      preview = await Core.api.previewInvitation(token, expectedTenantId);
      $("inviteTitle").textContent = preview.tenant.displayName;
      $("acceptEmail").value = preview.email;
      const status = Core.LABELS.invitationStatus[preview.status] || preview.status;
      $("inviteDescription").textContent = `${status}${preview.isTenantOwner ? " · OWNER da empresa" : ""}`;
      if (preview.status !== "PENDING") {
        $("inviteDescription").textContent += preview.status === "ACCEPTED"
          ? ". Este convite já foi aceito. Acesse o Workspace."
          : ". Solicite um novo convite ao responsável da empresa.";
        token = "";
        return;
      }
      if (!["ACTIVE", "TRIAL", "PROVISIONING"].includes(preview.tenant.status)) {
        $("inviteDescription").textContent = `Empresa ${Core.LABELS.tenantStatus[preview.tenant.status] || preview.tenant.status}. O aceite estará disponível quando a plataforma ativar a empresa.`;
        return;
      }
      $("acceptForm").hidden = false;
      canAccept = true;
      $("newAccountFields").hidden = !preview.needsPassword;
      $("acceptFullName").required = preview.needsPassword;
      $("acceptPassword").required = preview.needsPassword;
      if (preview.tenant.status === "PROVISIONING") $("inviteDescription").textContent += ". Empresa em configuração; Workspace liberado após ativação.";
      if (!preview.needsPassword) $("inviteDescription").textContent += ". Sua conta existente será vinculada a esta empresa; sua senha será mantida.";
    } catch (error) {
      $("inviteTitle").textContent = "Convite indisponível";
      showError(error);
    }
  }

  $("acceptForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (accepting || !canAccept || !preview || !token || !$("acceptForm").reportValidity()) return;
    accepting = true;
    $("acceptSubmit").disabled = true;
    $("acceptError").hidden = true;
    const payload = { token, tenantId: expectedTenantId || preview.tenant.id };
    if (preview.needsPassword) {
      payload.fullName = $("acceptFullName").value.trim();
      payload.password = $("acceptPassword").value;
    }
    try {
      await Core.api.acceptInvitation(payload);
      token = "";
      canAccept = false;
      $("acceptPassword").value = "";
      $("acceptForm").hidden = true;
      $("acceptSuccess").hidden = false;
      $("inviteDescription").textContent = "Aceito";
      $("workspaceLink").focus();
    } catch (error) {
      showError(error);
      if (["INVITATION_NOT_PENDING", "INVITATION_EXPIRED", "TENANT_NOT_ACTIVE", "USER_NOT_ACTIVE", "CROSS_TENANT_REFERENCE"].includes(error.code)) { $("acceptForm").hidden = true; canAccept = false; }
    } finally {
      accepting = false;
      $("acceptSubmit").disabled = false;
    }
  });

  loadInvitation();
})();
