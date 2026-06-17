% Self-contained: multi-line matrix literal with the opening `[` on its own
% line. Must build a clean 2x3 array (no spurious empty rows).
M = [
    1 2 3
    4 5 6
];
s = sum(M(:));
fprintf('rows=%d cols=%d sum=%d\n', size(M, 1), size(M, 2), s);
