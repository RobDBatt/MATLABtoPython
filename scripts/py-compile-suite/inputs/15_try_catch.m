% Try/catch
try
    x = 1 / 0;
    y = sqrt(-1);
catch err
    disp('caught error');
    disp(err.message);
end
