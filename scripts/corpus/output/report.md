# Corpus Analysis Report

Total files analyzed: **923**
- **Clean** (py_compile passes, zero flags): **581** (62.9%)
- PASS with flags (needs human review): 276 (29.9%)
- py_compile fail: 66 (7.2%)
- converter threw: 0 (0.0%)

## Top flagged files (highest review effort)

- 50 flags — `lightspeed\install_lightspeed.m`
- 40 flags — `vbmc\vbmc_examples.m`
- 25 flags — `spatialmath-matlab\SE2.m`
- 25 flags — `vbmc\shared\warpvars_vbmc.m`
- 24 flags — `spatialmath-matlab\SO3.m`
- 24 flags — `spatialmath-matlab\UnitQuaternion.m`
- 22 flags — `lightspeed\graphics\move_obj.m`
- 22 flags — `spatialmath-matlab\SE3.m`
- 20 flags — `spatialmath-matlab\unit_test\SpatialTest.m`
- 20 flags — `ypea\src\ypea\ypea_ba.m`

## Failure patterns (grouped by error signature)

### 1. SyntaxError: invalid syntax  —  46 files

- `autofft\+validation\testCosWindows.m`
- `autofft\+validation\testKaiserWindow.m`
- `DeepLearnToolbox\util\makeLMfilters.m`  `== 1, g=-g*(x/variance)`
- `export_fig\append_pdfs.m`
- `export_fig\fix_lines.m`
- ...and 41 more

### 2. SyntaxError: invalid syntax. Perhaps you forgot a comma?  —  4 files

- `autofft\autofft.m`
- `rcnn\utils\receptive_field_sizes.m`
- `spatialmath-matlab\Apps\tripleangle.m`
- `vbmc\utils\cornerplot.m`

### 3. SyntaxError: invalid syntax. Is this intended to be part of the string?  —  2 files

- `export_fig\ghostscript.m`
- `export_fig\hyperlink.m`

### 4. SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='?  —  2 files

- `vbmc\gplite\gplite_fmin.m`
- `vbmc\misc\vpoptimize_vbmc.m`

### 5. SyntaxError: expected ':'  —  1 files

- `export_fig\export_fig.m`

### 6. Sorry: IndentationError: expected an indented block after 'except' statement on line N (_check_b9fovyhcja.py, line N  —  1 files

- `export_fig\xkcdify.m`

### 7. C:\Sites-Vercel\Matlab\matlabtopython\scripts\corpus\output\_check_k90oi719v1j.py:39: SyntaxWarning: "\P" is an invalid  —  1 files

- `lightspeed\mexcompiler.m`

### 8. SyntaxError: cannot use starred expression here  —  1 files

- `matlab2tikz\src\m2tInputParser.m`

### 9. SyntaxError: invalid decimal literal  —  1 files

- `PRMLT\chapter10\mixGaussEvidence.m`

### 10. Sorry: IndentationError: unexpected indent (_check_mg8b5cnp6zn.py, line N)  —  1 files

- `spatialmath-matlab\arrow3.m`

### 11. Sorry: IndentationError: unexpected indent (_check_ejwg9zie27j.py, line N)  —  1 files

- `vbmc\gplite\private\slicesamplebnd.m`

### 12. SyntaxError: can't use starred expression here  —  1 files

- `vbmc\misc\setupoptions_vbmc.m`

### 13. Sorry: IndentationError: unindent does not match any outer indentation level (_check_jhv59ycwlp.py, line N)  —  1 files

- `vbmc\utils\evalbool.m`

### 14. Sorry: IndentationError: unexpected indent (_check_h5uyykkl0uo.py, line N)  —  1 files

- `vbmc\utils\slicesamplebnd.m`

### 15. Sorry: IndentationError: unexpected indent (_check_0t2gtdj80pyo.py, line N)  —  1 files

- `vbmc\utils\slicesample_vbmc.m`

### 16. SyntaxError: starred assignment target must be in a list or tuple  —  1 files

- `ypea\src\ypea\ypea_version.m`  `*varargout = version`

