% fprintf and sprintf
x = 3.14159;
y = 42;
name = 'Alice';
fprintf('x = %.3f\n', x);
fprintf('y = %d\n', y);
fprintf('%s has %d apples\n', name, y);
fprintf(1, 'stdout: %f\n', x);
msg = sprintf('The value is %g', x);
disp(msg);
