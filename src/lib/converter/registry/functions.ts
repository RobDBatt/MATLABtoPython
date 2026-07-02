import type { FunctionMapping } from '../types'

/**
 * Core MATLAB function → Python mapping table.
 * Does NOT include toolbox functions (see toolboxes.ts).
 */
export const FUNCTION_MAP: Record<string, FunctionMapping> = {
  // ── Array Creation ──────────────────────────────────────
  zeros:     { python: 'np.zeros',          args: 'reshape',     imports: ['numpy'] },
  ones:      { python: 'np.ones',           args: 'reshape',     imports: ['numpy'] },
  eye:       { python: 'np.eye',            args: 'passthrough', imports: ['numpy'] },
  rand:      { python: 'np.random.rand',    args: 'rand_shape',  imports: ['numpy'] },
  randn:     { python: 'np.random.randn',   args: 'rand_shape',  imports: ['numpy'] },
  linspace:  { python: 'np.linspace',       args: 'passthrough', imports: ['numpy'] },
  logspace:  { python: 'np.logspace',       args: 'passthrough', imports: ['numpy'] },
  meshgrid:  { python: 'np.meshgrid',       args: 'passthrough', imports: ['numpy'] },
  repmat:    { python: 'np.tile',           args: 'tile',        imports: ['numpy'] },
  diag:      { python: 'np.diag',           args: 'passthrough', imports: ['numpy'] },

  // ── Array Info ──────────────────────────────────────────
  size:      { python: '.shape',            args: 'attribute',   imports: ['numpy'] },
  length:    { python: 'max({}.shape)',      args: 'template',    imports: ['numpy'] },
  numel:     { python: 'len({})',            args: 'template',    imports: [] },
  ndims:     { python: '{}.ndim',           args: 'template',    imports: ['numpy'] },
  isempty:   { python: 'len({}) == 0',       args: 'template',    imports: [] },

  // ── Array Manipulation ─────────────────────────────────
  reshape:   { python: '{}.reshape',        args: 'template',    imports: ['numpy'] },
  transpose: { python: '{}.T',             args: 'template',    imports: ['numpy'] },
  fliplr:    { python: 'np.fliplr',         args: 'passthrough', imports: ['numpy'] },
  flipud:    { python: 'np.flipud',         args: 'passthrough', imports: ['numpy'] },
  rot90:     { python: 'np.rot90',          args: 'passthrough', imports: ['numpy'] },
  sort:      { python: 'np.sort',           args: 'passthrough', imports: ['numpy'] },
  sortrows: {
    python: 'np.lexsort',  // actual rewrite done by rewriteSortrows (custom)
    args: 'custom',
    imports: ['numpy'],
    flag: {
      type: 'WARNING',
      message: 'sortrows → np.lexsort sorts ascending by all columns (single numeric column → argsort). For descending order, a column vector, or the index output [B, idx] = sortrows(A), compute idx = np.lexsort(A[:, ::-1].T) then B = A[idx] and adjust manually.',
    },
    // Only warn on the forms the rewriter can't fully express: the [B, idx]
    // index output (already rewritten to `B, idx =` by the multi-return
    // pre-pass), or a non-plain-positive-integer column argument.
    flagWhen: (content) =>
      /\w+\s*,\s*\w+\s*=\s*sortrows\s*\(/.test(content) ||
      /\bsortrows\s*\([^,()]+,\s*(?!\d+\s*\))/.test(content),
  },
  cat:       { python: 'np.concatenate',    args: 'custom',      imports: ['numpy'] },
  horzcat:   { python: 'np.hstack',         args: 'reshape',     imports: ['numpy'] },
  vertcat:   { python: 'np.vstack',         args: 'reshape',     imports: ['numpy'] },
  // `find` intentionally absent from this registry — it's handled in the
  // transform stage's special-constructs pass so it can be context-aware:
  //   single-return  →  np.flatnonzero(cond)   (1D linear indices)
  //   [r, c] = ...   →  r, c = np.where(cond)  (tuple unpacking)
  //   [r, c, v] = ...→  multi-return with values; flagged
  //   find(c,1,'first') → np.flatnonzero(c)[0]
  //   find(c,1,'last')  → np.flatnonzero(c)[-1]
  sub2ind: {
    python: 'np.ravel_multi_index',
    args: 'custom',
    imports: ['numpy'],
    flag: { type: 'INDEX', message: 'sub2ind indices shifted to 0-based — verify' },
  },
  ind2sub: {
    python: 'np.unravel_index',
    args: 'custom',
    imports: ['numpy'],
    flag: { type: 'INDEX', message: 'ind2sub indices shifted to 0-based — verify' },
  },

  // ── Math Functions ─────────────────────────────────────
  abs:     { python: 'np.abs',            args: 'passthrough', imports: ['numpy'] },
  sqrt:    { python: 'np.sqrt',           args: 'passthrough', imports: ['numpy'] },
  exp:     { python: 'np.exp',            args: 'passthrough', imports: ['numpy'] },
  // Special functions (scipy.special). Names rarely collide with variables;
  // a variable shadowing one is protected by the Stage-3 shadow check.
  gammaln:   { python: 'special.gammaln',   args: 'passthrough', imports: ['scipy.special'] },
  betaln:    { python: 'special.betaln',    args: 'passthrough', imports: ['scipy.special'] },
  logsumexp: { python: 'special.logsumexp', args: 'passthrough', imports: ['scipy.special'] },
  erf:       { python: 'special.erf',       args: 'passthrough', imports: ['scipy.special'] },
  erfc:      { python: 'special.erfc',      args: 'passthrough', imports: ['scipy.special'] },
  erfinv:    { python: 'special.erfinv',    args: 'passthrough', imports: ['scipy.special'] },
  factorial: { python: 'special.factorial', args: 'passthrough', imports: ['scipy.special'] },
  nchoosek:  { python: 'special.comb',      args: 'passthrough', imports: ['scipy.special'] },
  psi:       { python: 'special.psi',       args: 'passthrough', imports: ['scipy.special'] },
  log:     { python: 'np.log',            args: 'passthrough', imports: ['numpy'] },
  log2:    { python: 'np.log2',           args: 'passthrough', imports: ['numpy'] },
  log10:   { python: 'np.log10',          args: 'passthrough', imports: ['numpy'] },
  sin:     { python: 'np.sin',            args: 'passthrough', imports: ['numpy'] },
  cos:     { python: 'np.cos',            args: 'passthrough', imports: ['numpy'] },
  tan:     { python: 'np.tan',            args: 'passthrough', imports: ['numpy'] },
  asin:    { python: 'np.arcsin',         args: 'passthrough', imports: ['numpy'] },
  acos:    { python: 'np.arccos',         args: 'passthrough', imports: ['numpy'] },
  atan:    { python: 'np.arctan',         args: 'passthrough', imports: ['numpy'] },
  atan2:   { python: 'np.arctan2',        args: 'passthrough', imports: ['numpy'] },
  ceil:    { python: 'np.ceil',           args: 'passthrough', imports: ['numpy'] },
  floor:   { python: 'np.floor',          args: 'passthrough', imports: ['numpy'] },
  round:   { python: 'np.round',          args: 'passthrough', imports: ['numpy'] },
  mod:     { python: 'np.mod',            args: 'passthrough', imports: ['numpy'] },
  rem:     { python: 'np.fmod',           args: 'passthrough', imports: ['numpy'] }, // sign of dividend (MATLAB rem), unlike np.remainder
  sign:    { python: 'np.sign',           args: 'passthrough', imports: ['numpy'] },
  max:     { python: 'np.max',            args: 'passthrough', imports: ['numpy'] },
  min:     { python: 'np.min',            args: 'passthrough', imports: ['numpy'] },
  sum:     { python: 'np.sum',            args: 'passthrough', imports: ['numpy'] },
  any:     { python: 'np.any',            args: 'passthrough', imports: ['numpy'] },
  all:     { python: 'np.all',            args: 'passthrough', imports: ['numpy'] },
  prod:    { python: 'np.prod',           args: 'passthrough', imports: ['numpy'] },
  cumsum:  { python: 'np.cumsum',         args: 'passthrough', imports: ['numpy'] },
  cumprod: { python: 'np.cumprod',        args: 'passthrough', imports: ['numpy'] },
  mean:    { python: 'np.mean',           args: 'passthrough', imports: ['numpy'] },
  median:  { python: 'np.median',         args: 'passthrough', imports: ['numpy'] },
  std: { python: 'np.std', args: 'custom', imports: ['numpy'] },
  var: { python: 'np.var', args: 'custom', imports: ['numpy'] },
  cross: { python: 'np.cross',           args: 'passthrough', imports: ['numpy'] },
  dot: {
    python: 'np.dot',
    args: 'passthrough',
    imports: ['numpy'],
    // The 3-arg form `dot(X, Y, dim)` is rewritten to
    // `np.sum(X * Y, axis=dim - 1)` in transform stage's preTransform; what
    // reaches here is the 2-arg form, which maps directly to np.dot and
    // doesn't need a flag.
  },

  // ── Linear Algebra ─────────────────────────────────────
  norm:  { python: 'np.linalg.norm',         args: 'passthrough', imports: ['numpy'] },
  det:   { python: 'np.linalg.det',          args: 'passthrough', imports: ['numpy'] },
  inv:   { python: 'np.linalg.inv',          args: 'passthrough', imports: ['numpy'] },
  eig: {
    python: 'np.linalg.eig',
    args: 'passthrough',
    imports: ['numpy'],
    flag: {
      type: 'WARNING',
      message: 'eig → np.linalg.eig — MATLAB eig returns eigenvalues in ascending order for symmetric matrices; NumPy does not sort. If your code depends on eigenvalue order, add: idx = np.argsort(eigenvalues); V = V[:, idx].',
    },
    // Only flag when sort order could matter: multi-output [V,D]=eig(A) or
    // generalized eig(A,B[,flag]) form which NumPy doesn't support directly.
    // Single-output v=eig(A) and inline eig(A) (e.g. in comparisons) don't
    // depend on order and map cleanly to np.linalg.eig.
    flagWhen: (content) =>
      /\[\s*\w+\s*,\s*\w+\s*\]\s*=\s*eig\s*\(/.test(content) ||
      /\beig\s*\([^)]*,[^)]*\)/.test(content),
  },
  svd:   { python: 'np.linalg.svd',          args: 'passthrough', imports: ['numpy'] },
  pinv:  { python: 'np.linalg.pinv',         args: 'passthrough', imports: ['numpy'] },
  rank:  { python: 'np.linalg.matrix_rank',  args: 'passthrough', imports: ['numpy'] },
  trace: { python: 'np.trace',               args: 'passthrough', imports: ['numpy'] },
  kron:    { python: 'np.kron',           args: 'passthrough', imports: ['numpy'] },

  // ── FFT ────────────────────────────────────────────────
  fft:      { python: 'np.fft.fft',      args: 'passthrough', imports: ['numpy'] },
  ifft:     { python: 'np.fft.ifft',     args: 'passthrough', imports: ['numpy'] },
  fft2:     { python: 'np.fft.fft2',     args: 'passthrough', imports: ['numpy'] },
  fftshift: { python: 'np.fft.fftshift', args: 'passthrough', imports: ['numpy'] },

  // ── String Functions ───────────────────────────────────
  // strcmp/strcmpi handled in special constructs for proper arg extraction
  // strcmp:  a == b
  // strcmpi: a.lower() == b.lower()
  // strcat handled in special constructs for proper arg extraction
  num2str:  { python: 'str',                  args: 'passthrough', imports: [] },
  str2num:  { python: 'float',                args: 'passthrough', imports: [] },
  sprintf:  { python: 'f',                    args: 'format_convert', imports: [] },
  strsplit: { python: '{}.split',             args: 'template', imports: [] },
  strtrim:  { python: '{}.strip()',           args: 'template', imports: [] },
  upper:    { python: '{}.upper()',           args: 'template', imports: [] },
  lower:    { python: '{}.lower()',           args: 'template', imports: [] },
  // MATLAB regexp(str, pat) → re.search(pat, str): subject and pattern SWAP.
  // The reorder applies only to the 2-arg form; option forms ('match',
  // 'tokens', …) differ structurally and are flagged when they survive.
  regexp:   { python: 're.search',            args: 'custom', imports: ['re'], argReorder: [1, 0] },
  regexprep: { python: 're.sub',             args: 'custom', imports: ['re'] },

  // ── File I/O ───────────────────────────────────────────
  fopen:    { python: 'open',              args: 'passthrough', imports: [] },
  fclose:   { python: '{}.close()',        args: 'template', imports: [] },
  fprintf:  { python: 'print',            args: 'format_convert', imports: [] },
  fscanf: {
    python: '',
    args: 'custom',
    imports: [],
    flag: { type: 'TODO', message: 'fscanf — no direct Python equivalent, manual conversion needed' },
  },
  fread:    { python: '{}.read()',         args: 'template', imports: [] },
  fwrite:   { python: '{}.write',          args: 'passthrough', imports: [] },
  load:     { python: 'sio.loadmat',       args: 'passthrough', imports: ['scipy.io'] },
  save:     { python: 'sio.savemat',       args: 'passthrough', imports: ['scipy.io'] },
  csvread:  { python: 'np.loadtxt',        args: 'custom', imports: ['numpy'] },
  csvwrite: { python: 'np.savetxt',        args: 'custom', imports: ['numpy'] },
  xlsread:  { python: 'pd.read_excel',     args: 'passthrough', imports: ['pandas'] },
  // readtable reads csv/txt/xlsx/etc. Pick the pandas reader by file extension;
  // default to read_csv and flag only when the extension is unknown (e.g. a
  // variable filename) so we don't silently guess the wrong reader.
  readtable: {
    python: 'pd.read_csv',
    args: 'custom',
    imports: ['pandas'],
    flag: {
      type: 'WARNING',
      message: 'readtable → pd.read_csv assumed. For Excel files use pd.read_excel; verify the delimiter/header for .txt/.dat files. Access columns with df["col"].',
    },
    flagWhen: (content) => !/readtable\s*\(\s*['"][^'"]*\.(csv|xls|xlsx|xlsm)['"]/i.test(content),
  },

  // ── Plotting ───────────────────────────────────────────
  figure:   { python: 'plt.figure()',       args: 'passthrough', imports: ['matplotlib.pyplot'] },
  plot:     { python: 'plt.plot',           args: 'passthrough', imports: ['matplotlib.pyplot'] },
  subplot:  { python: 'plt.subplot',        args: 'passthrough', imports: ['matplotlib.pyplot'] },
  title:    { python: 'plt.title',          args: 'passthrough', imports: ['matplotlib.pyplot'] },
  xlabel:   { python: 'plt.xlabel',         args: 'passthrough', imports: ['matplotlib.pyplot'] },
  ylabel:   { python: 'plt.ylabel',         args: 'passthrough', imports: ['matplotlib.pyplot'] },
  legend:   { python: 'plt.legend',         args: 'passthrough', imports: ['matplotlib.pyplot'] },
  bar:      { python: 'plt.bar',            args: 'passthrough', imports: ['matplotlib.pyplot'] },
  histogram: { python: 'plt.hist',          args: 'passthrough', imports: ['matplotlib.pyplot'] },
  scatter:  { python: 'plt.scatter',        args: 'passthrough', imports: ['matplotlib.pyplot'] },
  contour:  { python: 'plt.contour',        args: 'passthrough', imports: ['matplotlib.pyplot'] },
  surf: {
    python: '',
    args: 'custom',
    imports: ['matplotlib.pyplot'],
    flag: { type: 'TODO', message: 'surf — use mpl_toolkits.mplot3d for 3D surface plots' },
  },
  mesh: {
    python: '',
    args: 'custom',
    imports: ['matplotlib.pyplot'],
    flag: { type: 'TODO', message: 'mesh — use mpl_toolkits.mplot3d for 3D wireframe plots' },
  },
  imagesc:  { python: 'plt.imshow',         args: 'passthrough', imports: ['matplotlib.pyplot'] },
  colorbar: { python: 'plt.colorbar()',     args: 'passthrough', imports: ['matplotlib.pyplot'] },
  savefig:  { python: 'plt.savefig',        args: 'passthrough', imports: ['matplotlib.pyplot'] },
  axis:     { python: 'plt.axis',           args: 'passthrough', imports: ['matplotlib.pyplot'] },
  xlim:     { python: 'plt.xlim',           args: 'passthrough', imports: ['matplotlib.pyplot'] },
  ylim:     { python: 'plt.ylim',           args: 'passthrough', imports: ['matplotlib.pyplot'] },

  // ── Output ─────────────────────────────────────────────
  disp:    { python: 'print',              args: 'passthrough', imports: [] },
  display: { python: 'print',              args: 'passthrough', imports: [] },
  error:   { python: 'raise ValueError',   args: 'custom', imports: [] },
  warning: { python: 'warnings.warn',      args: 'passthrough', imports: ['warnings'] },

  // ── Audio ──────────────────────────────────────────────
  audioread: { python: 'sf.read',             args: 'passthrough', imports: ['soundfile'] },
  audiowrite: { python: 'sf.write',           args: 'custom',      imports: ['soundfile'] },
  audioplayer: {
    python: 'audioplayer',
    args: 'passthrough',
    imports: [],
    flag: { type: 'TODO', message: 'audioplayer — use sounddevice.play() or similar for audio playback' },
  },
  sound: {
    python: 'sound',
    args: 'passthrough',
    imports: [],
    flag: { type: 'TODO', message: 'sound — use sounddevice.play() for audio playback' },
  },

  // ── Windowing ──────────────────────────────────────────
  hanning:  { python: 'np.hanning',           args: 'passthrough', imports: ['numpy'] },
  hamming:  { python: 'np.hamming',           args: 'passthrough', imports: ['numpy'] },
  blackman: { python: 'np.blackman',          args: 'passthrough', imports: ['numpy'] },
  bartlett: { python: 'np.bartlett',          args: 'passthrough', imports: ['numpy'] },
  kaiser:   { python: 'np.kaiser',            args: 'passthrough', imports: ['numpy'] },

  // ── Plotting (additional) ──────────────────────────────
  stem:     { python: 'plt.stem',             args: 'passthrough', imports: ['matplotlib.pyplot'] },
  semilogx: { python: 'plt.semilogx',         args: 'passthrough', imports: ['matplotlib.pyplot'] },
  semilogy: { python: 'plt.semilogy',         args: 'passthrough', imports: ['matplotlib.pyplot'] },
  loglog:   { python: 'plt.loglog',           args: 'passthrough', imports: ['matplotlib.pyplot'] },
  polar:    { python: 'plt.polar',            args: 'passthrough', imports: ['matplotlib.pyplot'] },
  fill:     { python: 'plt.fill',             args: 'passthrough', imports: ['matplotlib.pyplot'] },
  text:     { python: 'plt.text',             args: 'passthrough', imports: ['matplotlib.pyplot'] },
  annotate: { python: 'plt.annotate',         args: 'passthrough', imports: ['matplotlib.pyplot'] },

  // ── Type checking ──────────────────────────────────────
  isnumeric:  { python: 'np.issubdtype({}.dtype, np.number)', args: 'template', imports: ['numpy'] },
  ischar:     { python: 'isinstance({}, str)',  args: 'template', imports: [] },
  islogical:  { python: '{}.dtype == np.bool_', args: 'template', imports: ['numpy'] },
  isstruct:   { python: 'isinstance({}, dict)', args: 'template', imports: [] },
  iscell:     { python: 'isinstance({}, list)', args: 'template', imports: [] },
  isscalar:   { python: 'np.isscalar',         args: 'passthrough', imports: ['numpy'] },
  isreal:     { python: 'np.isrealobj',        args: 'passthrough', imports: ['numpy'] },
  isequal:    { python: 'np.array_equal',      args: 'passthrough', imports: ['numpy'] },
  isnan:      { python: 'np.isnan',            args: 'passthrough', imports: ['numpy'] },
  isinf:      { python: 'np.isinf',            args: 'passthrough', imports: ['numpy'] },
  isfinite:   { python: 'np.isfinite',         args: 'passthrough', imports: ['numpy'] },

  // ── Optimization Options ────────────────────────────────
  optimset: {
    python: 'dict',
    args: 'custom',
    imports: [],
    flag: { type: 'WARNING', message: 'optimset → dict — convert Name/Value pairs to scipy options dict manually' },
  },
  optimoptions: {
    python: 'dict',
    args: 'custom',
    imports: [],
    flag: { type: 'WARNING', message: 'optimoptions → dict — convert to scipy minimize options' },
  },
  lsqcurvefit: {
    python: 'optimize.curve_fit',
    args: 'custom',
    imports: ['scipy.optimize'],
    flag: { type: 'WARNING', message: 'lsqcurvefit → curve_fit — argument order differs: curve_fit(f, xdata, ydata, p0)' },
  },

  // ── Utility ────────────────────────────────────────────
  nextpow2: { python: 'nextpow2', args: 'custom', imports: ['numpy'],
    flag: { type: 'WARNING', message: 'nextpow2 → int(np.ceil(np.log2(n))) — verify for edge cases (n=0, n=1)' },
  },

  // ── Math (additional) ──────────────────────────────────
  tanh:     { python: 'np.tanh',           args: 'passthrough', imports: ['numpy'] },
  sinh:     { python: 'np.sinh',           args: 'passthrough', imports: ['numpy'] },
  cosh:     { python: 'np.cosh',           args: 'passthrough', imports: ['numpy'] },
  atanh:    { python: 'np.arctanh',        args: 'passthrough', imports: ['numpy'] },
  asinh:    { python: 'np.arcsinh',        args: 'passthrough', imports: ['numpy'] },
  acosh:    { python: 'np.arccosh',        args: 'passthrough', imports: ['numpy'] },
  fix:      { python: 'np.fix',            args: 'passthrough', imports: ['numpy'] },
  randperm: { python: 'np.random.permutation', args: 'passthrough', imports: ['numpy'] },
  randi:    { python: 'np.random.randint',    args: 'custom',      imports: ['numpy'] },
  rng:      { python: 'np.random.seed',       args: 'passthrough', imports: ['numpy'] },
  sqrtm:    { python: 'linalg.sqrtm', args: 'passthrough', imports: ['scipy.linalg'] },
  expm:     { python: 'linalg.expm',  args: 'passthrough', imports: ['scipy.linalg'] },
  logm:     { python: 'linalg.logm',  args: 'passthrough', imports: ['scipy.linalg'] },
  cond:     { python: 'np.linalg.cond',     args: 'passthrough', imports: ['numpy'] },
  chol: {
    python: 'np.linalg.cholesky',
    args: 'passthrough',
    imports: ['numpy'],
    flag: {
      type: 'WARNING',
      message: 'chol → np.linalg.cholesky — MATLAB chol can return [U, p] for failure detection; numpy raises LinAlgError on failure and returns ONE matrix only. If you used [U, p] = chol(X), wrap in try/except and check the exception instead.',
    },
    // Only flag the multi-output form `[U, p] = chol(...)` — the single-
    // output `chol(X)` maps cleanly to np.linalg.cholesky(X).
    flagWhen: (content) => /\[\s*\w+\s*,\s*\w+\s*\]\s*=\s*chol\s*\(/.test(content),
  },
  qr:       { python: 'np.linalg.qr',       args: 'passthrough', imports: ['numpy'] },
  lu: {
    python: 'linalg.lu',
    args: 'passthrough',
    imports: ['scipy.linalg'],
    flag: {
      type: 'WARNING',
      message: 'lu → scipy.linalg.lu returns THREE values (P, L, U), not two. MATLAB [L, U] = lu(A) folds the permutation into L. Use P, L, U = linalg.lu(A) and apply P, or pass permute_l=True to get [L, U].',
    },
    flagWhen: (content) => /\[\s*\w+\s*,\s*\w+\s*\]\s*=\s*lu\s*\(/.test(content),
  },
  schur:    { python: 'linalg.schur',  args: 'passthrough', imports: ['scipy.linalg'] },

  // ── Miscellaneous ──────────────────────────────────────
  tic:      { python: '_tic = time.time()',   args: 'custom', imports: ['time'] },
  toc:      { python: 'print(f"Elapsed: {time.time() - _tic:.3f}s")', args: 'custom', imports: ['time'] },
  pause:    { python: 'time.sleep',           args: 'passthrough', imports: ['time'] },
  input:    { python: 'input',                args: 'passthrough', imports: [] },
  // MATLAB class(x) returns a class-name STRING ('double', 'char', ...). Plain
  // `type(x)` returned a type OBJECT (breaks any string use). Emit a string via
  // `type(x).__name__` — runnable; the exact name still differs from MATLAB's
  // (e.g. 'ndarray'/'float64' vs 'double'), a documented limitation.
  class:    { python: 'type({}).__name__',    args: 'template', imports: [] },
  fieldnames: { python: 'list({}.keys())',    args: 'template', imports: [] },
  struct:   {
    python: 'dict',
    args: 'custom',
    imports: [],
    flag: { type: 'WARNING', message: 'struct → dict — field access changes from s.field to s["field"]' },
  },
  cell:     { python: 'list',                 args: 'custom', imports: [] },

  // ── Set Operations ─────────────────────────────────────
  unique:    { python: 'np.unique',            args: 'passthrough', imports: ['numpy'] },
  ismember:  { python: 'np.isin',              args: 'passthrough', imports: ['numpy'] },
  intersect: { python: 'np.intersect1d',       args: 'passthrough', imports: ['numpy'] },
  union:     { python: 'np.union1d',           args: 'passthrough', imports: ['numpy'] },
  setdiff:   { python: 'np.setdiff1d',         args: 'passthrough', imports: ['numpy'] },

  // ── File System ────────────────────────────────────────
  exist:    { python: 'os.path.exists',        args: 'passthrough', imports: ['os'] },
  dir:      { python: 'os.listdir',            args: 'passthrough', imports: ['os'] },
  pwd:      { python: 'os.getcwd()',           args: 'custom',      imports: ['os'] },
  mkdir:    { python: 'os.makedirs',           args: 'passthrough', imports: ['os'] },
  rmdir:    { python: 'os.rmdir',              args: 'passthrough', imports: ['os'] },
  delete:   { python: 'os.remove',             args: 'passthrough', imports: ['os'] },
  fullfile: { python: 'os.path.join',          args: 'passthrough', imports: ['os'] },
  fileparts: {
    python: 'os.path.splitext',
    args: 'custom',
    imports: ['os'],
    flag: { type: 'WARNING', message: 'fileparts → os.path.splitext — returns (root, ext), not (path, name, ext). Multi-return form `[p, n, e] = fileparts(...)` will fail to unpack — split manually with os.path.dirname / os.path.basename / os.path.splitext.' },
    // Only flag the multi-return form `[p, n, e] = fileparts(...)`. Single-
    // call usage like `splitext(p)` returns the (root, ext) tuple correctly.
    flagWhen: (content) => /\[\s*\w+\s*(?:,\s*\w+\s*){1,2}\]\s*=\s*fileparts\s*\(/.test(content),
  },
  tempdir:  { python: 'tempfile.gettempdir()', args: 'custom',      imports: ['tempfile'] },

  // ── String Functions (additional) ──────────────────────
  // contains handled in special constructs for proper arg extraction
  startsWith: { python: '{}.startswith',         args: 'template',    imports: [] },
  endsWith:   { python: '{}.endswith',           args: 'template',    imports: [] },
  strrep:     { python: '{}.replace',            args: 'template',    imports: [] },
  blanks:     { python: "' ' * {}",              args: 'template',    imports: [] },
  deblank:    { python: '{}.rstrip()',            args: 'template',    imports: [] },
  char:       { python: 'chr',                   args: 'passthrough', imports: [] },
  cellstr:    { python: 'list',                  args: 'passthrough', imports: [] },

  // ── Statistics (additional) ────────────────────────────
  quantile:   { python: 'np.quantile',           args: 'passthrough', imports: ['numpy'] },
  prctile:    { python: 'np.percentile',          args: 'passthrough', imports: ['numpy'] },
  kurtosis:   { python: 'stats.kurtosis',         args: 'passthrough', imports: ['scipy.stats'] },
  skewness:   { python: 'stats.skew',             args: 'passthrough', imports: ['scipy.stats'] },
  movmean: {
    python: 'pd.Series',
    args: 'custom',
    imports: ['pandas'],
    flag: { type: 'WARNING', message: 'movmean → pd.Series().rolling().mean() — manual conversion needed' },
  },
  histc: {
    python: 'np.histogram',
    args: 'custom',
    imports: ['numpy'],
    flag: { type: 'WARNING', message: 'histc → np.histogram — return format differs' },
  },

  // ── Type Conversion ────────────────────────────────────
  double:   { python: 'np.float64',             args: 'passthrough', imports: ['numpy'] },
  single:   { python: 'np.float32',             args: 'passthrough', imports: ['numpy'] },
  int8:     { python: 'np.int8',                args: 'passthrough', imports: ['numpy'] },
  int16:    { python: 'np.int16',               args: 'passthrough', imports: ['numpy'] },
  int32:    { python: 'np.int32',               args: 'passthrough', imports: ['numpy'] },
  int64:    { python: 'np.int64',               args: 'passthrough', imports: ['numpy'] },
  uint8:    { python: 'np.uint8',               args: 'passthrough', imports: ['numpy'] },
  uint16:   { python: 'np.uint16',              args: 'passthrough', imports: ['numpy'] },
  uint32:   { python: 'np.uint32',              args: 'passthrough', imports: ['numpy'] },
  logical:  { python: 'np.bool_',               args: 'passthrough', imports: ['numpy'] },

  // ── Sparse Matrices ────────────────────────────────────
  sparse: {
    python: 'scipy.sparse.csr_matrix',
    args: 'custom',
    imports: ['scipy.sparse'],
    // No flag for the common forms `sparse(A)` and `sparse(i, j, v)`, both
    // of which map cleanly to csr_matrix. The 5-arg `sparse(i, j, v, m, n)`
    // form is rare; users will see the wrong shape and adjust if needed.
  },
  full:      { python: '{}.toarray()',           args: 'template',    imports: [] },
  issparse:  { python: 'scipy.sparse.issparse',  args: 'passthrough', imports: ['scipy.sparse'] },
  nnz: {
    python: 'np.count_nonzero',
    args: 'passthrough',
    imports: ['numpy'],
  },
  speye:     { python: 'scipy.sparse.eye',       args: 'passthrough', imports: ['scipy.sparse'] },
  sprand:    { python: 'scipy.sparse.random',     args: 'passthrough', imports: ['scipy.sparse'] },

  // ── ODE Solvers ────────────────────────────────────────
  ode45: {
    python: 'integrate.solve_ivp',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'ode45 → solve_ivp — return format differs: MATLAB returns [t,y], scipy returns object with .t and .y attributes. Use method="RK45".' },
  },
  ode23: {
    python: 'integrate.solve_ivp',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'ode23 → solve_ivp(method="RK23") — return format differs: use result.t, result.y' },
  },
  ode15s: {
    python: 'integrate.solve_ivp',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'ode15s → solve_ivp(method="BDF") — return format differs: use result.t, result.y' },
  },
  ode113: {
    python: 'integrate.solve_ivp',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'ode113 → solve_ivp(method="LSODA") — return format differs: use result.t, result.y' },
  },
  ode23s: {
    python: 'integrate.solve_ivp',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'ode23s → solve_ivp(method="Radau") — return format differs: use result.t, result.y' },
  },
  ode23t: {
    python: 'integrate.solve_ivp',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'ode23t → solve_ivp(method="Radau") — return format differs: use result.t, result.y' },
  },

  // ── Numerical Integration ──────────────────────────────
  integral: {
    python: 'integrate.quad',
    args: 'passthrough',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'integral → quad — returns (result, error), not just result' },
  },
  integral2: {
    python: 'integrate.dblquad',
    args: 'passthrough',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'integral2 → dblquad — argument order differs' },
  },
  integral3: {
    python: 'integrate.tplquad',
    args: 'passthrough',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'integral3 → tplquad — argument order differs' },
  },
  trapz: {
    python: 'np.trapz',
    args: 'passthrough',
    imports: ['numpy'],
  },
  cumtrapz: {
    python: 'integrate.cumulative_trapezoid',
    args: 'passthrough',
    imports: ['scipy.integrate'],
  },

  // ── Numerical Differentiation ──────────────────────────
  gradient: {
    python: 'np.gradient',
    args: 'passthrough',
    imports: ['numpy'],
  },
  diff: {
    python: 'np.diff',
    args: 'passthrough',
    imports: ['numpy'],
  },

  // ── Root Finding / Boundary Value ──────────────────────
  bvp4c: {
    python: 'integrate.solve_bvp',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'bvp4c → integrate.solve_bvp — interface differs significantly, manual conversion needed' },
  },
  deval: {
    python: '',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'TODO', message: 'deval — use scipy interpolation on solve_ivp result instead' },
  },

  // ── Additional Common Functions ────────────────────────
  roots:     { python: 'np.roots',              args: 'passthrough', imports: ['numpy'] },
  poly:      { python: 'np.poly',               args: 'passthrough', imports: ['numpy'] },
  conv:      { python: 'np.convolve',            args: 'passthrough', imports: ['numpy'] },
  deconv: {
    python: 'np.polydiv',
    args: 'passthrough',
    imports: ['numpy'],
    flag: { type: 'WARNING', message: 'deconv → np.polydiv — returns (quotient, remainder) tuple' },
  },
  // MATLAB interp1(x, y, xi) → np.interp(xi, x, y): the query points move to
  // the front. Reorder applies to the clean 3-arg form; a 4th 'method' arg
  // (spline/pchip/…) can't map to np.interp (linear only) → flagged.
  interp1:   { python: 'np.interp', args: 'passthrough', imports: ['numpy'],
               argReorder: [2, 0, 1],
               flag: { type: 'WARNING', message: "interp1: np.interp does LINEAR interpolation only — a non-linear method arg (spline/pchip/cubic) is ignored; use scipy.interpolate.interp1d for those." },
               flagWhen: (c) => /interp1\s*\([^)]*,\s*['"](?:spline|pchip|cubic|nearest|makima|v5cubic)['"]/i.test(c) },

  // ── Coverage-audit batch (systematic builtin sweep, 2026-07) ────────────
  // custom-rewritten forms (branches live in 03_transform's custom dispatcher;
  // bsxfun is handled earlier by convertBsxfun in preTransform)
  isa: {
    python: 'isa', args: 'custom', imports: [],
    flag: { type: 'WARNING', message: "isa with a non-literal or unrecognized class name can't map to isinstance automatically — review." },
    flagWhen: (c) => !/isa\s*\([^)]*,\s*'(?:double|single|float|char|string|cell|struct|logical|numeric|function_handle|u?int(?:8|16|32|64))'/.test(c),
  },
  cellfun:   { python: 'cellfun',   args: 'custom', imports: [] },
  arrayfun:  { python: 'arrayfun',  args: 'custom', imports: ['numpy'] },
  strncmp:   { python: 'strncmp',   args: 'custom', imports: [] },
  strncmpi:  { python: 'strncmpi',  args: 'custom', imports: [] },
  circshift: { python: 'np.roll',   args: 'custom', imports: ['numpy'] },
  ndgrid:    { python: 'np.meshgrid', args: 'custom', imports: ['numpy'] },
  saveas:    { python: 'plt.savefig', args: 'custom', imports: ['matplotlib.pyplot'] },
  etime:     { python: 'etime',     args: 'custom', imports: [] },

  // Every entry below was a confirmed PASSTHROUGH in the 344-builtin e2e
  // probe. Ordered by corpus frequency within each group.

  // complex / elementwise math
  real:      { python: 'np.real',    args: 'passthrough', imports: ['numpy'] },
  imag:      { python: 'np.imag',    args: 'passthrough', imports: ['numpy'] },
  conj:      { python: 'np.conj',    args: 'passthrough', imports: ['numpy'] },
  angle:     { python: 'np.angle',   args: 'passthrough', imports: ['numpy'] },
  power:     { python: 'np.power',   args: 'passthrough', imports: ['numpy'] },
  hypot:     { python: 'np.hypot',   args: 'passthrough', imports: ['numpy'] },
  gcd:       { python: 'np.gcd',     args: 'passthrough', imports: ['numpy'] },
  lcm:       { python: 'np.lcm',     args: 'passthrough', imports: ['numpy'] },
  complex:   { python: 'complex',    args: 'passthrough', imports: [] },
  gamma:     { python: 'special.gamma', args: 'passthrough', imports: ['scipy.special'] },

  // linear algebra
  tril:      { python: 'np.tril',    args: 'passthrough', imports: ['numpy'] },
  triu:      { python: 'np.triu',    args: 'passthrough', imports: ['numpy'] },
  linsolve:  { python: 'np.linalg.solve', args: 'passthrough', imports: ['numpy'] },
  null: {
    python: 'linalg.null_space', args: 'passthrough', imports: ['scipy.linalg'],
  },

  // arrays
  squeeze:   { python: 'np.squeeze', args: 'passthrough', imports: ['numpy'] },
  flip:      { python: 'np.flip',    args: 'passthrough', imports: ['numpy'] },
  cell2mat:  { python: 'np.block',   args: 'passthrough', imports: ['numpy'] },
  num2cell:  { python: 'list',       args: 'passthrough', imports: [] },
  histcounts: {
    python: 'np.histogram', args: 'passthrough', imports: ['numpy'],
    flag: { type: 'WARNING', message: 'histcounts → np.histogram returns (counts, edges); MATLAB returns counts first too, but bin defaults differ.' },
  },
  mode: {
    python: 'stats.mode', args: 'passthrough', imports: ['scipy.stats'],
    flag: { type: 'WARNING', message: 'mode → scipy.stats.mode returns a ModeResult — use `.mode` for the value.' },
  },

  // predicates (shape tests approximate MATLAB's everything-is-2D model)
  isvector:  { python: '(np.ndim({}) == 1 or 1 in np.shape({}))', args: 'template', imports: ['numpy'] },
  ismatrix:  { python: 'np.ndim({}) == 2', args: 'template', imports: ['numpy'] },
  isrow:     { python: '(np.ndim({}) == 1 or np.shape({})[0] == 1)', args: 'template', imports: ['numpy'] },
  iscolumn:  { python: '(np.ndim({}) == 2 and np.shape({})[1] == 1)', args: 'template', imports: ['numpy'] },
  issorted:  { python: 'np.all(np.diff({}) >= 0)', args: 'template', imports: ['numpy'] },
  iscellstr: { python: 'all(isinstance(_x, str) for _x in {})', args: 'template', imports: [] },
  isspace:   { python: '{}.isspace()', args: 'template', imports: [] },
  isletter:  { python: '{}.isalpha()', args: 'template', imports: [] },

  // strings
  replace:   { python: '{}.replace',  args: 'template', imports: [] },
  str2double: {
    python: 'float', args: 'passthrough', imports: [],
    flag: { type: 'WARNING', message: 'str2double on an ARRAY of strings needs a comprehension: [float(s) for s in a]; float() covers the scalar case.' },
  },
  strfind: {
    python: 'strfind', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: "strfind(str, pat) returns ALL 1-based match positions — no one-line Python equivalent. Use: [m.start() + 1 for m in re.finditer(re.escape(pat), str)] (keep the +1 only if downstream code expects MATLAB indexing)." },
  },
  sscanf: {
    python: 'sscanf', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'sscanf has no direct equivalent — use re groups or str.split() + float().' },
  },

  // io / os
  fgetl:     { python: "{}.readline().rstrip('\\n')", args: 'template', imports: [] },
  fgets:     { python: '{}.readline()', args: 'template', imports: [] },
  copyfile:  { python: 'shutil.copy', args: 'passthrough', imports: ['shutil'] },
  movefile:  { python: 'shutil.move', args: 'passthrough', imports: ['shutil'] },
  getenv:    { python: 'os.getenv',   args: 'passthrough', imports: ['os'] },
  system: {
    python: 'os.system', args: 'passthrough', imports: ['os'],
    flag: { type: 'WARNING', message: 'system → os.system returns only the exit status; to capture output use subprocess.run(cmd, shell=True, capture_output=True).' },
  },
  which: {
    python: 'which', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'which(name) locates a MATLAB file — closest Python is shutil.which (executables) or importlib.util.find_spec (modules).' },
  },
  textscan: {
    python: 'textscan', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'textscan has no direct equivalent — use csv module, np.loadtxt, or manual parsing.' },
  },
  datestr: {
    python: 'datestr', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'datestr → datetime.strftime; MATLAB datenum/datestr formats need manual translation.' },
  },
  datenum: {
    python: 'datenum', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'datenum → datetime.toordinal()-based math; offsets differ (MATLAB day 1 = Jan 1, 0000).' },
  },
  verLessThan: {
    python: 'verLessThan', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'verLessThan is a MATLAB version check — usually deletable in Python; review the guarded branch.' },
  },

  // functional
  func2str: {
    python: 'str', args: 'passthrough', imports: [],
    flag: { type: 'WARNING', message: 'func2str → str(f) gives a repr, not MATLAB source text; f.__name__ gives the bare name.' },
  },
  str2func: {
    python: 'str2func', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'str2func builds a function from a NAME string — in Python use a dict dispatch {name: fn} instead of eval.' },
  },
  typecast: {
    python: 'typecast', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'typecast reinterprets raw bytes — use ndarray.view(dtype) in NumPy.' },
  },
  ppval:     { python: '{}', args: 'template', imports: [] }, // pp(x): scipy spline objects are callable
  string:    { python: 'str',        args: 'passthrough', imports: [] },
  split:     { python: '{}.split',   args: 'template', imports: [] },
  pad:       { python: '{}.ljust',   args: 'template', imports: [] },
  regexpi: {
    python: 're.search', args: 'custom', imports: ['re'],
  },
  orth:      { python: 'linalg.orth', args: 'passthrough', imports: ['scipy.linalg'] },
  polyder:   { python: 'np.polyder', args: 'passthrough', imports: ['numpy'] },
  polyint:   { python: 'np.polyint', args: 'passthrough', imports: ['numpy'] },
  isprime:   { python: 'sp.isprime', args: 'passthrough', imports: ['sympy'] },
  uint64:    { python: 'np.uint64',  args: 'passthrough', imports: ['numpy'] },
  importdata: {
    python: 'np.loadtxt', args: 'passthrough', imports: ['numpy'],
    flag: { type: 'WARNING', message: 'importdata returns a struct with .data/.textdata in MATLAB — np.loadtxt returns just the numeric array.' },
  },
  dlmread:   { python: 'np.loadtxt', args: 'passthrough', imports: ['numpy'],
    flag: { type: 'WARNING', message: 'dlmread → np.loadtxt: pass delimiter="," explicitly for comma-separated files.' } },
  dlmwrite:  { python: 'np.savetxt', args: 'passthrough', imports: ['numpy'] },
  readmatrix: { python: 'np.loadtxt', args: 'passthrough', imports: ['numpy'] },
  cputime:   { python: 'time.process_time', args: 'passthrough', imports: ['time'] },
  // flag-don't-guess tail — no clean one-line Python equivalent
  primes: { python: 'primes', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'primes(n) → list(sympy.primerange(2, n + 1)) or a sieve.' } },
  nthroot: { python: 'nthroot', args: 'custom', imports: ['numpy'] },
  colon: { python: 'colon', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'colon(a, b) is just a:b → np.arange(a, b + 1).' } },
  inputParser: { python: 'inputParser', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'inputParser has no direct equivalent — use keyword arguments with defaults, or argparse for scripts.' } },
  builtin: { python: 'builtin', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: "builtin('f', ...) bypasses overloads — in Python just call the intended function directly." } },
  cast: { python: 'cast', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: "cast(x, 'type') → ndarray.astype(dtype) in NumPy." } },
  datetime: { python: 'datetime', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'datetime → Python datetime module; construction/format semantics differ.' } },
  isdatetime: { python: 'isdatetime', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'isdatetime → isinstance(x, datetime.datetime).' } },
  isduration: { python: 'isduration', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'isduration → isinstance(x, datetime.timedelta).' } },
  structfun: { python: 'structfun', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'structfun(@f, s) → {k: f(v) for k, v in s.items()} (structs convert to dicts).' } },
  mat2cell: { python: 'mat2cell', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'mat2cell partitions a matrix into blocks — use np.split / nested slicing.' } },
  zlim: { python: 'zlim', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'zlim needs a 3-D axes: ax.set_zlim(...).' } },
  randstream: { python: 'randstream', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'RandStream → np.random.Generator (np.random.default_rng(seed)).' } },
  // custom branches (03_transform dispatcher)
  strjoin:   { python: 'strjoin',   args: 'custom', imports: [] },
  erase:     { python: 'erase',     args: 'custom', imports: [] },
  permute:   { python: 'permute',   args: 'custom', imports: ['numpy'] },
  rmfield:   { python: 'rmfield',   args: 'custom', imports: [] },
  join:      { python: 'join',      args: 'custom', imports: [] },

  // plotting
  line:      { python: 'plt.plot',   args: 'passthrough', imports: ['matplotlib.pyplot'] },
  axes:      { python: 'plt.axes',   args: 'passthrough', imports: ['matplotlib.pyplot'] },
  hist:      { python: 'plt.hist',   args: 'passthrough', imports: ['matplotlib.pyplot'] },
  image:     { python: 'plt.imshow', args: 'passthrough', imports: ['matplotlib.pyplot'] },
  caxis:     { python: 'plt.clim',   args: 'passthrough', imports: ['matplotlib.pyplot'] },
  barh:      { python: 'plt.barh',   args: 'passthrough', imports: ['matplotlib.pyplot'] },
  quiver:    { python: 'plt.quiver', args: 'passthrough', imports: ['matplotlib.pyplot'] },
  stairs:    { python: 'plt.step',   args: 'passthrough', imports: ['matplotlib.pyplot'] },
  errorbar:  { python: 'plt.errorbar', args: 'passthrough', imports: ['matplotlib.pyplot'] },
  contourf:  { python: 'plt.contourf', args: 'passthrough', imports: ['matplotlib.pyplot'] },
  pcolor:    { python: 'plt.pcolormesh', args: 'passthrough', imports: ['matplotlib.pyplot'] },
  patch: {
    python: 'plt.fill', args: 'passthrough', imports: ['matplotlib.pyplot'],
    flag: { type: 'WARNING', message: 'patch → plt.fill covers the x,y[,color] form; property-pair patch(...) calls need manual conversion.' },
  },
  get: {
    python: 'plt.getp', args: 'passthrough', imports: ['matplotlib.pyplot'],
    flag: { type: 'WARNING', message: "get(h, 'Prop') → plt.getp(h, 'prop') — matplotlib property names are lowercase and may differ from MATLAB's." },
  },
  plot3: {
    python: 'plot3', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: "plot3 needs a 3-D axes: ax = plt.axes(projection='3d'); ax.plot(x, y, z)." },
  },
  scatter3: {
    python: 'scatter3', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: "scatter3 needs a 3-D axes: ax = plt.axes(projection='3d'); ax.scatter(x, y, z)." },
  },
  fill3: {
    python: 'fill3', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: "fill3 needs a 3-D axes (mpl_toolkits.mplot3d.art3d.Poly3DCollection)." },
  },
  zlabel: {
    python: 'zlabel', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: "zlabel needs a 3-D axes: ax.set_zlabel(...)." },
  },
  view: {
    python: 'view', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: 'view(az, el) sets the 3-D camera — matplotlib equivalent: ax.view_init(elev=el, azim=az) (note the swapped order).' },
  },
  rectangle: {
    python: 'rectangle', args: 'passthrough', imports: [],
    flag: { type: 'TODO', message: "rectangle → matplotlib.patches.Rectangle added via ax.add_patch(...)." },
  },
}
