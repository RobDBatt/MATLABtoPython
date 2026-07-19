# nargin default-argument idiom
def addopt(a, b=10):


    r = a + b
    return r
r1 = addopt(5)
r2 = addopt(5, 20)
print(f'{int(r1):d} {int(r2):d}')

