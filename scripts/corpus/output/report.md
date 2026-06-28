# Corpus Analysis Report

Total files analyzed: **923**
- **Clean** (py_compile passes, zero flags): **568** (61.5%)
- PASS with flags (needs human review): 273 (29.6%)
- py_compile fail: 82 (8.9%)
- converter threw: 0 (0.0%)

## Top flagged files (highest review effort)

- 44 flags — `lightspeed\install_lightspeed.m`
- 25 flags — `vbmc\shared\warpvars_vbmc.m`
- 20 flags — `ypea\src\ypea\ypea_ba.m`
- 17 flags — `ypea\src\ypea\ypea_ica.m`
- 15 flags — `spatialmath-matlab\SE2.m`
- 14 flags — `spatialmath-matlab\SE3.m`
- 14 flags — `vbmc\gplite\private\fminfill.m`
- 14 flags — `vbmc\utils\fminfill.m`
- 14 flags — `ypea\src\ypea\ypea_de.m`
- 13 flags — `spatialmath-matlab\SO3.m`

## Failure patterns (grouped by error signature)

### 1. SyntaxError: invalid syntax  —  52 files

- `autofft\+validation\testCosWindows.m`
- `autofft\+validation\testKaiserWindow.m`
- `DeepLearnToolbox\util\makeLMfilters.m`  `== 1, g=-g*(x/variance)`
- `export_fig\append_pdfs.m`
- `export_fig\pdf2eps.m`
- ...and 47 more

### 2. SyntaxError: invalid syntax. Perhaps you forgot a comma?  —  14 files

- `autofft\autofft.m`
- `export_fig\eps2pdf.m`
- `export_fig\fix_lines.m`
- `export_fig\ghostscript.m`
- `export_fig\print2eps.m`
- ...and 9 more

### 3. SyntaxError: starred assignment target must be in a list or tuple  —  2 files

- `probabilistic_matlab\generic_toolbox\process_final_samples.m`  `*rw_cell = deal(samples_array.flatten(order="F").relative_particle_weights)`
- `ypea\src\ypea\ypea_version.m`  `*varargout = version`

### 4. SyntaxError: positional argument follows keyword argument  —  2 files

- `spatialmath-matlab\plot_point.m`
- `vbmc\vbmc_plot.m`

### 5. SyntaxError: expected ':'  —  1 files

- `export_fig\export_fig.m`

### 6. SyntaxError: invalid syntax. Is this intended to be part of the string?  —  1 files

- `export_fig\hyperlink.m`

### 7. Sorry: IndentationError: expected an indented block after 'except' statement on line N (_check_7w0gzpf3mnu.py, line N  —  1 files

- `export_fig\xkcdify.m`

### 8. SyntaxError: cannot use starred expression here  —  1 files

- `matlab2tikz\src\m2tInputParser.m`

### 9. Sorry: IndentationError: unexpected indent (_check_skggppe4ueg.py, line N)  —  1 files

- `spatialmath-matlab\arrow3.m`

### 10. Sorry: IndentationError: unexpected indent (_check_zciyvvmp8m.py, line N)  —  1 files

- `vbmc\gplite\private\slicesamplebnd.m`

### 11. SyntaxError: can't use starred expression here  —  1 files

- `vbmc\misc\setupoptions_vbmc.m`

### 12. Sorry: IndentationError: unindent does not match any outer indentation level (_check_vbovrk6xoe.py, line N)  —  1 files

- `vbmc\utils\evalbool.m`

### 13. SyntaxError: closing parenthesis ')' does not match opening parenthesis '['  —  1 files

- `vbmc\utils\ibslike.m`

### 14. Sorry: IndentationError: unexpected indent (_check_8vrjz880su8.py, line N)  —  1 files

- `vbmc\utils\slicesamplebnd.m`

### 15. Sorry: IndentationError: unexpected indent (_check_oudvcx8x2ij.py, line N)  —  1 files

- `vbmc\utils\slicesample_vbmc.m`

### 16. SyntaxError: cannot assign to expression here. Maybe you meant '==' instead of '='?  —  1 files

- `vbmc\vbmc_examples.m`

