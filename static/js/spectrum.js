// static/js/spectrum.js

(function () {
  "use strict";

  window.OrcaUV = window.OrcaUV || {};

  const { UNITS, SPECTROSCOPY } = window.OrcaUV.Constants;
  const { cm1ToNm, cm1ToEv } = window.OrcaUV.Import;

  function buildSpectrum(transitions, options = {}) {
    const validTransitions = sanitizeTransitions(transitions);

    if (validTransitions.length === 0) {
      return emptySpectrum();
    }

    const fwhmCm1 = Number.isFinite(options.fwhmCm1)
      ? options.fwhmCm1
      : 1000;

    const normalizeSpectrum = options.normalizeSpectrum !== false;
    const scaleFactor = Number.isFinite(options.scaleFactor)
      ? options.scaleFactor
      : 1.0;

    const grid = buildCm1Grid(validTransitions, fwhmCm1, options);
    const intensity = new Array(grid.length).fill(0);

    const singleGaussians = validTransitions.map((transition) => {
      const y = grid.map((xCm1) =>
        gaussian(transition.fosc, transition.energyCm1, xCm1, fwhmCm1),
      );

      for (let index = 0; index < y.length; index += 1) {
        intensity[index] += y[index];
      }

      return {
        state: transition.state,
        label: transition.label,
        transitionLabel: transition.transitionLabel,
        energyCm1: transition.energyCm1,
        energyEv: transition.energyEv,
        wavelengthNm: transition.wavelengthNm,
        fosc: transition.fosc,
        xCm1: grid,
        y,
      };
    });

    const intensityNorm = normalizeArray(intensity);
    const intensityScaled = normalizeSpectrum
      ? intensityNorm.map((value) => value * scaleFactor)
      : intensity.map((value) => value * scaleFactor);

    const maxIntensity = Math.max(...intensity.filter(Number.isFinite), 0);
    const maxFosc = Math.max(...validTransitions.map((transition) => transition.fosc), 0);

    /*
      Molar extinction coefficient (epsilon) curve.

      Epsilon is a physical estimate derived only from the oscillator
      strengths and the Gaussian line width (fwhmCm1). It intentionally does
      NOT depend on normalizeSpectrum/scaleFactor: all display scaling and
      normalization apply only to the Intensity axis, never to epsilon.

      Because every transition shares the same fwhmCm1 in a given spectrum,
      the epsilon curve is exactly proportional to the raw (unnormalized,
      unscaled) intensity curve:

        epsilon(x) = intensity(x) * epsilonFactor(fwhmCm1)

      This lets the epsilon curve reuse the already-computed intensity array
      instead of recomputing a Gaussian sum per grid point.
    */
    const epsilonFactor = getEpsilonFactor(fwhmCm1);
    const epsilon = Number.isFinite(epsilonFactor)
      ? intensity.map((value) =>
          Number.isFinite(value) ? value * epsilonFactor : NaN,
        )
      : intensity.map(() => NaN);

    const maxEpsilon = Math.max(...epsilon.filter(Number.isFinite), 0);

    return {
      /*
        These x arrays are the raw, unshifted calculated spectrum grid.

        The optional calculated spectrum shift is intentionally a display/
        alignment transform and is applied in plot.js. Raw ORCA-derived data
        remain unchanged here.
      */
      xCm1: grid,
      xNm: grid.map(cm1ToNm),
      xEv: grid.map(cm1ToEv),

      intensity,
      intensityNorm,
      intensityScaled,

      epsilon,
      maxEpsilon,
      epsilonFactor,

      maxIntensity,
      maxFosc,

      fwhmCm1,
      normalizeSpectrum,
      scaleFactor,

      transitions: validTransitions,
      sticks: validTransitions.map((transition) => ({
        state: transition.state,
        label: transition.label,
        transitionLabel: transition.transitionLabel,
        energyCm1: transition.energyCm1,
        energyEv: transition.energyEv,
        wavelengthNm: transition.wavelengthNm,
        fosc: transition.fosc,
        relativeFosc: maxFosc > 0 ? transition.fosc / maxFosc : 0,
      })),

      singleGaussians,
    };
  }

  function sanitizeTransitions(transitions) {
    if (!Array.isArray(transitions)) {
      return [];
    }

    return transitions
      .map((transition) => ({
        ...transition,
        energyCm1: Number(transition.energyCm1),
        energyEv: Number(transition.energyEv),
        wavelengthNm: Number(transition.wavelengthNm),
        fosc: Number(transition.fosc),
      }))
      .filter((transition) =>
        Number.isFinite(transition.energyCm1) &&
        transition.energyCm1 > 0 &&
        Number.isFinite(transition.fosc) &&
        transition.fosc >= 0,
      )
      .sort((a, b) => a.energyCm1 - b.energyCm1);
  }

  function buildCm1Grid(transitions, fwhmCm1, options = {}) {
    const energies = transitions.map((transition) => transition.energyCm1);

    let minCm1 = Math.min(...energies);
    let maxCm1 = Math.max(...energies);

    const margin = Math.max(fwhmCm1 * 3, 500);

    minCm1 = Math.max(0, minCm1 - margin);
    maxCm1 = maxCm1 + margin;

    /*
      Manual range is specified in the displayed x-axis unit.

      Important with calculated spectrum shift:
      plot.js displays calculated points as

        displayed_cm-1 = raw_cm-1 + spectrumShiftCm1

      Therefore the internal calculation grid must use

        raw_cm-1 = displayed_cm-1 - spectrumShiftCm1

      If we do not subtract the shift here, the plotted curve can end inside
      the manually selected visible range.
    */
    if (options.rangeMin != null && options.rangeMax != null && !options.autoRange) {
      const converted = convertDisplayRangeToRawCm1(
        options.rangeMin,
        options.rangeMax,
        options.xAxis,
        options.spectrumShiftCm1,
      );

      if (converted) {
        minCm1 = converted.minCm1;
        maxCm1 = converted.maxCm1;
      }
    }

    if (!Number.isFinite(minCm1) || !Number.isFinite(maxCm1)) {
      return [];
    }

    if (minCm1 === maxCm1) {
      maxCm1 = minCm1 + 1;
    }

    if (minCm1 > maxCm1) {
      const tmp = minCm1;
      minCm1 = maxCm1;
      maxCm1 = tmp;
    }

    /*
      Avoid exactly zero as lower bound. A zero cm-1 grid point would later
      convert to invalid wavelength values. Negative raw grid points are not
      useful for UV-Vis spectra and can occur only for extreme shifts/ranges.
    */
    minCm1 = Math.max(1, minCm1);
    maxCm1 = Math.max(minCm1 + 1, maxCm1);

    const span = maxCm1 - minCm1;

    /*
      UV-Vis spectra are broad. A dynamic step keeps plotting responsive.
      For typical ranges, this gives a few thousand points.
    */
    const targetPoints = 3000;
    const rawStep = span / targetPoints;
    const step = chooseNiceStep(rawStep);

    const grid = [];

    for (let x = minCm1; x <= maxCm1; x += step) {
      grid.push(x);
    }

    if (grid.length === 0 || grid[grid.length - 1] < maxCm1) {
      grid.push(maxCm1);
    }

    return grid;
  }

  function convertDisplayRangeToRawCm1(rangeMin, rangeMax, xAxis, spectrumShiftCm1 = 0) {
    const displayRange = convertDisplayRangeToCm1(rangeMin, rangeMax, xAxis);

    if (!displayRange) {
      return null;
    }

    const shift = Number.isFinite(Number(spectrumShiftCm1))
      ? Number(spectrumShiftCm1)
      : 0;

    /*
      Convert displayed cm-1 coordinates back to raw calculated coordinates.
    */
    const rawA = displayRange.minCm1 - shift;
    const rawB = displayRange.maxCm1 - shift;

    if (!Number.isFinite(rawA) || !Number.isFinite(rawB) || rawA === rawB) {
      return null;
    }

    return {
      minCm1: Math.min(rawA, rawB),
      maxCm1: Math.max(rawA, rawB),
    };
  }

  function convertDisplayRangeToCm1(rangeMin, rangeMax, xAxis) {
    const a = Number(rangeMin);
    const b = Number(rangeMax);

    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) {
      return null;
    }

    let cm1A;
    let cm1B;

    switch (xAxis) {
      case "nm":
        //if (a <= 0 || b <= 0) return null;
        if (a <= 50 || b <= 50) return null;
        cm1A = UNITS.NM_CM1_FACTOR / a;
        cm1B = UNITS.NM_CM1_FACTOR / b;
        break;

      case "ev":
        cm1A = a * UNITS.CM1_PER_EV;
        cm1B = b * UNITS.CM1_PER_EV;
        break;

      case "cm-1":
      default:
        cm1A = a;
        cm1B = b;
        break;
    }

    if (!Number.isFinite(cm1A) || !Number.isFinite(cm1B)) {
      return null;
    }

    return {
      minCm1: Math.min(cm1A, cm1B),
      maxCm1: Math.max(cm1A, cm1B),
    };
  }

  function chooseNiceStep(rawStep) {
    if (!Number.isFinite(rawStep) || rawStep <= 0) {
      return 1;
    }

    const allowedSteps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];

    for (const step of allowedSteps) {
      if (rawStep <= step) {
        return step;
      }
    }

    const exponent = Math.floor(Math.log10(rawStep));
    const base = 10 ** exponent;
    const normalized = rawStep / base;

    if (normalized <= 2) return 2 * base;
    if (normalized <= 5) return 5 * base;
    return 10 * base;
  }

  function gaussian(amplitude, centerCm1, xCm1, widthCm1) {
    /*
      Same historical Gaussian form as the original Python tools:

      a * exp(-(ln(2) * ((center - x) / linewidth)^2))

      Note:
      The UI calls this FWHM for continuity with the old tools, but this
      formula reaches half-height at |center - x| = widthCm1.
    */

    if (
      !Number.isFinite(amplitude) ||
      !Number.isFinite(centerCm1) ||
      !Number.isFinite(xCm1) ||
      !Number.isFinite(widthCm1) ||
      widthCm1 === 0
    ) {
      return NaN;
    }

    return amplitude * Math.exp(
      -(Math.log(2) * ((centerCm1 - xCm1) / widthCm1) ** 2),
    );
  }

  function calculateEpsilonAtCm1(transitions, xCm1, widthCm1) {
    /*
      Calculate the decadic molar extinction coefficient ε at xCm1.

      Units:
        xCm1, transition.energyCm1, widthCm1: cm⁻¹
        result: L mol⁻¹ cm⁻¹ = M⁻¹ cm⁻¹

      This intentionally uses the same historical Gaussian width convention
      as gaussian():

        exp(-ln(2) * ((center - x) / width)^2)

      Therefore the displayed curve shape and ε values are consistent.
      With this convention, the normalized line shape is:

        g(x) = sqrt(ln(2) / pi) / width
               * exp(-ln(2) * ((center - x) / width)^2)

      and:
        ε(x) = Σ [2.315e8 * f_i * g_i(x)]
    */

    const validTransitions = sanitizeTransitions(transitions);

    if (
      validTransitions.length === 0 ||
      !Number.isFinite(xCm1) ||
      !Number.isFinite(widthCm1) ||
      widthCm1 <= 0
    ) {
      return NaN;
    }

    let epsilon = 0;

    for (const transition of validTransitions) {
      const contribution = epsilonGaussian(
        transition.fosc,
        transition.energyCm1,
        xCm1,
        widthCm1,
      );

      if (Number.isFinite(contribution)) {
        epsilon += contribution;
      }
    }

    return epsilon;
  }

  function epsilonGaussian(fosc, centerCm1, xCm1, widthCm1) {
    if (
      !Number.isFinite(fosc) ||
      !Number.isFinite(centerCm1) ||
      !Number.isFinite(xCm1) ||
      !Number.isFinite(widthCm1) ||
      fosc < 0 ||
      widthCm1 <= 0
    ) {
      return NaN;
    }

    const epsilonFactor = getEpsilonFactor(widthCm1);
    const exponent = -Math.log(2) * ((centerCm1 - xCm1) / widthCm1) ** 2;

    return epsilonFactor * fosc * Math.exp(exponent);
  }

  function getEpsilonFactor(widthCm1) {
    /*
      Converts a raw (fosc-amplitude) Gaussian contribution into the
      corresponding decadic molar extinction coefficient contribution, for a
      given shared Gaussian width widthCm1.

      Derivation:
        area-normalized line shape:
          g(x) = sqrt(ln(2) / pi) / width * exp(-ln(2) * ((center - x)/width)^2)
        epsilon contribution:
          areaPerFosc * fosc * g(x)
              = fosc * exp(-ln(2) * ((center - x)/width)^2)
                * [areaPerFosc * sqrt(ln(2) / pi) / width]

      The bracketed term is returned here and is independent of fosc/center/x,
      so it can be reused to scale an entire pre-summed raw intensity array.
    */
    if (!Number.isFinite(widthCm1) || widthCm1 <= 0) {
      return NaN;
    }

    const areaPerFosc = Number.isFinite(SPECTROSCOPY?.OSC_STRENGTH_TO_EPSILON_AREA)
      ? SPECTROSCOPY.OSC_STRENGTH_TO_EPSILON_AREA
      : 2.315e8;

    return areaPerFosc * Math.sqrt(Math.log(2) / Math.PI) / widthCm1;
  }

  function normalizeArray(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return [];
    }

    const finiteValues = values.filter(Number.isFinite);

    if (finiteValues.length === 0) {
      return values.map(() => 0);
    }

    const maxValue = Math.max(...finiteValues);

    if (maxValue === 0) {
      return values.map(() => 0);
    }

    return values.map((value) =>
      Number.isFinite(value) ? value / maxValue : 0,
    );
  }

  function emptySpectrum() {
    return {
      xCm1: [],
      xNm: [],
      xEv: [],
      intensity: [],
      intensityNorm: [],
      intensityScaled: [],
      epsilon: [],
      maxEpsilon: 0,
      epsilonFactor: NaN,
      maxIntensity: 0,
      maxFosc: 0,
      transitions: [],
      sticks: [],
      singleGaussians: [],
    };
  }

  window.OrcaUV.Spectrum = {
    buildSpectrum,
    gaussian,
    calculateEpsilonAtCm1,
    epsilonGaussian,
    getEpsilonFactor,
    normalizeArray,
  };
})();