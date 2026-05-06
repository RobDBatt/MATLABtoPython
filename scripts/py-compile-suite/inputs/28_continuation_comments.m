%% Section A: Setup
% Initialize parameters
N = 1000;       % number of samples
fs = 44100;     % sample rate in Hz
f = 440;        % frequency in Hz

%% Section B: Generate signal
t = (0:N-1) / fs;
signal = sin(2*pi*f*t) + ...
         0.5*sin(2*pi*2*f*t) + ...
         0.25*sin(2*pi*3*f*t);

%% Section C: Compute RMS
rms_val = sqrt(mean(signal.^2));
