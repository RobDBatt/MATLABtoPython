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
  rand:      { python: 'np.random.rand',    args: 'passthrough', imports: ['numpy'] },
  randn:     { python: 'np.random.randn',   args: 'passthrough', imports: ['numpy'] },
  linspace:  { python: 'np.linspace',       args: 'passthrough', imports: ['numpy'] },
  logspace:  { python: 'np.logspace',       args: 'passthrough', imports: ['numpy'] },
  meshgrid:  { python: 'np.meshgrid',       args: 'passthrough', imports: ['numpy'] },
  repmat:    { python: 'np.tile',           args: 'reshape',     imports: ['numpy'] },
  diag:      { python: 'np.diag',           args: 'passthrough', imports: ['numpy'] },

  // ── Array Info ──────────────────────────────────────────
  size:      { python: '.shape',            args: 'attribute',   imports: ['numpy'] },
  length:    { python: 'max({}.shape)',      args: 'template',    imports: ['numpy'] },
  numel:     { python: '{}.size',           args: 'template',    imports: ['numpy'] },
  ndims:     { python: '{}.ndim',           args: 'template',    imports: ['numpy'] },
  isempty:   { python: '{}.size == 0',      args: 'template',    imports: ['numpy'] },

  // ── Array Manipulation ─────────────────────────────────
  reshape:   { python: '{}.reshape',        args: 'template',    imports: ['numpy'] },
  transpose: { python: '{}.T',             args: 'template',    imports: ['numpy'] },
  fliplr:    { python: 'np.fliplr',         args: 'passthrough', imports: ['numpy'] },
  flipud:    { python: 'np.flipud',         args: 'passthrough', imports: ['numpy'] },
  rot90:     { python: 'np.rot90',          args: 'passthrough', imports: ['numpy'] },
  sort:      { python: 'np.sort',           args: 'passthrough', imports: ['numpy'] },
  sortrows:  { python: '{a}[{a}[:,0].argsort()]', args: 'custom', imports: ['numpy'] },
  cat:       { python: 'np.concatenate',    args: 'custom',      imports: ['numpy'] },
  horzcat:   { python: 'np.hstack',         args: 'reshape',     imports: ['numpy'] },
  vertcat:   { python: 'np.vstack',         args: 'reshape',     imports: ['numpy'] },
  find: {
    python: 'np.where',
    args: 'passthrough',
    imports: ['numpy'],
    flag: { type: 'WARNING', message: 'find → np.where — return format differs, verify usage' },
  },
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
  rem:     { python: 'np.remainder',      args: 'passthrough', imports: ['numpy'] },
  sign:    { python: 'np.sign',           args: 'passthrough', imports: ['numpy'] },
  max:     { python: 'np.max',            args: 'passthrough', imports: ['numpy'] },
  min:     { python: 'np.min',            args: 'passthrough', imports: ['numpy'] },
  sum:     { python: 'np.sum',            args: 'passthrough', imports: ['numpy'] },
  prod:    { python: 'np.prod',           args: 'passthrough', imports: ['numpy'] },
  cumsum:  { python: 'np.cumsum',         args: 'passthrough', imports: ['numpy'] },
  cumprod: { python: 'np.cumprod',        args: 'passthrough', imports: ['numpy'] },
  mean:    { python: 'np.mean',           args: 'passthrough', imports: ['numpy'] },
  median:  { python: 'np.median',         args: 'passthrough', imports: ['numpy'] },
  std: {
    python: 'np.std',
    args: 'custom', // needs ddof=1 appended
    imports: ['numpy'],
    flag: { type: 'WARNING', message: 'std uses ddof=1 to match MATLAB default (N-1) — verify' },
  },
  var: {
    python: 'np.var',
    args: 'custom',
    imports: ['numpy'],
    flag: { type: 'WARNING', message: 'var uses ddof=1 to match MATLAB default (N-1) — verify' },
  },
  cross: { python: 'np.cross',           args: 'passthrough', imports: ['numpy'] },
  dot:   { python: 'np.dot',             args: 'passthrough', imports: ['numpy'] },

  // ── Linear Algebra ─────────────────────────────────────
  norm:  { python: 'np.linalg.norm',         args: 'passthrough', imports: ['numpy'] },
  det:   { python: 'np.linalg.det',          args: 'passthrough', imports: ['numpy'] },
  inv:   { python: 'np.linalg.inv',          args: 'passthrough', imports: ['numpy'] },
  eig: {
    python: 'np.linalg.eig',
    args: 'passthrough',
    imports: ['numpy'],
    flag: { type: 'WARNING', message: 'eig output order may differ — MATLAB sorts eigenvalues' },
  },
  svd:   { python: 'np.linalg.svd',          args: 'passthrough', imports: ['numpy'] },
  pinv:  { python: 'np.linalg.pinv',         args: 'passthrough', imports: ['numpy'] },
  rank:  { python: 'np.linalg.matrix_rank',  args: 'passthrough', imports: ['numpy'] },
  trace: { python: 'np.trace',               args: 'passthrough', imports: ['numpy'] },

  // ── FFT ────────────────────────────────────────────────
  fft:      { python: 'np.fft.fft',      args: 'passthrough', imports: ['numpy'] },
  ifft:     { python: 'np.fft.ifft',     args: 'passthrough', imports: ['numpy'] },
  fft2:     { python: 'np.fft.fft2',     args: 'passthrough', imports: ['numpy'] },
  fftshift: { python: 'np.fft.fftshift', args: 'passthrough', imports: ['numpy'] },

  // ── String Functions ───────────────────────────────────
  strcmp:    { python: '{a} == {b}',           args: 'custom', imports: [] },
  strcmpi:  { python: '{a}.lower() == {b}.lower()', args: 'custom', imports: [] },
  strcat:   { python: '{a} + {b}',            args: 'custom', imports: [] },
  num2str:  { python: 'str',                  args: 'passthrough', imports: [] },
  str2num:  { python: 'float',                args: 'passthrough', imports: [] },
  sprintf:  { python: 'f',                    args: 'format_convert', imports: [] },
  strsplit: { python: '{}.split',             args: 'template', imports: [] },
  strtrim:  { python: '{}.strip()',           args: 'template', imports: [] },
  upper:    { python: '{}.upper()',           args: 'template', imports: [] },
  lower:    { python: '{}.lower()',           args: 'template', imports: [] },
  regexp:   { python: 're.search',            args: 'custom', imports: ['re'] },
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
  isnan:      { python: 'np.isnan',            args: 'passthrough', imports: ['numpy'] },
  isinf:      { python: 'np.isinf',            args: 'passthrough', imports: ['numpy'] },
  isfinite:   { python: 'np.isfinite',         args: 'passthrough', imports: ['numpy'] },

  // ── Miscellaneous ──────────────────────────────────────
  tic:      { python: '_tic = time.time()',   args: 'custom', imports: ['time'] },
  toc:      { python: 'print(f"Elapsed: {time.time() - _tic:.3f}s")', args: 'custom', imports: ['time'] },
  pause:    { python: 'time.sleep',           args: 'passthrough', imports: ['time'] },
  input:    { python: 'input',                args: 'passthrough', imports: [] },
  class:    { python: 'type',                 args: 'passthrough', imports: [] },
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
    flag: { type: 'WARNING', message: 'fileparts → os.path.splitext — returns (root, ext), not (path, name, ext)' },
  },
  tempdir:  { python: 'tempfile.gettempdir()', args: 'custom',      imports: ['tempfile'] },

  // ── String Functions (additional) ──────────────────────
  contains:   { python: '{b} in {a}',           args: 'custom',      imports: [] },
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
    flag: { type: 'WARNING', message: 'sparse → scipy.sparse.csr_matrix — constructor differs, verify args' },
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
    python: 'solve_ivp',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'ode45 → solve_ivp — return format differs: MATLAB returns [t,y], scipy returns object with .t and .y attributes. Use method="RK45".' },
  },
  ode23: {
    python: 'solve_ivp',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'ode23 → solve_ivp(method="RK23") — return format differs: use result.t, result.y' },
  },
  ode15s: {
    python: 'solve_ivp',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'ode15s → solve_ivp(method="BDF") — return format differs: use result.t, result.y' },
  },
  ode113: {
    python: 'solve_ivp',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'ode113 → solve_ivp(method="LSODA") — return format differs: use result.t, result.y' },
  },
  ode23s: {
    python: 'solve_ivp',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'ode23s → solve_ivp(method="Radau") — return format differs: use result.t, result.y' },
  },
  ode23t: {
    python: 'solve_ivp',
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
    python: 'solve_bvp',
    args: 'custom',
    imports: ['scipy.integrate'],
    flag: { type: 'WARNING', message: 'bvp4c → solve_bvp — interface differs significantly, manual conversion needed' },
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
  interp1:   { python: 'np.interp',             args: 'passthrough', imports: ['numpy'] },
}
