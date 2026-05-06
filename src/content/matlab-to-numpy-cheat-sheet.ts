export const article = {
  slug: 'matlab-to-numpy-cheat-sheet',
  title: 'MATLAB to NumPy/SciPy Cheat Sheet: Every Common Function Mapped',
  description: 'The complete side-by-side reference for converting MATLAB operations to Python. Array creation, math, linear algebra, indexing, plotting — all in one page.',
  publishedAt: '2026-04-13',
  keyword: 'matlab to numpy equivalent',
  sections: [
    {
      heading: 'How to use this cheat sheet',
      body: `This is a practical reference for engineers migrating MATLAB code to Python. Every entry shows the MATLAB syntax on the left and the exact Python equivalent on the right, including the required import.

Bookmark this page. You will come back to it.

For automated conversion of entire files, paste your MATLAB code into our converter — it applies all of these mappings automatically and flags anything that needs manual review.`,
    },
    {
      heading: 'Array creation',
      body: `\`zeros(3,4)\` → \`np.zeros((3, 4))\`
\`ones(3,4)\` → \`np.ones((3, 4))\`
\`eye(5)\` → \`np.eye(5)\`
\`rand(3,4)\` → \`np.random.rand(3, 4)\`
\`randn(3,4)\` → \`np.random.randn(3, 4)\`
\`linspace(0,1,100)\` → \`np.linspace(0, 1, 100)\`
\`logspace(1,3,50)\` → \`np.logspace(1, 3, 50)\`
\`meshgrid(x,y)\` → \`np.meshgrid(x, y)\`
\`diag(v)\` → \`np.diag(v)\`
\`repmat(A,m,n)\` → \`np.tile(A, (m, n))\`
\`[1 2 3; 4 5 6]\` → \`np.array([[1, 2, 3], [4, 5, 6]])\`
\`1:10\` → \`np.arange(1, 11)\` (note: Python excludes the end value)
\`1:0.5:10\` → \`np.arange(1, 10.5, 0.5)\`

All of these require \`import numpy as np\`.`,
    },
    {
      heading: 'Array info and size',
      body: `\`size(A)\` → \`A.shape\`
\`size(A,1)\` → \`A.shape[0]\` (note: 0-indexed in Python)
\`size(A,2)\` → \`A.shape[1]\`
\`length(A)\` → \`max(A.shape)\` or \`len(A)\` for 1D
\`numel(A)\` → \`A.size\`
\`ndims(A)\` → \`A.ndim\`
\`isempty(A)\` → \`len(A) == 0\` or \`A.size == 0\``,
    },
    {
      heading: 'Indexing',
      body: `**The #1 gotcha: MATLAB is 1-based, Python is 0-based.**

\`A(1)\` → \`A[0]\` (first element)
\`A(end)\` → \`A[-1]\` (last element)
\`A(end-1)\` → \`A[-2]\`
\`A(2:5)\` → \`A[1:5]\` (elements 2 through 5)
\`A(1:end-1)\` → \`A[:-1]\` (all but last)
\`A(:)\` → \`A.flatten()\`
\`A(i,j)\` → \`A[i-1, j-1]\`
\`A(:,j)\` → \`A[:, j-1]\`
\`A(i,:)\` → \`A[i-1, :]\`
\`A(A>5)\` → \`A[A > 5]\` (logical indexing — no shift needed)
\`A(mask)\` → \`A[mask]\``,
    },
    {
      heading: 'Operators',
      body: `**Element-wise operations:**
\`A .* B\` → \`A * B\`
\`A ./ B\` → \`A / B\`
\`A .^ 2\` → \`A ** 2\`

**Matrix operations:**
\`A * B\` (matrix multiply) → \`A @ B\`
\`A'\` (conjugate transpose) → \`A.conj().T\` or \`A.T\` for real
\`A.'\` (transpose) → \`A.T\`
\`A \\ b\` (solve Ax=b) → \`np.linalg.solve(A, b)\`

**Comparison and logical:**
\`~=\` → \`!=\`
\`&&\` → \`and\`
\`||\` → \`or\`
\`&\` → \`&\` (element-wise)
\`|\` → \`|\` (element-wise)
\`~\` → \`not\` or \`~\` (for arrays)`,
    },
    {
      heading: 'Math functions',
      body: `\`abs(x)\` → \`np.abs(x)\`
\`sqrt(x)\` → \`np.sqrt(x)\`
\`exp(x)\` → \`np.exp(x)\`
\`log(x)\` → \`np.log(x)\` (natural log)
\`log2(x)\` → \`np.log2(x)\`
\`log10(x)\` → \`np.log10(x)\`
\`sin(x)\` → \`np.sin(x)\`
\`cos(x)\` → \`np.cos(x)\`
\`tan(x)\` → \`np.tan(x)\`
\`asin(x)\` → \`np.arcsin(x)\`
\`atan2(y,x)\` → \`np.arctan2(y, x)\`
\`ceil(x)\` → \`np.ceil(x)\`
\`floor(x)\` → \`np.floor(x)\`
\`round(x)\` → \`np.round(x)\`
\`mod(a,b)\` → \`np.mod(a, b)\` or \`a % b\`
\`sign(x)\` → \`np.sign(x)\`
\`real(z)\` → \`np.real(z)\`
\`imag(z)\` → \`np.imag(z)\`
\`conj(z)\` → \`np.conj(z)\`
\`angle(z)\` → \`np.angle(z)\``,
    },
    {
      heading: 'Statistics',
      body: `\`mean(x)\` → \`np.mean(x)\`
\`median(x)\` → \`np.median(x)\`
\`std(x)\` → \`np.std(x, ddof=1)\` (ddof=1 to match MATLAB N-1)
\`var(x)\` → \`np.var(x, ddof=1)\`
\`max(x)\` → \`np.max(x)\`
\`min(x)\` → \`np.min(x)\`
\`[val,idx] = max(x)\` → \`val = np.max(x); idx = np.argmax(x)\`
\`sum(x)\` → \`np.sum(x)\`
\`prod(x)\` → \`np.prod(x)\`
\`cumsum(x)\` → \`np.cumsum(x)\`
\`cumprod(x)\` → \`np.cumprod(x)\`
\`sort(x)\` → \`np.sort(x)\`
\`[sorted,idx] = sort(x)\` → \`idx = np.argsort(x); sorted = x[idx]\`
\`unique(x)\` → \`np.unique(x)\`
\`histc(x,edges)\` → \`np.histogram(x, edges)\`
\`prctile(x,p)\` → \`np.percentile(x, p)\`
\`corrcoef(x)\` → \`np.corrcoef(x.T)\` (note: row convention differs)
\`cov(x)\` → \`np.cov(x.T)\` (note: row convention differs)`,
    },
    {
      heading: 'Linear algebra',
      body: `\`inv(A)\` → \`np.linalg.inv(A)\`
\`pinv(A)\` → \`np.linalg.pinv(A)\`
\`det(A)\` → \`np.linalg.det(A)\`
\`rank(A)\` → \`np.linalg.matrix_rank(A)\`
\`norm(A)\` → \`np.linalg.norm(A)\`
\`trace(A)\` → \`np.trace(A)\`
\`[V,D] = eig(A)\` → \`D, V = np.linalg.eig(A)\` (note: unsorted in NumPy)
\`[U,S,V] = svd(A)\` → \`U, S, V = np.linalg.svd(A)\`
\`[Q,R] = qr(A)\` → \`Q, R = np.linalg.qr(A)\`
\`[L,U,P] = lu(A)\` → \`P, L, U = scipy.linalg.lu(A)\` (note: different return order)
\`chol(A)\` → \`np.linalg.cholesky(A)\`
\`cond(A)\` → \`np.linalg.cond(A)\`
\`kron(A,B)\` → \`np.kron(A, B)\`
\`cross(a,b)\` → \`np.cross(a, b)\`
\`dot(a,b)\` → \`np.dot(a, b)\`

Requires \`import numpy as np\` and \`import scipy.linalg\` for lu.`,
    },
    {
      heading: 'FFT',
      body: `\`fft(x)\` → \`np.fft.fft(x)\`
\`ifft(x)\` → \`np.fft.ifft(x)\`
\`fft2(x)\` → \`np.fft.fft2(x)\`
\`fftshift(x)\` → \`np.fft.fftshift(x)\``,
    },
    {
      heading: 'Plotting (matplotlib)',
      body: `\`figure\` → \`plt.figure()\`
\`plot(x,y)\` → \`plt.plot(x, y)\`
\`subplot(m,n,p)\` → \`plt.subplot(m, n, p)\`
\`title('text')\` → \`plt.title('text')\`
\`xlabel('text')\` → \`plt.xlabel('text')\`
\`ylabel('text')\` → \`plt.ylabel('text')\`
\`legend('a','b')\` → \`plt.legend(['a', 'b'])\`
\`grid on\` → \`plt.grid(True)\`
\`hold on\` → not needed (matplotlib accumulates by default)
\`axis equal\` → \`plt.axis('equal')\`
\`close all\` → \`plt.close('all')\`
\`scatter(x,y)\` → \`plt.scatter(x, y)\`
\`histogram(x,30)\` → \`plt.hist(x, 30)\`
\`bar(x,y)\` → \`plt.bar(x, y)\`
\`stem(x,y)\` → \`plt.stem(x, y)\`
\`semilogx(x,y)\` → \`plt.semilogx(x, y)\`
\`loglog(x,y)\` → \`plt.loglog(x, y)\`
\`colorbar\` → \`plt.colorbar()\`
\`savefig('file.png')\` → \`plt.savefig('file.png')\`

Named arguments:
\`'LineWidth', 2\` → \`linewidth=2\`
\`'MarkerSize', 8\` → \`markersize=8\`
\`'FontSize', 14\` → \`fontsize=14\`
\`'Location', 'Best'\` → \`loc='best'\`

Requires \`import matplotlib.pyplot as plt\`.`,
    },
    {
      heading: 'String operations',
      body: `\`strcmp(a,b)\` → \`a == b\`
\`strcmpi(a,b)\` → \`a.lower() == b.lower()\`
\`strcat(a,b)\` → \`a + b\`
\`num2str(x)\` → \`str(x)\`
\`str2num(s)\` → \`float(s)\`
\`sprintf('format',x)\` → \`'format' % (x,)\` or \`f'...{x}'\`
\`strsplit(s,',')\` → \`s.split(',')\`
\`strtrim(s)\` → \`s.strip()\`
\`upper(s)\` → \`s.upper()\`
\`lower(s)\` → \`s.lower()\`
\`contains(s,'sub')\` → \`'sub' in s\`
\`startsWith(s,'pre')\` → \`s.startswith('pre')\`
\`strrep(s,'old','new')\` → \`s.replace('old', 'new')\``,
    },
    {
      heading: 'File I/O',
      body: `\`load('file.mat')\` → \`scipy.io.loadmat('file.mat')\`
\`save('file.mat','var')\` → \`scipy.io.savemat('file.mat', {'var': var})\`
\`csvread('file.csv')\` → \`np.loadtxt('file.csv', delimiter=',')\`
\`csvwrite('file.csv',A)\` → \`np.savetxt('file.csv', A, delimiter=',')\`
\`xlsread('file.xlsx')\` → \`pd.read_excel('file.xlsx')\`
\`fopen(name,'w')\` → \`open(name, 'w')\`
\`fclose(fid)\` → \`fid.close()\`
\`fprintf(fid,'format',x)\` → \`fid.write('format' % (x,))\`
\`fullfile('a','b','c')\` → \`os.path.join('a', 'b', 'c')\`
\`exist('file')\` → \`os.path.exists('file')\`

Requires \`import scipy.io\`, \`import pandas as pd\`, or \`import os\` as needed.`,
    },
    {
      heading: 'Control flow',
      body: `\`for i = 1:10 ... end\` → \`for i in range(10):\`
\`for i = 5:20 ... end\` → \`for i in range(5, 21):\`
\`for i = 1:2:10 ... end\` → \`for i in range(1, 11, 2):\`
\`while cond ... end\` → \`while cond:\`
\`if ... elseif ... else ... end\` → \`if ... elif ... else:\`
\`switch x / case val\` → \`if x == val: / elif x == val2:\`
\`try ... catch ME ... end\` → \`try: ... except Exception as ME:\`
\`break\` → \`break\`
\`continue\` → \`continue\`
\`return\` → \`return\``,
    },
    {
      heading: 'Constants',
      body: `\`pi\` → \`np.pi\`
\`NaN\` → \`np.nan\`
\`Inf\` → \`np.inf\`
\`eps\` → \`np.finfo(float).eps\`
\`true\` → \`True\`
\`false\` → \`False\`
\`1i\` → \`1j\` (imaginary unit)`,
    },
    {
      heading: 'Use the converter',
      body: `This cheat sheet covers the most common mappings. For a complete file conversion with automatic import injection, index shifting, toolbox detection, and a compatibility report, paste your MATLAB code into the converter. Free for 50 lines.`,
    },
  ],
}
