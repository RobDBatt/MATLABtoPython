% Sort and unique
x = [5, 3, 8, 1, 9, 3, 5, 2, 8];
sorted_asc = sort(x);
sorted_desc = sort(x, 'descend');
[sorted_vals, idx] = sort(x);
unique_vals = unique(x);
n_unique = length(unique_vals);
