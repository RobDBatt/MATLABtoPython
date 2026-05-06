def outer(x):
    a = 10
    result = inner(x) + a
    return result

def inner(z):
    y = z * 2
    return y
