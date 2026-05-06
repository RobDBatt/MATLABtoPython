% Cell arrays
names = {'Alice', 'Bob', 'Carol'};
first_name = names{1};
n = length(names);
for i = 1:n
    disp(names{i});
end
