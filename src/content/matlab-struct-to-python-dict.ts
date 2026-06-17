export const article = {
  slug: 'matlab-struct-to-python-dict',
  title: 'MATLAB struct to Python: dicts, dataclasses, and named tuples',
  description: 'Convert MATLAB struct and struct arrays to Python. When to use dict, when to use dataclass, and how to handle nested structs and dynamic field names.',
  publishedAt: '2026-05-09',
  keyword: 'matlab struct python',
  sections: [
    {
      heading: 'The direct replacement: Python dict',
      body: `A MATLAB struct is a container that holds named fields of any type. The closest Python equivalent is a \`dict\`:

\`\`\`matlab
% MATLAB
s.name = 'Alice';
s.age  = 30;
s.scores = [85, 92, 78];

% Access
disp(s.name)         % 'Alice'
disp(s.scores(2))    % 92
\`\`\`

\`\`\`python
# Python — dict
s = {
    'name': 'Alice',
    'age': 30,
    'scores': np.array([85, 92, 78]),
}

# Access
print(s['name'])          # 'Alice'
print(s['scores'][1])     # 92  (0-based)
\`\`\`

**The key difference:** dot notation (\`s.name\`) becomes bracket notation (\`s['name']\`). This is the most repetitive mechanical change in a struct migration.

If you prefer dot access, use a \`dataclass\` or \`SimpleNamespace\` — covered below.`,
    },
    {
      heading: 'struct() constructor and fieldnames',
      body: `\`\`\`matlab
% MATLAB — struct constructor
s = struct('x', 1, 'y', 2, 'label', 'origin');

% Get field names
fields = fieldnames(s);    % {'x','y','label'}

% Check if field exists
if isfield(s, 'z')
    disp(s.z)
end

% Remove a field
s = rmfield(s, 'label');
\`\`\`

\`\`\`python
# Python
s = {'x': 1, 'y': 2, 'label': 'origin'}

# Get field names
fields = list(s.keys())    # ['x', 'y', 'label']

# Check if field exists
if 'z' in s:
    print(s['z'])

# Remove a field
del s['label']
# or: s.pop('label', None)  — safe, no error if missing
\`\`\`

For dynamic field access (\`s.(fieldName)\` in MATLAB), Python dicts use \`s[field_name]\` — the bracket notation is already dynamic by default.`,
    },
    {
      heading: 'Struct arrays: arrays of structs',
      body: `MATLAB allows arrays of structs where each element has the same fields. Python maps this to a list of dicts, or a dict of lists (columnar layout):

\`\`\`matlab
% MATLAB — struct array
for i = 1:3
    data(i).x = i;
    data(i).y = i^2;
end
% Access
data(2).x   % 2
\`\`\`

\`\`\`python
# Python — option 1: list of dicts (row-oriented, matches MATLAB struct array)
data = [{'x': i, 'y': i**2} for i in range(1, 4)]
data[1]['x']   # 2  (0-based index)

# Python — option 2: dict of lists (column-oriented, better for NumPy operations)
import numpy as np
data = {
    'x': np.array([1, 2, 3]),
    'y': np.array([1, 4, 9]),
}
data['x'][1]   # 2
\`\`\`

**Which layout to choose:** If you mostly iterate over records (\`for item in data\`), use a list of dicts. If you mostly do per-field math (\`data.y = data.x .^ 2\`), use a dict of arrays — it's much faster for NumPy operations.`,
    },
    {
      heading: 'Dot-access structs: SimpleNamespace and dataclass',
      body: `If you want to keep the \`s.name\` syntax, Python has two options:

**\`SimpleNamespace\`** — quick, dynamic, no type annotations:

\`\`\`python
from types import SimpleNamespace

s = SimpleNamespace(name='Alice', age=30, scores=[85, 92, 78])

print(s.name)         # 'Alice' — dot access works
s.city = 'Boston'     # add new fields dynamically
\`\`\`

**\`dataclass\`** — structured, type-hinted, best for fixed schemas:

\`\`\`python
from dataclasses import dataclass, field
import numpy as np

@dataclass
class Measurement:
    sensor_id: int
    values: np.ndarray
    label: str = 'unlabeled'

m = Measurement(sensor_id=1, values=np.array([1.2, 3.4, 5.6]))
print(m.sensor_id)    # 1
print(m.values.mean()) # 3.4
\`\`\`

Use \`SimpleNamespace\` when you're migrating exploratory scripts that build structs on the fly. Use \`dataclass\` when you want IDE autocomplete, type checking, and a clear schema.`,
    },
    {
      heading: 'Nested structs',
      body: `\`\`\`matlab
% MATLAB — nested struct
config.model.layers = 3;
config.model.hidden = 128;
config.training.lr = 0.001;
config.training.epochs = 50;
\`\`\`

\`\`\`python
# Python — nested dict
config = {
    'model': {
        'layers': 3,
        'hidden': 128,
    },
    'training': {
        'lr': 0.001,
        'epochs': 50,
    },
}

# Access
print(config['model']['layers'])    # 3
print(config['training']['lr'])     # 0.001
\`\`\`

For deeply nested configs, consider using a library like \`pydantic\` (data validation) or just nested \`dataclasses\`:

\`\`\`python
@dataclass
class ModelConfig:
    layers: int = 3
    hidden: int = 128

@dataclass
class TrainingConfig:
    lr: float = 0.001
    epochs: int = 50

@dataclass
class Config:
    model: ModelConfig = field(default_factory=ModelConfig)
    training: TrainingConfig = field(default_factory=TrainingConfig)

cfg = Config()
print(cfg.model.layers)      # 3
print(cfg.training.lr)       # 0.001
\`\`\``,
    },
    {
      heading: 'Serialising structs: save/load to JSON and MAT files',
      body: `\`\`\`matlab
% MATLAB
save('data.mat', 's');
load('data.mat');
\`\`\`

\`\`\`python
# Python — dict to JSON (human-readable)
import json
import numpy as np

# JSON doesn't support NumPy arrays — convert first
s = {'name': 'Alice', 'scores': [85, 92, 78]}
with open('data.json', 'w') as f:
    json.dump(s, f)

with open('data.json') as f:
    s_loaded = json.load(f)

# Python — load original MATLAB .mat files
import scipy.io
mat = scipy.io.loadmat('data.mat')
# mat is a dict; struct fields become dict keys
# Note: strings come back as arrays — use mat['fieldname'][0] to extract

# Python — save for MATLAB compatibility
scipy.io.savemat('output.mat', {'s': {'name': 'Alice', 'age': 30}})
\`\`\``,
    },
    {
      heading: 'Convert your struct code now',
      body: `The MATLAB struct → Python migration is mechanical:

- \`s.field\` → \`s['field']\` (dict) or \`s.field\` (SimpleNamespace/dataclass)
- \`isfield(s, 'x')\` → \`'x' in s\`
- \`fieldnames(s)\` → \`list(s.keys())\`
- \`rmfield(s, 'x')\` → \`del s['x']\`
- \`struct array\` → list of dicts (or dict of arrays for columnar access)

Paste your MATLAB struct code into the [free converter at mtopython.com/convert](/convert) to get working Python output in under a second. The converter handles struct creation, field access, \`fieldnames\`, \`isfield\`, and \`rmfield\` automatically.`,
    },
  ],
}
