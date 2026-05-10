// static/js/app.js

(function () {
  "use strict";

  window.OrcaUV = window.OrcaUV || {};

  const {
    APP_NAME,
    APP_VERSION,
  } = window.OrcaUV.Constants;

  const {
    initUi,
    getUiState,
    updateUiReadouts,
    showToast,
    renderOrcaData,
    renderExperimentalData,
    renderTransitionsTable,
    renderPeaksTable,
    renderCurrentSettings,
    clearRenderedData,
  } = window.OrcaUV.UI;

  const {
    parseOrcaUvVisOutput,
  } = window.OrcaUV.Import;

  const {
    buildSpectrum,
  } = window.OrcaUV.Spectrum;

  const {
    detectPeaks,
  } = window.OrcaUV.PeakDetection;

  const {
    renderPlot,
    updatePlotTheme,
    getAutoRangeInfo,
  } = window.OrcaUV.Plot;

  const {
    exportPng,
    exportCsv,
  } = window.OrcaUV.Export;

  const {
    parseExperimentalCsv,
  } = window.OrcaUV.ExperimentalCsv;

  const appState = {
    orcaFileName: null,
    orcaText: null,
    parsedOrca: null,

    experimentalFileName: null,
    experimentalText: null,
    parsedExperimental: null,

    spectrum: null,
    peaks: [],
  };

  document.addEventListener("DOMContentLoaded", () => {
    console.info(`${APP_NAME} ${APP_VERSION} initialized.`);

    initUi();
    attachEventListeners();
    renderCurrentSettings(getUiState(), null, null);
    
    // showToast("App initialized", "JavaScript files loaded.", "info");
  });

  function attachEventListeners() {
    const orcaFileInput = document.getElementById("orca-file");
    const experimentalFileInput = document.getElementById("experimental-file");

    const exportPngButton = document.getElementById("export-png");
    const exportCsvButton = document.getElementById("export-csv");

    const resetViewButton = document.getElementById("reset-view");
    const clearDataButton = document.getElementById("clear-data");

    if (orcaFileInput) {
      orcaFileInput.addEventListener("change", handleOrcaFileSelected);
    }

    if (experimentalFileInput) {
      experimentalFileInput.addEventListener("change", handleExperimentalFileSelected);
    }

    if (exportPngButton) {
      exportPngButton.addEventListener("click", handleExportPng);
    }

    if (exportCsvButton) {
      exportCsvButton.addEventListener("click", handleExportCsv);
    }

    if (resetViewButton) {
      resetViewButton.addEventListener("click", handleResetView);
    }

    if (clearDataButton) {
      clearDataButton.addEventListener("click", handleClearData);
    }

    attachUiChangeListeners();
    attachThemeListener();
  }

  function attachUiChangeListeners() {
    const controlSelector = [
      'input[name="x-axis"]',
      'input[name="axis-direction"]',
      "#auto-range",
      "#range-min",
      "#range-max",
      "#fwhm-slider",
      "#normalize-spectrum",
      "#scale-factor-slider",
      "#spectrum-shift-slider",
      "#show-spectrum",
      "#show-spectrum-fill",
      "#show-sticks",
      "#show-state-labels",
      "#show-single-gaussians",
      "#show-gaussian-areas",
      "#show-peak-labels",
      "#show-grid",
      "#detect-peaks",
      "#peak-height-slider",
      "#peak-distance-slider",
      "#show-experimental",
      "#experimental-y-type",
      "#normalize-experimental",
      "#baseline-correction",
      'input[name="experimental-style"]',
      'input[name="assignment-display"]',
      'input[name="assignment-selection-mode"]',
      "#assignment-threshold-slider",
      "#show-transition-labels",
    ].join(",");

    document.querySelectorAll(controlSelector).forEach((element) => {
      element.addEventListener("input", handleUiChanged);
      element.addEventListener("change", handleUiChanged);
    });
  }

  function attachThemeListener() {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    mediaQuery.addEventListener("change", () => {
      updatePlotTheme();
      rerender();
    });
  }

  async function handleOrcaFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      appState.orcaFileName = file.name;
      appState.orcaText = await file.text();

      appState.parsedOrca = parseOrcaUvVisOutput(appState.orcaText, file.name);

      renderOrcaData(appState.parsedOrca);
      recalculate();

      const count = appState.parsedOrca.metadata.transitionCount ?? 0;

      if (appState.parsedOrca.metadata.sectionFound) {
        showToast("ORCA file loaded", `${file.name}: ${count} transitions parsed.`, "success");
      } else {
        showToast("No UV-Vis data found", file.name, "warning");
      }
    } catch (error) {
      console.error(error);
      showToast("ORCA import failed", error.message ?? "Unknown error", "error");
    }
  }

  async function handleExperimentalFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      appState.experimentalFileName = file.name;
      appState.experimentalText = await file.text();

      const uiState = getUiState();

      appState.parsedExperimental = parseExperimentalCsv(
        appState.experimentalText,
        file.name,
        {
          yType: uiState.experimentalYType,
        },
      );

      const showExperimentalCheckbox = document.getElementById("show-experimental");

      if (showExperimentalCheckbox) {
        showExperimentalCheckbox.checked = true;
      }

      renderExperimentalData(appState.parsedExperimental);
      rerender();

      showToast("Experimental CSV loaded", file.name, "success");
    } catch (error) {
      console.error(error);
      showToast("CSV import failed", error.message ?? "Unknown error", "error");
    }
  }

  function handleUiChanged() {
    updateUiReadouts();

    if (appState.parsedOrca) {
      recalculate();
    } else {
      renderCurrentSettings(getUiState(), null, null);
      rerender();
    }
  }

  function recalculate() {
    const uiState = getUiState();
    const transitions = appState.parsedOrca?.transitions ?? [];

    renderTransitionsTable(transitions, uiState);
    appState.spectrum = buildSpectrum(transitions, uiState);

    appState.peaks = uiState.detectPeaks
      ? detectPeaks(appState.spectrum, uiState)
      : [];

    const autoRangeInfo = getAutoRangeInfo(appState.spectrum, uiState);

    renderPeaksTable(appState.peaks, uiState);
    renderCurrentSettings(uiState, appState.spectrum, autoRangeInfo);
    rerender();
  }

  function rerender() {
    const plotElement = document.getElementById("plot");
    const uiState = getUiState();

    renderPlot(
      plotElement,
      appState.spectrum,
      appState.parsedOrca?.transitions ?? [],
      appState.peaks,
      {
        ...uiState,
        experimental: appState.parsedExperimental,
        plotTitle: appState.parsedOrca?.metadata?.fileName ?? "Absorption spectrum",
      },
    );
  }

  function clearPlot() {
    const plotElement = document.getElementById("plot");

    if (!plotElement) {
      return;
    }

    if (window.Plotly && plotElement.data) {
      Plotly.purge(plotElement);
    }

    plotElement.innerHTML = `
      <div class="empty-plot-message">
        Load an ORCA output file to display a UV-Vis spectrum.
      </div>
    `;
  }

  function handleExportPng() {
    const plotElement = document.getElementById("plot");
    const uiState = getUiState();

    exportPng(plotElement, uiState);
  }

  function handleExportCsv() {
    const uiState = getUiState();
    const csvText = exportCsv(appState.spectrum, uiState);

    console.info("CSV export placeholder:");
    console.info(csvText);

    showToast("CSV export", "Placeholder only. Real download will be added later.", "info");
  }

  function handleResetView() {
    showToast("Reset view", "Placeholder only.", "info");
    rerender();
  }

  function handleClearData() {
    appState.orcaFileName = null;
    appState.orcaText = null;
    appState.parsedOrca = null;

    appState.experimentalFileName = null;
    appState.experimentalText = null;
    appState.parsedExperimental = null;

    appState.spectrum = null;
    appState.peaks = [];

    const orcaFileInput = document.getElementById("orca-file");
    const experimentalFileInput = document.getElementById("experimental-file");

    if (orcaFileInput) {
      orcaFileInput.value = "";
    }

    if (experimentalFileInput) {
      experimentalFileInput.value = "";
    }

    clearRenderedData();
    updateUiReadouts();
    clearPlot();

    showToast("Data cleared", "Application state reset.", "info");
  }

  window.OrcaUV.App = {
    appState,
    recalculate,
    rerender,
  };
})();