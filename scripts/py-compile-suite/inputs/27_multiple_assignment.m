% Multiple return value unpacking
A = magic(5);
[m, n] = size(A);
[max_val, max_idx] = max(A(:));
[min_val, min_idx] = min(A(:));
[U, S, V] = svd(A);
[~, peak_idx] = max(A(1, :));
