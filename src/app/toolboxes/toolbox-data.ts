export interface ToolboxInfo {
  slug: string
  name: string
  matlabName: string
  pythonLib: string
  installCmd: string
  description: string
  /**
   * True when the converter engine has registry rules that auto-transform this
   * toolbox's calls. False means this page is a migration guide only — the
   * engine flags these functions rather than converting them (e.g. deep
   * learning, parallel constructs, and DB connections have no 1:1 mapping).
   */
  autoConverted: boolean
  mappings: Array<{ matlab: string; python: string; note?: string }>
}

export const TOOLBOXES: ToolboxInfo[] = [
  {
    slug: 'signal-processing',
    name: 'Signal Processing',
    matlabName: 'Signal Processing Toolbox',
    pythonLib: 'scipy.signal',
    installCmd: 'pip install scipy',
    description: 'Filter design, spectral analysis, and signal transforms. The most commonly migrated MATLAB toolbox.',
    autoConverted: true,
    mappings: [
      { matlab: 'butter(n, Wn)', python: 'signal.butter(n, Wn)', note: 'Butterworth filter design' },
      { matlab: 'cheby1(n, Rp, Wn)', python: 'signal.cheby1(n, Rp, Wn)', note: 'Chebyshev Type I' },
      { matlab: 'cheby2(n, Rs, Wn)', python: 'signal.cheby2(n, Rs, Wn)', note: 'Chebyshev Type II' },
      { matlab: 'ellip(n, Rp, Rs, Wn)', python: 'signal.ellip(n, Rp, Rs, Wn)', note: 'Elliptic filter' },
      { matlab: 'filtfilt(b, a, x)', python: 'signal.filtfilt(b, a, x)', note: 'Zero-phase filtering' },
      { matlab: 'filter(b, a, x)', python: 'signal.lfilter(b, a, x)', note: 'Note: lfilter, not filter' },
      { matlab: 'freqz(b, a)', python: 'signal.freqz(b, a)', note: 'Frequency response' },
      { matlab: 'spectrogram(x)', python: 'signal.spectrogram(x)' },
      { matlab: 'pwelch(x)', python: 'signal.welch(x)', note: 'Note: welch, not pwelch' },
      { matlab: 'periodogram(x)', python: 'signal.periodogram(x)' },
      { matlab: 'resample(x, p, q)', python: 'signal.resample_poly(x, p, q)' },
      { matlab: 'decimate(x, r)', python: 'signal.decimate(x, r)' },
      { matlab: 'hilbert(x)', python: 'signal.hilbert(x)' },
      { matlab: 'conv(a, b)', python: 'np.convolve(a, b)', note: 'Uses NumPy, not SciPy' },
      { matlab: 'conv2(A, B)', python: 'signal.convolve2d(A, B)' },
      { matlab: 'xcorr(a, b)', python: "np.correlate(a, b, 'full')" },
    ],
  },
  {
    slug: 'statistics',
    name: 'Statistics',
    matlabName: 'Statistics and Machine Learning Toolbox',
    pythonLib: 'scipy.stats + pandas',
    installCmd: 'pip install scipy pandas',
    description: 'Statistical distributions, hypothesis testing, and regression. Maps to scipy.stats and pandas.',
    autoConverted: true,
    mappings: [
      { matlab: 'normpdf(x, mu, sig)', python: 'stats.norm.pdf(x, mu, sig)' },
      { matlab: 'normcdf(x, mu, sig)', python: 'stats.norm.cdf(x, mu, sig)' },
      { matlab: 'norminv(p, mu, sig)', python: 'stats.norm.ppf(p, mu, sig)' },
      { matlab: 'normrnd(mu, sig, m, n)', python: 'np.random.normal(mu, sig, (m, n))' },
      { matlab: 'ttest(x)', python: 'stats.ttest_1samp(x, 0)' },
      { matlab: 'ttest2(x, y)', python: 'stats.ttest_ind(x, y)' },
      { matlab: 'anova1(data)', python: 'stats.f_oneway(*groups)' },
      { matlab: 'chi2test(x)', python: 'stats.chi2_contingency(x)' },
      { matlab: 'corrcoef(X)', python: 'np.corrcoef(X)' },
      { matlab: 'cov(X)', python: 'np.cov(X)' },
      { matlab: 'polyfit(x, y, n)', python: 'np.polyfit(x, y, n)' },
      { matlab: 'polyval(p, x)', python: 'np.polyval(p, x)' },
      { matlab: 'tabulate(x)', python: 'pd.value_counts(x)' },
      { matlab: 'quantile(x, p)', python: 'np.quantile(x, p)' },
      { matlab: 'prctile(x, p)', python: 'np.percentile(x, p)' },
    ],
  },
  {
    slug: 'image-processing',
    name: 'Image Processing',
    matlabName: 'Image Processing Toolbox',
    pythonLib: 'scikit-image + scipy.ndimage',
    installCmd: 'pip install scikit-image',
    description: 'Image filtering, segmentation, and morphological operations. Maps to scikit-image and OpenCV.',
    autoConverted: true,
    mappings: [
      { matlab: "imread('file')", python: "io.imread('file')" },
      { matlab: "imwrite(I, 'file')", python: "io.imsave('file', I)", note: 'Argument order reversed' },
      { matlab: 'imshow(I)', python: 'plt.imshow(I)', note: 'Uses matplotlib' },
      { matlab: 'imresize(I, [m,n])', python: 'transform.resize(I, (m,n))' },
      { matlab: 'imrotate(I, angle)', python: 'transform.rotate(I, angle)' },
      { matlab: 'rgb2gray(I)', python: 'color.rgb2gray(I)' },
      { matlab: 'im2double(I)', python: 'util.img_as_float(I)' },
      { matlab: 'imfilter(I, h)', python: 'ndi.convolve(I, h)', note: 'Uses scipy.ndimage' },
      { matlab: "edge(I, 'canny')", python: 'feature.canny(I)' },
      { matlab: 'regionprops(L)', python: 'measure.regionprops(L)' },
      { matlab: 'bwlabel(BW)', python: 'measure.label(BW)' },
      { matlab: 'imdilate(BW, se)', python: 'morphology.dilation(BW, se)' },
      { matlab: 'imerode(BW, se)', python: 'morphology.erosion(BW, se)' },
    ],
  },
  {
    slug: 'optimization',
    name: 'Optimization',
    matlabName: 'Optimization Toolbox',
    pythonLib: 'scipy.optimize',
    installCmd: 'pip install scipy',
    description: 'Nonlinear optimization, root finding, and linear programming. Maps to scipy.optimize.',
    autoConverted: true,
    mappings: [
      { matlab: 'fminunc(f, x0)', python: 'optimize.minimize(f, x0)' },
      { matlab: 'fminsearch(f, x0)', python: "optimize.minimize(f, x0, method='Nelder-Mead')" },
      { matlab: 'fmincon(f, x0, A, b)', python: 'optimize.minimize(f, x0, constraints=...)', note: 'Constraints need manual mapping' },
      { matlab: 'fzero(f, x0)', python: 'optimize.brentq(f, a, b)', note: 'Requires interval [a,b] instead of initial guess' },
      { matlab: 'fsolve(f, x0)', python: 'optimize.fsolve(f, x0)' },
      { matlab: 'lsqcurvefit(f, p, x, y)', python: 'optimize.curve_fit(f, x, y, p)' },
      { matlab: 'linprog(f, A, b)', python: 'optimize.linprog(f, A_ub=A, b_ub=b)' },
    ],
  },
  {
    slug: 'control-systems',
    name: 'Control Systems',
    matlabName: 'Control System Toolbox',
    pythonLib: 'python-control',
    installCmd: 'pip install control',
    description: 'Transfer functions, state space models, and frequency domain analysis. Maps to python-control.',
    autoConverted: true,
    mappings: [
      { matlab: 'tf(num, den)', python: 'control.tf(num, den)' },
      { matlab: 'ss(A, B, C, D)', python: 'control.ss(A, B, C, D)' },
      { matlab: 'zpk(z, p, k)', python: 'control.zpk(z, p, k)' },
      { matlab: 'bode(sys)', python: 'control.bode_plot(sys)' },
      { matlab: 'nyquist(sys)', python: 'control.nyquist_plot(sys)' },
      { matlab: 'step(sys)', python: 'control.step_response(sys)' },
      { matlab: 'impulse(sys)', python: 'control.impulse_response(sys)' },
      { matlab: 'rlocus(sys)', python: 'control.root_locus(sys)' },
      { matlab: 'margin(sys)', python: 'control.margin(sys)' },
      { matlab: 'feedback(G, H)', python: 'control.feedback(G, H)' },
      { matlab: 'series(G1, G2)', python: 'control.series(G1, G2)' },
      { matlab: 'parallel(G1, G2)', python: 'control.parallel(G1, G2)' },
      { matlab: 'c2d(sys, Ts)', python: 'control.c2d(sys, Ts)' },
    ],
  },

  // ── Deep Learning ────────────────────────────────────────

  {
    slug: 'deep-learning',
    name: 'Deep Learning',
    matlabName: 'Deep Learning Toolbox',
    pythonLib: 'PyTorch or TensorFlow/Keras',
    installCmd: 'pip install torch  # or: pip install tensorflow',
    description: "MATLAB's neural network stack. No 1:1 function mapping — deep learning frameworks differ in their whole mental model. Use PyTorch if you prefer defining layers in code; TensorFlow/Keras if you prefer a declarative builder. Both are mature, free, and dominant in research.",
    autoConverted: false,
    mappings: [
      { matlab: 'trainNetwork(X, Y, layers, options)', python: 'model.fit(X, Y, ...)  # Keras', note: 'Keras: define Sequential, compile, fit' },
      { matlab: 'trainingOptions(solver, ...)', python: 'optimizer = torch.optim.Adam(...)', note: 'PyTorch: create optimizer directly' },
      { matlab: 'layerGraph', python: 'torch.nn.Sequential(...) or torch.nn.Module', note: 'PyTorch: subclass nn.Module for custom graphs' },
      { matlab: 'imageInputLayer([h w c])', python: 'Input(shape=(h, w, c))  # Keras', note: 'Input layer not needed in PyTorch' },
      { matlab: 'convolution2dLayer(k, n)', python: 'Conv2D(n, k)  # Keras', note: 'torch.nn.Conv2d(in_ch, out_ch, k)' },
      { matlab: 'fullyConnectedLayer(n)', python: 'Dense(n)  # Keras', note: 'torch.nn.Linear(in_features, n)' },
      { matlab: 'reluLayer', python: 'ReLU()  # Keras / torch.nn.ReLU()' },
      { matlab: 'softmaxLayer', python: 'Softmax()  # output layer with softmax activation' },
      { matlab: 'dropoutLayer(p)', python: 'Dropout(p)  # Keras / torch.nn.Dropout(p)' },
      { matlab: 'batchNormalizationLayer', python: 'BatchNormalization()  # Keras / torch.nn.BatchNorm2d' },
      { matlab: 'maxPooling2dLayer(k)', python: 'MaxPooling2D(k)  # Keras / torch.nn.MaxPool2d(k)' },
      { matlab: 'lstmLayer(n)', python: 'LSTM(n)  # Keras / torch.nn.LSTM(input_size, n)' },
      { matlab: 'classify(net, X)', python: 'model.predict(X)  # Keras', note: 'torch: model(X).argmax(dim=1)' },
      { matlab: 'predict(net, X)', python: 'model.predict(X)  # Keras / model(X) for torch' },
      { matlab: 'imageDatastore(folder)', python: 'torchvision.datasets.ImageFolder / tf.keras.utils.image_dataset_from_directory' },
      { matlab: 'augmentedImageDatastore', python: 'torchvision.transforms / tf.keras.layers.experimental.preprocessing' },
      { matlab: 'resnet50 / vgg16 / googlenet', python: 'torchvision.models.resnet50(weights=...) / tf.keras.applications.VGG16' },
    ],
  },

  // ── Curve Fitting ────────────────────────────────────────

  {
    slug: 'curve-fitting',
    name: 'Curve Fitting',
    matlabName: 'Curve Fitting Toolbox',
    pythonLib: 'scipy.optimize + numpy.polyfit',
    installCmd: 'pip install scipy',
    description: "Fit curves to data. scipy.optimize.curve_fit covers 95% of MATLAB's fit() usage; polyfit/polyval match directly. For interactive fitting, the MATLAB `cftool` GUI has no Python equivalent — but a Jupyter notebook with matplotlib widgets comes close.",
    autoConverted: true,
    mappings: [
      { matlab: "fit(x, y, 'poly2')", python: 'np.polyfit(x, y, 2)', note: 'Polynomial order N → degree N' },
      { matlab: "fit(x, y, 'poly1')", python: 'np.polyfit(x, y, 1)', note: 'Linear fit' },
      { matlab: 'polyfit(x, y, n)', python: 'np.polyfit(x, y, n)' },
      { matlab: 'polyval(p, x)', python: 'np.polyval(p, x)' },
      { matlab: "fit(x, y, 'exp1')", python: "from scipy.optimize import curve_fit\\nfit, cov = curve_fit(lambda x, a, b: a*np.exp(b*x), x, y)", note: 'Exponential fit via curve_fit' },
      { matlab: 'fit(x, y, customModel)', python: 'scipy.optimize.curve_fit(model, x, y)', note: 'Pass any callable as the model' },
      { matlab: 'goodnessOfFit', python: "from sklearn.metrics import r2_score\\nr2_score(y, y_fit)", note: 'R² via sklearn, or compute manually' },
      { matlab: 'confint(fitobject)', python: '95% CI from sqrt(diag(cov))  # from curve_fit covariance', note: 'No direct function — compute from covariance matrix' },
      { matlab: "smooth(y, 'sgolay')", python: 'scipy.signal.savgol_filter(y, window, order)', note: 'Savitzky–Golay' },
      { matlab: 'interp1(x, y, xi)', python: "scipy.interpolate.interp1d(x, y)(xi)", note: "Default 'linear'; kind='cubic' for spline" },
      { matlab: 'interp2(X, Y, Z, xi, yi)', python: 'scipy.interpolate.interp2d(X, Y, Z)(xi, yi)', note: 'Or RegularGridInterpolator for newer scipy' },
      { matlab: 'spline(x, y, xi)', python: "scipy.interpolate.CubicSpline(x, y)(xi)" },
      { matlab: 'csaps(x, y, p, xi)', python: 'scipy.interpolate.UnivariateSpline(x, y, s=...)', note: 'Smoothing spline' },
    ],
  },

  // ── Wavelet ──────────────────────────────────────────────

  {
    slug: 'wavelet',
    name: 'Wavelet',
    matlabName: 'Wavelet Toolbox',
    pythonLib: 'PyWavelets (pywt)',
    installCmd: 'pip install PyWavelets',
    description: 'Discrete and continuous wavelet transforms, multilevel decomposition, and thresholding. Maps directly to PyWavelets.',
    autoConverted: true,
    mappings: [
      { matlab: 'wavedec(x, n, wname)', python: 'pywt.wavedec(x, wname, level=n)', note: 'Multilevel 1-D decomposition' },
      { matlab: 'waverec(c, wname)', python: 'pywt.waverec(c, wname)', note: 'Reconstruction from coefficients' },
      { matlab: 'dwt(x, wname)', python: 'pywt.dwt(x, wname)', note: 'Single-level DWT' },
      { matlab: 'idwt(cA, cD, wname)', python: 'pywt.idwt(cA, cD, wname)', note: 'Inverse single-level DWT' },
      { matlab: 'dwt2(X, wname)', python: 'pywt.dwt2(X, wname)', note: '2-D DWT' },
      { matlab: 'idwt2(cA, cH, cV, cD, wname)', python: 'pywt.idwt2((cA, (cH, cV, cD)), wname)', note: 'Inverse 2-D DWT' },
      { matlab: 'cwt(x, scales, wname)', python: 'pywt.cwt(x, scales, wname)', note: 'Continuous wavelet transform' },
      { matlab: 'wthresh(x, sorh, t)', python: "pywt.threshold(x, t, mode='soft')", note: "sorh: 's' → soft, 'h' → hard" },
    ],
  },

  // ── Parallel Computing ───────────────────────────────────

  {
    slug: 'parallel-computing',
    name: 'Parallel Computing',
    matlabName: 'Parallel Computing Toolbox',
    pythonLib: 'joblib / multiprocessing / dask',
    installCmd: 'pip install joblib dask',
    description: "MATLAB's parfor and spmd parallelize loops and distribute work across cores. Python's equivalent choices are joblib (simple, parallel map), multiprocessing (stdlib, explicit), or dask (for out-of-core data that doesn't fit in RAM). Pick joblib for drop-in parfor replacement.",
    autoConverted: false,
    mappings: [
      { matlab: 'parfor i = 1:n\\n    y(i) = f(x(i));\\nend', python: "from joblib import Parallel, delayed\\ny = Parallel(n_jobs=-1)(delayed(f)(xi) for xi in x)", note: 'Drop-in parfor replacement' },
      { matlab: 'parpool', python: 'joblib uses auto-detected pool', note: 'No explicit pool setup needed' },
      { matlab: 'parpool(4)', python: "Parallel(n_jobs=4)(...)", note: '4 cores' },
      { matlab: 'delete(gcp)', python: '# pool auto-closes at context exit', note: 'No action needed with joblib' },
      { matlab: 'parfeval(@f, 1, args)', python: "from concurrent.futures import ProcessPoolExecutor\\nexecutor.submit(f, *args)", note: 'Future-based async execution' },
      { matlab: 'fetchOutputs(future)', python: 'future.result()' },
      { matlab: 'spmd\\n    ...\\nend', python: 'Use multiprocessing.Pool with explicit worker rank', note: 'Rarely a direct port — redesign is usually cleaner' },
      { matlab: 'labindex', python: 'rank from multiprocessing.current_process() or explicit arg' },
      { matlab: 'numlabs', python: "os.cpu_count() or pool size" },
      { matlab: 'gcp (get current pool)', python: '# implicit in joblib' },
      { matlab: 'distributed(X)', python: 'dask.array.from_array(X, chunks=...)', note: 'For data too large for RAM' },
      { matlab: 'gather(D)', python: 'D.compute()  # dask', note: 'Materialize a dask array to numpy' },
      { matlab: 'batch(script)', python: "subprocess.run(['python', script])", note: 'Fire-and-forget background job' },
    ],
  },

  // ── Symbolic Math ────────────────────────────────────────

  {
    slug: 'symbolic-math',
    name: 'Symbolic Math',
    matlabName: 'Symbolic Math Toolbox',
    pythonLib: 'sympy',
    installCmd: 'pip install sympy',
    description: "Symbolic algebra — solve equations, simplify expressions, compute derivatives and integrals. sympy is a nearly-complete functional superset of MATLAB's Symbolic Math Toolbox, including LaTeX rendering in Jupyter. Most one-liners port directly.",
    autoConverted: true,
    mappings: [
      { matlab: "syms x y", python: "x, y = sp.symbols('x y')", note: "Explicit 'import sympy as sp' first" },
      { matlab: "f = x^2 + 3*x + 2", python: "f = x**2 + 3*x + 2", note: 'sympy uses Python ** not ^' },
      { matlab: 'diff(f, x)', python: 'sp.diff(f, x)' },
      { matlab: 'diff(f, x, 2)', python: 'sp.diff(f, x, 2)', note: 'Second derivative' },
      { matlab: 'int(f, x)', python: 'sp.integrate(f, x)', note: 'Indefinite integral' },
      { matlab: 'int(f, x, 0, 1)', python: 'sp.integrate(f, (x, 0, 1))', note: 'Definite integral — tuple form' },
      { matlab: 'solve(f == 0, x)', python: 'sp.solve(f, x)', note: 'Implicitly solves for zeros' },
      { matlab: 'solve([f1; f2], [x; y])', python: 'sp.solve([f1, f2], [x, y])', note: 'System of equations' },
      { matlab: 'simplify(f)', python: 'sp.simplify(f)' },
      { matlab: 'expand(f)', python: 'sp.expand(f)' },
      { matlab: 'factor(f)', python: 'sp.factor(f)' },
      { matlab: 'collect(f, x)', python: 'sp.collect(f, x)' },
      { matlab: 'subs(f, x, 2)', python: 'f.subs(x, 2)' },
      { matlab: 'subs(f, [x, y], [1, 2])', python: 'f.subs([(x, 1), (y, 2)])' },
      { matlab: 'limit(f, x, 0)', python: 'sp.limit(f, x, 0)' },
      { matlab: 'taylor(f, x, Order=5)', python: 'sp.series(f, x, 0, 5).removeO()' },
      { matlab: 'jacobian([f1; f2], [x; y])', python: 'sp.Matrix([f1, f2]).jacobian([x, y])' },
      { matlab: 'latex(f)', python: 'sp.latex(f)' },
      { matlab: 'vpa(pi, 50)', python: 'sp.N(sp.pi, 50)', note: 'Arbitrary-precision numeric' },
      { matlab: 'double(f)', python: 'float(f)  # or sp.N(f)' },
    ],
  },

  // ── Database ─────────────────────────────────────────────

  {
    slug: 'database',
    name: 'Database',
    matlabName: 'Database Toolbox',
    pythonLib: 'SQLAlchemy + pandas',
    installCmd: 'pip install sqlalchemy pandas pyodbc  # pyodbc for SQL Server, psycopg2 for Postgres, PyMySQL for MySQL',
    description: "Connect to SQL databases and run queries. Python's SQL ecosystem is richer than MATLAB's: SQLAlchemy for ORM and connection management, pandas.read_sql for tabular queries, DBAPI drivers for each engine. Migration is usually an improvement.",
    autoConverted: false,
    mappings: [
      { matlab: "conn = database(dsn, user, pwd)", python: "from sqlalchemy import create_engine\\nengine = create_engine('postgresql://user:pwd@host/db')", note: 'Connection URL format per DB' },
      { matlab: "conn = database('', user, pwd, driver, url)", python: 'create_engine(url)', note: 'SQLAlchemy encodes driver in the URL' },
      { matlab: "close(conn)", python: 'engine.dispose()', note: 'Or use context manager' },
      { matlab: "data = fetch(conn, 'SELECT * FROM t')", python: "import pandas as pd\\ndata = pd.read_sql('SELECT * FROM t', engine)", note: 'Returns a DataFrame' },
      { matlab: "curs = exec(conn, 'SELECT ...')", python: "result = engine.execute('SELECT ...')  # or session.execute()" },
      { matlab: "data = fetch(curs)", python: 'rows = result.fetchall()' },
      { matlab: "sqlwrite(conn, 'tbl', tableData)", python: "df.to_sql('tbl', engine, if_exists='append', index=False)", note: 'pandas writes DataFrames to SQL' },
      { matlab: "insert(conn, 'tbl', cols, vals)", python: "engine.execute(t.insert().values(...))", note: 'SQLAlchemy Core' },
      { matlab: "update(conn, 'tbl', cols, vals, 'WHERE ...')", python: "engine.execute(t.update().where(...).values(...))" },
      { matlab: 'sqlread', python: "pd.read_sql_table('tbl', engine)" },
      { matlab: "runstoredprocedure(conn, 'sp', args)", python: "engine.execute(text('EXEC sp :a :b'), a=..., b=...)" },
      { matlab: 'istable(conn, name)', python: "engine.dialect.has_table(engine.connect(), name)" },
      { matlab: 'get(conn, "AutoCommit")', python: "engine.execution_options(autocommit=True)" },
    ],
  },
]

export function getToolbox(slug: string): ToolboxInfo | undefined {
  return TOOLBOXES.find(t => t.slug === slug)
}
