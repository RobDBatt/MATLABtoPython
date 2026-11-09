# Corpus Analysis Report

Total files analyzed: **1062**
- **Clean** (py_compile passes, zero flags): **708** (66.7%)
- PASS with flags (needs human review): 301 (28.3%)
- py_compile fail: 53 (5.0%)
- converter threw: 0 (0.0%)

## Top flagged files (highest review effort)

- 50 flags — `lightspeed\install_lightspeed.m`
- 39 flags — `vbmc\vbmc_examples.m`
- 38 flags — `spatialmath-matlab\Apps\tripleangle.m`
- 25 flags — `spatialmath-matlab\SE2.m`
- 25 flags — `vbmc\shared\warpvars_vbmc.m`
- 24 flags — `spatialmath-matlab\SO3.m`
- 24 flags — `spatialmath-matlab\UnitQuaternion.m`
- 22 flags — `lightspeed\graphics\move_obj.m`
- 22 flags — `spatialmath-matlab\SE3.m`
- 20 flags — `spatialmath-matlab\unit_test\SpatialTest.m`

## Failure patterns (grouped by error signature)

### 1. SyntaxError: invalid syntax  —  40 files

- `autofft\+validation\testCosWindows.m`
- `autofft\+validation\testKaiserWindow.m`
- `DeepLearnToolbox\util\makeLMfilters.m`  `== 1, g=-g*(x/variance)`
- `export_fig\fix_lines.m`
- `export_fig\print2eps.m`
- ...and 35 more

### 2. SyntaxError: invalid syntax. Perhaps you forgot a comma?  —  4 files

- `autofft\autofft.m`
- `export_fig\xkcdify.m`
- `rcnn\utils\receptive_field_sizes.m`
- `vbmc\utils\cornerplot.m`

### 3. SyntaxError: invalid syntax. Is this intended to be part of the string?  —  3 files

- `export_fig\append_pdfs.m`
- `export_fig\ghostscript.m`
- `export_fig\hyperlink.m`

### 4. SyntaxError: expected ':'  —  1 files

- `export_fig\export_fig.m`

### 5. <check>.py:39: SyntaxWarning: "\P" is an invalid escape sequence. Such sequences will not work in the future. Did you me  —  1 files

- `lightspeed\mexcompiler.m`

### 6. SyntaxError: cannot assign to expression here. Maybe you meant '==' instead of '='?  —  1 files

- `numerical-analysis-toolbox\linear\iterative\krylov\GMRES.m`  `vi+1 = w / h[i+1, i - 1]`

### 7. Sorry: IndentationError: unexpected indent (<check>.py, line N)  —  1 files

- `spatialmath-matlab\arrow3.m`

### 8. SyntaxError: can't use starred expression here  —  1 files

- `vbmc\misc\setupoptions_vbmc.m`

### 9. SyntaxError: starred assignment target must be in a list or tuple  —  1 files

- `ypea\src\ypea\ypea_version.m`  `*varargout = version`

