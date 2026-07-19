from matlabtopython_compat import Struct

# struct field access
s = Struct()
s['name'] = 'hp'
s['value'] = 42
x = s['value']
print(f'{int(x):d}')
