% While loop with break and continue
x = 0;
while x < 100
    x = x + 3;
    if x == 42
        continue;
    end
    if x > 80
        break;
    end
    disp(x);
end
