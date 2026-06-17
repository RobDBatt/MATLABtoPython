% Self-contained: repmat tiles a small matrix, then reduce over it.
A = [1 2; 3 4];
B = repmat(A, 2, 3);
s = sum(B(:));
fprintf('rows=%d cols=%d sum=%d\n', size(B, 1), size(B, 2), s);
