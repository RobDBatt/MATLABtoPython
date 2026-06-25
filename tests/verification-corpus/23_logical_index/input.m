% logical indexing
v = [5 -3 8 -1 2];
p = v(v > 0);
fprintf('%d\n', numel(p));
