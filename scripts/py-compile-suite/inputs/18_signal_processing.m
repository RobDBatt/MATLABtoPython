% Signal processing toolbox
fs = 1000;
t = 0:1/fs:1;
x = sin(2*pi*50*t) + 0.5*randn(size(t));
[b, a] = butter(4, 100/(fs/2));
y = filtfilt(b, a, x);
N = length(x);
X = fft(x);
f = fs*(0:(N/2))/N;
P = abs(X/N);
