export const article = {
  slug: 'matlab-plot-to-matplotlib',
  title: 'MATLAB plot() to matplotlib: Side-by-Side Reference with Every Option',
  description: 'Convert MATLAB plotting code to matplotlib line by line. Covers plot, subplot, legends, labels, line styles, colorbars, 3D plots, and the differences that catch engineers off guard.',
  publishedAt: '2026-04-17',
  keyword: 'matlab plot to matplotlib',
  sections: [
    {
      heading: 'Core plotting: the 90% case',
      body: `Every MATLAB plot starts with \`plot(x, y)\`. Same function name in Python, different import:

\`\`\`matlab
x = 0:0.1:10;
y = sin(x);
plot(x, y)
xlabel('time')
ylabel('amplitude')
title('Sine wave')
grid on
\`\`\`

\`\`\`python
import numpy as np
import matplotlib.pyplot as plt

x = np.arange(0, 10.1, 0.1)
y = np.sin(x)
plt.plot(x, y)
plt.xlabel('time')
plt.ylabel('amplitude')
plt.title('Sine wave')
plt.grid(True)
plt.show()   # MATLAB shows automatically; matplotlib needs this
\`\`\`

The biggest surprise for MATLAB users is that last line. Matplotlib accumulates plot commands silently and renders only when \`plt.show()\` is called (or in a Jupyter notebook's next cell). In MATLAB, plots appear immediately. Forget \`plt.show()\` and your script runs to completion with nothing on screen.`,
    },
    {
      heading: 'Line style and color shortcuts',
      body: `MATLAB's compact format string (\`'r--'\`) works identically in matplotlib:

| MATLAB | matplotlib | Meaning |
|---|---|---|
| \`plot(x, y, 'r')\` | \`plt.plot(x, y, 'r')\` | Red solid |
| \`plot(x, y, 'r--')\` | \`plt.plot(x, y, 'r--')\` | Red dashed |
| \`plot(x, y, 'b-.')\` | \`plt.plot(x, y, 'b-.')\` | Blue dash-dot |
| \`plot(x, y, 'ko')\` | \`plt.plot(x, y, 'ko')\` | Black circles |
| \`plot(x, y, 'g^')\` | \`plt.plot(x, y, 'g^')\` | Green triangles |

The style codes (\`-\`, \`--\`, \`-.\`, \`:\`, \`o\`, \`s\`, \`^\`, \`d\`) are MATLAB-compatible. The color codes (\`r\`, \`g\`, \`b\`, \`c\`, \`m\`, \`y\`, \`k\`, \`w\`) are identical.`,
    },
    {
      heading: 'Named arguments',
      body: `MATLAB's name-value pairs become matplotlib keyword arguments:

| MATLAB | matplotlib |
|---|---|
| \`'LineWidth', 2\` | \`linewidth=2\` |
| \`'MarkerSize', 8\` | \`markersize=8\` |
| \`'MarkerFaceColor', 'r'\` | \`markerfacecolor='r'\` |
| \`'Color', [0.2 0.5 0.8]\` | \`color=(0.2, 0.5, 0.8)\` |
| \`'DisplayName', 'series 1'\` | \`label='series 1'\` |

Example:
\`\`\`matlab
plot(x, y, 'r', 'LineWidth', 2, 'DisplayName', 'measured')
\`\`\`

\`\`\`python
plt.plot(x, y, 'r', linewidth=2, label='measured')
\`\`\`

Key naming differences: MATLAB uses \`DisplayName\` for the legend label; matplotlib uses \`label\`. MATLAB uses \`Color\` with a 3-element RGB vector in [0,1]; matplotlib uses \`color\` with a tuple or hex string.`,
    },
    {
      heading: 'Subplots',
      body: `MATLAB's \`subplot(m, n, p)\` picks the p-th cell of an m×n grid. Matplotlib has two styles — the simple one matches MATLAB closely:

\`\`\`matlab
subplot(2, 2, 1); plot(x, y1); title('A')
subplot(2, 2, 2); plot(x, y2); title('B')
subplot(2, 2, 3); plot(x, y3); title('C')
subplot(2, 2, 4); plot(x, y4); title('D')
\`\`\`

\`\`\`python
plt.subplot(2, 2, 1); plt.plot(x, y1); plt.title('A')
plt.subplot(2, 2, 2); plt.plot(x, y2); plt.title('B')
plt.subplot(2, 2, 3); plt.plot(x, y3); plt.title('C')
plt.subplot(2, 2, 4); plt.plot(x, y4); plt.title('D')
\`\`\`

Or the object-oriented style, which is the matplotlib idiom:
\`\`\`python
fig, axes = plt.subplots(2, 2)
axes[0, 0].plot(x, y1); axes[0, 0].set_title('A')
axes[0, 1].plot(x, y2); axes[0, 1].set_title('B')
axes[1, 0].plot(x, y3); axes[1, 0].set_title('C')
axes[1, 1].plot(x, y4); axes[1, 1].set_title('D')
\`\`\`

Our converter produces the first form (MATLAB-shaped) because it preserves the structure 1:1. Users who want the OO form usually refactor after conversion.`,
    },
    {
      heading: 'hold on / hold off',
      body: `MATLAB requires \`hold on\` to prevent each \`plot()\` call from erasing the previous one:

\`\`\`matlab
plot(x, y1, 'r')
hold on
plot(x, y2, 'b')
hold off
\`\`\`

Matplotlib **always** accumulates plots on the current axes — \`hold on\` is the default. Our converter comments out \`hold on\`/\`hold off\` because they have no Python equivalent:

\`\`\`python
plt.plot(x, y1, 'r')
# hold on removed — matplotlib accumulates plots by default
plt.plot(x, y2, 'b')
# hold off removed
\`\`\`

If you ever need to clear the current axes (rare), use \`plt.cla()\`.`,
    },
    {
      heading: 'Legend',
      body: `\`\`\`matlab
plot(x, y1, 'r')
plot(x, y2, 'b')
legend('series 1', 'series 2', 'Location', 'northeast')
\`\`\`

\`\`\`python
plt.plot(x, y1, 'r', label='series 1')
plt.plot(x, y2, 'b', label='series 2')
plt.legend(loc='upper right')
\`\`\`

Two differences matter:

1. Matplotlib prefers you attach labels at plot time via \`label=\`, then call \`plt.legend()\` with no args. MATLAB takes labels as positional args to \`legend()\` itself.
2. Location naming differs: MATLAB uses \`'northeast'\`, matplotlib uses \`'upper right'\`. Our converter translates these:

| MATLAB \`Location\` | matplotlib \`loc\` |
|---|---|
| \`'north'\` | \`'upper center'\` |
| \`'south'\` | \`'lower center'\` |
| \`'east'\` | \`'center right'\` |
| \`'west'\` | \`'center left'\` |
| \`'northeast'\` | \`'upper right'\` |
| \`'northwest'\` | \`'upper left'\` |
| \`'southeast'\` | \`'lower right'\` |
| \`'southwest'\` | \`'lower left'\` |
| \`'best'\` | \`'best'\` |`,
    },
    {
      heading: 'Axes labels, title, limits',
      body: `Simple case, same function names:
\`\`\`matlab
xlabel('time (s)')
ylabel('amplitude')
title('My signal')
\`\`\`

\`\`\`python
plt.xlabel('time (s)')
plt.ylabel('amplitude')
plt.title('My signal')
\`\`\`

Axis limits differ slightly:
| MATLAB | matplotlib |
|---|---|
| \`axis([xmin xmax ymin ymax])\` | \`plt.axis([xmin, xmax, ymin, ymax])\` |
| \`xlim([a b])\` | \`plt.xlim(a, b)\` or \`plt.xlim([a, b])\` |
| \`ylim([a b])\` | \`plt.ylim(a, b)\` |
| \`axis equal\` | \`plt.axis('equal')\` |
| \`axis tight\` | \`plt.axis('tight')\` |
| \`grid on\` | \`plt.grid(True)\` |`,
    },
    {
      heading: 'Colormaps and colorbars',
      body: `\`\`\`matlab
imagesc(A)
colormap(jet)
colorbar
\`\`\`

\`\`\`python
plt.imshow(A, cmap='jet', aspect='auto')
plt.colorbar()
\`\`\`

The MATLAB names \`jet\`, \`parula\`, \`hsv\`, \`hot\`, \`cool\`, \`gray\` all exist in matplotlib as string names. Parula is MATLAB's default; matplotlib's default is \`viridis\`. You can still request \`'parula'\` explicitly.

Note: MATLAB's \`imagesc\` auto-scales to the data range; matplotlib's \`imshow\` does too by default, but uses 'equal' aspect. Add \`aspect='auto'\` if you want the MATLAB appearance.`,
    },
    {
      heading: '3D plots',
      body: `\`\`\`matlab
surf(X, Y, Z)
mesh(X, Y, Z)
\`\`\`

\`\`\`python
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401 (needed for 3d projection)
fig = plt.figure()
ax = fig.add_subplot(111, projection='3d')
ax.plot_surface(X, Y, Z, cmap='viridis')
# or ax.plot_wireframe(X, Y, Z) for mesh
\`\`\`

More ceremony in matplotlib — 3D plotting requires explicit axes creation. MATLAB treats 3D as a plot-type choice; matplotlib treats it as an axes-projection choice.`,
    },
    {
      heading: 'Saving figures',
      body: `\`\`\`matlab
saveas(gcf, 'output.png')
print('output', '-dpng', '-r300')
\`\`\`

\`\`\`python
plt.savefig('output.png', dpi=300)
\`\`\`

Matplotlib infers the format from the filename extension (png, pdf, svg, eps). The \`dpi\` argument controls resolution. Matplotlib figures are usually higher quality than MATLAB defaults; dpi 150 is often enough.`,
    },
    {
      heading: 'Common gotchas',
      body: `Things that catch MATLAB users the first time:

1. **You need \`plt.show()\` in scripts.** MATLAB displays plots as side effects; matplotlib buffers until told. In Jupyter notebooks, inline display usually just works.
2. **\`plt.figure()\` creates a new figure.** In MATLAB, \`figure\` without args makes a new window. Same in matplotlib.
3. **Axis direction.** \`imshow\` puts row 0 at the top (image convention). \`imagesc\` in MATLAB does the same. If you're plotting a matrix where rows should increase upward, add \`plt.gca().invert_yaxis()\` or use \`origin='lower'\` in \`imshow\`.
4. **Legends auto-hide if empty.** If no plot has a \`label=\`, \`plt.legend()\` silently does nothing. MATLAB would error.
5. **Closing figures.** \`plt.close()\` closes the current figure, \`plt.close('all')\` closes all. Matches MATLAB's \`close\` and \`close all\`.

[The converter](/convert) handles all the syntax translations in this article automatically, including the subtle ones like \`DisplayName\` → \`label\` and \`'northeast'\` → \`'upper right'\`. The \`plt.show()\` call is appended to the end of the script where appropriate.`,
    },
  ],
}
