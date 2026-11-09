import matplotlib.pyplot as plt

# fprintf and sprintf
x = 3.14159
y = 42
name = 'Alice'
print(f'x = {x:.3f}')
print(f'y = {int(y):d}')
print(f'{name} has {int(y):d} apples')
plt.savefig('stdout: %f\n')
msg = f'The value is {x:g}'
print(msg)
