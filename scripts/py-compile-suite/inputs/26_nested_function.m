function result = outer(x)
    a = 10;
    result = inner(x) + a;
end

function y = inner(z)
    y = z * 2;
end
