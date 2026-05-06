% Matrix operations with transpose
A = [1 2 3; 4 5 6; 7 8 9];
B = A';
C = A * B;
D = A + A;
E = A - eye(3);
F = A \ ones(3, 1);
trace_val = trace(A);
det_val = det(A);
