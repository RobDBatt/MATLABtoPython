% Self-contained: bare try/end (no catch) — MATLAB swallows the error and the
% loop continues. The erroring iteration is skipped; acc sums the rest.
acc = 0;
for k = 1:5
    try
        if k == 3
            error('skip this one');
        end
        acc = acc + k;
    end
end
fprintf('acc=%d\n', acc);
