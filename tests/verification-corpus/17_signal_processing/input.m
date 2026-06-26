% Signal Processing Toolbox: butter + filter + fft + findpeaks
fs = 100;
t = linspace(0, 1, fs);
x = sin(2*pi*5*t) + 0.5 * sin(2*pi*20*t);
[b, a] = butter(4, 0.3);
y = filter(b, a, x);
Y = abs(fft(y));
[pks, locs] = findpeaks(x);
fprintf('peaks=%d\n', numel(pks));
