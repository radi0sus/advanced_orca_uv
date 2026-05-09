// static/js/experimental-csv.js

(function () {
  "use strict";

  window.OrcaUV = window.OrcaUV || {};

  function parseExperimentalCsv(text, fileName = "", options = {}) {
    const warnings = [];

    const lines = normalizeLines(text)
      .filter((line) => line.trim() !== "")
      .filter((line) => !line.trim().startsWith("#"));

    if (lines.length === 0) {
      throw new Error("Experimental CSV file is empty.");
    }

    const delimiterInfo = detectDelimiter(lines);
    const parsedRows = lines
      .map((line) => parseLine(line, delimiterInfo.value))
      .filter((row) => row.length > 0);

    if (parsedRows.length === 0) {
      throw new Error("No readable rows found in experimental CSV.");
    }

    const hasHeader = detectHeader(parsedRows, delimiterInfo.value);
    const header = hasHeader ? parsedRows[0] : null;
    const dataRows = hasHeader ? parsedRows.slice(1) : parsedRows;

    if (dataRows.length === 0) {
      throw new Error("Experimental CSV contains a header but no data rows.");
    }

    const columnSelection = selectNumericColumns(dataRows, delimiterInfo.value);

    if (!columnSelection) {
      throw new Error("Could not find two numeric columns in experimental CSV.");
    }

    const { xIndex, yIndex } = columnSelection;

    const xNm = [];
    const yRaw = [];

    for (const row of dataRows) {
      const x = parseNumericValue(row[xIndex], delimiterInfo.value);
      const y = parseNumericValue(row[yIndex], delimiterInfo.value);

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }

      if (x <= 0) {
        warnings.push(`Ignored non-positive x value: ${x}`);
        continue;
      }

      xNm.push(x);
      yRaw.push(y);
    }

    if (xNm.length < 2) {
      throw new Error("Experimental CSV contains fewer than two valid data points.");
    }

    const sorted = sortPairsByX(xNm, yRaw);

    return {
      metadata: {
        fileName,
        delimiter: delimiterInfo.label,
        hasHeader,
        xColumn: getColumnLabel(header, xIndex),
        yColumn: getColumnLabel(header, yIndex),
        xUnit: "nm",
        yType: options.yType ?? "absorbance",
        pointCount: sorted.x.length,
        warnings,
      },
      data: {
        /*
          Current assumption:
          experimental x-axis values are wavelength values in nm.
        */
        xNm: sorted.x,
        yRaw: sorted.y,

        /*
          Kept for compatibility with older placeholder shape.
        */
        x: sorted.x,
        y: sorted.y,
        normalizedY: [],
      },
    };
  }

  function normalizeLines(text) {
    return String(text ?? "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n");
  }

  function detectDelimiter(lines) {
    const candidates = [
      { label: "tab", value: "\t" },
      { label: "semicolon", value: ";" },
      { label: "comma", value: "," },
      { label: "whitespace", value: "whitespace" },
    ];

    const sample = lines.slice(0, 25);

    let best = candidates[0];
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      let score = 0;
      let multiColumnRows = 0;
      let numericCells = 0;

      for (const line of sample) {
        const row = parseLine(line, candidate.value);

        if (row.length > 1) {
          multiColumnRows += 1;
          score += row.length;
        }

        for (const cell of row) {
          if (Number.isFinite(parseNumericValue(cell, candidate.value))) {
            numericCells += 1;
          }
        }
      }

      score += multiColumnRows * 10;
      score += numericCells * 2;

      /*
        Penalize comma slightly because decimal comma data without a real CSV
        delimiter can otherwise look artificially split.
      */
      if (candidate.value === ",") {
        score -= 1;
      }

      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return best;
  }

  function parseLine(line, delimiter) {
    const trimmed = String(line ?? "").trim();

    if (trimmed === "") {
      return [];
    }

    if (delimiter === "whitespace") {
      return trimmed.split(/\s+/);
    }

    return splitDelimitedLine(trimmed, delimiter);
  }

  function splitDelimitedLine(line, delimiter) {
    const cells = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];

      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = "";
        continue;
      }

      current += char;
    }

    cells.push(current.trim());

    return cells;
  }

  function detectHeader(rows, delimiter) {
    if (rows.length < 2) {
      return false;
    }

    const first = rows[0];
    const second = rows[1];

    const firstNumericCount = first.filter((cell) =>
      Number.isFinite(parseNumericValue(cell, delimiter)),
    ).length;

    const secondNumericCount = second.filter((cell) =>
      Number.isFinite(parseNumericValue(cell, delimiter)),
    ).length;

    if (firstNumericCount < 2 && secondNumericCount >= 2) {
      return true;
    }

    const headerWords = [
      "wavelength",
      "lambda",
      "nm",
      "energy",
      "abs",
      "absorbance",
      "transmittance",
      "intensity",
      "signal",
    ];

    const firstText = first.join(" ").toLowerCase();

    return (
      secondNumericCount >= 2 &&
      headerWords.some((word) => firstText.includes(word))
    );
  }

  function selectNumericColumns(rows, delimiter) {
    const maxColumns = rows.reduce(
      (max, row) => Math.max(max, row.length),
      0,
    );

    if (maxColumns < 2) {
      return null;
    }

    const stats = [];

    for (let column = 0; column < maxColumns; column += 1) {
      let numericCount = 0;

      for (const row of rows) {
        const value = parseNumericValue(row[column], delimiter);

        if (Number.isFinite(value)) {
          numericCount += 1;
        }
      }

      stats.push({
        column,
        numericCount,
      });
    }

    const minimumCount = Math.max(2, Math.ceil(rows.length * 0.5));

    const eligible = stats
      .filter((entry) => entry.numericCount >= minimumCount)
      .sort((a, b) => a.column - b.column);

    if (eligible.length >= 2) {
      return {
        xIndex: eligible[0].column,
        yIndex: eligible[1].column,
      };
    }

    const strongest = stats
      .filter((entry) => entry.numericCount > 0)
      .sort((a, b) => {
        if (b.numericCount !== a.numericCount) {
          return b.numericCount - a.numericCount;
        }

        return a.column - b.column;
      });

    if (strongest.length < 2) {
      return null;
    }

    return {
      xIndex: strongest[0].column,
      yIndex: strongest[1].column,
    };
  }

  function parseNumericValue(value, delimiter) {
    if (value == null) {
      return NaN;
    }

    let text = String(value)
      .trim()
      .replace(/^"+|"+$/g, "")
      .replace(/\u00A0/g, " ")
      .trim();

    if (text === "") {
      return NaN;
    }

    /*
      Remove common unit fragments if users export columns like "450 nm".
    */
    text = text
      .replace(/cm\s*\^-?\s*1/gi, "")
      .replace(/cm\s*[-⁻]?\s*1/gi, "")
      .replace(/nm/gi, "")
      .replace(/ev/gi, "")
      .replace(/%/g, "")
      .trim();

    /*
      Decimal comma support.

      For semicolon, tab and whitespace separated files, comma can safely be
      treated as decimal separator if no decimal dot is present.
    */
    if (delimiter !== "," && text.includes(",") && !text.includes(".")) {
      text = text.replace(",", ".");
    } else if (delimiter !== "," && text.includes(",") && text.includes(".")) {
      /*
        Heuristic for European thousands/decimal style:
        1.234,56 -> 1234.56
      */
      const lastComma = text.lastIndexOf(",");
      const lastDot = text.lastIndexOf(".");

      if (lastComma > lastDot) {
        text = text.replace(/\./g, "").replace(",", ".");
      } else {
        text = text.replace(/,/g, "");
      }
    } else if (delimiter === "," && text.includes(",") && text.includes(".")) {
      /*
        For comma CSV, assume comma is a thousands separator if both are present:
        1,234.56 -> 1234.56
      */
      text = text.replace(/,/g, "");
    }

    const number = Number(text);

    return Number.isFinite(number) ? number : NaN;
  }

  function sortPairsByX(x, y) {
    const pairs = x
      .map((xValue, index) => ({
        x: xValue,
        y: y[index],
      }))
      .filter((pair) =>
        Number.isFinite(pair.x) &&
        Number.isFinite(pair.y),
      )
      .sort((a, b) => a.x - b.x);

    return {
      x: pairs.map((pair) => pair.x),
      y: pairs.map((pair) => pair.y),
    };
  }

  function getColumnLabel(header, index) {
    if (Array.isArray(header) && header[index] != null && header[index] !== "") {
      return header[index];
    }

    return `column ${index + 1}`;
  }

  window.OrcaUV.ExperimentalCsv = {
    parseExperimentalCsv,
  };
})();