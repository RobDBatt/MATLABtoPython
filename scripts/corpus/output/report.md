# Corpus Analysis Report

Total files analyzed: **1062**
- **Clean** (py_compile passes, zero flags): **708** (66.7%)
- PASS with flags (needs human review): 300 (28.2%)
- py_compile fail: 54 (5.1%)
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

### 1. SyntaxError: invalid syntax  —  41 files

- `autofft\+validation\testCosWindows.m`
- `autofft\+validation\testKaiserWindow.m`
- `DeepLearnToolbox\util\makeLMfilters.m`  `== 1, g=-g*(x/variance)`
- `export_fig\fix_lines.m`
- `export_fig\print2eps.m`
- ...and 36 more

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

### 5. C:\Sites-Vercel\Matlab\matlabtopython\scripts\corpus\output\_check_6pv0jnf4b28.py:39: SyntaxWarning: "\P" is an invalid  —  1 files

- `lightspeed\mexcompiler.m`

### 6. SyntaxError: cannot assign to expression here. Maybe you meant '==' instead of '='?  —  1 files

- `numerical-analysis-toolbox\linear\iterative\krylov\GMRES.m`  `vi+1 = w / h[i+1, i - 1]`

### 7. Sorry: IndentationError: unexpected indent (_check_1boxu3nlz25.py, line N)  —  1 files

- `spatialmath-matlab\arrow3.m`

### 8. SyntaxError: can't use starred expression here  —  1 files

- `vbmc\misc\setupoptions_vbmc.m`

### 9. SyntaxError: starred assignment target must be in a list or tuple  —  1 files

- `ypea\src\ypea\ypea_version.m`  `*varargout = version`

