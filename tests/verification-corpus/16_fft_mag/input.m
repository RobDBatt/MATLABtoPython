% fft magnitude spectrum
t = linspace(0, 1, 8);
x = sin(2*pi*2*t);
Y = fft(x);
P = abs(Y);
fprintf('%d\n', numel(P));
