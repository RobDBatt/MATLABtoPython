# Corpus Analysis Report

Total files analyzed: **923**
- **Clean** (py_compile passes, zero flags): **525** (56.9%)
- PASS with flags (needs human review): 333 (36.1%)
- py_compile fail: 65 (7.0%)
- converter threw: 0 (0.0%)

## Top flagged files (highest review effort)

- 50 flags — `lightspeed\install_lightspeed.m`
- 26 flags — `spatialmath-matlab\SE2.m`
- 25 flags — `spatialmath-matlab\UnitQuaternion.m`
- 25 flags — `vbmc\shared\warpvars_vbmc.m`
- 24 flags — `spatialmath-matlab\SE3.m`
- 24 flags — `spatialmath-matlab\SO3.m`
- 20 flags — `spatialmath-matlab\unit_test\SpatialTest.m`
- 20 flags — `ypea\src\ypea\ypea_ba.m`
- 18 flags — `spatialmath-matlab\Quaternion.m`
- 18 flags — `spatialmath-matlab\SO2.m`

## Failure patterns (grouped by error signature)

### 1. SyntaxError: invalid syntax  —  45 files

- `autofft\+validation\testCosWindows.m`
- `autofft\+validation\testKaiserWindow.m`
- `DeepLearnToolbox\util\makeLMfilters.m`  `== 1, g=-g*(x/variance)`
- `export_fig\append_pdfs.m`
- `export_fig\fix_lines.m`
- ...and 40 more

### 2. SyntaxError: invalid syntax. Perhaps you forgot a comma?  —  4 files

- `autofft\autofft.m`
- `rcnn\utils\receptive_field_sizes.m`
- `spatialmath-matlab\Apps\tripleangle.m`
- `vbmc\utils\cornerplot.m`

### 3. SyntaxError: invalid syntax. Is this intended to be part of the string?  —  2 files

- `export_fig\ghostscript.m`
- `export_fig\hyperlink.m`

### 4. SyntaxError: starred assignment target must be in a list or tuple  —  2 files

- `probabilistic_matlab\generic_toolbox\process_final_samples.m`  `*rw_cell = samples_array.flatten(order="F").relative_particle_weights`
- `ypea\src\ypea\ypea_version.m`  `*varargout = version`

### 5. SyntaxError: expected ':'  —  1 files

- `export_fig\export_fig.m`

### 6. Sorry: IndentationError: expected an indented block after 'except' statement on line N (_check_yhuagho5izk.py, line N  —  1 files

- `export_fig\xkcdify.m`

### 7. SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='?  —  1 files

- `lightspeed\graphics\move_obj.m`

### 8. C:\Sites-Vercel\Matlab\matlabtopython\scripts\corpus\output\_check_5obbfpr902.py:38: SyntaxWarning: "\P" is an invalid e  —  1 files

- `lightspeed\mexcompiler.m`

### 9. SyntaxError: cannot use starred expression here  —  1 files

- `matlab2tikz\src\m2tInputParser.m`

### 10. Sorry: IndentationError: unexpected indent (_check_him5fupyc98.py, line N)  —  1 files

- `spatialmath-matlab\arrow3.m`

### 11. Sorry: IndentationError: unexpected indent (_check_mluu2ndnqc.py, line N)  —  1 files

- `vbmc\gplite\private\slicesamplebnd.m`

### 12. SyntaxError: can't use starred expression here  —  1 files

- `vbmc\misc\setupoptions_vbmc.m`

### 13. Sorry: IndentationError: unindent does not match any outer indentation level (_check_3o1cd7g20bc.py, line N)  —  1 files

- `vbmc\utils\evalbool.m`

### 14. Sorry: IndentationError: unexpected indent (_check_vw4zcvuwh5b.py, line N)  —  1 files

- `vbmc\utils\slicesamplebnd.m`

### 15. Sorry: IndentationError: unexpected indent (_check_b7hxs45n8yk.py, line N)  —  1 files

- `vbmc\utils\slicesample_vbmc.m`

### 16. SyntaxError: cannot assign to expression here. Maybe you meant '==' instead of '='?  —  1 files

- `vbmc\vbmc_examples.m`

