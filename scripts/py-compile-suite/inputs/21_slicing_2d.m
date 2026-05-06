% 2D slicing and reshaping
A = reshape(1:24, [4, 6]);
row1 = A(1, :);
col2 = A(:, 2);
submat = A(1:2, 3:5);
last_row = A(end, :);
last_col = A(:, end);
A_flat = A(:);
