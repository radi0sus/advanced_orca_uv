> [!TIP]
> **Advanced ORCA UV-Vis Viewer** is available as a static web app with interactive Plotly spectra, local ORCA output parsing, TD-DFT/TDA excited-state assignments, HOMO/LUMO mapping, experimental CSV overlay, peak labels, and PNG/CSV/Markdown export.  
> 👉 Try it here: https://radi0sus.github.io/advanced_orca_uv/  
> 👉 Original CLI tool: https://github.com/radi0sus/orca_uv


https://github.com/user-attachments/assets/aac4a7ae-c32c-48f1-9c4c-e16127fe051d

# Advanced ORCA UV-Vis Viewer

A browser-based successor to the original [`orca_uv`](https://github.com/radi0sus/orca_uv) Python CLI tool for plotting calculated UV-Vis absorption spectra from [ORCA](https://orcaforum.kofo.mpg.de) output files.

This version keeps the main idea of the CLI tool:

- read an ORCA output file,
- extract the UV-Vis absorption spectrum,
- combine oscillator-strength sticks with a Gaussian-broadened spectrum,
- detect and label peaks,
- export the resulting spectrum.

The web app extends this workflow with interactive visualization, TD-DFT/TDA excited-state assignment analysis, HOMO/LUMO mapping, experimental overlay support, and browser-based export.

Everything runs **locally in the browser**.

No Python installation is required.  
The ORCA output file is not uploaded to a server.

---

## Main additions compared to the CLI tool

### Browser-based workflow

The viewer runs as a static web app via GitHub Pages.

You can open the page, select an ORCA output file, and generate the UV-Vis spectrum directly in the browser.

The ORCA file is processed locally. It is not uploaded to a server.

---

### Interactive Plotly visualization

The spectrum is rendered with Plotly and can be interactively inspected.

Supported display options include:

- wavelength axis in `nm`,
- energy axis in `eV`,
- energy axis in `cm⁻¹`,
- low-to-high or high-to-low axis direction,
- automatic or manual displayed range,
- grid toggle,
- stick spectrum toggle,
- convoluted Gaussian spectrum,
- filled calculated spectrum,
- individual Gaussian bands,
- filled transparent rainbow Gaussian components,
- state labels,
- detected peak labels.

The plot title is derived from the loaded ORCA filename.

---

### Gaussian broadening in the energy domain

The calculated spectrum is broadened on an internal `cm⁻¹` energy grid and converted to the selected display axis.

The broadening follows the historical behavior of the original Python tool.

Live controls are available for:

- Gaussian line width / FWHM-like parameter in `cm⁻¹`,
- normalization of the calculated spectrum,
- scale factor,
- calculated spectrum shift in `cm⁻¹`.

The calculated spectrum shift is a display/alignment transform.  
The raw ORCA transition table remains unchanged.

---

### ORCA 5 and ORCA 6 UV-Vis table support

The parser reads the main absorption spectrum from the electric dipole section:

```text
ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC DIPOLE MOMENTS
```

and stops before:

```text
ABSORPTION SPECTRUM VIA TRANSITION VELOCITY DIPOLE MOMENTS
```

Supported UV-Vis table styles include:

### ORCA 5-style absorption table

```text
State   Energy   Wavelength   fosc   T2   TX   TY   TZ
        (cm-1)   (nm)
```

### ORCA 6-style absorption table

```text
Transition      Energy     Energy  Wavelength fosc(D2)
                 (eV)      (cm-1)    (nm)
0-1A  ->  1-1A   ...
```

ORCA 6 transition labels such as:

```text
0-1A → 1-1A
```

can optionally be shown in the transitions table.

---

### TD-DFT/TDA excited-state assignments

In addition to the UV-Vis absorption table, the app parses the TD-DFT/TDA excited-state assignment section:

```text
TD-DFT/TDA EXCITED STATES
```

or ORCA 6 variants such as:

```text
TD-DFT/TDA EXCITED STATES (SINGLETS)
```

Parsed assignment information includes:

- excited state number,
- excitation energy,
- `<S²>` value where available,
- multiplicity where available,
- orbital transition contributions,
- ORCA orbital numbers,
- contribution weights,
- CI coefficients.

The assignment panel lists the parsed states and their orbital contributions.

---

### HOMO/LUMO mapping

The web app maps ORCA orbital numbers to HOMO/LUMO-style labels.

For example:

```text
54a → 55a
```

can be displayed as:

```text
HOMOα → LUMOα
```

For unrestricted calculations, alpha and beta orbital references are handled separately where possible, e.g.:

```text
HOMOα / LUMOα
HOMOβ / LUMOβ
```

The transitions table can display assignments either as:

```text
HOMO/LUMO
```

or as original:

```text
ORCA orbitals
```

This makes it possible to switch between a chemically interpreted view and the raw ORCA orbital numbering.

---

### Assignment table controls

The web app includes a dedicated table-control section.

Supported controls include:

- assignment display:
  - `HOMO/LUMO`,
  - `ORCA orbitals`,
- assignment selection:
  - `Auto`,
  - `Manual`,
- assignment threshold in `%`,
- optional ORCA transition labels.

The `Auto` assignment mode follows the original summary logic:

- keep relevant assignment contributions above the default main-assignment threshold,
- sort by descending contribution weight,
- show the strongest contributions up to the configured maximum,
- fall back to the strongest assignment if no contribution passes the threshold.

The `Manual` assignment mode uses the user-selected threshold.

The detailed excited-state assignment panel remains available for full inspection of the parsed assignments.

---

### Peak detection

The calculated spectrum can be analyzed for local maxima.

Peak detection uses the displayed scaled spectrum and supports live controls for:

- minimum peak height in `%`,
- minimum peak distance in `cm⁻¹`.

Detected peaks are shown in a table with:

```text
λ / nm, E / eV, E / cm⁻¹, scaled intensity, relative intensity / %
```

Peak labels can also be shown directly in the Plotly spectrum.

---

### Experimental CSV overlay

In addition to ORCA output files, an experimental CSV spectrum can be loaded as an overlay.

Experimental x-values are interpreted as:

```text
wavelength / nm
```

Supported CSV features include:

- optional header,
- no-header numeric files,
- comma-separated data,
- semicolon-separated data,
- tab-separated data,
- whitespace-separated data,
- decimal comma support for common non-comma-separated formats.

The first two numeric columns are used as:

```text
wavelength_nm, y value
```

The experimental spectrum can be shown together with the calculated ORCA spectrum.

Available overlay options include:

- show/hide overlay,
- normalize overlay,
- baseline correction,
- filled line or line-only style.

The experimental overlay is not shifted when the calculated spectrum shift is applied.

---

### Auto-range handling

The web app includes an automatic range mode designed for UV-Vis spectra with weak far-out transitions.

Instead of blindly using the full internal calculation grid, the automatic range focuses on:

- significant calculated spectrum intensity,
- relevant oscillator-strength sticks.

Very weak transitions outside the focused auto-range are still parsed and listed in the information panel.

They are not removed from the data.

---

### Export

The web app supports export of:

- PNG of the current Plotly view,
- CSV of the calculated spectrum,
- Markdown export of the transitions table.

### PNG export

The PNG export uses the current Plotly view.

It includes the visible plot state, such as:

- selected x-axis,
- current displayed range,
- calculated spectrum shift,
- visible plot elements,
- labels,
- experimental overlay if enabled.

### CSV export

The calculated spectrum CSV contains:

```text
x_nm, x_cm-1, x_eV, intensity, intensity_scaled
```

Where:

- `x_nm` is the displayed wavelength axis,
- `x_cm-1` is the displayed energy axis in `cm⁻¹`,
- `x_eV` is the displayed energy axis in `eV`,
- `intensity` is the calculated summed spectrum intensity,
- `intensity_scaled` is the displayed intensity after normalization and scaling.

The calculated spectrum shift is included in the exported x-axis values.

### Markdown transition-table export

The Markdown export contains metadata and a transition table corresponding to the current table display settings.

It includes information such as:

- ORCA filename,
- ORCA version,
- UV-Vis section,
- number of transitions,
- HOMO/LUMO orbital-number mapping,
- assignment display mode,
- assignment selection mode,
- optional ORCA transition-label column.

This export is intended as a browser-based replacement for tabular state summaries previously generated with command-line helper scripts.

---

## Quick start

Open the web app:

```text
https://radi0sus.github.io/advanced_orca_uv/
```

Then:

1. Select an ORCA output file.
2. Inspect the calculated UV-Vis spectrum.
3. Adjust broadening, shift, scaling, axis, or display options if needed.
4. Optionally inspect TD-DFT/TDA assignments and HOMO/LUMO mapping.
5. Optionally load an experimental CSV spectrum.
6. Export the plot as PNG, the calculated spectrum as CSV, or the transition table as Markdown.

---

## Input files

### ORCA output

The app expects an ORCA output file containing a UV-Vis absorption spectrum section.

The main spectrum is read from:

```text
ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC DIPOLE MOMENTS
```

up to:

```text
ABSORPTION SPECTRUM VIA TRANSITION VELOCITY DIPOLE MOMENTS
```

The velocity dipole section is not used for the main spectrum.

Example ORCA 6 absorption section:

```text
----------------------------------------------------------------------------------------------------
                     ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC DIPOLE MOMENTS
----------------------------------------------------------------------------------------------------
     Transition      Energy     Energy  Wavelength fosc(D2)      D2        DX        DY        DZ
                      (eV)      (cm-1)    (nm)                 (au**2)    (au)      (au)      (au)
----------------------------------------------------------------------------------------------------
  0-1A  ->  1-1A    2.425480   19562.8   511.2   0.053572750   0.90155  -0.94775  -0.00944   0.05679
```

Example TD-DFT/TDA excited-state assignment section:

```text
TD-DFT/TDA EXCITED STATES (SINGLETS)

STATE  1:  E=   0.089135 au      2.425 eV    19562.8 cm**-1 <S**2> =   0.000000 Mult 1
    50a ->  55a  :     0.041104 (c=  0.20274172)
    54a ->  55a  :     0.940008 (c= -0.96954029)
```

The excited-state assignment section is optional.  
If present, it is used for assignment tables and HOMO/LUMO mapping.

---

### Experimental CSV

Experimental CSV files may contain either a header or no header.

Examples:

```csv
wavelength_nm,absorbance
250,0.12
251,0.14
252,0.15
```

or:

```csv
250 0.12
251 0.14
252 0.15
```

Semicolon, tab, comma, and whitespace-separated files are supported.

The first two numeric columns are used as:

```text
wavelength_nm, y value
```

---

## Relationship to the original CLI tool

The original Python CLI tool is still useful for command-line workflows and scripted processing:

```console
python3 orca-uv.py filename
```

This web app is intended for interactive use and easier sharing via GitHub Pages.

Compared to the original CLI version, the web app adds:

- no Python dependency,
- interactive Plotly plots,
- local browser-based file processing,
- ORCA 5 and ORCA 6 absorption-table support,
- TD-DFT/TDA excited-state assignment parsing,
- HOMO/LUMO assignment mapping,
- spin-resolved alpha/beta HOMO/LUMO references where available,
- assignment tables with HOMO/LUMO or ORCA-orbital display,
- optional ORCA transition labels,
- experimental CSV overlay,
- live parameter controls,
- peak detection and peak tables,
- modern light/dark interface,
- direct PNG, CSV, and Markdown export from the browser.

---

## Notes

The calculated UV-Vis spectrum is broadened in the `cm⁻¹` energy domain and converted to the selected display axis.

The Gaussian broadening formula follows the historical behavior of the original Python tool for compatibility.

The displayed calculated spectrum shift is intended for visual alignment with experimental data.  
It does not modify the raw ORCA transition energies in the parsed transition table.

Experimental CSV x-values are currently interpreted as wavelength values in `nm`.

NTO parsing and orbital visualization are outside the current scope of this web app.

CD spectra and velocity dipole spectra are not used for the main plotted UV-Vis spectrum.

---

## Original project

This web app is based on the original `orca_uv` Python tool:

```text
https://github.com/radi0sus/orca_uv
```
