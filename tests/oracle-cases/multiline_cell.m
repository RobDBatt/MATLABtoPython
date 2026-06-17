% Self-contained: multi-line cell literal with an inline comment on each
% element. The comments must not swallow the closing brace.
vals = {
    100 %alpha
    200 %beta
    300 %gamma
};
x = vals{2};
fprintf('x=%d\n', x);
