export const article = {
  slug: 'matlab-image-processing-to-scikit-image',
  title: 'MATLAB Image Processing Toolbox to Python: Complete scikit-image Guide',
  description: 'Convert MATLAB Image Processing Toolbox functions to Python. imresize, imfilter, edge detection, morphology — mapped to scikit-image and OpenCV with working code.',
  publishedAt: '2026-05-09',
  keyword: 'matlab image processing toolbox python',
  sections: [
    {
      heading: 'The core substitution: scikit-image, OpenCV, and Pillow',
      body: `MATLAB's Image Processing Toolbox maps to three Python libraries depending on what you're doing:

| MATLAB Toolbox | Python equivalent | When to use it |
|---|---|---|
| Image Processing Toolbox | **scikit-image** | Filtering, morphology, segmentation, feature detection |
| Image Processing Toolbox | **OpenCV (cv2)** | Real-time processing, video, camera pipelines |
| Basic image I/O | **Pillow (PIL)** | Reading/writing common formats, basic transforms |
| Any array math on images | **NumPy** | Pixel math, masking, slicing |

For most scientific and research code that used MATLAB's Image Processing Toolbox, scikit-image is the closest drop-in. Install both:

\`\`\`bash
pip install scikit-image opencv-python pillow numpy
\`\`\`

The imports you'll use most:

\`\`\`python
import numpy as np
from skimage import io, filters, morphology, feature, measure, transform
from skimage import color, exposure, segmentation
import cv2  # when you need OpenCV specifically
\`\`\``,
    },
    {
      heading: 'Reading, writing, and displaying images',
      body: `MATLAB's \`imread\` / \`imshow\` / \`imwrite\` map directly:

\`\`\`matlab
% MATLAB
img = imread('photo.png');
imshow(img);
imwrite(img, 'output.png');
\`\`\`

\`\`\`python
# Python — scikit-image
from skimage import io
import matplotlib.pyplot as plt

img = io.imread('photo.png')          # returns numpy array, shape (H, W, C)
plt.imshow(img)
plt.axis('off')
plt.show()
io.imsave('output.png', img)
\`\`\`

**Key difference:** MATLAB images are 1-indexed matrices; NumPy arrays are 0-indexed. A pixel at row 5, column 10 in MATLAB is \`img(5, 10)\`; in Python it's \`img[4, 9]\`.

**Data types matter:** MATLAB \`imread\` returns \`uint8\` (0–255). scikit-image functions typically expect float images in [0, 1]. Use \`skimage.img_as_float\` to convert:

\`\`\`python
from skimage import img_as_float, img_as_ubyte

img_float = img_as_float(img)   # uint8 → float64 in [0.0, 1.0]
img_uint8 = img_as_ubyte(img_float)  # float64 → uint8
\`\`\``,
    },
    {
      heading: 'Resizing, rotating, and geometric transforms',
      body: `\`\`\`matlab
% MATLAB
resized = imresize(img, 0.5);              % scale by 0.5
resized2 = imresize(img, [256 256]);       % resize to 256x256
rotated = imrotate(img, 45);              % rotate 45 degrees
flipped = fliplr(img);                    % horizontal flip
\`\`\`

\`\`\`python
# Python
from skimage.transform import resize, rotate
import numpy as np

resized = resize(img, (img.shape[0]//2, img.shape[1]//2),
                 anti_aliasing=True)
resized2 = resize(img, (256, 256), anti_aliasing=True)
rotated = rotate(img, 45, resize=False)   # resize=True to avoid clipping
flipped = np.fliplr(img)                  # horizontal flip — plain NumPy
\`\`\`

**Note:** \`skimage.transform.resize\` returns a float64 array in [0, 1] by default. Use \`preserve_range=True\` to keep the original dtype and range.

For affine transforms, use \`skimage.transform.AffineTransform\` + \`warp\`, or \`cv2.warpAffine\` if you prefer OpenCV's interface.`,
    },
    {
      heading: 'Filtering: Gaussian, median, and custom kernels',
      body: `Spatial filtering is where most image processing code spends its time:

\`\`\`matlab
% MATLAB
blurred = imgaussfilt(img, 2);            % Gaussian, sigma=2
med = medfilt2(img, [5 5]);              % 5x5 median filter
sharpened = imsharpen(img);
custom = imfilter(img, fspecial('sobel'));
\`\`\`

\`\`\`python
# Python
from skimage import filters
from scipy.ndimage import median_filter, convolve

blurred = filters.gaussian(img, sigma=2)
med = median_filter(img, size=5)         # scipy for 3D-safe median

# Sharpening: unsharp mask
sharpened = filters.unsharp_mask(img, radius=1, amount=1.0)

# Custom kernel: Sobel
from skimage.filters import sobel
edges = sobel(img)                       # already built-in

# Or apply any custom kernel with scipy:
import numpy as np
from scipy.ndimage import convolve
kernel = np.array([[-1,-1,-1],[-1,8,-1],[-1,-1,-1]])
filtered = convolve(img.astype(float), kernel)
\`\`\`

**Important:** For color images, apply filters to each channel or convert to grayscale first:

\`\`\`python
from skimage.color import rgb2gray
gray = rgb2gray(img)   # returns float64 in [0, 1]
edges = filters.sobel(gray)
\`\`\``,
    },
    {
      heading: 'Edge detection and feature extraction',
      body: `\`\`\`matlab
% MATLAB
edges_canny = edge(gray_img, 'Canny');
edges_sobel = edge(gray_img, 'Sobel');
edges_prewitt = edge(gray_img, 'Prewitt');
corners = detectHarrisFeatures(gray_img);
\`\`\`

\`\`\`python
# Python
from skimage import feature, filters
from skimage.color import rgb2gray

gray = rgb2gray(img)

# Canny
edges_canny = feature.canny(gray, sigma=1.0,
                              low_threshold=0.1, high_threshold=0.2)

# Sobel (magnitude)
edges_sobel = filters.sobel(gray)

# Prewitt
edges_prewitt = filters.prewitt(gray)

# Harris corners
harris = feature.corner_harris(gray)
coords = feature.corner_peaks(harris, min_distance=5)
# coords[:, 0] are row indices, coords[:, 1] are column indices
\`\`\`

For feature descriptors (SIFT, ORB), use OpenCV:

\`\`\`python
import cv2
sift = cv2.SIFT_create()
kp, desc = sift.detectAndCompute(cv2.cvtColor(img, cv2.COLOR_RGB2GRAY), None)
\`\`\``,
    },
    {
      heading: 'Morphological operations',
      body: `MATLAB's \`imerode\`, \`imdilate\`, \`imopen\`, \`imclose\` all have direct equivalents:

\`\`\`matlab
% MATLAB
se = strel('disk', 5);
eroded = imerode(binary_img, se);
dilated = imdilate(binary_img, se);
opened = imopen(binary_img, se);
closed = imclose(binary_img, se);
filled = imfill(binary_img, 'holes');
\`\`\`

\`\`\`python
# Python
from skimage import morphology
from scipy.ndimage import binary_fill_holes
import numpy as np

# Create structuring element
disk = morphology.disk(5)           # equivalent to strel('disk', 5)
square = morphology.square(5)       # strel('square', 5)

eroded  = morphology.binary_erosion(binary_img, disk)
dilated = morphology.binary_dilation(binary_img, disk)
opened  = morphology.binary_opening(binary_img, disk)
closed  = morphology.binary_closing(binary_img, disk)
filled  = binary_fill_holes(binary_img)  # scipy
\`\`\`

For grayscale morphology, use \`morphology.erosion\` and \`morphology.dilation\` (without the \`binary_\` prefix).`,
    },
    {
      heading: 'Region properties and connected components',
      body: `MATLAB's \`bwconncomp\`, \`regionprops\`, and \`labelmatrix\` have a clean Python equivalent:

\`\`\`matlab
% MATLAB
cc = bwconncomp(binary_img);
stats = regionprops(cc, 'Area', 'Centroid', 'BoundingBox');
areas = [stats.Area];
centroids = cat(1, stats.Centroid);
\`\`\`

\`\`\`python
# Python
from skimage import measure

labeled = measure.label(binary_img)            # connected-component labeling
regions = measure.regionprops(labeled)

areas = [r.area for r in regions]
centroids = [r.centroid for r in regions]      # (row, col) in 0-based coords
bboxes = [r.bbox for r in regions]            # (min_row, min_col, max_row, max_col)

# Filter by area
large = [r for r in regions if r.area > 100]
\`\`\`

Every \`RegionProperties\` object exposes: \`area\`, \`centroid\`, \`bbox\`, \`eccentricity\`, \`perimeter\`, \`major_axis_length\`, \`minor_axis_length\`, and more. Check \`skimage.measure.regionprops\` docs for the full list.`,
    },
    {
      heading: 'Colour space conversions',
      body: `\`\`\`matlab
% MATLAB
gray = rgb2gray(img);
hsv_img = rgb2hsv(img);
lab_img = rgb2lab(img);
\`\`\`

\`\`\`python
# Python
from skimage import color

gray    = color.rgb2gray(img)         # float64 in [0, 1]
hsv_img = color.rgb2hsv(img)
lab_img = color.rgb2lab(img)          # L in [0,100], a/b in [-128,127]
ycbcr   = color.rgb2ycbcr(img)
\`\`\`

**Watch out for channel order:** OpenCV uses BGR; scikit-image and MATLAB use RGB. When mixing the two:

\`\`\`python
import cv2
img_bgr = cv2.imread('photo.png')          # OpenCV reads as BGR
img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)  # convert for skimage
\`\`\``,
    },
    {
      heading: 'Convert your image processing code now',
      body: `Most MATLAB Image Processing Toolbox code translates to scikit-image with minimal structural changes — the functions map almost one-to-one. The main friction points are:

1. **0-based vs 1-based indexing** — pixel \`(r, c)\` in MATLAB is \`img[r-1, c-1]\` in Python
2. **Float vs uint8** — scikit-image functions prefer float [0, 1]; convert explicitly with \`img_as_float\`
3. **Channel order** — RGB everywhere (never BGR unless you're using OpenCV directly)
4. **Structuring elements** — \`strel('disk', r)\` → \`morphology.disk(r)\`

Paste your MATLAB image processing code into the [free converter at mtopython.com/convert](/convert) to get Python output in under a second. The converter maps \`imread\`, \`imresize\`, \`imfilter\`, \`imerode\`, \`imdilate\`, and all common toolbox functions automatically.`,
    },
  ],
}
