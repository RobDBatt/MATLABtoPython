# nargin default-argument idiom
def addopt(a, b=10):


    r = a + b
    return r
r1 = addopt(5)
r2 = addopt(5, 20)
print(f'{r1:d} {r2:d}')

