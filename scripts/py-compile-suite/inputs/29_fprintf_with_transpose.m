% The tricky case: fprintf with format specifiers + transpose in same statement
A = [1 2 3; 4 5 6];
v = [10; 20; 30];
fprintf(1, 'A size: %d x %d\n', size(A));
fprintf('column vector: %s\n', mat2str(v));
row = v';
fprintf('row vector: %s\n', mat2str(row));
B = A';
fprintf('transposed A has %d rows\n', size(B, 1));
result = A*v;
fprintf('product = [%d %d]\n', result(1), result(2));
