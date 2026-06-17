% Self-contained: a MATLAB path command is a no-op; the rest must still run.
addpath(genpath(pwd));
x = 3;
y = x^2;
fprintf('y=%d\n', y);
