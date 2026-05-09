// static/js/excited-states.js

(function () {
  "use strict";

  window.OrcaUV = window.OrcaUV || {};

  const CONSTANTS = window.OrcaUV.Constants || {};

  const ORCA_EXCITED_STATES_SECTION =
    CONSTANTS.ORCA_EXCITED_STATES_SECTION || {
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

  const PARSER =
    CONSTANTS.PARSER || {
      assignmentWeightThreshold: 0.01,
      mainAssignmentWeightThreshold: 0.05,
      maxMainAssignments: 3,
    };

  function parseExcitedStates(text, homoLumo = null) {
    const block = extractExcitedStatesBlock(text);

    if (!block) {
      console.warn("Excited-state section not found.");
      return {
        states: [],
        byState: new Map(),
        metadata: {
          found: false,
          stateCount: 0,
          assignmentCount: 0,
        },
      };
    }

    const lines = block.split(/\r?\n/);
    const states = [];
    let currentState = null;

    for (const line of lines) {
      const stateMatch = line.match(/^\s*STATE\s+(\d+):/i);

      if (stateMatch) {
        const stateNumber = Number.parseInt(stateMatch[1], 10);

        currentState = {
          state: stateNumber,
          label: `S${stateNumber}`,
          energyAu: null,
          energyEv: null,
          energyCm1: null,
          s2: null,
          multiplicity: null,
          assignments: [],
          mainAssignment: "",
          rawHeader: line,
        };

        parseStateHeader(line, currentState);
        states.push(currentState);
        continue;
      }

      if (!currentState) {
        continue;
      }

      const assignment = parseAssignmentLine(line, homoLumo);

      if (assignment) {
        currentState.assignments.push(assignment);
      }
    }

    for (const state of states) {
      state.mainAssignment = summarizeAssignments(state.assignments);
    }

    const byState = new Map(states.map((state) => [state.state, state]));

    const assignmentCount = states.reduce(
      (sum, state) => sum + state.assignments.length,
      0,
    );

    console.info("Excited-state parser result:", {
      found: states.length > 0,
      stateCount: states.length,
      assignmentCount,
    });

    return {
      states,
      byState,
      metadata: {
        found: states.length > 0,
        stateCount: states.length,
        assignmentCount,
      },
    };
  }

  function parseStateHeader(line, stateObject) {
    const energyMatch = line.match(
      /E=\s*([-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?)\s+au\s+([-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?)\s+eV\s+([-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?)\s+cm\*\*-1/i,
    );

    if (energyMatch) {
      stateObject.energyAu = parseFloatSafe(energyMatch[1]);
      stateObject.energyEv = parseFloatSafe(energyMatch[2]);
      stateObject.energyCm1 = parseFloatSafe(energyMatch[3]);
    }

    const s2Match = line.match(/<S\*\*2>\s*=\s*([-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?)/i);

    if (s2Match) {
      stateObject.s2 = parseFloatSafe(s2Match[1]);
    }

    const multMatch = line.match(/\bMult\s+(\d+)/i);

    if (multMatch) {
      stateObject.multiplicity = Number.parseInt(multMatch[1], 10);
    }
  }

  function parseAssignmentLine(line, homoLumo) {
    /*
      Robust recognition inspired by the old Python tool.

      Typical ORCA 5:
        184a -> 185a  :     0.233075 (c=  0.48277885)

      Typical unrestricted ORCA:
        223b -> 226b  :     0.358274 (c=  0.59856008)
    */

    if (!line.includes("->")) {
      return null;
    }

    const transitionMatch = line.match(
      /(\d+\s*[ab]?)\s*->\s*(\d+\s*[ab]?)\s*:\s*([-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?)/i,
    );

    if (!transitionMatch) {
      return null;
    }

    const fromOrbital = normalizeOrbitalLabel(transitionMatch[1]);
    const toOrbital = normalizeOrbitalLabel(transitionMatch[2]);
    const weight = parseFloatSafe(transitionMatch[3]);

    const coefficientMatch = line.match(/c\s*=\s*([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?)/i);
    
    const coefficient = coefficientMatch
      ? parseFloatSafe(coefficientMatch[1])
      : null;

    return {
      from: fromOrbital,
      to: toOrbital,
      transition: `${fromOrbital} → ${toOrbital}`,
      fromLabel: orbitalToHomoLumoLabel(fromOrbital, homoLumo),
      toLabel: orbitalToHomoLumoLabel(toOrbital, homoLumo),
      assignment: buildAssignmentLabel(fromOrbital, toOrbital, homoLumo),
      weight,
      coefficient,
      rawLine: line,
    };
  }

  function detectHomoLumo(text) {
    /*
      Preferred source:

      Restricted / one-operator example:
        Operator 0:  Orbitals  50...184  to 185...1695

      Unrestricted example:
        Operator 0:  Orbitals  73...227  to 228...2144  => alpha
        Operator 1:  Orbitals  73...223  to 224...2144  => beta
    */

    const orbitalRangeRegex =
      /Operator\s+(\d+):\s+Orbitals\s+(-?\d+)\s*\.\.\.\s*(-?\d+)\s+to\s+(-?\d+)\s*\.\.\.\s*(-?\d+)/gi;

    const ranges = [];
    let match;

    while ((match = orbitalRangeRegex.exec(text)) !== null) {
      const operator = Number.parseInt(match[1], 10);
      const occupiedStart = Number.parseInt(match[2], 10);
      const occupiedEnd = Number.parseInt(match[3], 10);
      const virtualStart = Number.parseInt(match[4], 10);
      const virtualEnd = Number.parseInt(match[5], 10);

      if (
        Number.isInteger(operator) &&
        Number.isInteger(occupiedStart) &&
        Number.isInteger(occupiedEnd) &&
        Number.isInteger(virtualStart) &&
        Number.isInteger(virtualEnd) &&
        occupiedEnd >= 0 &&
        virtualStart >= 0 &&
        virtualEnd >= virtualStart
      ) {
        ranges.push({
          operator,
          occupiedStart,
          occupiedEnd,
          virtualStart,
          virtualEnd,
          homo: occupiedEnd,
          lumo: virtualStart,
        });
      }
    }

    if (ranges.length > 0) {
      const alphaRange =
        ranges.find((range) => range.operator === 0) ||
        ranges[0];

      const betaRange =
        ranges.find((range) => range.operator === 1) ||
        null;

      return buildHomoLumoResult({
        alpha: rangeToSpinReference(alphaRange, "alpha"),
        beta: betaRange
          ? rangeToSpinReference(betaRange, "beta")
          : rangeToSpinReference(alphaRange, "beta"),
        source: "CIS orbital range",
        operatorRanges: ranges,
      });
    }

    /*
      Fallback from electron counts.

      ORCA orbital numbering starts at 0. Therefore:
        N(alpha) = 228 electrons => HOMO(alpha) = 227, LUMO(alpha) = 228
        N(beta)  = 224 electrons => HOMO(beta)  = 223, LUMO(beta)  = 224
    */

    const electronCountAlpha = findElectronCount(text, "Alpha");
    const electronCountBeta = findElectronCount(text, "Beta");

    if (Number.isFinite(electronCountAlpha) || Number.isFinite(electronCountBeta)) {
      const alpha = Number.isFinite(electronCountAlpha)
        ? electronCountToReference(electronCountAlpha, "alpha")
        : null;

      const beta = Number.isFinite(electronCountBeta)
        ? electronCountToReference(electronCountBeta, "beta")
        : alpha
          ? { ...alpha, spin: "beta" }
          : null;

      if (alpha || beta) {
        return buildHomoLumoResult({
          alpha: alpha || beta,
          beta: beta || alpha,
          source: "electron count",
          operatorRanges: [],
        });
      }
    }

    /*
      Fallback:
        HOMO(alpha) = 184
        HOMO(beta)  = 184

      This is less common in current ORCA outputs, but useful for compatibility.
    */

    const homoAlphaMatch = text.match(/HOMO\s*(?:$\s*alpha\s*$|alpha)\s*=\s*(\d+)/i);
    const homoBetaMatch = text.match(/HOMO\s*(?:$\s*beta\s*$|beta)\s*=\s*(\d+)/i);

    if (homoAlphaMatch || homoBetaMatch) {
      const alphaHomo = homoAlphaMatch
        ? Number.parseInt(homoAlphaMatch[1], 10)
        : null;

      const betaHomo = homoBetaMatch
        ? Number.parseInt(homoBetaMatch[1], 10)
        : alphaHomo;

      const alpha = Number.isInteger(alphaHomo)
        ? homoToReference(alphaHomo, "alpha")
        : null;

      const beta = Number.isInteger(betaHomo)
        ? homoToReference(betaHomo, "beta")
        : alpha
          ? { ...alpha, spin: "beta" }
          : null;

      if (alpha || beta) {
        return buildHomoLumoResult({
          alpha: alpha || beta,
          beta: beta || alpha,
          source: "HOMO line",
          operatorRanges: [],
        });
      }
    }

    return null;
  }

  function buildHomoLumoResult({ alpha, beta, source, operatorRanges }) {
    const hasAlpha = Boolean(alpha);
    const hasBeta = Boolean(beta);

    const alphaRef = alpha || beta || null;
    const betaRef = beta || alpha || null;

    const restricted =
      hasAlpha &&
      hasBeta &&
      alphaRef.homo === betaRef.homo &&
      alphaRef.lumo === betaRef.lumo;

    const common = restricted
      ? {
          homo: alphaRef.homo,
          lumo: alphaRef.lumo,
          occupiedStart: alphaRef.occupiedStart,
          occupiedEnd: alphaRef.occupiedEnd,
          virtualStart: alphaRef.virtualStart,
          virtualEnd: alphaRef.virtualEnd,
        }
      : null;

    return {
      /*
        Legacy fields.
        Kept so existing UI code does not break.
        For unrestricted calculations these refer to alpha.
      */
      homo: alphaRef?.homo ?? null,
      lumo: alphaRef?.lumo ?? null,
      occupiedStart: alphaRef?.occupiedStart ?? null,
      occupiedEnd: alphaRef?.occupiedEnd ?? null,
      virtualStart: alphaRef?.virtualStart ?? null,
      virtualEnd: alphaRef?.virtualEnd ?? null,

      alpha: alphaRef,
      beta: betaRef,
      common,

      restricted,
      spinResolved: !restricted,
      source,
      operatorRanges: Array.isArray(operatorRanges) ? operatorRanges : [],
    };
  }

  function rangeToSpinReference(range, spin) {
    if (!range) {
      return null;
    }

    return {
      spin,
      homo: range.homo,
      lumo: range.lumo,
      occupiedStart: range.occupiedStart,
      occupiedEnd: range.occupiedEnd,
      virtualStart: range.virtualStart,
      virtualEnd: range.virtualEnd,
      operator: range.operator,
    };
  }

  function electronCountToReference(count, spin) {
    const rounded = Math.round(count);

    if (!Number.isFinite(rounded) || rounded <= 0) {
      return null;
    }

    const homo = rounded - 1;

    return homoToReference(homo, spin);
  }

  function homoToReference(homo, spin) {
    if (!Number.isInteger(homo) || homo < 0) {
      return null;
    }

    return {
      spin,
      homo,
      lumo: homo + 1,
      occupiedStart: null,
      occupiedEnd: homo,
      virtualStart: homo + 1,
      virtualEnd: null,
      operator: null,
    };
  }

  function findElectronCount(text, spinLabel) {
    const wanted = String(spinLabel || "").toLowerCase();
    const lines = String(text || "").split(/\r?\n/);

    for (const line of lines) {
      const match = line.match(
        /^\s*N\s*$\s*([A-Za-z]+)\s*$\s*:\s*([-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?)/,
      );

      if (!match) {
        continue;
      }

      const foundSpin = match[1].toLowerCase();

      if (foundSpin !== wanted) {
        continue;
      }

      return parseFloatSafe(match[2]);
    }

    return null;
  }

  function orbitalToHomoLumoLabel(orbital, homoLumo) {
    if (!homoLumo || orbital == null) {
      return orbital;
    }

    const parsed = parseOrbitalLabel(orbital);

    if (!parsed) {
      return orbital;
    }

    const index = parsed.index;
    const spin = parsed.spin;

    const reference = getReferenceForSpin(homoLumo, spin);

    if (!reference) {
      return orbital;
    }

    const homo = reference.homo;
    const lumo = reference.lumo;

    let label;

    if (Number.isInteger(homo) && index <= homo) {
      const delta = homo - index;
      label = delta === 0 ? "HOMO" : `HOMO-${delta}`;
    } else if (Number.isInteger(lumo) && index >= lumo) {
      const delta = index - lumo;
      label = delta === 0 ? "LUMO" : `LUMO+${delta}`;
    } else {
      label = String(index);
    }

    /*
      If the original ORCA assignment contains explicit spin labels a/b,
      preserve that information in the displayed HOMO/LUMO notation.
    */
    return spin ? `${label}${spinToGreek(spin)}` : label;
  }

  function getReferenceForSpin(homoLumo, spin) {
    if (!homoLumo) {
      return null;
    }

    if (spin === "a" && homoLumo.alpha) {
      return homoLumo.alpha;
    }

    if (spin === "b" && homoLumo.beta) {
      return homoLumo.beta;
    }

    if (homoLumo.common) {
      return homoLumo.common;
    }

    /*
      Legacy fallback.
    */
    if (
      Number.isInteger(homoLumo.homo) &&
      Number.isInteger(homoLumo.lumo)
    ) {
      return {
        homo: homoLumo.homo,
        lumo: homoLumo.lumo,
      };
    }

    return homoLumo.alpha || homoLumo.beta || null;
  }

  function buildAssignmentLabel(fromOrbital, toOrbital, homoLumo) {
    const fromLabel = orbitalToHomoLumoLabel(fromOrbital, homoLumo);
    const toLabel = orbitalToHomoLumoLabel(toOrbital, homoLumo);

    return `${fromLabel} → ${toLabel}`;
  }

  function summarizeAssignments(assignments) {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return "—";
    }

    const filtered = assignments
      .filter((assignment) => Number.isFinite(assignment.weight))
      .filter((assignment) => assignment.weight >= PARSER.mainAssignmentWeightThreshold)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, PARSER.maxMainAssignments);

    if (filtered.length === 0) {
      const strongest = assignments
        .filter((assignment) => Number.isFinite(assignment.weight))
        .sort((a, b) => b.weight - a.weight)[0];

      if (!strongest) {
        return "—";
      }

      return `${strongest.assignment} (${formatPercent(strongest.weight)})`;
    }

    return filtered
      .map((assignment) => `${assignment.assignment} (${formatPercent(assignment.weight)})`)
      .join(", ");
  }

  function extractExcitedStatesBlock(text) {
    /*
      Close to the old Python tool:

      start:
      TD-DFT/TDA EXCITED STATES

      end:
      TD-DFT/TDA-EXCITATION SPECTRA

      ORCA 6:
      TD-DFT/TDA EXCITED STATES (SINGLETS)
      still contains the same start marker.
    */

    const lines = text.split(/\r?\n/);

    let startIndex = -1;
    let endIndex = lines.length;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      const foundStart = ORCA_EXCITED_STATES_SECTION.startMarkers.some(
        (marker) => line.includes(marker),
      );

      if (foundStart) {
        startIndex = index;
        break;
      }
    }

    if (startIndex === -1) {
      console.warn("No TD-DFT/TDA EXCITED STATES start marker found.");
      return null;
    }

    for (let index = startIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];

      const foundEnd = ORCA_EXCITED_STATES_SECTION.endMarkers.some(
        (marker) => line.includes(marker),
      );

      const foundNtoStart = line.includes("NATURAL TRANSITION ORBITALS");

      if (foundEnd || foundNtoStart) {
        endIndex = index;
        break;
      }
    }

    const block = lines.slice(startIndex, endIndex).join("\n");

    console.info("Excited-state block extracted:", {
      startIndex,
      endIndex,
      lineCount: endIndex - startIndex,
    });

    return block;
  }

  function parseOrbitalLabel(label) {
    const match = String(label).trim().match(/^(\d+)([ab])?$/i);

    if (!match) {
      return null;
    }

    return {
      index: Number.parseInt(match[1], 10),
      spin: match[2] ? match[2].toLowerCase() : "",
    };
  }

  function normalizeOrbitalLabel(label) {
    return String(label || "").replace(/\s+/g, "").trim();
  }

  function parseFloatSafe(value) {
    if (value == null) {
      return null;
    }

    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) {
      return "—";
    }

    return `${(value * 100).toFixed(1)}%`;
  }

  function spinToGreek(spin) {
    switch (spin) {
      case "a":
        return "α";
      case "b":
        return "β";
      default:
        return "";
    }
  }

  window.OrcaUV.ExcitedStates = {
    parseExcitedStates,
    detectHomoLumo,
    orbitalToHomoLumoLabel,
    buildAssignmentLabel,
    summarizeAssignments,
  };
})();