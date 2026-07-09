// static/js/ui.js

(function () {
  "use strict";

  window.OrcaUV = window.OrcaUV || {};

  const { DEFAULTS, UNITS, THRESHOLDS, PARSER } = window.OrcaUV.Constants;
  const { cm1ToEv } = window.OrcaUV.Import;

  function initUi() {
    updateUiReadouts();
    console.info("UI module initialized.");
  }

  function getUiState() {
    return {
      xAxis: getCheckedRadioValue("x-axis", DEFAULTS.xAxis),
      axisDirection: getCheckedRadioValue("axis-direction", DEFAULTS.axisDirection),

      autoRange: getCheckboxValue("auto-range", DEFAULTS.autoRange),
      rangeMin: getOptionalNumberValue("range-min"),
      rangeMax: getOptionalNumberValue("range-max"),
      
      assignmentDisplay: getCheckedRadioValue("assignment-display", DEFAULTS.assignmentDisplay),
      assignmentSelectionMode: getCheckedRadioValue("assignment-selection-mode", DEFAULTS.assignmentSelectionMode),
      assignmentThresholdPercent: getNumberValue("assignment-threshold-slider", DEFAULTS.assignmentThresholdPercent),
      showTransitionLabels: getCheckboxValue("show-transition-labels", DEFAULTS.showTransitionLabels),

      fwhmCm1: getNumberValue("fwhm-slider", DEFAULTS.fwhmCm1),

      normalizeSpectrum: getCheckboxValue("normalize-spectrum", DEFAULTS.normalizeSpectrum),
      scaleFactor: getNumberValue("scale-factor-slider", DEFAULTS.scaleFactor),
      spectrumShiftCm1: getNumberValue("spectrum-shift-slider", DEFAULTS.spectrumShiftCm1),

      showSpectrum: getCheckboxValue("show-spectrum", DEFAULTS.showSpectrum),
      showSpectrumFill: getCheckboxValue("show-spectrum-fill", DEFAULTS.showSpectrumFill),
      showSticks: getCheckboxValue("show-sticks", DEFAULTS.showSticks),
      showStateLabels: getCheckboxValue("show-state-labels", DEFAULTS.showStateLabels),
      showSingleGaussians: getCheckboxValue("show-single-gaussians", DEFAULTS.showSingleGaussians),
      showGaussianAreas: getCheckboxValue("show-gaussian-areas", DEFAULTS.showGaussianAreas),
      showPeakLabels: getCheckboxValue("show-peak-labels", DEFAULTS.showPeakLabels),
      showGrid: getCheckboxValue("show-grid", DEFAULTS.showGrid),
      showEpsilonAxis: getCheckboxValue("show-epsilon-axis", DEFAULTS.showEpsilonAxis),

      detectPeaks: getCheckboxValue("detect-peaks", DEFAULTS.detectPeaks),
      peakHeightPercent: getNumberValue("peak-height-slider", DEFAULTS.peakHeightPercent),
      peakDistanceCm1: getNumberValue("peak-distance-slider", DEFAULTS.peakDistanceCm1),

      showExperimental: getCheckboxValue("show-experimental", DEFAULTS.showExperimental),
      experimentalYType: getSelectValue("experimental-y-type", DEFAULTS.experimentalYType),
      normalizeExperimental: getCheckboxValue("normalize-experimental", DEFAULTS.normalizeExperimental),
      baselineCorrection: getCheckboxValue("baseline-correction", DEFAULTS.baselineCorrection),
      experimentalStyle: getCheckedRadioValue("experimental-style", DEFAULTS.experimentalStyle),
    };
  }

  function updateUiReadouts() {
    const uiState = getUiState();
    
    updateRangeValidation(uiState);

    setText("fwhm-value", `${formatInteger(uiState.fwhmCm1)} cm⁻¹`);
    setText("scale-factor-value", uiState.scaleFactor.toFixed(1));
    setText("spectrum-shift-value", `${formatSignedInteger(uiState.spectrumShiftCm1)} cm⁻¹`);
    setText("peak-height-value", `${formatInteger(uiState.peakHeightPercent)} %`);
    setText("peak-distance-value", `${formatInteger(uiState.peakDistanceCm1)} cm⁻¹`);
    
    setText("assignment-threshold-value", `${formatInteger(uiState.assignmentThresholdPercent)} %`);
    updateAssignmentThresholdControl(uiState);

    setText("plot-axis-pill", `X: ${axisLabel(uiState.xAxis)}`);
    setText("plot-fwhm-pill", `HWHM: ${formatInteger(uiState.fwhmCm1)} cm⁻¹`);

    updateFwhmReadout(uiState.fwhmCm1);

    setText("exp-y-type-info", experimentalYTypeLabel(uiState.experimentalYType));
    setText("exp-normalization-info", uiState.normalizeExperimental ? "enabled" : "disabled");
  }

  function renderOrcaData(parsedOrca) {
    const metadata = parsedOrca?.metadata ?? null;
    const transitions = parsedOrca?.transitions ?? [];
    const excitedStates = parsedOrca?.excitedStates ?? null;

    renderOrcaMetadata(metadata);
    renderTransitionsTable(transitions);
    renderAssignmentsPanel(excitedStates, metadata?.homoLumo ?? null);
  }

  function renderOrcaMetadata(metadata) {
    if (!metadata) {
      clearOrcaMetadata();
      return;
    }

    setText("info-file", metadata.fileName || "—");
    setText("metadata-file-pill", metadata.fileName || "No file");
    setText("info-orca-version", metadata.orcaVersion || "—");
    setText("info-section", metadata.sectionFound ? metadata.spectrumSource : "not found");
    setText("info-transition-count", formatInteger(metadata.transitionCount ?? 0));

    if (metadata.energyRangeCm1) {
      setText(
        "info-energy-range",
        `${formatNumber(metadata.energyRangeCm1.min, 1)}–${formatNumber(metadata.energyRangeCm1.max, 1)} cm⁻¹`,
      );
    } else {
      setText("info-energy-range", "— cm⁻¹");
    }

    if (metadata.wavelengthRangeNm) {
      setText(
        "info-wavelength-range",
        `${formatNumber(metadata.wavelengthRangeNm.min, 1)}–${formatNumber(metadata.wavelengthRangeNm.max, 1)} nm`,
      );
    } else {
      setText("info-wavelength-range", "— nm");
    }

    const fileStatusText = metadata.sectionFound
      ? `Loaded ${metadata.transitionCount ?? 0} UV-Vis transitions.`
      : "No ORCA UV-Vis absorption data found.";

    updateFileStatus(fileStatusText, metadata.sectionFound ? "success" : "warning");

    if (Array.isArray(metadata.warnings) && metadata.warnings.length > 0) {
      console.warn("ORCA parser warnings:", metadata.warnings);
    }
  }

  function renderCurrentSettings(uiState, spectrum = null, autoRangeInfo = null) {
    if (!uiState) {
      return;
    }

    setText("info-x-axis", axisLabel(uiState.xAxis));
    setText("info-axis-direction", axisDirectionLabel(uiState.axisDirection));
    setText("info-range-mode", uiState.autoRange ? "Auto" : "Manual");

    setText(
      "info-displayed-range",
      formatDisplayedRange(autoRangeInfo?.range, uiState.xAxis),
    );

    setText("info-fwhm", `${formatInteger(uiState.fwhmCm1 * 2)} cm⁻¹`);
    setText("info-spectrum-shift", `${formatSignedInteger(uiState.spectrumShiftCm1)} cm⁻¹`);
    setText("info-normalize-spectrum", uiState.normalizeSpectrum ? "enabled" : "disabled");
    setText(
      "info-scale-factor",
      Number.isFinite(uiState.scaleFactor) ? uiState.scaleFactor.toFixed(1) : "—",
    );

    setText(
      "info-outside-auto-range",
      formatOutsideAutoRange(autoRangeInfo?.outsideTransitions, uiState.xAxis),
    );
  }

  function renderTransitionsTable(transitions, uiState = getUiState()) {
    const tableBody = document.getElementById("transitions-table-body");
    const countPill = document.getElementById("transitions-count-pill");

    const transitionCount = Array.isArray(transitions) ? transitions.length : 0;

    if (countPill) {
      countPill.textContent = `${transitionCount} ${
        transitionCount === 1 ? "transition" : "transitions"
      }`;
    }

    if (!tableBody) return;

    if (!Array.isArray(transitions) || transitions.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6">No UV-Vis transitions loaded.</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = transitions
      .map((transition) => {
        const stateLabel = escapeHtml(getTransitionStateLabel(transition, uiState));
        const wavelength = formatNumber(transition.wavelengthNm, 1);
        const energyEv = formatNumber(transition.energyEv, 3);
        const energyCm1 = formatNumber(transition.energyCm1, 1);
        const fosc = formatScientificOrFixed(transition.fosc);
        // const assignment = escapeHtml(transition.assignment ?? "—");
        const assignment = escapeHtml(getTransitionAssignmentText(transition, uiState));
        const rowClass = getTransitionRowClass(transition);
        
        return `
          <tr class="${rowClass}">
            <td>${stateLabel}</td>
            <td>${wavelength}</td>
            <td>${energyEv}</td>
            <td>${energyCm1}</td>
            <td>${fosc}</td>
            <td>${assignment}</td>
          </tr>
        `;
      })
      .join("");
  }

  function getTransitionRowClass(transition) {
    const threshold = THRESHOLDS?.significantFosc ?? 0.005;
    const fosc = Number(transition?.fosc);
  
    if (Number.isFinite(fosc) && fosc >= threshold) {
      return "fosc-significant";
    }
  
    return "";
  }

  function getTransitionStateLabel(transition, uiState) {
    const baseLabel = transition?.label ?? `S${transition?.state ?? "?"}`;
  
    if (!uiState?.showTransitionLabels) {
      return baseLabel;
    }
  
    const transitionLabel = transition?.transitionLabel;
  
    if (
      !transitionLabel ||
      transitionLabel === "—" ||
      transitionLabel === baseLabel
    ) {
      return baseLabel;
    }
  
    return `${baseLabel} (${transitionLabel})`;
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
  
        1. keep assignments with weight >= PARSER.mainAssignmentWeightThreshold
        2. sort by descending weight
        3. keep at most PARSER.maxMainAssignments
        4. if none pass the threshold, show the strongest assignment as fallback
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
    
  function formatAssignmentPercent(value) {
    if (!Number.isFinite(value)) {
      return "—";
    }
  
    return `${(value * 100).toFixed(1)}%`;
  }

  function renderAssignmentsPanel(excitedStates, homoLumo) {
    renderHomoLumoInfo(homoLumo);

    const assignmentsList = document.getElementById("assignments-list");
    const countPill = document.getElementById("assignments-count-pill");

    if (!assignmentsList) {
      return;
    }

    const states = excitedStates?.states ?? [];
    const assignmentCount = states.reduce(
      (sum, state) => sum + (state.assignments?.length ?? 0),
      0,
    );

    if (countPill) {
      countPill.textContent = `${assignmentCount} ${
        assignmentCount === 1 ? "assignment" : "assignments"
      }`;
    }

    if (states.length === 0) {
      const message = excitedStates?.metadata?.found
        ? "Excited-state section found, but no states were parsed."
        : "No excited-state assignments loaded.";

      assignmentsList.innerHTML = `
        <div class="empty-state">${escapeHtml(message)}</div>
      `;
      return;
    }

    const statesWithAssignments = states.filter(
      (state) => Array.isArray(state.assignments) && state.assignments.length > 0,
    );

    if (statesWithAssignments.length === 0) {
      assignmentsList.innerHTML = `
        <div class="empty-state">Excited states were found, but no orbital assignments were parsed.</div>
      `;
      return;
    }

    assignmentsList.innerHTML = statesWithAssignments
      .map((state, index) => renderAssignmentStateCard(state, index))
      .join("");
  }

  function renderAssignmentStateCard(state, index) {
    const isOpen = shouldOpenAssignmentState(state, index);
    const openAttribute = isOpen ? " open" : "";

    const stateLabel = escapeHtml(state.label ?? `S${state.state}`);
    const stateMeta = buildAssignmentStateMeta(state);
    const mainAssignment = escapeHtml(state.mainAssignment ?? "—");

    const rows = [...state.assignments]
      .sort((a, b) => {
        const aw = Number.isFinite(a.weight) ? a.weight : -Infinity;
        const bw = Number.isFinite(b.weight) ? b.weight : -Infinity;
        return bw - aw;
      })
      .map((assignment) => {
        return `
          <tr>
            <td>${escapeHtml(assignment.assignment ?? "—")}</td>
            <td>${escapeHtml(assignment.transition ?? "—")}</td>
            <td>${formatNumber((assignment.weight ?? NaN) * 100, 2)}</td>
            <td>${formatNumber(assignment.coefficient, 8)}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <details class="assignment-state-card"${openAttribute}>
        <summary>
          <span class="assignment-state-title">${stateLabel}</span>
          <span class="assignment-state-meta">${stateMeta}</span>
          <span class="assignment-state-main">${mainAssignment}</span>
        </summary>

        <div class="assignment-state-body">
          <p class="assignment-summary-line">
            <strong>Main:</strong> ${mainAssignment}
          </p>

          <div class="table-wrap">
            <table aria-label="Assignments for ${stateLabel}">
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>ORCA transition</th>
                  <th>Weight / %</th>
                  <th>Coefficient</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    `;
  }

  function shouldOpenAssignmentState(state, index) {
    return false;
  }

  function buildAssignmentStateMeta(state) {
    const parts = [];

    if (Number.isFinite(state.energyEv)) {
      parts.push(`${formatNumber(state.energyEv, 3)} eV`);
    }

    if (Number.isFinite(state.energyCm1)) {
      parts.push(`${formatNumber(state.energyCm1, 1)} cm⁻¹`);
    }

    if (Number.isFinite(state.s2)) {
      parts.push(`<S²> ${formatNumber(state.s2, 2)}`);
    }

    if (Number.isInteger(state.multiplicity)) {
      parts.push(`Mult ${state.multiplicity}`);
    }

    return escapeHtml(parts.join(" · ") || "—");
  }

  function renderPeaksTable(peaks, uiState = getUiState()) {
    const tableBody = document.getElementById("peaks-table-body");
    const countPill = document.getElementById("peak-count-pill");

    if (!tableBody) return;

    const peakCount = Array.isArray(peaks) ? peaks.length : 0;
    const shiftCm1 = Number.isFinite(uiState?.spectrumShiftCm1)
      ? uiState.spectrumShiftCm1
      : 0;

    if (countPill) {
      countPill.textContent = `${peakCount} ${peakCount === 1 ? "peak" : "peaks"}`;
    }

    if (peakCount === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7">No peaks detected.</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = peaks
      .map((peak, index) => {
        const displayed = getShiftedPeakValues(peak, shiftCm1);

        return `
          <tr>
            <td>${index + 1}</td>
            <td>${formatNumber(displayed.wavelengthNm, 1)}</td>
            <td>${formatNumber(displayed.energyEv, 3)}</td>
            <td>${formatNumber(displayed.energyCm1, 1)}</td>
            <td>${formatEpsilon(peak.epsilon)}</td>
            <td>${formatNumber(peak.intensityScaled, 3)}</td>
            <td>${formatNumber(peak.relativeIntensityPercent, 1)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderExperimentalData(parsedExperimental) {
    const metadata = parsedExperimental?.metadata ?? null;
  
    if (!metadata) {
      setText("experimental-file-pill", "No file");
  
      setText("exp-file", "—");
      setText("exp-delimiter", "—");
      setText("exp-x-column", "—");
      setText("exp-points", "0");
      return;
    }
  
    setText("experimental-file-pill", metadata.fileName || "No file");
  
    setText("exp-file", metadata.fileName || "—");
    setText("exp-delimiter", metadata.delimiter || "—");
    setText("exp-x-column", metadata.xColumn ?? "—");
    setText("exp-y-type-info", experimentalYTypeLabel(metadata.yType));
    setText("exp-points", formatInteger(metadata.pointCount ?? 0));
  }

  function clearRenderedData() {
    clearOrcaMetadata();
    renderTransitionsTable([]);
    renderAssignmentsPanel(null, null);
    renderPeaksTable([]);
    renderExperimentalData(null);
    renderCurrentSettings(getUiState(), null, null);
    updateFileStatus("No ORCA UV-Vis data loaded yet.", "warning");
  }

  function resetUiControlsToDefaults() {
    setRadioValue("x-axis", DEFAULTS.xAxis);
    setRadioValue("axis-direction", DEFAULTS.axisDirection);
  
    setCheckboxValue("auto-range", DEFAULTS.autoRange);
    setInputValue("range-min", "");
    setInputValue("range-max", "");
  
    setInputValue("fwhm-slider", DEFAULTS.fwhmCm1);
  
    setCheckboxValue("normalize-spectrum", DEFAULTS.normalizeSpectrum);
    setInputValue("scale-factor-slider", DEFAULTS.scaleFactor);
    setInputValue("spectrum-shift-slider", DEFAULTS.spectrumShiftCm1);
  
    setCheckboxValue("show-spectrum", DEFAULTS.showSpectrum);
    setCheckboxValue("show-spectrum-fill", DEFAULTS.showSpectrumFill);
    setCheckboxValue("show-sticks", DEFAULTS.showSticks);
    setCheckboxValue("show-state-labels", DEFAULTS.showStateLabels);
    setCheckboxValue("show-single-gaussians", DEFAULTS.showSingleGaussians);
    setCheckboxValue("show-gaussian-areas", DEFAULTS.showGaussianAreas);
    setCheckboxValue("show-peak-labels", DEFAULTS.showPeakLabels);
    setCheckboxValue("show-grid", DEFAULTS.showGrid);
    setCheckboxValue("show-epsilon-axis", DEFAULTS.showEpsilonAxis);
  
    setCheckboxValue("detect-peaks", DEFAULTS.detectPeaks);
    setInputValue("peak-height-slider", DEFAULTS.peakHeightPercent);
    setInputValue("peak-distance-slider", DEFAULTS.peakDistanceCm1);
  
    setRadioValue("assignment-display", DEFAULTS.assignmentDisplay);
    setRadioValue("assignment-selection-mode", DEFAULTS.assignmentSelectionMode);
    setInputValue("assignment-threshold-slider", DEFAULTS.assignmentThresholdPercent);
    setCheckboxValue("show-transition-labels", DEFAULTS.showTransitionLabels);
  
    setCheckboxValue("show-experimental", DEFAULTS.showExperimental);
    setSelectValue("experimental-y-type", DEFAULTS.experimentalYType);
    setCheckboxValue("normalize-experimental", DEFAULTS.normalizeExperimental);
    setCheckboxValue("baseline-correction", DEFAULTS.baselineCorrection);
    setRadioValue("experimental-style", DEFAULTS.experimentalStyle);
  
    updateUiReadouts();
  }

  function showToast(title, message, type = "info") {
    const toastStack = document.querySelector(".toast-stack");

    if (!toastStack) {
      console.info(`[${type}] ${title}: ${message}`);
      return;
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      ${escapeHtml(message)}
    `;

    toastStack.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 4200);
  }

  function clearOrcaMetadata() {
    setText("metadata-file-pill", "No file");
    setText("info-file", "—");
    setText("info-orca-version", "—");
    setText("info-section", "—");
    setText("info-transition-count", "0");
    setText("info-energy-range", "— cm⁻¹");
    setText("info-wavelength-range", "— nm");

    setText("info-x-axis", "—");
    setText("info-axis-direction", "—");
    setText("info-range-mode", "—");
    setText("info-displayed-range", "—");
    setText("info-fwhm", "— cm⁻¹");
    setText("info-spectrum-shift", "— cm⁻¹");
    setText("info-normalize-spectrum", "—");
    setText("info-scale-factor", "—");
    setText("info-outside-auto-range", "—");
  }

  function renderHomoLumoInfo(homoLumo) {
    if (!homoLumo) {
      setText("assignment-homo", "—");
      setText("assignment-lumo", "—");
      setText("assignment-source", "—");
      return;
    }

    setText("assignment-homo", formatHomoLumoPair(homoLumo, "homo"));
    setText("assignment-lumo", formatHomoLumoPair(homoLumo, "lumo"));
    setText("assignment-source", homoLumo.source || "—");
  }

  function formatHomoLumoPair(homoLumo, key) {
    if (!homoLumo) {
      return "—";
    }

    const alphaValue = homoLumo.alpha?.[key];
    const betaValue = homoLumo.beta?.[key];

    if (Number.isInteger(alphaValue) && Number.isInteger(betaValue)) {
      if (alphaValue === betaValue) {
        return String(alphaValue);
      }

      return `α ${alphaValue} / β ${betaValue}`;
    }

    if (Number.isInteger(alphaValue)) {
      return `α ${alphaValue}`;
    }

    if (Number.isInteger(betaValue)) {
      return `β ${betaValue}`;
    }

    const legacyValue = homoLumo[key];

    return Number.isInteger(legacyValue) ? String(legacyValue) : "—";
  }

  function updateFwhmReadout(fwhmCm1) {
    const readout = document.getElementById("fwhm-readout");
    if (!readout) return;

    /*
      The Gaussian formula (see gaussian() in spectrum.js) reaches
      half-height at |center - x| = fwhmCm1, i.e. one HWHM (half width at
      half maximum) away from the center on each side. The FWHM (half-max
      point to half-max point) is therefore twice the HWHM shown on the
      slider.
    */
    const trueFwhmCm1 = fwhmCm1 * 2;

    const widthEv = cm1ToEv(trueFwhmCm1);

    const referenceNm = 400;
    const approxWidthNm = (referenceNm ** 2 * trueFwhmCm1) / 1.0e7;

    readout.innerHTML = `
      <div class="readout-row">
        <span>FWHM</span>
        <strong>${formatInteger(trueFwhmCm1)} cm⁻¹</strong>
      </div>
      <div class="readout-row">
        <span>Approx. at ${referenceNm} nm</span>
        <strong>≈ ${formatNumber(approxWidthNm, 1)} nm</strong>
      </div>
      <div class="readout-row">
        <span>Approx. energy width</span>
        <strong>≈ ${formatNumber(widthEv, 3)} eV</strong>
      </div>
    `;
  }

  function updateFileStatus(message, status = "warning") {
    const statusCard = document.getElementById("file-status");
    if (!statusCard) return;

    const dotClass = status === "success" ? "success" : "warning";

    statusCard.innerHTML = `
      <div class="status-line">
        <span class="status-dot ${dotClass}"></span>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  }

  function axisLabel(axisMode) {
    switch (axisMode) {
      case "nm":
        return "Wavelength / nm";
      case "ev":
        return "Energy / eV";
      case "cm-1":
        return "Energy / cm⁻¹";
      default:
        return axisMode ?? "—";
    }
  }

  function axisDirectionLabel(value) {
    switch (value) {
      case "normal":
        return "Low → High";
      case "reversed":
        return "High → Low";
      default:
        return value ?? "—";
    }
  }

  function experimentalYTypeLabel(value) {
    switch (value) {
      case "absorbance":
        return "Absorbance";
      case "transmittance":
        return "Transmittance / %";
      case "intensity":
        return "Intensity";
      default:
        return value ?? "—";
    }
  }

  function formatDisplayedRange(range, xAxis) {
    if (!Array.isArray(range) || range.length !== 2) {
      return "—";
    }

    const min = Number(range[0]);
    const max = Number(range[1]);

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return "—";
    }

    return `${formatAxisValue(min, xAxis)}–${formatAxisValue(max, xAxis)} ${axisUnitLabel(xAxis)}`;
  }

  function formatOutsideAutoRange(transitions, xAxis) {
    if (!Array.isArray(transitions) || transitions.length === 0) {
      return "—";
    }

    const maxListed = 8;
    const listed = transitions.slice(0, maxListed);

    const text = listed
      .map((transition) => {
        const label = transition.label || `S${transition.state ?? "?"}`;
        return `${label} (${formatAxisValue(transition.xValue, xAxis)} ${axisUnitLabel(xAxis)})`;
      })
      .join(", ");

    const remaining = transitions.length - listed.length;

    if (remaining > 0) {
      return `${text} + ${remaining} more`;
    }

    return text;
  }

  function formatAxisValue(value, xAxis) {
    if (!Number.isFinite(value)) {
      return "—";
    }

    switch (xAxis) {
      case "ev":
        return value.toFixed(3);

      case "cm-1":
        return value.toFixed(1);

      case "nm":
      default:
        return value.toFixed(1);
    }
  }

  function axisUnitLabel(xAxis) {
    switch (xAxis) {
      case "ev":
        return "eV";

      case "cm-1":
        return "cm⁻¹";

      case "nm":
      default:
        return "nm";
    }
  }

  function updateAssignmentThresholdControl(uiState) {
    const slider = document.getElementById("assignment-threshold-slider");
  
    if (!slider) {
      return;
    }
  
    const isManual = uiState?.assignmentSelectionMode === "manual";
    slider.disabled = !isManual;
  }

  function updateRangeValidation(uiState) {
    const rangeMinElement = document.getElementById("range-min");
    const rangeMaxElement = document.getElementById("range-max");
  
    if (!rangeMinElement || !rangeMaxElement) {
      return;
    }
  
    const minValue = getOptionalNumberValue("range-min");
    const maxValue = getOptionalNumberValue("range-max");
  
    const minInvalid = isInvalidRangeBoundary(minValue, uiState.xAxis);
    const maxInvalid = isInvalidRangeBoundary(maxValue, uiState.xAxis);
  
    const equalInvalid =
      !uiState.autoRange &&
      Number.isFinite(minValue) &&
      Number.isFinite(maxValue) &&
      minValue === maxValue;
  
    setInputInvalid(rangeMinElement, minInvalid || equalInvalid);
    setInputInvalid(rangeMaxElement, maxInvalid || equalInvalid);
  }
  
  function isInvalidRangeBoundary(value, xAxis) {
    if (value == null) {
      return false;
    }
  
    if (!Number.isFinite(value)) {
      return true;
    }
  
    switch (xAxis) {
      case "nm":
        return value <= 50;
  
      case "ev":
      case "cm-1":
      default:
        return value <= 0;
    }
  }

function setInputInvalid(element, invalid) {
  element.classList.toggle("is-invalid", Boolean(invalid));

  const field = element.closest(".field");
  if (field) {
    field.classList.toggle("has-invalid-input", Boolean(invalid));
  }
}

  function setRadioValue(name, value) {
    const elements = document.querySelectorAll(`input[name="${name}"]`);
  
    elements.forEach((element) => {
      element.checked = element.value === value;
    });
  }
  
  function setCheckboxValue(id, value) {
    const element = document.getElementById(id);
  
    if (element) {
      element.checked = Boolean(value);
    }
  }
  
  function setInputValue(id, value) {
    const element = document.getElementById(id);
  
    if (element) {
      element.value = value == null ? "" : String(value);
    }
  }

  function setSelectValue(id, value) {
    const element = document.getElementById(id);
  
    if (element) {
      element.value = value;
    }
  }

  function getCheckedRadioValue(name, fallback) {
    const element = document.querySelector(`input[name="${name}"]:checked`);
    return element ? element.value : fallback;
  }

  function getCheckboxValue(id, fallback) {
    const element = document.getElementById(id);
    return element ? element.checked : fallback;
  }

  function getNumberValue(id, fallback) {
    const element = document.getElementById(id);
    if (!element) return fallback;

    const value = Number(element.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function getOptionalNumberValue(id) {
    const element = document.getElementById(id);
    if (!element || element.value === "") return null;

    const value = Number(element.value);
    return Number.isFinite(value) ? value : null;
  }

  function getSelectValue(id, fallback) {
    const element = document.getElementById(id);
    return element ? element.value : fallback;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;

    element.textContent = value == null || value === "" ? "—" : String(value);
  }

  function getShiftedPeakValues(peak, shiftCm1) {
    const rawEnergyCm1 = Number.isFinite(peak?.energyCm1)
      ? peak.energyCm1
      : NaN;

    const energyCm1 = Number.isFinite(rawEnergyCm1)
      ? rawEnergyCm1 + shiftCm1
      : NaN;

    if (!Number.isFinite(energyCm1) || energyCm1 <= 0) {
      return {
        energyCm1: NaN,
        energyEv: NaN,
        wavelengthNm: NaN,
      };
    }

    return {
      energyCm1,
      energyEv: energyCm1 / UNITS.CM1_PER_EV,
      wavelengthNm: UNITS.NM_CM1_FACTOR / energyCm1,
    };
  }

  function formatSignedInteger(value) {
    if (!Number.isFinite(value)) return "—";

    const rounded = Math.round(value);

    if (rounded > 0) {
      return `+${rounded}`;
    }

    return rounded.toString();
  }

  function formatEpsilon(value) {
    if (!Number.isFinite(value)) {
      return "—";
    }

    const absolute = Math.abs(value);

    if (absolute >= 100) {
      return Math.round(value).toString();
    }

    if (absolute >= 10) {
      return value.toFixed(1);
    }

    if (absolute > 0) {
      return value.toPrecision(3);
    }

    return "0";
  }

  function formatNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return "—";
    return value.toFixed(digits);
  }

  function formatInteger(value) {
    if (!Number.isFinite(value)) return "—";
    return Math.round(value).toString();
  }

  function formatScientificOrFixed(value) {
    if (!Number.isFinite(value)) return "—";

    if (Math.abs(value) > 0 && Math.abs(value) < 0.001) {
      return value.toExponential(3);
    }

    return value.toFixed(6);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.OrcaUV.UI = {
    initUi,
    getUiState,
    updateUiReadouts,
    resetUiControlsToDefaults,
    renderOrcaData,
    renderOrcaMetadata,
    renderTransitionsTable,
    renderAssignmentsPanel,
    renderPeaksTable,
    renderExperimentalData,
    renderCurrentSettings,
    clearRenderedData,
    showToast,
  };
})();