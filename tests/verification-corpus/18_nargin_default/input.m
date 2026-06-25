% nargin default-argument idiom
r1 = addopt(5);
r2 = addopt(5, 20);
fprintf('%d %d\n', r1, r2);

function r = addopt(a, b)
    if nargin < 2
        b = 10;
    end
    r = a + b;
end
