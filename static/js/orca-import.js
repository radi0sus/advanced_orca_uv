// static/js/orca-import.js

(function () {
  "use strict";

  window.OrcaUV = window.OrcaUV || {};

  const {
    ORCA_UVVIS_SECTION,
    PARSER,
    UNITS,
  } = window.OrcaUV.Constants;

  const {
    detectHomoLumo,
    parseExcitedStates,
  } = window.OrcaUV.ExcitedStates;

  function parseOrcaUvVisOutput(text, fileName = "") {
    const warnings = [];

    const orcaVersion = detectOrcaVersion(text);
    const homoLumo = detectHomoLumo(text);
    const excitedStates = parseExcitedStates(text, homoLumo);

    const absorptionBlock = extractAbsorptionBlock(text);

    if (!absorptionBlock) {
      warnings.push(
        `UV-Vis section not found: ${ORCA_UVVIS_SECTION.startMarker}`,
      );

      return {
        metadata: {
          fileName,
          orcaVersion,
          spectrumSource: ORCA_UVVIS_SECTION.sourceLabel,
          sectionFound: false,
          sectionStart: ORCA_UVVIS_SECTION.startMarker,
          sectionEnd: ORCA_UVVIS_SECTION.endMarker,
          transitionCount: 0,
          excitedStatesFound: excitedStates.metadata.found,
          excitedStateCount: excitedStates.metadata.stateCount,
          assignmentCount: excitedStates.metadata.assignmentCount,
          homoLumo,
          tableFormats: [],
          warnings,
        },
        transitions: [],
        excitedStates,
      };
    }

    const parsedTransitions = parseAbsorptionTransitions(absorptionBlock, {
      excitedStates,
      homoLumo,
      warnings,
    });

    const energyValues = parsedTransitions
      .map((transition) => transition.energyCm1)
      .filter(Number.isFinite);

    const wavelengthValues = parsedTransitions
      .map((transition) => transition.wavelengthNm)
      .filter(Number.isFinite);

    const foscValues = parsedTransitions
      .map((transition) => transition.fosc)
      .filter(Number.isFinite);

    const tableFormats = [
      ...new Set(parsedTransitions.map((transition) => transition.sourceFormat)),
    ];

    return {
      metadata: {
        fileName,
        orcaVersion,
        spectrumSource: ORCA_UVVIS_SECTION.sourceLabel,
        sectionFound: true,
        sectionStart: ORCA_UVVIS_SECTION.startMarker,
        sectionEnd: ORCA_UVVIS_SECTION.endMarker,
        transitionCount: parsedTransitions.length,
        excitedStatesFound: excitedStates.metadata.found,
        excitedStateCount: excitedStates.metadata.stateCount,
        assignmentCount: excitedStates.metadata.assignmentCount,
        homoLumo,
        tableFormats,
        energyRangeCm1: rangeOf(energyValues),
        wavelengthRangeNm: rangeOf(wavelengthValues),
        maxFosc: foscValues.length ? Math.max(...foscValues) : null,
        warnings,
      },
      transitions: parsedTransitions,
      excitedStates,
    };
  }

  function cm1ToNm(cm1) {
    if (!Number.isFinite(cm1) || cm1 === 0) return NaN;
    return UNITS.NM_CM1_FACTOR / cm1;
  }

  function cm1ToEv(cm1) {
    if (!Number.isFinite(cm1)) return NaN;
    return cm1 / UNITS.CM1_PER_EV;
  }

  function evToCm1(ev) {
    if (!Number.isFinite(ev)) return NaN;
    return ev * UNITS.CM1_PER_EV;
  }

  function nmToCm1(nm) {
    if (!Number.isFinite(nm) || nm === 0) return NaN;
    return UNITS.NM_CM1_FACTOR / nm;
  }

  function parseAbsorptionTransitions(block, context) {
    const lines = block.split(/\r?\n/);
    const transitions = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) continue;
      if (trimmed.startsWith("-")) continue;
      if (/^(State|Transition)\b/i.test(trimmed)) continue;
      if (/^$/.test(trimmed)) continue;

      const orca6Transition = parseOrca6AbsorptionLine(trimmed, context);
      if (orca6Transition) {
        transitions.push(orca6Transition);
        continue;
      }

      const orca5Transition = parseOrca5AbsorptionLine(trimmed, context);
      if (orca5Transition) {
        transitions.push(orca5Transition);
      }
    }

    return transitions;
  }

  function parseOrca5AbsorptionLine(line, context) {
    if (!/^\d+\s+[-+]?\d/.test(line)) return null;

    const parts = line.split(/\s+/);
    if (parts.length < 4) return null;

    const state = Number.parseInt(parts[0], 10);
    const energyCm1 = parseFloatSafe(parts[1]);
    const wavelengthNm = parseFloatSafe(parts[2]);
    const fosc = parseFloatSafe(parts[3]);

    if (
      !Number.isInteger(state) ||
      !Number.isFinite(energyCm1) ||
      !Number.isFinite(wavelengthNm) ||
      !Number.isFinite(fosc)
    ) {
      return null;
    }

    if (!isConsistentCm1Nm(energyCm1, wavelengthNm)) {
      context.warnings.push(
        `Skipping suspicious ORCA 5-style UV-Vis row: "${line}"`,
      );
      return null;
    }

    const excitedState = context.excitedStates.byState.get(state) ?? null;

    return {
      state,
      label: `S${state}`,
      transitionLabel: `S${state}`,
      transitionFrom: null,
      transitionTo: null,

      energyCm1,
      wavelengthNm,
      energyEv: cm1ToEv(energyCm1),
      fosc,

      dipole2: parseFloatSafe(parts[4]),
      dipoleX: parseFloatSafe(parts[5]),
      dipoleY: parseFloatSafe(parts[6]),
      dipoleZ: parseFloatSafe(parts[7]),

      assignment: excitedState?.mainAssignment ?? "—",
      excitedState,

      sourceFormat: PARSER.tableFormats.ORCA5,
      rawLine: line,
    };
  }

  function parseOrca6AbsorptionLine(line, context) {
    if (!line.includes("->")) return null;

    const parts = line.split(/\s+/);
    if (parts.length < 7) return null;
    if (parts[1] !== "->") return null;

    const transitionFrom = parts[0];
    const transitionTo = parts[2];

    const energyEv = parseFloatSafe(parts[3]);
    const energyCm1 = parseFloatSafe(parts[4]);
    const wavelengthNm = parseFloatSafe(parts[5]);
    const fosc = parseFloatSafe(parts[6]);

    if (
      !Number.isFinite(energyEv) ||
      !Number.isFinite(energyCm1) ||
      !Number.isFinite(wavelengthNm) ||
      !Number.isFinite(fosc)
    ) {
      return null;
    }

    if (!isConsistentCm1Nm(energyCm1, wavelengthNm)) {
      context.warnings.push(
        `Skipping suspicious ORCA 6-style UV-Vis row: "${line}"`,
      );
      return null;
    }

    const state = parseStateNumberFromTransitionTarget(transitionTo);
    const excitedState = Number.isInteger(state)
      ? context.excitedStates.byState.get(state) ?? null
      : null;

    return {
      state,
      label: Number.isInteger(state) ? `S${state}` : transitionTo,
      transitionLabel: `${transitionFrom} → ${transitionTo}`,
      transitionFrom,
      transitionTo,

      energyCm1,
      wavelengthNm,
      energyEv,
      fosc,

      dipole2: parseFloatSafe(parts[7]),
      dipoleX: parseFloatSafe(parts[8]),
      dipoleY: parseFloatSafe(parts[9]),
      dipoleZ: parseFloatSafe(parts[10]),

      assignment: excitedState?.mainAssignment ?? "—",
      excitedState,

      sourceFormat: PARSER.tableFormats.ORCA6,
      rawLine: line,
    };
  }

  function extractAbsorptionBlock(text) {
    const startIndex = text.indexOf(ORCA_UVVIS_SECTION.startMarker);
    if (startIndex === -1) return null;

    const afterStart = text.slice(startIndex);
    const endIndexRelative = afterStart.indexOf(ORCA_UVVIS_SECTION.endMarker);

    if (endIndexRelative === -1) {
      return afterStart;
    }

    return afterStart.slice(0, endIndexRelative);
  }

  function detectOrcaVersion(text) {
    const match = text.match(/Program Version\s+([^\s]+)/i);
    return match ? match[1] : null;
  }

  function parseStateNumberFromTransitionTarget(target) {
    const match = String(target).trim().match(/^(\d+)/);
    return match ? Number.parseInt(match[1], 10) : null;
  }

  function isConsistentCm1Nm(cm1, nm) {
    if (!Number.isFinite(cm1) || !Number.isFinite(nm)) return false;
    if (cm1 <= 0 || nm <= 0) return false;

    const product = cm1 * nm;
    const relativeError =
      Math.abs(product - UNITS.NM_CM1_FACTOR) / UNITS.NM_CM1_FACTOR;

    return relativeError <= PARSER.wavelengthConsistencyTolerance;
  }

  function rangeOf(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return null;
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  function parseFloatSafe(value) {
    if (value == null) return null;

    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  }

  window.OrcaUV.Import = {
    parseOrcaUvVisOutput,
    cm1ToNm,
    cm1ToEv,
    evToCm1,
    nmToCm1,
  };
})();