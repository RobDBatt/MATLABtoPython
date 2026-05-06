% Struct creation and access
s = struct('name', 'Alice', 'age', 30, 'score', 95.5);
s.email = 'alice@example.com';
s.tags = [1, 2, 3];
disp(s.name);
disp(s.age);
n = s.name;
