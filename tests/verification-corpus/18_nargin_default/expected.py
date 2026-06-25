# nargin default-argument idiom
r1 = addopt(5)
r2 = addopt(5, 20)
print('%d %d' % (r1, r2))

def addopt(a, b=10):


    r = a + b
    return r
