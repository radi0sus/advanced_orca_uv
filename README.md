> [!TIP]
> **Advanced ORCA UV-Vis Viewer** is available as a static web app with interactive Plotly spectra, local ORCA output parsing, TD-DFT/TDA excited-state assignments, HOMO/LUMO mapping, experimental CSV overlay, peak labels, molar-extinction estimates for detected peaks, and PNG/CSV/Markdown export.  
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
- estimate molar extinction coefficients for detected peaks,
- export the resulting spectrum.

The web app extends this workflow with interactive visualization, TD-DFT/TDA excited-state assignment analysis, HOMO/LUMO mapping, experimental overlay support, peak detection, peak labels, molar-extinction estimates, and browser-based export.

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

The Gaussian band shape used for the displayed calculated spectrum is

$$
I(\tilde{\nu}) =
f \cdot
\exp\left[
-\ln(2)
\left(
\frac{\tilde{\nu}_0 - \tilde{\nu}}{w}
\right)^2
\right]
$$

where:

- $\tilde{\nu}$ is the wavenumber in `cm⁻¹`,
- $\tilde{\nu}_0$ is the transition energy in `cm⁻¹`,
- $f$ is the oscillator strength,
- $w$ is the app line-width parameter in `cm⁻¹`.

For compatibility with the original tools, the UI refers to this width as an FWHM-like broadening parameter.

With the formula above, the band reaches half height at

$$
|\tilde{\nu} - \tilde{\nu}_0| = w
$$

so the mathematical full width at half maximum of this Gaussian form is

$$
\mathrm{FWHM}_{\mathrm{math}} = 2w
$$

Live controls are available for:

- Gaussian line width / FWHM-like parameter in `cm⁻¹`,
- normalization of the calculated spectrum,
- scale factor,
- calculated spectrum shift in `cm⁻¹`.

The calculated spectrum shift is a display/alignment transform.  
The raw ORCA transition table remains unchanged.

---

### Molar extinction coefficient estimates

Detected peaks include an estimated decadic molar extinction coefficient:

- `ε / M⁻¹ cm⁻¹`

The estimate is derived from the TD-DFT oscillator strengths and the Gaussian line shape used by the app.

The oscillator-strength relation used is

$$
f \approx 4.32 \times 10^{-9}
\int \varepsilon(\tilde{\nu}) \, d\tilde{\nu}
$$

or equivalently

$$
\int \varepsilon(\tilde{\nu}) \, d\tilde{\nu}
\approx
2.315 \times 10^8 \cdot f
$$

with:

- $\varepsilon$ in `L mol⁻¹ cm⁻¹` = `M⁻¹ cm⁻¹`,
- $\tilde{\nu}$ in `cm⁻¹`.

For consistency with the displayed calculated spectrum, the app uses the same historical Gaussian width convention as the plotted spectrum.

The area-normalized Gaussian line shape used for the molar-extinction estimate is

$$
g(\tilde{\nu}) =
\frac{\sqrt{\ln(2) / \pi}}{w}
\exp\left[
-\ln(2)
\left(
\frac{\tilde{\nu}_0 - \tilde{\nu}}{w}
\right)^2
\right]
$$

with

$$
\int_{-\infty}^{\infty}
g(\tilde{\nu}) \, d\tilde{\nu}
= 1
$$

The molar extinction coefficient at a given wavenumber is estimated as

$$
\varepsilon(\tilde{\nu}) =
\sum_i
\left[
2.315 \times 10^8
\cdot f_i
\cdot g_i(\tilde{\nu})
\right]
$$

For a detected peak, $\varepsilon$ is evaluated at the detected peak position using all parsed transitions.

Important notes:

- The ε values are estimates based on the chosen Gaussian broadening.
- Changing the broadening width changes the estimated peak ε values.
- Spectrum normalization and scale factor do not define the physical ε values.
- The displayed spectrum shift is only a visual alignment transform and does not alter the underlying ORCA transition energies used for the ε estimate.
- The calculation uses the app's historical broadening convention for compatibility, not a newly redefined true-FWHM Gaussian convention.

---

### ORCA 5 and ORCA 6 UV-Vis table support

The parser reads the main absorption spectrum from the electric dipole section:

```
ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC DIPOLE MOMENTS
```

and stops before:

```
ABSORPTION SPECTRUM VIA TRANSITION VELOCITY DIPOLE MOMENTS
```

Supported UV-Vis table styles include:

#### ORCA 5-style absorption table

```
State   Energy   Wavelength   fosc   T2   TX   TY   TZ
        (cm-1)   (nm)
```

#### ORCA 6-style absorption table

```
Transition      Energy     Energy  Wavelength fosc(D2)
                 (eV)      (cm-1)    (nm)
0-1A  ->  1-1A   ...
```

ORCA 6 transition labels such as `0-1A → 1-1A` can optionally be shown in the transitions table.

---

### TD-DFT/TDA excited-state assignments

In addition to the UV-Vis absorption table, the app parses the TD-DFT/TDA excited-state assignment section:

```
TD-DFT/TDA EXCITED STATES
```

or ORCA 6 variants such as:

```
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

For example, an ORCA assignment such as

```
54a → 55a
```

can be displayed as:

```
HOMOα → LUMOα
```

For unrestricted calculations, alpha and beta orbital references are handled separately where possible, e.g.:

```
HOMOα / LUMOα
HOMOβ / LUMOβ
```

The transitions table can display assignments either as `HOMO/LUMO` or as original `ORCA orbitals`.

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

- `λ / nm`
- `E / eV`
- `E / cm⁻¹`
- `ε / M⁻¹ cm⁻¹`
- scaled intensity
- relative intensity / `%`

The `ε / M⁻¹ cm⁻¹` column gives the estimated molar extinction coefficient at the detected peak position.

Peak labels can also be shown directly in the Plotly spectrum.

---

### Experimental CSV overlay

In addition to ORCA output files, an experimental CSV spectrum can be loaded as an overlay.

Experimental x-values are interpreted as wavelength values in `nm`.

Supported CSV features include:

- optional header,
- no-header numeric files,
- comma-separated data,
- semicolon-separated data,
- tab-separated data,
- whitespace-separated data,
- decimal comma support for common non-comma-separated formats.

The first two numeric columns are used as:

- `wavelength_nm`
- `y value`

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

#### PNG export

The PNG export uses the current Plotly view.

It includes the visible plot state, such as:

- selected x-axis,
- current displayed range,
- calculated spectrum shift,
- visible plot elements,
- labels,
- experimental overlay if enabled.

#### CSV export

The calculated spectrum CSV contains the following columns:

- `x_nm`
- `x_cm-1`
- `x_eV`
- `intensity`
- `intensity_scaled`

Where:

- `x_nm` is the displayed wavelength axis,
- `x_cm-1` is the displayed energy axis in `cm⁻¹`,
- `x_eV` is the displayed energy axis in `eV`,
- `intensity` is the calculated summed spectrum intensity,
- `intensity_scaled` is the displayed intensity after normalization and scaling.

The calculated spectrum shift is included in the exported x-axis values.

The CSV export contains the sampled calculated spectrum curve.  
It does not currently export the detected peak table.

#### Markdown transition-table export

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

The Markdown transition-table export does not currently include the detected peak table.

This export is intended as a browser-based replacement for tabular state summaries previously generated with command-line helper scripts.

---

## Quick start

Open the web app:

https://radi0sus.github.io/advanced_orca_uv/

Then:

1. Select an ORCA output file.
2. Inspect the calculated UV-Vis spectrum.
3. Adjust broadening, shift, scaling, axis, or display options if needed.
4. Inspect detected peaks and estimated molar extinction coefficients.
5. Optionally inspect TD-DFT/TDA assignments and HOMO/LUMO mapping.
6. Optionally load an experimental CSV spectrum.
7. Export the plot as PNG, the calculated spectrum as CSV, or the transition table as Markdown.

---

## Input files

### ORCA output

The app expects an ORCA output file containing a UV-Vis absorption spectrum section.

The main spectrum is read from:

```
ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC DIPOLE MOMENTS
```

up to:

```
ABSORPTION SPECTRUM VIA TRANSITION VELOCITY DIPOLE MOMENTS
```

The velocity dipole section is not used for the main spectrum.

Example ORCA 6 absorption section:

```
----------------------------------------------------------------------------------------------------
                     ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC DIPOLE MOMENTS
----------------------------------------------------------------------------------------------------
     Transition      Energy     Energy  Wavelength fosc(D2)      D2        DX        DY        DZ
                      (eV)      (cm-1)    (nm)                 (au**2)    (au)      (au)      (au)
----------------------------------------------------------------------------------------------------
  0-1A  ->  1-1A    2.425480   19562.8   511.2   0.053572750   0.90155  -0.94775  -0.00944   0.05679
```

Example TD-DFT/TDA excited-state assignment section:

```
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

```
wavelength_nm,absorbance
250,0.12
251,0.14
252,0.15
```

or:

```
250 0.12
251 0.14
252 0.15
```

Semicolon, tab, comma, and whitespace-separated files are supported.

The first two numeric columns are used as:

- `wavelength_nm`
- `y value`

---

## Relationship to the original CLI tool

The original Python CLI tool is still useful for command-line workflows and scripted processing:

```
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
- estimated molar extinction coefficients for detected peaks,
- modern light/dark interface,
- direct PNG, CSV, and Markdown export from the browser.

---

## Notes

The calculated UV-Vis spectrum is broadened in the `cm⁻¹` energy domain and converted to the selected display axis.

The Gaussian broadening formula follows the historical behavior of the original Python tool for compatibility.

The line-width control is an FWHM-like broadening parameter inherited from the original workflow.  
For the historical Gaussian form used by the app, the curve reaches half height at one line-width parameter away from the center.

Estimated molar extinction coefficients are calculated from oscillator strengths using an area-normalized Gaussian line shape consistent with the displayed broadening convention.

The displayed calculated spectrum shift is intended for visual alignment with experimental data.  
It does not modify the raw ORCA transition energies in the parsed transition table.

Experimental CSV x-values are currently interpreted as wavelength values in `nm`.

NTO parsing and orbital visualization are outside the current scope of this web app.

CD spectra and velocity dipole spectra are not used for the main plotted UV-Vis spectrum.

---

## Original project

This web app is based on the original `orca_uv` Python tool:

https://github.com/radi0sus/orca_uv