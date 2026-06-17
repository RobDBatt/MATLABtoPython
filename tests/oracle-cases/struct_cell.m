% Self-contained: a cell array holding several multi-pair structs. Each must
% become a valid dict literal (not an invalid dict('k', v, ...) call).
items = {struct('id', 1, 'qty', 10) struct('id', 2, 'qty', 20)};
n = numel(items);
fprintf('n=%d\n', n);
