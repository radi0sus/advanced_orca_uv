// static/js/constants.js

(function () {
  "use strict";

  window.OrcaUV = window.OrcaUV || {};

  const APP_NAME = "Advanced ORCA UV-Vis";
  const APP_VERSION = "0.1.0";

  const ORCA_UVVIS_SECTION = {
    sourceLabel: "Electric dipole moments",
    startMarker: "ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC DIPOLE MOMENTS",
    endMarker: "ABSORPTION SPECTRUM VIA TRANSITION VELOCITY DIPOLE MOMENTS",
  };

  const ORCA_EXCITED_STATES_SECTION = {
    startMarkers: [
      "TD-DFT/TDA EXCITED STATES",
      "TD-DFT EXCITED STATES",
    ],
    endMarkers: [
      "TD-DFT/TDA-EXCITATION SPECTRA",
      "TD-DFT EXCITATION SPECTRA",
      "ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC DIPOLE MOMENTS",
    ],
  };

  const UNITS = {
    CM1_PER_EV: 8065.54429,
    NM_CM1_FACTOR: 1.0e7,
  };

  /*
    Spectroscopy constants.

    OSC_STRENGTH_TO_EPSILON_AREA converts oscillator strength f to the
    integrated decadic molar extinction coefficient area:

      ∫ ε(ν~) dν~ ≈ 2.315 × 10^8 · f

    with:
      ε in L mol⁻¹ cm⁻¹ = M⁻¹ cm⁻¹
      ν~ in cm⁻¹

    Based on:
      f ≈ 4.32 × 10⁻⁹ ∫ ε(ν~) dν~
  */
  const SPECTROSCOPY = {
    OSC_STRENGTH_TO_EPSILON_AREA: 2.315e8,
  };

  const AXIS_MODES = {
    WAVELENGTH_NM: "nm",
    ENERGY_EV: "ev",
    ENERGY_CM1: "cm-1",
  };

  const AXIS_DIRECTIONS = {
    NORMAL: "normal",
    REVERSED: "reversed",
  };

  const DEFAULTS = {
    xAxis: AXIS_MODES.WAVELENGTH_NM,
    axisDirection: AXIS_DIRECTIONS.NORMAL,

    autoRange: true,

    fwhmCm1: 1000,
    fwhmMinCm1: 100,
    fwhmMaxCm1: 5000,
    fwhmStepCm1: 50,

    normalizeSpectrum: true,
    scaleFactor: 1.0,
    scaleFactorMin: 0.1,
    scaleFactorMax: 5.0,
    scaleFactorStep: 0.1,

    spectrumShiftCm1: 0,
    spectrumShiftMinCm1: -5000,
    spectrumShiftMaxCm1: 5000,
    spectrumShiftStepCm1: 50,

    showSpectrum: true,
    showSpectrumFill: true,
    showSticks: true,
    showStateLabels: false,
    showSingleGaussians: false,
    showGaussianAreas: false,
    showPeakLabels: true,
    showGrid: false,
    showEpsilonAxis: true,

    detectPeaks: true,
    peakHeightPercent: 2,
    peakDistanceCm1: 10,

    showExperimental: false,
    experimentalYType: "absorbance",
    normalizeExperimental: true,
    baselineCorrection: false,
    experimentalStyle: "line-fill",
    assignmentDisplay: "homo-lumo",
    assignmentSelectionMode: "auto",
    assignmentThresholdPercent: 5,
    showTransitionLabels: false,
  };

  const PARSER = {
    wavelengthConsistencyTolerance: 0.03,

    assignmentWeightThreshold: 0.01,
    mainAssignmentWeightThreshold: 0.05,
    maxMainAssignments: 3,

    tableFormats: {
      ORCA5: "orca5-table",
      ORCA6: "orca6-table",
    },
  };

  const THRESHOLDS = {
    significantFosc: 0.005,
  };

  const EXPORT_COLUMNS = [
    "x_nm",
    "x_cm-1",
    "x_eV",
    "intensity",
    "intensity_scaled",
    "epsilon",
  ];

  const FILE_ACCEPT = {
    orcaOutput: [".out", ".log", ".txt"],
    experimentalCsv: [".csv", ".txt", ".dat"],
  };

  window.OrcaUV.Constants = {
    APP_NAME,
    APP_VERSION,
    ORCA_UVVIS_SECTION,
    ORCA_EXCITED_STATES_SECTION,
    UNITS,
    SPECTROSCOPY,
    THRESHOLDS,
    AXIS_MODES,
    AXIS_DIRECTIONS,
    DEFAULTS,
    PARSER,
    EXPORT_COLUMNS,
    FILE_ACCEPT,
  };
})();