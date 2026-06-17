# Corpus Analysis Report

Total files analyzed: **923**
- **Clean** (py_compile passes, zero flags): **644** (69.8%)
- PASS with flags (needs human review): 153 (16.6%)
- py_compile fail: 126 (13.7%)
- converter threw: 0 (0.0%)

## Top flagged files (highest review effort)

- 44 flags — `lightspeed\install_lightspeed.m`
- 25 flags — `vbmc\shared\warpvars_vbmc.m`
- 13 flags — `vbmc\gplite\private\fminfill.m`
- 13 flags — `vbmc\utils\fminfill.m`
- 11 flags — `probabilistic_matlab\@stack_object\empirical_moments_convergence.m`
- 9 flags — `probabilistic_matlab\@stack_object\empirical_moments.m`
- 9 flags — `vbmc\private\activesample_vbmc.m`
- 8 flags — `spatialmath-matlab\Apps\tripleangle.m`
- 8 flags — `spatialmath-matlab\SO2.m`
- 8 flags — `vbmc\misc\funlogger_vbmc.m`

## Failure patterns (grouped by error signature)

### 1. SyntaxError: invalid syntax  —  84 files

- `autofft\+validation\testCosWindows.m`
- `autofft\+validation\testKaiserWindow.m`
- `DeepLearnToolbox\util\makeLMfilters.m`
- `export_fig\append_pdfs.m`
- `export_fig\pdf2eps.m`
- ...and 79 more

### 2. SyntaxError: invalid syntax. Perhaps you forgot a comma?  —  19 files

- `autofft\autofft.m`
- `DeepLearnToolbox\util\expand.m`
- `export_fig\eps2pdf.m`
- `export_fig\fix_lines.m`
- `export_fig\ghostscript.m`
- ...and 14 more

### 3. SyntaxError: unmatched ')'  —  4 files

- `DeepLearnToolbox\util\visualize.m`
- `lightspeed\graphics\axis_pct.m`
- `spatialmath-matlab\oa2r.m`
- `spatialmath-matlab\SO3.m`

### 4. SyntaxError: '[' was never closed  —  2 files

- `probabilistic_matlab\example_models\gaussian_model.m`
- `vbmc\utils\cmaes_modded.m`

### 5. SyntaxError: positional argument follows keyword argument  —  2 files

- `spatialmath-matlab\plot_point.m`
- `vbmc\vbmc_plot.m`

### 6. SyntaxError: invalid decimal literal  —  1 files

- `DeepLearnToolbox\SAE\saesetup.m`

### 7. SyntaxError: expression cannot contain assignment, perhaps you meant "=="?  —  1 files

- `export_fig\export_fig.m`

### 8. SyntaxError: invalid syntax. Is this intended to be part of the string?  —  1 files

- `export_fig\hyperlink.m`

### 9. Sorry: IndentationError: expected an indented block after 'except' statement on line N (_check_r2v4nzhkc6e.py, line N  —  1 files

- `export_fig\xkcdify.m`

### 10. SyntaxError: cannot use starred expression here  —  1 files

- `matlab2tikz\src\m2tInputParser.m`

### 11. SyntaxError: '(' was never closed  —  1 files

- `rcnn\utils\receptive_field_sizes.m`

### 12. Sorry: IndentationError: unexpected indent (_check_88kfht52u4v.py, line N)  —  1 files

- `spatialmath-matlab\arrow3.m`

### 13. Sorry: IndentationError: unexpected indent (_check_nlxdnvowtsl.py, line N)  —  1 files

- `vbmc\gplite\private\slicesamplebnd.m`

### 14. SyntaxError: '{' was never closed  —  1 files

- `vbmc\misc\setupoptions_vbmc.m`

### 15. Sorry: IndentationError: unindent does not match any outer indentation level (_check_ayoj4gmrm5e.py, line N)  —  1 files

- `vbmc\utils\evalbool.m`

### 16. SyntaxError: closing parenthesis ')' does not match opening parenthesis '['  —  1 files

- `vbmc\utils\ibslike.m`

### 17. Sorry: IndentationError: unexpected indent (_check_qij7yb87k4.py, line N)  —  1 files

- `vbmc\utils\slicesamplebnd.m`

### 18. Sorry: IndentationError: unexpected indent (_check_df06aftee1j.py, line N)  —  1 files

- `vbmc\utils\slicesample_vbmc.m`

### 19. SyntaxError: cannot assign to expression here. Maybe you meant '==' instead of '='?  —  1 files

- `vbmc\vbmc_examples.m`

### 20. SyntaxError: starred assignment target must be in a list or tuple  —  1 files

- `ypea\src\ypea\ypea_version.m`  `*varargout = version`

