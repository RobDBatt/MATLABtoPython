# While loop with break and continue
x = 0
while x < 100:
    x = x + 3
    if x == 42:
        continue
    if x > 80:
        break
    print(x)
