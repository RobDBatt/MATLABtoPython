% Self-contained: struct field membership via isfield (struct → dict).
x = struct('a', 1, 'b', 2);
if isfield(x, 'a')
    disp('has a');
end
if ~isfield(x, 'z')
    disp('no z');
end
