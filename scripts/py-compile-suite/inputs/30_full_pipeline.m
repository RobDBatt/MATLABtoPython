function [peaks, locs] = findpeaks_demo(signal, fs, threshold)
    % Find local peaks above a threshold
    N = length(signal);
    dt = 1/fs;
    t = (0:N-1) * dt;

    % Smooth with a lowpass filter
    [b, a] = butter(4, 0.3);
    filtered = filtfilt(b, a, signal);

    % Scan for local maxima above threshold
    peaks = [];
    locs = [];
    for i = 2:N-1
        if filtered(i) > filtered(i-1) && filtered(i) > filtered(i+1)
            if filtered(i) > threshold
                peaks = [peaks, filtered(i)];
                locs = [locs, t(i)];
            end
        end
    end

    % Plot the result
    figure;
    plot(t, signal, 'b', 'LineWidth', 0.5);
    hold on;
    plot(locs, peaks, 'rv', 'MarkerSize', 8);
    title(sprintf('Found %d peaks above %.2f', length(peaks), threshold));
    xlabel('Time (s)');
    ylabel('Amplitude');
    grid on;
    legend('Signal', 'Peaks', 'Location', 'Best');
end
