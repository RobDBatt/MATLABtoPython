import numpy as np
from matlabtopython_compat import Struct

# Struct creation and access
s = Struct({'name': 'Alice', 'age': 30, 'score': 95.5})
s['email'] = 'alice@example.com'
s['tags'] = np.array([1, 2, 3])
print(s['name'])
print(s['age'])
n = s['name']
