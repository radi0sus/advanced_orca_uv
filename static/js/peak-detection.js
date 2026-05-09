// static/js/peak-detection.js

(function () {
  "use strict";

  window.OrcaUV = window.OrcaUV || {};

  const FALLBACK_CM1_PER_EV = 8065.54429;
  const FALLBACK_NM_CM1_FACTOR = 1.0e7;

  function detectPeaks(spectrum, options = {}) {
    if (!spectrum || !Array.isArray(spectrum.xCm1)) {
      return [];
    }

    const xCm1 = spectrum.xCm1;
    const y = getIntensityArray(spectrum);

    if (!Array.isArray(y) || xCm1.length !== y.length || xCm1.length < 3) {
      return [];
    }

    const validYMax = getMaxFinite(y);

    if (!Number.isFinite(validYMax) || validYMax <= 0) {
      return [];
    }

    const minimumHeightPercent = getMinimumHeightPercent(options);
    const minimumDistanceCm1 = getMinimumDistanceCm1(options);

    const heightThreshold = validYMax * (minimumHeightPercent / 100);

    const candidates = findPeakCandidates(xCm1, y, heightThreshold, validYMax);

    if (candidates.length === 0) {
      return [];
    }

    const distanceFiltered = filterByMinimumDistance(
      candidates,
      minimumDistanceCm1,
    );

    return distanceFiltered
      .sort((a, b) => a.wavelengthNm - b.wavelengthNm)
      .map((peak, index) => ({
        ...peak,
        peakNumber: index + 1,
      }));
  }

  function getIntensityArray(spectrum) {
    /*
      Peak detection should follow what the user sees.

      intensityScaled is preferred because it already includes the current
      normalization/scale-factor setting from spectrum.js.

      If unavailable, fall back to common internal names.
    */
    if (Array.isArray(spectrum.intensityScaled)) {
      return spectrum.intensityScaled;
    }

    if (Array.isArray(spectrum.intensityNorm)) {
      return spectrum.intensityNorm;
    }

    if (Array.isArray(spectrum.intensity)) {
      return spectrum.intensity;
    }

    if (Array.isArray(spectrum.y)) {
      return spectrum.y;
    }

    return [];
  }

  function findPeakCandidates(xCm1, y, heightThreshold, globalMax) {
    const candidates = [];
    const length = y.length;

    let index = 1;

    while (index < length - 1) {
      const current = y[index];

      if (!Number.isFinite(current) || current < heightThreshold) {
        index += 1;
        continue;
      }

      const previous = y[index - 1];
      const next = y[index + 1];

      if (!Number.isFinite(previous) || !Number.isFinite(next)) {
        index += 1;
        continue;
      }

      /*
        Normal sharp maximum:
          y[i] > y[i-1] and y[i] >= y[i+1]

        Plateau maximum:
          y[i] > y[i-1], then one or more equal points,
          then y[j] > y[j+1].
      */
      if (current > previous) {
        let plateauEnd = index;

        while (
          plateauEnd < length - 1 &&
          y[plateauEnd] === y[plateauEnd + 1]
        ) {
          plateauEnd += 1;
        }

        if (
          plateauEnd < length - 1 &&
          Number.isFinite(y[plateauEnd + 1]) &&
          y[plateauEnd] > y[plateauEnd + 1]
        ) {
          const peakIndex = Math.round((index + plateauEnd) / 2);
          const refined = refinePeakPosition(xCm1, y, peakIndex);

          candidates.push(buildPeakObject(
            refined.index,
            refined.energyCm1,
            refined.intensityScaled,
            globalMax,
          ));

          index = plateauEnd + 1;
          continue;
        }
      }

      /*
        Also accept the common strict-local-maximum case. This catches maxima
        where the left side is not handled by the plateau branch above.
      */
      if (current >= previous && current > next) {
        const refined = refinePeakPosition(xCm1, y, index);

        candidates.push(buildPeakObject(
          refined.index,
          refined.energyCm1,
          refined.intensityScaled,
          globalMax,
        ));
      }

      index += 1;
    }

    return candidates;
  }

  function refinePeakPosition(xCm1, y, index) {
    /*
      Quadratic interpolation around the local maximum.

      This gives slightly smoother peak positions than just returning the
      nearest grid point, but automatically falls back to the grid point if the
      neighboring points are unsuitable.
    */
    const centerX = xCm1[index];
    const centerY = y[index];

    if (
      index <= 0 ||
      index >= y.length - 1 ||
      !Number.isFinite(centerX) ||
      !Number.isFinite(centerY)
    ) {
      return {
        index,
        energyCm1: centerX,
        intensityScaled: centerY,
      };
    }

    const leftX = xCm1[index - 1];
    const rightX = xCm1[index + 1];

    const leftY = y[index - 1];
    const rightY = y[index + 1];

    if (
      !Number.isFinite(leftX) ||
      !Number.isFinite(rightX) ||
      !Number.isFinite(leftY) ||
      !Number.isFinite(rightY)
    ) {
      return {
        index,
        energyCm1: centerX,
        intensityScaled: centerY,
      };
    }

    const denominator = leftY - 2 * centerY + rightY;

    if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-15) {
      return {
        index,
        energyCm1: centerX,
        intensityScaled: centerY,
      };
    }

    const deltaIndex = 0.5 * (leftY - rightY) / denominator;

    /*
      A valid parabola vertex for a local maximum should be close to the center
      point. If not, the interpolation is unreliable.
    */
    if (!Number.isFinite(deltaIndex) || Math.abs(deltaIndex) > 1) {
      return {
        index,
        energyCm1: centerX,
        intensityScaled: centerY,
      };
    }

    const averageStep = (rightX - leftX) / 2;
    const refinedX = centerX + deltaIndex * averageStep;
    const refinedY = centerY - 0.25 * (leftY - rightY) * deltaIndex;

    if (
      !Number.isFinite(refinedX) ||
      !Number.isFinite(refinedY) ||
      refinedY < centerY * 0.95
    ) {
      return {
        index,
        energyCm1: centerX,
        intensityScaled: centerY,
      };
    }

    return {
      index,
      energyCm1: refinedX,
      intensityScaled: refinedY,
    };
  }

  function filterByMinimumDistance(candidates, minimumDistanceCm1) {
    if (!Number.isFinite(minimumDistanceCm1) || minimumDistanceCm1 <= 0) {
      return candidates.slice();
    }

    /*
      Keep the strongest peaks first. We then suppress weaker candidates within
      the requested cm⁻¹ distance.
    */
    const strongestFirst = candidates
      .slice()
      .sort((a, b) => b.intensityScaled - a.intensityScaled);

    const accepted = [];

    for (const candidate of strongestFirst) {
      const tooClose = accepted.some((existing) =>
        Math.abs(existing.energyCm1 - candidate.energyCm1) < minimumDistanceCm1,
      );

      if (!tooClose) {
        accepted.push(candidate);
      }
    }

    return accepted;
  }

  function buildPeakObject(index, energyCm1, intensityScaled, globalMax) {
    const units = getUnits();

    const energyEv = energyCm1 / units.CM1_PER_EV;
    const wavelengthNm = energyCm1 > 0
      ? units.NM_CM1_FACTOR / energyCm1
      : NaN;

    const intensityNorm = globalMax > 0
      ? intensityScaled / globalMax
      : 0;

    return {
      index,
      energyCm1,
      energyEv,
      wavelengthNm,
      intensityScaled,
      intensityNorm,
      relativeIntensityPercent: intensityNorm * 100,
    };
  }

  function getMinimumHeightPercent(options) {
    const candidates = [
      options.minimumHeightPercent,
      options.minHeightPercent,
      options.peakHeightPercent,
      options.peakMinHeightPercent,
      options.minimumPeakHeightPercent,
      options.minPeakHeightPercent,
      options.peakHeight,
      options.minHeight,
    ];

    for (const value of candidates) {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return clamp(number, 0, 100);
      }
    }

    return 5;
  }

  function getMinimumDistanceCm1(options) {
    const candidates = [
      options.minimumDistanceCm1,
      options.minDistanceCm1,
      options.peakDistanceCm1,
      options.peakMinDistanceCm1,
      options.minimumPeakDistanceCm1,
      options.minPeakDistanceCm1,
      options.peakDistance,
      options.minDistance,
    ];

    for (const value of candidates) {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return Math.max(0, number);
      }
    }

    return 1000;
  }

  function getMaxFinite(values) {
    let max = -Infinity;

    for (const value of values) {
      if (Number.isFinite(value) && value > max) {
        max = value;
      }
    }

    return max;
  }

  function getUnits() {
    const constants = window.OrcaUV.Constants || {};
    const units = constants.UNITS || {};

    return {
      CM1_PER_EV: Number.isFinite(units.CM1_PER_EV)
        ? units.CM1_PER_EV
        : FALLBACK_CM1_PER_EV,

      NM_CM1_FACTOR: Number.isFinite(units.NM_CM1_FACTOR)
        ? units.NM_CM1_FACTOR
        : FALLBACK_NM_CM1_FACTOR,
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  window.OrcaUV.PeakDetection = {
    detectPeaks,
  };
})();