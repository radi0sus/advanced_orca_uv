// static/js/plot.js

(function () {
  "use strict";

  window.OrcaUV = window.OrcaUV || {};

  function renderPlot(plotElement, spectrum, transitions, peaks, options = {}) {
    if (!plotElement) {
      console.warn("No plot element provided.");
      return;
    }

    if (!window.Plotly) {
      console.error("Plotly is not loaded.");
      return;
    }

    const hasSpectrum =
      spectrum &&
      Array.isArray(spectrum.xCm1) &&
      spectrum.xCm1.length > 0 &&
      Array.isArray(spectrum.intensityScaled) &&
      spectrum.intensityScaled.length > 0;

    if (!hasSpectrum) {
      clearPlot(plotElement);
      return;
    }

    const dark = isDarkMode();
    const colors = getThemeColors(dark);

    const experimentalY = getExperimentalDisplayYData(spectrum, options);

    const traces = buildTraces(spectrum, options, colors, experimentalY);
    const yMax = getYMax([
      spectrum.intensityScaled,
      getStickDisplayHeights(spectrum, options),
      experimentalY,
    ]);

    const annotations = [];

    if (options.showStateLabels && options.showSticks) {
      annotations.push(
        ...buildStateLabelAnnotations(spectrum, options, yMax, colors),
      );
    }

    if (options.showPeakLabels && Array.isArray(peaks) && peaks.length > 0) {
      annotations.push(
        ...buildPeakAnnotations(peaks, options, colors.peak),
      );
    }

    const layout = buildLayout({
      spectrum,
      options,
      annotations,
      colors,
      yMax,
    });

    const config = buildPlotConfig();

    Plotly.react(plotElement, traces, layout, config).then(() => {
      requestAnimationFrame(() => {
        Plotly.Plots.resize(plotElement);
      });
    });
  }

  function clearPlot(plotElement) {
    if (!plotElement) {
      return;
    }

    if (window.Plotly && plotElement.data) {
      Plotly.purge(plotElement);
    }

    plotElement.innerHTML = "";
  }

  function buildTraces(spectrum, options, colors, experimentalY = []) {
    const traces = [];

    /*
      Draw order, following the IR viewer style:
      1. filled Gaussian areas in the background
      2. individual Gaussian lines
      3. stick spectrum
      4. calculated summed spectrum
      5. experimental overlay
    */

    if (options.showGaussianAreas && spectrum.singleGaussians.length > 0) {
      traces.push(...buildFilledGaussianTraces(spectrum, options));
    }

    if (options.showSingleGaussians && spectrum.singleGaussians.length > 0) {
      traces.push(buildSingleGaussianTrace(spectrum, options, colors));
    }

    if (options.showSticks && spectrum.sticks.length > 0) {
      traces.push(buildStickTrace(spectrum, options, colors));
    }

    if (options.showSpectrum !== false) {
      traces.push(buildSpectrumTrace(spectrum, options, colors));
    }

    if (shouldShowExperimentalOverlay(options)) {
      const experimentalTrace = buildExperimentalTrace(
        spectrum,
        options,
        colors,
        experimentalY,
      );

      if (experimentalTrace) {
        traces.push(experimentalTrace);
      }
    }

    return traces;
  }

  function buildSpectrumTrace(spectrum, options, colors) {
    const x = getSpectrumXData(spectrum, options.xAxis, options);
    const y = spectrum.intensityScaled;
    const useFill = options.showSpectrumFill !== false;

    return {
      x,
      y,
      type: "scatter",
      mode: "lines",
      name: "Calculated",
      line: {
        color: colors.spectrum,
        width: 1.9,
      },
      fill: useFill ? "tozeroy" : "none",
      fillcolor: useFill ? colors.spectrumFill : "rgba(0,0,0,0)",
      hovertemplate:
        "Calculated<br>" +
        `${axisHoverLabel(options.xAxis)}: %{x:.4g}<br>` +
        "Intensity: %{y:.4f}<extra></extra>",
    };
  }

  function buildExperimentalTrace(spectrum, options, colors, experimentalY) {
    const experimental = options.experimental;

    if (!experimental?.data) {
      return null;
    }

    const xNm = getExperimentalXNm(experimental);
    const y = Array.isArray(experimentalY)
      ? experimentalY
      : getExperimentalDisplayYData(spectrum, options);

    if (!Array.isArray(xNm) || !Array.isArray(y) || xNm.length !== y.length) {
      return null;
    }

    const x = [];
    const displayY = [];

    for (let index = 0; index < xNm.length; index += 1) {
      const xValue = convertNmToAxis(xNm[index], options.xAxis);
      const yValue = y[index];

      if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
        continue;
      }

      x.push(xValue);
      displayY.push(yValue);
    }

    if (x.length < 2) {
      return null;
    }

    const style = options.experimentalStyle || "line-fill";

    return {
      x,
      y: displayY,
      type: "scatter",
      mode: "lines",
      name: "Experimental",
      line: {
        color: colors.experimental,
        width: 1.6,
      },
      fill: style === "line-fill" ? "tozeroy" : "none",
      fillcolor: style === "line-fill"
        ? colors.experimentalFill
        : "rgba(0,0,0,0)",
      opacity: 0.95,
      hovertemplate:
        "Experimental<br>" +
        `${axisHoverLabel(options.xAxis)}: %{x:.4g}<br>` +
        "Signal: %{y:.4f}<extra></extra>",
    };
  }

  function shouldShowExperimentalOverlay(options) {
    const experimental = options.experimental;

    if (!options.showExperimental || !experimental?.data) {
      return false;
    }

    const xNm = getExperimentalXNm(experimental);
    const yRaw = getExperimentalRawY(experimental);

    return (
      Array.isArray(xNm) &&
      Array.isArray(yRaw) &&
      xNm.length > 1 &&
      yRaw.length > 1
    );
  }

  function getExperimentalDisplayYData(spectrum, options) {
    const experimental = options.experimental;

    if (!experimental?.data || !options.showExperimental) {
      return [];
    }

    const yRaw = getExperimentalRawY(experimental);

    if (!Array.isArray(yRaw) || yRaw.length === 0) {
      return [];
    }

    let y = yRaw.map((value) =>
      convertExperimentalYValue(value, options.experimentalYType),
    );

    if (options.baselineCorrection) {
      y = subtractBaseline(y);
    }

    if (options.normalizeExperimental !== false) {
      y = normalizeExperimentalY(y, spectrum, options);
    }

    return y;
  }

  function getExperimentalXNm(experimental) {
    if (Array.isArray(experimental?.data?.xNm)) {
      return experimental.data.xNm;
    }

    if (Array.isArray(experimental?.data?.x)) {
      return experimental.data.x;
    }

    return [];
  }

  function getExperimentalRawY(experimental) {
    if (Array.isArray(experimental?.data?.yRaw)) {
      return experimental.data.yRaw;
    }

    if (Array.isArray(experimental?.data?.y)) {
      return experimental.data.y;
    }

    return [];
  }

  function convertExperimentalYValue(value, yType) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return NaN;
    }

    if (yType === "transmittance") {
      /*
        Convert transmittance percent to absorbance-like signal:
        A = -log10(T / 100)

        This makes experimental transmittance data comparable to an
        absorption spectrum. Invalid or non-positive T values are ignored.
      */
      if (number <= 0) {
        return NaN;
      }

      return -Math.log10(number / 100);
    }

    return number;
  }

  function subtractBaseline(values) {
    const finite = values.filter(Number.isFinite);

    if (finite.length === 0) {
      return values.map(() => NaN);
    }

    const baseline = Math.min(...finite);

    return values.map((value) =>
      Number.isFinite(value) ? value - baseline : NaN,
    );
  }

  function normalizeExperimentalY(values, spectrum, options) {
    const finite = values.filter(Number.isFinite);

    if (finite.length === 0) {
      return values.map(() => NaN);
    }

    /*
      Important:
      Normalization should only scale the overlay height.
      It should not implicitly subtract the baseline.

      Baseline correction is controlled separately by:
        options.baselineCorrection

      Therefore we scale by max(y), not by max(y) - min(y).
    */
    const max = Math.max(...finite);

    if (!Number.isFinite(max) || max === 0) {
      return values.map((value) =>
        Number.isFinite(value) ? value : NaN,
      );
    }

    const targetMax = getCalculatedDisplayMax(spectrum, options);

    return values.map((value) =>
      Number.isFinite(value)
        ? (value / max) * targetMax
        : NaN,
    );
  }

  function getCalculatedDisplayMax(spectrum, options) {
    const spectrumMax = getMaxFinite(spectrum?.intensityScaled ?? []);

    if (Number.isFinite(spectrumMax) && spectrumMax > 0) {
      return spectrumMax;
    }

    if (Number.isFinite(options.scaleFactor) && options.scaleFactor > 0) {
      return options.scaleFactor;
    }

    return 1;
  }

  function buildStickTrace(spectrum, options, colors) {
    const x = [];
    const y = [];

    for (const stick of spectrum.sticks) {
      const xValue = getTransitionXValue(stick, options.xAxis, options);
      const yValue = getStickDisplayHeight(stick, spectrum, options);

      if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
        continue;
      }

      x.push(xValue, xValue, null);
      y.push(0, yValue, null);
    }

    return {
      x,
      y,
      type: "scatter",
      mode: "lines",
      name: "Sticks",
      line: {
        color: colors.sticks,
        width: 1.1,
      },
      opacity: 0.75,
      hoverinfo: "skip",
      showlegend: false,
    };
  }

  function buildSingleGaussianTrace(spectrum, options, colors) {
    const x = [];
    const y = [];

    for (const gaussianBand of spectrum.singleGaussians) {
      const bandX = gaussianBand.xCm1.map((cm1) =>
        convertCalculatedCm1ToAxis(cm1, options.xAxis, options),
      );

      const bandY = scaleGaussianY(gaussianBand.y, spectrum, options);

      for (let index = 0; index < bandX.length; index += 1) {
        x.push(bandX[index]);
        y.push(bandY[index]);
      }

      x.push(null);
      y.push(null);
    }

    return {
      x,
      y,
      type: "scatter",
      mode: "lines",
      name: "Single Gaussians",
      line: {
        color: colors.gaussian,
        width: 0.85,
        dash: "solid",
      },
      opacity: 1,
      hoverinfo: "skip",
      showlegend: false,
    };
  }

  function buildFilledGaussianTraces(spectrum, options) {
    const traces = [];

    if (!Array.isArray(spectrum.singleGaussians) || spectrum.singleGaussians.length === 0) {
      return traces;
    }

    const centers = spectrum.singleGaussians
      .map((gaussianBand) => gaussianBand.energyCm1)
      .filter(Number.isFinite);

    const minCenter = centers.length > 0 ? Math.min(...centers) : 0;
    const maxCenter = centers.length > 0 ? Math.max(...centers) : 1;

    for (const gaussianBand of spectrum.singleGaussians) {
      if (!Number.isFinite(gaussianBand.fosc) || gaussianBand.fosc <= 0) {
        continue;
      }

      const bandX = gaussianBand.xCm1.map((cm1) =>
        convertCalculatedCm1ToAxis(cm1, options.xAxis, options),
      );

      const bandY = scaleGaussianY(gaussianBand.y, spectrum, options);

      const polygonX = [];
      const polygonY = [];

      for (let index = 0; index < bandX.length; index += 1) {
        polygonX.push(bandX[index]);
        polygonY.push(bandY[index]);
      }

      for (let index = bandX.length - 1; index >= 0; index -= 1) {
        polygonX.push(bandX[index]);
        polygonY.push(0);
      }

      const fillColor = gaussianRainbowColor(
        gaussianBand.energyCm1,
        minCenter,
        maxCenter,
        0.15,
      );

      const lineColor = gaussianRainbowColor(
        gaussianBand.energyCm1,
        minCenter,
        maxCenter,
        0.32,
      );

      traces.push({
        x: polygonX,
        y: polygonY,
        type: "scatter",
        mode: "lines",
        fill: "toself",
        fillcolor: fillColor,
        name: `Gaussian ${gaussianBand.label || ""}`.trim(),
        line: {
          color: lineColor,
          width: 0.45,
        },
        hoverinfo: "skip",
        showlegend: false,
      });
    }

    return traces;
  }

  function gaussianRainbowColor(center, minCenter, maxCenter, alpha) {
      /*
        center in cm⁻¹
        14286 cm⁻¹ (~700 nm) = Rot    (Hue 0°)
        26316 cm⁻¹ (~380 nm) = Violett (Hue 270°)
        alles außerhalb geclampt
      */
      const relative = clamp((center - 14286) / (26316 - 14286), 0, 1);
      const hue = relative * 270;
      return `hsla(${hue.toFixed(1)}, 90%, 50%, ${alpha})`;
  }

  function buildStateLabelAnnotations(spectrum, options, yMax, colors) {
    const annotations = [];

    if (!Array.isArray(spectrum.sticks) || spectrum.sticks.length === 0) {
      return annotations;
    }

    const labelThreshold = 0.03;

    /*
      Put state labels beside the stick close to the baseline instead of above
      the stick. This avoids collisions with peak labels, especially for small
      FWHM values where peaks and sticks nearly coincide.
    */
    const baseY = yMax > 0 ? yMax * 0.045 : 0.045;
    const maxLabelY = yMax > 0 ? yMax * 0.14 : 0.14;

    for (const stick of spectrum.sticks) {
      if (!Number.isFinite(stick.fosc) || stick.fosc <= 0) {
        continue;
      }

      if (Number.isFinite(stick.relativeFosc) && stick.relativeFosc < labelThreshold) {
        continue;
      }

      const xValue = getTransitionXValue(stick, options.xAxis, options);
      const yValue = getStickDisplayHeight(stick, spectrum, options);

      if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
        continue;
      }

      /*
        Keep labels near the baseline, but lift them slightly for stronger
        sticks so they still visually belong to the corresponding transition.
      */
      const labelY = Math.min(
        Math.max(baseY, yValue * 0.18),
        maxLabelY,
      );

      annotations.push({
        x: xValue,
        y: labelY,
        text: escapeHtml(stick.label || `S${stick.state}`),
        showarrow: false,
        textangle: -90,
        font: {
          size: 10,
          color: colors.sticks,
        },
        xanchor: "left",
        yanchor: "middle",
        align: "left",
        xshift: 0,
      });
    }

    return annotations;
  }

  function buildPeakAnnotations(peaks, options, peakColor) {
    const annotations = [];
    const filteredPeaks = thinPeakLabels(peaks, 15);

    for (const peak of filteredPeaks) {
      const x = getPeakXValue(peak, options.xAxis, options);
      const y = getPeakYValue(peak);

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }

      annotations.push({
        x,
        y,
        text: formatPeakLabel(peak, options.xAxis, options),
        showarrow: true,
        arrowhead: 0,
        arrowsize: 1,
        arrowwidth: 1,
        arrowcolor: peakColor,
        standoff: 5,
        ax: 0,
        ay: -52,
        textangle: -90,
        font: {
          size: 10,
          color: peakColor,
        },
        xanchor: "center",
        align: "center",
      });
    }

    return annotations;
  }

  function thinPeakLabels(peaks, minDistanceCm1) {
    if (!Array.isArray(peaks) || peaks.length === 0) {
      return [];
    }

    /*
      Keep labels reasonably separated in the internal cm⁻¹ domain.
      The value here is deliberately small; real peak filtering is already
      handled by peak-detection.js.
    */
    const labeled = [];

    for (const peak of peaks) {
      const tooClose = labeled.some((existing) => {
        const distance = Math.abs((peak.energyCm1 ?? 0) - (existing.energyCm1 ?? 0));
        return distance < minDistanceCm1;
      });

      if (!tooClose) {
        labeled.push(peak);
      }
    }

    return labeled.slice(0, 20);
  }

  function buildLayout({ spectrum, options, annotations, colors, yMax }) {
    const xRange = buildXRange(spectrum, options);
    const yRange = buildYRange(yMax, options);
    const xTickConfig = buildXAxisTickConfig(xRange, options.xAxis);

    return {
      title: {
        text: escapeHtml(options.plotTitle || "Absorption spectrum"),
        x: 0.5,
        xanchor: "center",
        font: {
          size: 20,
          color: colors.text,
        },
      },
      paper_bgcolor: colors.paperBg,
      plot_bgcolor: colors.plotBg,
      margin: {
        t: 72,
        r: 30,
        b: 96,
        l: 82,
      },
      font: {
        color: colors.text,
      },
      xaxis: {
        title: {
          text: axisTitle(options.xAxis),
          font: {
            size: 15,
            color: colors.text,
          },
        },
        range: xRange,
        showline: true,
        linecolor: colors.axis,
        linewidth: 1.4,
        mirror: true,
        ticks: "outside",
        ticklen: 6,
        tickwidth: 1.1,
        tickcolor: colors.axis,
        tickfont: {
          color: colors.text,
        },
        automargin: true,
        showgrid: Boolean(options.showGrid),
        gridcolor: colors.grid,
        zeroline: false,
        ...xTickConfig,
      },
      yaxis: {
        title: {
          text: yAxisTitle(options),
          font: {
            size: 15,
            color: colors.text,
          },
        },
        range: yRange,
        showline: true,
        linecolor: colors.axis,
        linewidth: 1.4,
        mirror: true,
        ticks: "outside",
        ticklen: 6,
        tickwidth: 1.1,
        tickcolor: colors.axis,
        tickfont: {
          color: colors.text,
        },
        automargin: true,
        showgrid: false,
        zeroline: false,
      },
      annotations,
      showlegend: false,
      hovermode: "closest",
    };
  }

  function buildXRange(spectrum, options) {
    const autoRangeInfo = getAutoRangeInfo(spectrum, options);

    if (!autoRangeInfo || !Array.isArray(autoRangeInfo.range)) {
      return undefined;
    }

    const min = autoRangeInfo.range[0];
    const max = autoRangeInfo.range[1];

    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      return undefined;
    }

    if (options.axisDirection === "reversed") {
      return [max, min];
    }

    return [min, max];
  }

  function getAutoRangeInfo(spectrum, options = {}) {
    if (
      options.autoRange === false &&
      Number.isFinite(options.rangeMin) &&
      Number.isFinite(options.rangeMax) &&
      options.rangeMin !== options.rangeMax
    ) {
      return {
        mode: "manual",
        range: [
          Math.min(options.rangeMin, options.rangeMax),
          Math.max(options.rangeMin, options.rangeMax),
        ],
        outsideTransitions: [],
      };
    }

    const values = [
      ...getSignificantSpectrumXValues(spectrum, options),
      ...getRelevantStickXValues(spectrum, options),
    ].filter(Number.isFinite);

    let range = null;

    if (values.length > 0) {
      range = addRangePadding(values, options.xAxis);
    }

    if (!range) {
      const stickValues = Array.isArray(spectrum?.sticks)
        ? spectrum.sticks
            .map((stick) => getTransitionXValue(stick, options.xAxis, options))
            .filter(Number.isFinite)
        : [];

      if (stickValues.length > 0) {
        range = addRangePadding(stickValues, options.xAxis);
      }
    }

    if (!range) {
      const allX = getSpectrumXData(spectrum, options.xAxis, options)
        .filter(Number.isFinite);

      if (allX.length > 0) {
        range = addRangePadding(allX, options.xAxis);
      }
    }

    if (!range) {
      return {
        mode: "auto",
        range: null,
        outsideTransitions: [],
      };
    }

    return {
      mode: "auto",
      range,
      outsideTransitions: getWeakTransitionsOutsideRange(spectrum, options, range),
    };
  }

  function getSignificantSpectrumXValues(spectrum, options) {
    const x = getSpectrumXData(spectrum, options.xAxis, options);
    const y = spectrum?.intensityScaled;

    if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) {
      return [];
    }

    const yMax = getMaxFinite(y);

    if (!Number.isFinite(yMax) || yMax <= 0) {
      return [];
    }

    /*
      Auto range follows the visible/significant calculated spectrum,
      not the full internal grid. This avoids extremely weak far-IR/near-IR
      transitions or near-zero cm⁻¹ grid points dominating the wavelength axis.
    */
    const relativeThreshold = 0.005;
    const threshold = yMax * relativeThreshold;

    const values = [];

    for (let index = 0; index < x.length; index += 1) {
      const xValue = x[index];
      const yValue = y[index];

      if (
        Number.isFinite(xValue) &&
        Number.isFinite(yValue) &&
        yValue >= threshold
      ) {
        values.push(xValue);
      }
    }

    return values;
  }

  function getRelevantStickXValues(spectrum, options) {
    if (!Array.isArray(spectrum?.sticks) || spectrum.sticks.length === 0) {
      return [];
    }

    const maxFosc = Number.isFinite(spectrum.maxFosc)
      ? spectrum.maxFosc
      : 0;

    if (maxFosc <= 0) {
      return [];
    }

    /*
      Include only relevant oscillator-strength sticks in auto range.
      Very weak transitions remain available in tables and with manual range,
      but they should not dominate the automatic default view.
    */
    const threshold = maxFosc * 0.01;

    return spectrum.sticks
      .filter((stick) =>
        Number.isFinite(stick.fosc) &&
        stick.fosc >= threshold,
      )
      .map((stick) => getTransitionXValue(stick, options.xAxis, options))
      .filter(Number.isFinite);
  }

  function getWeakTransitionsOutsideRange(spectrum, options, range) {
    if (
      !Array.isArray(spectrum?.sticks) ||
      spectrum.sticks.length === 0 ||
      !Array.isArray(range) ||
      range.length !== 2
    ) {
      return [];
    }

    const min = Math.min(range[0], range[1]);
    const max = Math.max(range[0], range[1]);

    const maxFosc = Number.isFinite(spectrum.maxFosc)
      ? spectrum.maxFosc
      : 0;

    if (maxFosc <= 0) {
      return [];
    }

    const weakThreshold = maxFosc * 0.01;

    return spectrum.sticks
      .map((stick) => {
        const xValue = getTransitionXValue(stick, options.xAxis, options);

        return {
          state: stick.state,
          label: stick.label || `S${stick.state}`,
          xValue,
          xAxis: options.xAxis,
          fosc: stick.fosc,
          energyCm1: stick.energyCm1,
          energyEv: stick.energyEv,
          wavelengthNm: stick.wavelengthNm,
        };
      })
      .filter((transition) =>
        Number.isFinite(transition.xValue) &&
        Number.isFinite(transition.fosc) &&
        transition.fosc < weakThreshold &&
        (transition.xValue < min || transition.xValue > max),
      );
  }

  function addRangePadding(values, xAxis) {
    const finite = values.filter(Number.isFinite);

    if (finite.length === 0) {
      return null;
    }

    let min = Math.min(...finite);
    let max = Math.max(...finite);

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return null;
    }

    if (min === max) {
      const center = min;
      let halfWidth;

      switch (xAxis) {
        case "ev":
          halfWidth = Math.max(Math.abs(center) * 0.05, 0.1);
          break;

        case "cm-1":
          halfWidth = Math.max(Math.abs(center) * 0.05, 500);
          break;

        case "nm":
        default:
          halfWidth = Math.max(Math.abs(center) * 0.05, 10);
          break;
      }

      min = center - halfWidth;
      max = center + halfWidth;
    } else {
      const padding = (max - min) * 0.04;

      min -= padding;
      max += padding;
    }

    if (xAxis === "nm" || xAxis === "ev" || xAxis === "cm-1") {
      min = Math.max(min, Number.EPSILON);
    }

    return [min, max];
  }

  function buildXAxisTickConfig(xRange, xAxis) {
    if (!Array.isArray(xRange) || xRange.length !== 2) {
      return {};
    }

    const start = Number(xRange[0]);
    const end = Number(xRange[1]);

    if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) {
      return {};
    }

    /*
      Use evenly spaced ticks including exact axis start and end.
      This mimics the old Python/Matplotlib LinearLocator idea and ensures
      that labels are visible at both ends of the x-axis.
    */
    const tickValues = buildLinearTicks(start, end, 6);

    return {
      tickmode: "array",
      tickvals: tickValues,
      ticktext: tickValues.map((value) => formatAxisTick(value, xAxis)),
    };
  }

  function buildLinearTicks(start, end, count) {
    const ticks = [];

    if (!Number.isFinite(start) || !Number.isFinite(end) || count < 2) {
      return ticks;
    }

    const step = (end - start) / (count - 1);

    for (let index = 0; index < count; index += 1) {
      ticks.push(start + step * index);
    }

    /*
      Force exact start/end to avoid tiny floating-point deviations.
    */
    ticks[0] = start;
    ticks[ticks.length - 1] = end;

    return removeNearDuplicateTicks(ticks);
  }

  function removeNearDuplicateTicks(ticks) {
    const result = [];
    const tolerance = 1e-9;

    for (const tick of ticks) {
      if (!result.some((existing) => Math.abs(existing - tick) < tolerance)) {
        result.push(tick);
      }
    }

    return result;
  }

  function formatAxisTick(value, xAxis) {
    if (!Number.isFinite(value)) {
      return "";
    }

    switch (xAxis) {
      case "ev":
        return value.toFixed(2);

      case "nm":
        if (Math.abs(value) >= 100) {
          return value.toFixed(0);
        }
        return value.toFixed(1);

      case "cm-1":
      default:
        return value.toFixed(0);
    }
  }

  function buildYRange(yMax, options) {
    const scaleFactor = Number.isFinite(options.scaleFactor)
      ? options.scaleFactor
      : 1;

    const maxY = Number.isFinite(yMax) && yMax > 0
      ? yMax
      : scaleFactor;

    /*
      Extra headroom is needed because Plotly annotations are positioned in
      screen pixels above the actual peak coordinates. Without this, rotated
      peak labels can touch or exceed the plot frame.
    */
    let paddingFactor = 1.14;

    if (options.showStateLabels) {
      paddingFactor = Math.max(paddingFactor, 1.24);
    }

    if (options.showPeakLabels) {
      paddingFactor = Math.max(paddingFactor, 1.36);
    }

    return [0, maxY * paddingFactor];
  }

  function buildPlotConfig() {
    return {
      responsive: true,
      displaylogo: false,
      scrollZoom: true,
      modeBarButtonsToRemove: [
        "select2d",
        "lasso2d",
        "autoScale2d",
      ],
      toImageButtonOptions: {
        format: "png",
        filename: "advanced_orca_uvvis",
        width: 1400,
        height: 900,
        scale: 2,
      },
    };
  }

  function getSpectrumXData(spectrum, xAxis, options = {}) {
    if (!Array.isArray(spectrum?.xCm1)) {
      return [];
    }

    /*
      The calculated spectrum shift is a display/alignment transform.
      Raw ORCA data remain unchanged.
    */
    return spectrum.xCm1.map((cm1) =>
      convertCalculatedCm1ToAxis(cm1, xAxis, options),
    );
  }

  function getTransitionXValue(transition, xAxis, options = {}) {
    const energyCm1 = Number.isFinite(transition?.energyCm1)
      ? transition.energyCm1
      : NaN;

    return convertCalculatedCm1ToAxis(energyCm1, xAxis, options);
  }

  function getPeakXValue(peak, xAxis, options = {}) {
    const energyCm1 = Number.isFinite(peak?.energyCm1)
      ? peak.energyCm1
      : NaN;

    return convertCalculatedCm1ToAxis(energyCm1, xAxis, options);
  }

  function getPeakYValue(peak) {
    if (Number.isFinite(peak.intensityScaled)) {
      return peak.intensityScaled;
    }

    if (Number.isFinite(peak.intensityNorm)) {
      return peak.intensityNorm;
    }

    if (Number.isFinite(peak.relativeIntensityPercent)) {
      return peak.relativeIntensityPercent / 100;
    }

    return NaN;
  }

  function convertCalculatedCm1ToAxis(cm1, xAxis, options = {}) {
    const shiftedCm1 = getShiftedCalculatedCm1(cm1, options);
    return convertCm1ToAxis(shiftedCm1, xAxis);
  }

  function getShiftedCalculatedCm1(cm1, options = {}) {
    const number = Number(cm1);

    if (!Number.isFinite(number)) {
      return NaN;
    }

    return number + getSpectrumShiftCm1(options);
  }

  function getSpectrumShiftCm1(options = {}) {
    const shift = Number(options.spectrumShiftCm1);
    return Number.isFinite(shift) ? shift : 0;
  }

  function convertNmToAxis(nm, xAxis) {
    const number = Number(nm);

    if (!Number.isFinite(number) || number <= 0) {
      return NaN;
    }

    const cm1 = 1.0e7 / number;

    switch (xAxis) {
      case "nm":
        return number;

      case "ev":
        return cm1 / 8065.54429;

      case "cm-1":
      default:
        return cm1;
    }
  }

  function convertCm1ToAxis(cm1, xAxis) {
    if (!Number.isFinite(cm1) || cm1 <= 0) {
      return NaN;
    }

    switch (xAxis) {
      case "nm":
        return 1.0e7 / cm1;
      case "ev":
        return cm1 / 8065.54429;
      case "cm-1":
      default:
        return cm1;
    }
  }

  function scaleGaussianY(yValues, spectrum, options) {
    const scaleFactor = Number.isFinite(options.scaleFactor)
      ? options.scaleFactor
      : 1;

    if (options.normalizeSpectrum !== false) {
      const maxIntensity = Number.isFinite(spectrum.maxIntensity)
        ? spectrum.maxIntensity
        : 0;

      if (maxIntensity <= 0) {
        return yValues.map(() => 0);
      }

      return yValues.map((value) =>
        Number.isFinite(value) ? (value / maxIntensity) * scaleFactor : 0,
      );
    }

    return yValues.map((value) =>
      Number.isFinite(value) ? value * scaleFactor : 0,
    );
  }

  function getStickDisplayHeights(spectrum, options) {
    if (!spectrum || !Array.isArray(spectrum.sticks)) {
      return [];
    }

    return spectrum.sticks.map((stick) =>
      getStickDisplayHeight(stick, spectrum, options),
    );
  }

  function getStickDisplayHeight(stick, spectrum, options) {
    const scaleFactor = Number.isFinite(options.scaleFactor)
      ? options.scaleFactor
      : 1;

    if (!Number.isFinite(stick.fosc) || stick.fosc <= 0) {
      return 0;
    }

    /*
      Stick heights use the same y-scale as the Gaussian bands.
      Each Gaussian has amplitude = fosc, so sticks are normalized with
      the same denominator as the summed Gaussian spectrum.
    */
    if (options.normalizeSpectrum !== false) {
      const maxIntensity = Number.isFinite(spectrum.maxIntensity)
        ? spectrum.maxIntensity
        : 0;

      if (maxIntensity <= 0) {
        return 0;
      }

      return (stick.fosc / maxIntensity) * scaleFactor;
    }

    return stick.fosc * scaleFactor;
  }

  function getYMax(arrays) {
    let maxValue = 0;

    for (const array of arrays) {
      if (!Array.isArray(array)) {
        continue;
      }

      for (const value of array) {
        if (Number.isFinite(value) && value > maxValue) {
          maxValue = value;
        }
      }
    }

    return maxValue;
  }

  function getMaxFinite(values) {
    if (!Array.isArray(values)) {
      return NaN;
    }

    let max = -Infinity;

    for (const value of values) {
      if (Number.isFinite(value) && value > max) {
        max = value;
      }
    }

    return max;
  }

  function axisTitle(xAxis) {
    switch (xAxis) {
      case "nm":
        return "Wavelength / nm";
      case "ev":
        return "Energy / eV";
      case "cm-1":
      default:
        return "Energy / cm⁻¹";
    }
  }

  function axisHoverLabel(xAxis) {
    switch (xAxis) {
      case "nm":
        return "λ / nm";
      case "ev":
        return "E / eV";
      case "cm-1":
      default:
        return "E / cm⁻¹";
    }
  }

  function yAxisTitle(options) {
    if (options.normalizeSpectrum !== false) {
      return "Intensity / normalized units";
    }

    return "Intensity";
  }

  function formatPeakLabel(peak, xAxis, options = {}) {
    const shiftedEnergyCm1 = getShiftedCalculatedCm1(peak.energyCm1, options);

    if (!Number.isFinite(shiftedEnergyCm1) || shiftedEnergyCm1 <= 0) {
      return "—";
    }

    const shiftedWavelengthNm = 1.0e7 / shiftedEnergyCm1;
    const shiftedEnergyEv = shiftedEnergyCm1 / 8065.54429;

    switch (xAxis) {
      case "nm":
        return formatNumber(shiftedWavelengthNm, 1);

      case "ev":
        return formatNumber(shiftedEnergyEv, 3);

      case "cm-1":
      default:
        return formatNumber(shiftedEnergyCm1, 0);
    }
  }

  function updatePlotTheme() {
    const plotElement = document.getElementById("plot");

    if (!plotElement || !plotElement.data || !plotElement.layout) {
      return;
    }

    const colors = getThemeColors(isDarkMode());

    Plotly.relayout(plotElement, {
      paper_bgcolor: colors.paperBg,
      plot_bgcolor: colors.plotBg,
      "font.color": colors.text,
      "title.font.color": colors.text,
      "xaxis.title.font.color": colors.text,
      "xaxis.linecolor": colors.axis,
      "xaxis.tickcolor": colors.axis,
      "xaxis.tickfont.color": colors.text,
      "xaxis.gridcolor": colors.grid,
      "yaxis.title.font.color": colors.text,
      "yaxis.linecolor": colors.axis,
      "yaxis.tickcolor": colors.axis,
      "yaxis.tickfont.color": colors.text,
      "yaxis.gridcolor": colors.grid,
    });
  }

  function getThemeColors(dark) {
    if (dark) {
      return {
        paperBg: "#1a222b",
        plotBg: "#1a222b",
        text: "#e6edf3",
        axis: "#e6edf3",
        grid: "rgba(230,237,243,0.12)",
        spectrum: "#7fb3d5",
        spectrumFill: "rgba(127,179,213,0.16)",
        sticks: "#f1948a",
        gaussian: "rgba(159,176,191,0.55)",
        peak: "#f1948a",
        experimental: "#58d68d",
        experimentalFill: "rgba(88,214,141,0.13)",
      };
    }

    return {
      paperBg: "#ffffff",
      plotBg: "#ffffff",
      text: "#1f2a33",
      axis: "#1f2a33",
      grid: "rgba(31,42,51,0.10)",
      spectrum: "#1a5276",
      spectrumFill: "rgba(26,82,118,0.12)",
      sticks: "#922b21",
      gaussian: "rgba(91,107,121,0.45)",
      peak: "#922b21",
      experimental: "#1e8449",
      experimentalFill: "rgba(30,132,73,0.11)",
    };
  }

  function isDarkMode() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatNumber(value, digits = 2) {
    if (!Number.isFinite(value)) {
      return "—";
    }

    return value.toFixed(digits);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.OrcaUV.Plot = {
    renderPlot,
    updatePlotTheme,
    getAutoRangeInfo,
  };
})();