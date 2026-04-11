// @ts-nocheck
// PR Buildr webview client-side script
// Handles UI interactions and communicates with the extension host via postMessage.

(function () {
  const vscode = acquireVsCodeApi();

  // State
  let state = {
    title: "",
    body: "",
    base: "",
    head: "",
    branches: [],
    isDraft: false,
    isGenerating: false,
    isCreating: false,
    isCreated: false,
    jiraTicketId: "",
    jiraConfigured: false,
    images: [], // Array of { id, fileName, altText, previewDataUrl }
    isPreviewMode: false,
    hasDraft: false,
  };

  // DOM elements (resolved after DOMContentLoaded)
  let titleField;
  let bodyField;
  let baseDropdown;
  let draftCheckbox;
  let createBtn;
  let regenerateBtn;
  let statusMessage;
  let statusBar;
  let progressRing;
  let successResult;
  let staleWarning;
  let jiraSection;
  let jiraField;
  let integrationsSection;
  let integrationsToggle;
  let integrationsChevron;
  let integrationsBody;
  let jiraConfigureBtn;
  let ignoreIntegrationsBtn;
  // Image elements
  let imageGrid;
  let addImageBtn;
  let imageTip;
  let imageStaleWarning;
  // Preview elements
  let editTab;
  let previewTab;
  let bodyPreview;

  // Initialize DOM references
  function initElements() {
    titleField = document.getElementById("title-field");
    bodyField = document.getElementById("body-field");
    baseDropdown = document.getElementById("base-dropdown");
    draftCheckbox = document.getElementById("draft-checkbox");
    createBtn = document.getElementById("create-btn");
    regenerateBtn = document.getElementById("regenerate-btn");
    statusMessage = document.getElementById("status-message");
    statusBar = document.getElementById("status-bar");
    progressRing = document.getElementById("progress-ring");
    successResult = document.getElementById("success-result");
    staleWarning = document.getElementById("stale-warning");
    jiraSection = document.getElementById("jira-section");
    jiraField = document.getElementById("jira-field");
    integrationsSection = document.getElementById("integrations-section");
    integrationsToggle = document.getElementById("integrations-toggle");
    integrationsChevron = document.getElementById("integrations-chevron");
    integrationsBody = document.getElementById("integrations-body");
    jiraConfigureBtn = document.getElementById("jira-configure-btn");
    ignoreIntegrationsBtn = document.getElementById("ignore-integrations-btn");
    // Image elements
    imageGrid = document.getElementById("image-grid");
    addImageBtn = document.getElementById("add-image-btn");
    imageTip = document.getElementById("image-tip");
    imageStaleWarning = document.getElementById("image-stale-warning");
    // Preview elements
    editTab = document.getElementById("edit-tab");
    previewTab = document.getElementById("preview-tab");
    bodyPreview = document.getElementById("body-preview");

    // Event listeners
    if (baseDropdown) {
      baseDropdown.addEventListener("change", onBaseChange);
    }
    if (createBtn) {
      createBtn.addEventListener("click", onCreate);
    }
    if (regenerateBtn) {
      regenerateBtn.addEventListener("click", onRegenerate);
    }
    if (titleField) {
      titleField.addEventListener("input", () => {
        state.title = titleField.value;
      });
    }
    if (bodyField) {
      bodyField.addEventListener("input", () => {
        state.body = bodyField.value;
      });
    }
    if (jiraField) {
      jiraField.addEventListener("input", () => {
        state.jiraTicketId = jiraField.value;
      });
    }

    // Integrations toggle
    if (integrationsToggle) {
      integrationsToggle.addEventListener("click", () => {
        if (integrationsBody) {
          const isHidden = integrationsBody.classList.contains("hidden");
          integrationsBody.classList.toggle("hidden");
          if (integrationsChevron) {
            integrationsChevron.textContent = isHidden ? "\u25BC" : "\u25B6";
          }
        }
      });
    }

    // Configure Jira button
    if (jiraConfigureBtn) {
      jiraConfigureBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "configureJira" });
      });
    }

    // Ignore integrations button
    if (ignoreIntegrationsBtn) {
      ignoreIntegrationsBtn.addEventListener("click", () => {
        if (integrationsSection) integrationsSection.classList.add("hidden");
        vscode.postMessage({ type: "ignoreIntegrations" });
      });
    }

    // Add image button
    if (addImageBtn) {
      addImageBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "addImage" });
      });
    }

    // Edit/Preview tabs
    if (editTab) {
      editTab.addEventListener("click", onEditTab);
    }
    if (previewTab) {
      previewTab.addEventListener("click", onPreviewTab);
    }
  }

  // ── Incoming messages from extension ──

  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "init":
        handleInit(msg.data);
        break;
      case "draft":
        handleDraft(msg.data);
        break;
      case "status":
        handleStatus(msg.data);
        break;
      case "creating":
        handleCreating();
        break;
      case "created":
        handleCreated(msg.data);
        break;
      case "imageAdded":
        handleImageAdded(msg.data);
        break;
      case "imageRemoved":
        handleImageRemoved(msg.data);
        break;
      case "uploadingImages":
        handleUploadingImages(msg.data);
        break;
      case "imageUploadFailed":
        handleImageUploadFailed(msg.data);
        break;
    }
  });

  function handleInit(data) {
    state.head = data.head;
    state.base = data.base;
    state.branches = data.branches;

    // Set head branch display
    const headValue = document.getElementById("head-value");
    if (headValue) headValue.textContent = data.head;

    // Populate base dropdown
    if (baseDropdown) {
      baseDropdown.innerHTML = "";
      for (const branch of data.branches) {
        const option = document.createElement("vscode-option");
        option.value = branch;
        option.textContent = branch;
        if (branch === data.base) {
          option.selected = true;
        }
        baseDropdown.appendChild(option);
      }
    }

    // Set info fields
    const templateValue = document.getElementById("template-value");
    if (templateValue) templateValue.textContent = data.templateSource;

    const providerValue = document.getElementById("provider-value");
    if (providerValue) providerValue.textContent = `${data.provider} / ${data.model}`;

    // Jira UI setup
    const jiraConfigured = data.jiraEnabled && data.jiraProjectUrl && data.jiraProjectKey;
    state.jiraConfigured = Boolean(jiraConfigured);

    if (jiraConfigured) {
      // Show Jira field directly, hide integrations dropdown
      if (jiraSection) jiraSection.classList.remove("hidden");
      if (integrationsSection) integrationsSection.classList.add("hidden");
      if (jiraField) {
        jiraField.value = data.jiraTicketId || "";
        jiraField.disabled = false;
        state.jiraTicketId = data.jiraTicketId || "";
      }
    } else if (data.jiraEnabled) {
      // Show integrations dropdown (collapsed, with grayed Jira option)
      if (jiraSection) jiraSection.classList.add("hidden");
      if (integrationsSection) integrationsSection.classList.remove("hidden");
    } else {
      // Jira disabled — hide everything
      if (jiraSection) jiraSection.classList.add("hidden");
      if (integrationsSection) integrationsSection.classList.add("hidden");
    }

    // Show generating state
    setGenerating(true);
    setStatus("Generating PR draft...", false);
  }

  function handleDraft(data) {
    state.title = data.title;
    state.body = data.body;
    state.hasDraft = true;

    if (titleField) titleField.value = data.title;
    if (bodyField) bodyField.value = data.body;

    setGenerating(false);
    setStatus("Draft ready. Review and edit before creating.", false);
    hideStaleWarning();
    hideImageStaleWarning();

    // If preview is active, re-render it
    if (state.isPreviewMode) {
      renderPreview();
    }
  }

  function handleStatus(data) {
    setStatus(data.message, data.isError || false);
    if (data.isError) {
      setGenerating(false);
      setCreating(false);
    }
  }

  function handleCreating() {
    setCreating(true);
    setStatus("Creating pull request...", false);
  }

  function handleCreated(data) {
    state.isCreated = true;
    setCreating(false);

    const label = data.draft ? "Draft PR" : "PR";
    setStatus(`${label} #${data.number} created successfully!`, false, true);

    // Show success result with link
    if (successResult) {
      successResult.innerHTML = `
        <strong>${label} #${data.number} created!</strong><br>
        <a href="${data.url}" title="Open in browser">${data.url}</a>
      `;
      successResult.classList.remove("hidden");
    }

    // Disable create button (already created)
    if (createBtn) createBtn.disabled = true;
  }

  // ── Image message handlers ──

  function handleImageAdded(data) {
    state.images.push(data);
    renderImageGrid();
    showImageTip();
    // Show stale warning if draft already exists
    if (state.hasDraft) {
      showImageStaleWarning();
    }
  }

  function handleImageRemoved(data) {
    state.images = state.images.filter(function (img) {
      return img.id !== data.id;
    });
    renderImageGrid();
    if (state.images.length === 0) {
      hideImageTip();
      hideImageStaleWarning();
    }
  }

  function handleUploadingImages(data) {
    setStatus("Uploading image " + data.current + " of " + data.total + "...", false);
  }

  function handleImageUploadFailed(data) {
    setStatus("Some images failed to upload: " + data.message, true);
  }

  // ── Image grid rendering ──

  function renderImageGrid() {
    if (!imageGrid) return;
    imageGrid.innerHTML = "";

    for (var i = 0; i < state.images.length; i++) {
      var img = state.images[i];
      var card = document.createElement("div");
      card.className = "image-card";
      card.innerHTML =
        '<img class="image-card-thumb" src="' +
        escapeAttr(img.previewDataUrl) +
        '" alt="' +
        escapeAttr(img.altText) +
        '">' +
        '<div class="image-card-info">' +
        '<span class="image-card-label">{image:' +
        escapeHtml(img.id) +
        "}</span>" +
        '<input class="image-card-alt" type="text" value="' +
        escapeAttr(img.altText) +
        '" placeholder="Alt text..." data-id="' +
        escapeAttr(img.id) +
        '">' +
        '<button class="image-card-remove" data-id="' +
        escapeAttr(img.id) +
        '" title="Remove image">&times;</button>' +
        "</div>";
      imageGrid.appendChild(card);
    }

    // Attach event listeners
    var altInputs = imageGrid.querySelectorAll(".image-card-alt");
    for (var j = 0; j < altInputs.length; j++) {
      altInputs[j].addEventListener("input", function (e) {
        var id = e.target.getAttribute("data-id");
        var newAlt = e.target.value;
        // Update local state
        for (var k = 0; k < state.images.length; k++) {
          if (state.images[k].id === id) {
            state.images[k].altText = newAlt;
            break;
          }
        }
        vscode.postMessage({ type: "updateImageAlt", data: { id: id, altText: newAlt } });
      });
    }

    var removeButtons = imageGrid.querySelectorAll(".image-card-remove");
    for (var j = 0; j < removeButtons.length; j++) {
      removeButtons[j].addEventListener("click", function (e) {
        var id = e.target.getAttribute("data-id");
        vscode.postMessage({ type: "removeImage", data: { id: id } });
      });
    }
  }

  // ── Preview tab ──

  function onEditTab() {
    state.isPreviewMode = false;
    if (editTab) editTab.classList.add("active");
    if (previewTab) previewTab.classList.remove("active");
    if (bodyField) bodyField.classList.remove("hidden");
    if (bodyPreview) bodyPreview.classList.add("hidden");
  }

  function onPreviewTab() {
    state.isPreviewMode = true;
    if (previewTab) previewTab.classList.add("active");
    if (editTab) editTab.classList.remove("active");
    if (bodyField) bodyField.classList.add("hidden");
    if (bodyPreview) bodyPreview.classList.remove("hidden");
    renderPreview();
  }

  function renderPreview() {
    if (!bodyPreview) return;
    var text = (bodyField ? bodyField.value : state.body) || "";

    // Replace {image:N} with actual <img> tags using data URLs
    for (var i = 0; i < state.images.length; i++) {
      var img = state.images[i];
      // Match by id
      var idPattern = new RegExp("\\{image:" + escapeRegex(img.id) + "\\}", "g");
      text = text.replace(idPattern, "![" + img.altText + "](" + img.previewDataUrl + ")");
      // Match by filename
      var fnPattern = new RegExp("\\{image:" + escapeRegex(img.fileName) + "\\}", "gi");
      text = text.replace(fnPattern, "![" + img.altText + "](" + img.previewDataUrl + ")");
    }

    // Render markdown to HTML using marked (loaded globally)
    if (typeof marked !== "undefined" && marked.parse) {
      bodyPreview.innerHTML = marked.parse(text, { breaks: true });
    } else {
      // Fallback: show as preformatted text
      bodyPreview.textContent = text;
    }
  }

  // ── Outgoing messages to extension ──

  function onBaseChange() {
    if (!baseDropdown) return;
    state.base = baseDropdown.value;
    vscode.postMessage({ type: "changeBase", data: { base: state.base } });
    showStaleWarning();
  }

  function onCreate() {
    var title = titleField ? titleField.value.trim() : "";
    if (!title) {
      setStatus("Title cannot be empty.", true);
      return;
    }

    vscode.postMessage({
      type: "create",
      data: {
        title: titleField ? titleField.value : "",
        body: bodyField ? bodyField.value : "",
        base: state.base,
        draft: draftCheckbox ? draftCheckbox.checked : false,
        jiraTicketId: state.jiraTicketId || undefined,
      },
    });
  }

  function onRegenerate() {
    setGenerating(true);
    setStatus("Regenerating PR draft...", false);
    hideStaleWarning();
    hideImageStaleWarning();
    if (successResult) successResult.classList.add("hidden");
    if (createBtn) createBtn.disabled = false;
    state.isCreated = false;
    vscode.postMessage({ type: "regenerate" });
  }

  // ── UI state helpers ──

  function setGenerating(generating) {
    state.isGenerating = generating;
    if (createBtn) createBtn.disabled = generating || state.isCreated;
    if (regenerateBtn) regenerateBtn.disabled = generating;
    if (titleField) titleField.disabled = generating;
    if (bodyField) bodyField.disabled = generating;
    if (progressRing) {
      progressRing.classList.toggle("hidden", !generating);
    }
  }

  function setCreating(creating) {
    state.isCreating = creating;
    if (createBtn) createBtn.disabled = creating;
    if (regenerateBtn) regenerateBtn.disabled = creating;
    if (titleField) titleField.disabled = creating;
    if (bodyField) bodyField.disabled = creating;
    if (baseDropdown) baseDropdown.disabled = creating;
    if (progressRing) {
      progressRing.classList.toggle("hidden", !creating);
    }
  }

  function setStatus(message, isError, isSuccess) {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.className = "status-message";
    if (isError) statusMessage.className = "status-error";
    if (isSuccess) statusMessage.className = "status-success";
  }

  function showStaleWarning() {
    if (staleWarning) staleWarning.classList.remove("hidden");
  }

  function hideStaleWarning() {
    if (staleWarning) staleWarning.classList.add("hidden");
  }

  function showImageTip() {
    if (imageTip) imageTip.classList.remove("hidden");
  }

  function hideImageTip() {
    if (imageTip) imageTip.classList.add("hidden");
  }

  function showImageStaleWarning() {
    if (imageStaleWarning) imageStaleWarning.classList.remove("hidden");
  }

  function hideImageStaleWarning() {
    if (imageStaleWarning) imageStaleWarning.classList.add("hidden");
  }

  // ── Escape helpers ──

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // ── Init ──

  document.addEventListener("DOMContentLoaded", () => {
    initElements();
  });

  // Fallback: if DOM is already loaded
  if (document.readyState !== "loading") {
    initElements();
  }
})();
