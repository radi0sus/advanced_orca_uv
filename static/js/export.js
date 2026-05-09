// static/js/export.js

(function () {
  "use strict";

  window.OrcaUV = window.OrcaUV || {};

  const { EXPORT_COLUMNS } = window.OrcaUV.Constants;

  function exportPng(plotElement, options = {}) {
    // Placeholder.
    // Later:
    // - Plotly.toImage / Plotly.downloadImage
    // - width: 1400, height: 900, scale: 2

    console.info("exportPng placeholder called.", { plotElement, options });
  }

  function exportCsv(spectrum, options = {}) {
    // Placeholder.
    // Later export columns:
    // x_nm, x_cm-1, x_eV, intensity, intensity_norm

    console.info("exportCsv placeholder called.", { spectrum, options });

    const header = EXPORT_COLUMNS.join(",");
    return `${header}\n`;
  }

  window.OrcaUV.Export = {
    exportPng,
    exportCsv,
  };
})();