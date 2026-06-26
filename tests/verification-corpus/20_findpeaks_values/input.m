% findpeaks values + locations
x = [0 2 0 4 0 6 0];
[pks, locs] = findpeaks(x);
fprintf('%d\n', numel(pks));
