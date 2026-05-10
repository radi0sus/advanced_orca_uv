// static/js/export.js

(function () {
  "use strict";

  window.OrcaUV = window.OrcaUV || {};

  const {
    UNITS,
    DEFAULTS,
    PARSER,
  } = window.OrcaUV.Constants;

  async function exportPng(plotElement, options = {}) {
    if (!plotElement || !window.Plotly) {
      throw new Error("No plot available.");
    }

    if (!plotElement.data || plotElement.data.length === 0) {
      throw new Error("No plot data to export.");
    }

    const filename = buildExportBaseName(options.fileName, "spectrum");

    await Plotly.downloadImage(plotElement, {
      format: "png",
      filename,
      width: 1400,
      height: 900,
      scale: 2,
    });
  }

  function exportCsv(spectrum, uiState = {}, options = {}) {
    if (
      !spectrum ||
      !Array.isArray(spectrum.xCm1) ||
      spectrum.xCm1.length === 0 ||
      !Array.isArray(spectrum.intensityScaled)
    ) {
      throw new Error("No calculated spectrum to export.");
    }

    const csvText = buildSpectrumCsv(spectrum, uiState);
    const filename = `${buildExportBaseName(options.fileName, "spectrum")}.csv`;

    downloadTextFile(filename, csvText, "text/csv;charset=utf-8");
  }

  function exportTransitionsMarkdown(parsedOrca, uiState = {}, options = {}) {
    const transitions = parsedOrca?.transitions ?? [];

    if (!Array.isArray(transitions) || transitions.length === 0) {
      throw new Error("No transitions to export.");
    }

    const markdownText = buildTransitionsMarkdown(parsedOrca, uiState);
    const filename = `${buildExportBaseName(options.fileName, "transitions")}.md`;

    downloadTextFile(filename, markdownText, "text/markdown;charset=utf-8");
  }

  function buildSpectrumCsv(spectrum, uiState = {}) {
    const xCm1Raw = spectrum.xCm1;
    const intensity = getRawIntensityArray(spectrum);
    const intensityScaled = spectrum.intensityScaled;

    const shiftCm1 = Number.isFinite(uiState.spectrumShiftCm1)
      ? uiState.spectrumShiftCm1
      : 0;

    const rows = [
      [
        "x_nm",
        "x_cm-1",
        "x_eV",
        "intensity",
        "intensity_scaled",
      ].join(","),
    ];

    const length = Math.min(
      xCm1Raw.length,
      intensity.length,
      intensityScaled.length,
    );

    for (let index = 0; index < length; index += 1) {
      const rawCm1 = xCm1Raw[index];
      const displayCm1 = Number.isFinite(rawCm1)
        ? rawCm1 + shiftCm1
        : NaN;

      if (!Number.isFinite(displayCm1) || displayCm1 <= 0) {
        continue;
      }

      const xNm = UNITS.NM_CM1_FACTOR / displayCm1;
      const xEv = displayCm1 / UNITS.CM1_PER_EV;

      const rawY = intensity[index];
      const scaledY = intensityScaled[index];

      rows.push([
        formatCsvNumber(xNm, 8),
        formatCsvNumber(displayCm1, 8),
        formatCsvNumber(xEv, 10),
        formatCsvNumber(rawY, 12),
        formatCsvNumber(scaledY, 12),
      ].join(","));
    }

    return `${rows.join("\n")}\n`;
  }

  function getRawIntensityArray(spectrum) {
    if (Array.isArray(spectrum.intensity)) {
      return spectrum.intensity;
    }

    if (Array.isArray(spectrum.intensityRaw)) {
      return spectrum.intensityRaw;
    }

    /*
      Fallback:
      If the spectrum object only exposes intensityScaled, export that as raw too.
      This should normally not be needed, but avoids a broken CSV.
    */
    if (Array.isArray(spectrum.intensityScaled)) {
      return spectrum.intensityScaled;
    }

    return [];
  }

  function buildTransitionsMarkdown(parsedOrca, uiState = {}) {
    const metadata = parsedOrca?.metadata ?? {};
    const transitions = parsedOrca?.transitions ?? [];

    const showTransitionColumn =
      Boolean(uiState.showTransitionLabels) &&
      transitions.some(hasMeaningfulTransitionLabel);

    const lines = [];

    lines.push("# ORCA UV-Vis transitions");
    lines.push("");

    lines.push(`File: ${escapeMarkdownInline(metadata.fileName || "—")}  `);
    lines.push(`ORCA version: ${escapeMarkdownInline(metadata.orcaVersion || "—")}  `);
    lines.push(`UV-Vis section: ${escapeMarkdownInline(metadata.spectrumSource || "—")}  `);
    lines.push(`Transitions: ${Number.isFinite(metadata.transitionCount) ? metadata.transitionCount : transitions.length}  `);
    
    appendHomoLumoMarkdownMetadata(lines, metadata.homoLumo);
    
    lines.push(`Assignment display: ${escapeMarkdownInline(assignmentDisplayLabel(uiState.assignmentDisplay))}  `);
    lines.push(`Assignment selection: ${escapeMarkdownInline(assignmentSelectionLabel(uiState.assignmentSelectionMode))}  `);

    if (uiState.assignmentSelectionMode === "manual") {
      lines.push(`Assignment threshold: ${formatInteger(uiState.assignmentThresholdPercent)} %  `);
    }

    lines.push(`Transition labels: ${showTransitionColumn ? "shown" : "hidden"}  `);
    lines.push("");

    const header = showTransitionColumn
      ? ["State", "Transition", "λ / nm", "E / eV", "E / cm⁻¹", "fosc", "Assignment"]
      : ["State", "λ / nm", "E / eV", "E / cm⁻¹", "fosc", "Assignment"];

    const alignment = showTransitionColumn
      ? [":---", ":---", "---:", "---:", "---:", "---:", ":---"]
      : [":---", "---:", "---:", "---:", "---:", ":---"];

    lines.push(markdownRow(header));
    lines.push(markdownRow(alignment));

    for (const transition of transitions) {
      const row = showTransitionColumn
        ? [
            getBaseStateLabel(transition),
            getTransitionLabelForExport(transition),
            formatNumber(transition.wavelengthNm, 1),
            formatNumber(transition.energyEv, 3),
            formatNumber(transition.energyCm1, 1),
            formatFosc(transition.fosc),
            getTransitionAssignmentText(transition, uiState),
          ]
        : [
            getBaseStateLabel(transition),
            formatNumber(transition.wavelengthNm, 1),
            formatNumber(transition.energyEv, 3),
            formatNumber(transition.energyCm1, 1),
            formatFosc(transition.fosc),
            getTransitionAssignmentText(transition, uiState),
          ];

      lines.push(markdownRow(row));
    }

    lines.push("");

    return lines.join("\n");
  }

  function markdownRow(values) {
    return `| ${values.map(escapeMarkdownCell).join(" | ")} |`;
  }

  function getBaseStateLabel(transition) {
    return transition?.label ?? `S${transition?.state ?? "?"}`;
  }

  function hasMeaningfulTransitionLabel(transition) {
    const baseLabel = getBaseStateLabel(transition);
    const transitionLabel = transition?.transitionLabel;

    return Boolean(
      transitionLabel &&
      transitionLabel !== "—" &&
      transitionLabel !== baseLabel,
    );
  }

  function getTransitionLabelForExport(transition) {
    return hasMeaningfulTransitionLabel(transition)
      ? transition.transitionLabel
      : "—";
  }

  function getTransitionAssignmentText(transition, uiState) {
    const displayMode = uiState?.assignmentDisplay || DEFAULTS.assignmentDisplay;
    const selectionMode = uiState?.assignmentSelectionMode || DEFAULTS.assignmentSelectionMode;

    const field = displayMode === "orca" || displayMode === "orca-orbitals"
      ? "transition"
      : "assignment";

    const assignments = transition?.excitedState?.assignments;

    if (selectionMode === "manual") {
      return summarizeAssignmentFieldManual(assignments, field, uiState);
    }

    return summarizeAssignmentFieldAuto(assignments, field);
  }

  function summarizeAssignmentFieldAuto(assignments, field) {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return "—";
    }

    /*
      Auto mode follows the old main-assignment mechanism:
      - weight >= PARSER.mainAssignmentWeightThreshold
      - strongest first
      - max PARSER.maxMainAssignments
      - fallback: strongest assignment
    */
    const threshold = Number.isFinite(PARSER?.mainAssignmentWeightThreshold)
      ? PARSER.mainAssignmentWeightThreshold
      : 0.05;

    const maxAssignments = Number.isInteger(PARSER?.maxMainAssignments)
      ? PARSER.maxMainAssignments
      : 3;

    const weightedAssignments = assignments
      .filter((assignment) => Number.isFinite(assignment.weight))
      .sort((a, b) => b.weight - a.weight);

    const selected = weightedAssignments
      .filter((assignment) => assignment.weight >= threshold)
      .slice(0, maxAssignments);

    const finalSelection = selected.length > 0
      ? selected
      : weightedAssignments.slice(0, 1);

    if (finalSelection.length === 0) {
      return "—";
    }

    return finalSelection
      .map((assignment) => {
        const value =
          assignment?.[field] ||
          assignment?.assignment ||
          assignment?.transition ||
          "—";

        return `${value} (${formatAssignmentPercent(assignment.weight)})`;
      })
      .join(", ");
  }

  function summarizeAssignmentFieldManual(assignments, field, uiState) {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return "—";
    }

    const rawThresholdPercent = Number.isFinite(uiState?.assignmentThresholdPercent)
      ? uiState.assignmentThresholdPercent
      : DEFAULTS.assignmentThresholdPercent;

    const thresholdPercent = Math.min(100, Math.max(0, rawThresholdPercent));
    const threshold = thresholdPercent / 100;

    const selected = assignments
      .filter((assignment) => Number.isFinite(assignment.weight))
      .filter((assignment) => assignment.weight >= threshold)
      .sort((a, b) => b.weight - a.weight);

    if (selected.length === 0) {
      return "—";
    }

    return selected
      .map((assignment) => {
        const value =
          assignment?.[field] ||
          assignment?.assignment ||
          assignment?.transition ||
          "—";

        return `${value} (${formatAssignmentPercent(assignment.weight)})`;
      })
      .join(", ");
  }

  function appendHomoLumoMarkdownMetadata(lines, homoLumo) {
    if (!homoLumo) {
      lines.push("HOMO/LUMO mapping: —  ");
      return;
    }
  
    if (homoLumo.source) {
      lines.push(`HOMO/LUMO source: ${escapeMarkdownInline(homoLumo.source)}  `);
    }
  
    const alphaText = formatHomoLumoReference(homoLumo.alpha);
    const betaText = formatHomoLumoReference(homoLumo.beta);
  
    if (alphaText !== "—" || betaText !== "—") {
      lines.push(`HOMOα/LUMOα: ${escapeMarkdownInline(alphaText)}  `);
      lines.push(`HOMOβ/LUMOβ: ${escapeMarkdownInline(betaText)}  `);
      return;
    }
  
    const legacyText = formatLegacyHomoLumoReference(homoLumo);
  
    if (legacyText !== "—") {
      lines.push(`HOMO/LUMO: ${escapeMarkdownInline(legacyText)}  `);
    } else {
      lines.push("HOMO/LUMO mapping: —  ");
    }
  }
  
  function formatHomoLumoReference(reference) {
    if (!reference) {
      return "—";
    }
  
    const homo = formatOrbitalIndex(reference.homo);
    const lumo = formatOrbitalIndex(reference.lumo);
  
    if (homo === "—" && lumo === "—") {
      return "—";
    }
  
    return `${homo} / ${lumo}`;
  }
  
  function formatLegacyHomoLumoReference(homoLumo) {
    if (!homoLumo) {
      return "—";
    }
  
    const homo = formatOrbitalIndex(homoLumo.homo);
    const lumo = formatOrbitalIndex(homoLumo.lumo);
  
    if (homo === "—" && lumo === "—") {
      return "—";
    }
  
    return `${homo} / ${lumo}`;
  }
  
  function formatOrbitalIndex(value) {
    return Number.isInteger(value) ? String(value) : "—";
  }

  function assignmentDisplayLabel(value) {
    switch (value) {
      case "orca":
      case "orca-orbitals":
        return "ORCA orbitals";
      case "homo-lumo":
      default:
        return "HOMO/LUMO";
    }
  }

  function assignmentSelectionLabel(value) {
    switch (value) {
      case "manual":
        return "Manual";
      case "auto":
      default:
        return "Auto";
    }
  }

  function buildExportBaseName(fileName, suffix) {
    const base = stripKnownExtension(fileName || "orca_uvvis");
    const safeBase = sanitizeFileName(base || "orca_uvvis");
    const safeSuffix = sanitizeFileName(suffix || "export");

    return `${safeBase}_${safeSuffix}`;
  }

  function stripKnownExtension(fileName) {
    return String(fileName || "")
      .replace(/\.(out|log|txt|orca)$/i, "")
      .replace(/\.(csv|dat)$/i, "");
  }

  function sanitizeFileName(value) {
    return String(value || "")
      .trim()
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 160);
  }

  function downloadTextFile(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function formatCsvNumber(value, digits) {
    if (!Number.isFinite(value)) {
      return "";
    }

    return Number(value).toFixed(digits);
  }

  function formatNumber(value, digits = 2) {
    if (!Number.isFinite(value)) {
      return "—";
    }

    return Number(value).toFixed(digits);
  }

  function formatInteger(value) {
    if (!Number.isFinite(value)) {
      return "—";
    }

    return Math.round(value).toString();
  }

  function formatFosc(value) {
    if (!Number.isFinite(value)) {
      return "—";
    }

    return Number(value).toFixed(9);
  }

  function formatAssignmentPercent(value) {
    if (!Number.isFinite(value)) {
      return "—";
    }

    return `${(value * 100).toFixed(1)}%`;
  }

  function escapeMarkdownCell(value) {
    return escapeMarkdownInline(value)
      .replaceAll("\n", "<br>");
  }

  function escapeMarkdownInline(value) {
    return String(value ?? "—")
      .replaceAll("\\", "\\\\")
      .replaceAll("|", "\\|")
      .replaceAll("\r", "")
      .replaceAll("\n", " ");
  }

  window.OrcaUV.Export = {
    exportPng,
    exportCsv,
    exportTransitionsMarkdown,
  };
})();