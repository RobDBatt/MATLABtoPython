% Plotting with matplotlib-equivalent features
t = linspace(0, 2*pi, 200);
y1 = sin(t);
y2 = cos(t);
figure;
plot(t, y1, 'b', 'LineWidth', 1.5);
hold on;
plot(t, y2, 'r--', 'LineWidth', 1.5);
xlabel('t');
ylabel('amplitude');
title('Sine and Cosine');
legend('sin', 'cos', 'Location', 'Best');
grid on;
