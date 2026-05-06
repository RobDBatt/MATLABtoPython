% Find indices
x = [1, -2, 3, -4, 5, -6, 7];
positive_idx = find(x > 0);
first_neg = find(x < 0, 1, 'first');
last_neg = find(x < 0, 1, 'last');
positive_vals = x(positive_idx);
count_pos = length(positive_idx);
