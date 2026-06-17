export const article = {
  slug: 'matlab-ode45-to-scipy',
  title: 'MATLAB ode45 to Python: Solving ODEs with scipy.integrate',
  description: 'Replace MATLAB ode45, ode23, and ode15s with scipy.integrate.solve_ivp. Step-by-step conversion with working examples for IVPs, events, and stiff systems.',
  publishedAt: '2026-05-09',
  keyword: 'matlab ode45 python equivalent',
  sections: [
    {
      heading: 'The direct replacement: solve_ivp',
      body: `MATLAB's \`ode45\` is a 4th/5th-order Runge-Kutta solver. Python's \`scipy.integrate.solve_ivp\` is the equivalent, with a nearly identical interface.

| MATLAB | Python | Method |
|---|---|---|
| \`ode45\` | \`solve_ivp(..., method='RK45')\` | 4/5th-order RK (default) |
| \`ode23\` | \`solve_ivp(..., method='RK23')\` | 2/3rd-order RK |
| \`ode15s\` | \`solve_ivp(..., method='BDF')\` | Stiff systems |
| \`ode113\` | \`solve_ivp(..., method='LSODA')\` | Auto stiff/non-stiff |
| \`ode23s\` | \`solve_ivp(..., method='Radau')\` | Stiff, implicit |

Install scipy if you haven't:

\`\`\`bash
pip install scipy numpy
\`\`\`

\`\`\`python
from scipy.integrate import solve_ivp
import numpy as np
\`\`\``,
    },
    {
      heading: 'Basic conversion: ode45 to solve_ivp',
      body: `Here is the standard pattern side by side:

\`\`\`matlab
% MATLAB — exponential decay: dy/dt = -2y, y(0) = 1
f = @(t, y) -2 * y;
tspan = [0, 5];
y0 = 1;
[t, y] = ode45(f, tspan, y0);
plot(t, y)
\`\`\`

\`\`\`python
# Python — same problem
import numpy as np
from scipy.integrate import solve_ivp
import matplotlib.pyplot as plt

def f(t, y):
    return [-2 * y[0]]       # must return array-like, not scalar

t_span = (0, 5)
y0 = [1.0]                   # must be a list or array, not scalar

sol = solve_ivp(f, t_span, y0, method='RK45', dense_output=True)

t_eval = np.linspace(0, 5, 200)
y_eval = sol.sol(t_eval)     # interpolate at any t (requires dense_output=True)

plt.plot(t_eval, y_eval[0])
plt.show()
\`\`\`

**Three key differences from MATLAB:**

1. **The RHS function** must accept \`(t, y)\` where \`y\` is always a 1D array, even for scalar ODEs. Return a list or array of the same length.
2. **\`y0\` must be a list/array**, not a scalar. Use \`y0 = [1.0]\` not \`y0 = 1\`.
3. **The return value** is an object, not \`[t, y]\`. Access \`sol.t\` and \`sol.y\`.`,
    },
    {
      heading: 'Accessing the solution: sol.t and sol.y',
      body: `Unlike MATLAB, \`solve_ivp\` returns a result object:

\`\`\`matlab
% MATLAB
[t, y] = ode45(f, tspan, y0);
% t is column vector, y is (length(t) × n_vars) matrix
final_value = y(end, :);
\`\`\`

\`\`\`python
# Python
sol = solve_ivp(f, t_span, y0)

# sol.t — 1D array of time points (shape: n_steps,)
# sol.y — 2D array (shape: n_vars × n_steps) — note: TRANSPOSED vs MATLAB!
print(sol.t.shape)     # (n_steps,)
print(sol.y.shape)     # (n_vars, n_steps)

final_value = sol.y[:, -1]     # last time step, all variables
y_at_all_t  = sol.y[0, :]     # first variable, all time steps
\`\`\`

**Note the transpose:** In MATLAB, \`y\` is \`(n_steps × n_vars)\`. In scipy, \`sol.y\` is \`(n_vars × n_steps)\`. To get the MATLAB layout: \`sol.y.T\`.

**To specify evaluation points** (like MATLAB's \`tspan\` with more than 2 points):

\`\`\`python
t_eval = np.linspace(0, 5, 100)     # evaluate at 100 evenly-spaced points
sol = solve_ivp(f, (0, 5), y0, t_eval=t_eval)
\`\`\``,
    },
    {
      heading: 'Systems of ODEs',
      body: `Multi-variable systems work exactly the same way — \`y\` is a vector:

\`\`\`matlab
% MATLAB — Lotka-Volterra (predator-prey)
% dy1/dt = a*y1 - b*y1*y2
% dy2/dt = -c*y2 + d*y1*y2
function dydt = lotka_volterra(t, y)
    a = 1.5; b = 1.0; c = 3.0; d = 1.0;
    dydt = [a*y(1) - b*y(1)*y(2);
            -c*y(2) + d*y(1)*y(2)];
end

[t, y] = ode45(@lotka_volterra, [0, 15], [10; 5]);
plot(t, y(:,1), t, y(:,2))
\`\`\`

\`\`\`python
# Python — same system
def lotka_volterra(t, y):
    a, b, c, d = 1.5, 1.0, 3.0, 1.0
    dy1 = a * y[0] - b * y[0] * y[1]
    dy2 = -c * y[1] + d * y[0] * y[1]
    return [dy1, dy2]

sol = solve_ivp(lotka_volterra, (0, 15), [10.0, 5.0],
                method='RK45', t_eval=np.linspace(0, 15, 300))

plt.plot(sol.t, sol.y[0], label='Prey')
plt.plot(sol.t, sol.y[1], label='Predators')
plt.legend()
plt.show()
\`\`\``,
    },
    {
      heading: 'Passing parameters to the ODE function',
      body: `MATLAB uses nested functions or \`@(t,y)\` closures to pass parameters. Python uses closures or the \`args\` keyword:

\`\`\`matlab
% MATLAB — passing parameters with closure
a = 2.5; b = 1.2;
f = @(t, y) a*y(1) - b*y(2);
[t, y] = ode45(f, [0,10], [1;1]);
\`\`\`

\`\`\`python
# Python — option 1: closure (most Pythonic)
a, b = 2.5, 1.2
def f(t, y):
    return [a * y[0] - b * y[1],
            -b * y[0] + a * y[1]]

# Python — option 2: args keyword (cleaner for many params)
def f_params(t, y, a, b):
    return [a * y[0] - b * y[1],
            -b * y[0] + a * y[1]]

sol = solve_ivp(f_params, (0, 10), [1.0, 1.0], args=(2.5, 1.2))
\`\`\``,
    },
    {
      heading: 'Solver options: tolerances and stiff systems',
      body: `MATLAB's \`odeset\` options map to \`solve_ivp\` keyword arguments:

\`\`\`matlab
% MATLAB
opts = odeset('RelTol', 1e-6, 'AbsTol', 1e-9, 'MaxStep', 0.01);
[t, y] = ode45(f, tspan, y0, opts);

% For stiff systems:
[t, y] = ode15s(f, tspan, y0);
\`\`\`

\`\`\`python
# Python
sol = solve_ivp(f, t_span, y0,
                method='RK45',
                rtol=1e-6,       # RelTol
                atol=1e-9,       # AbsTol
                max_step=0.01)   # MaxStep

# For stiff systems — use BDF or Radau:
sol = solve_ivp(f, t_span, y0, method='BDF')
sol = solve_ivp(f, t_span, y0, method='Radau')
\`\`\`

**When to use stiff solvers:** If \`RK45\` is slow (taking thousands of tiny steps), your system is stiff. Switch to \`method='BDF'\` (equivalent to \`ode15s\`) for systems with widely separated timescales — circuit models, chemical kinetics, reaction-diffusion.`,
    },
    {
      heading: 'Event detection',
      body: `MATLAB's \`odeset('Events', @myEvents)\` finds when specific conditions are met. \`solve_ivp\` uses a list of event functions with attributes:

\`\`\`matlab
% MATLAB — stop when y crosses zero
function [value, isterminal, direction] = myEvent(t, y)
    value = y(1);        % event fires when this is 0
    isterminal = 1;      % stop integration
    direction = -1;      % only when decreasing
end

opts = odeset('Events', @myEvent);
[t, y, te, ye] = ode45(f, tspan, y0, opts);
\`\`\`

\`\`\`python
# Python — same: stop when y[0] crosses zero from above
def zero_crossing(t, y):
    return y[0]

zero_crossing.terminal  = True    # stop when triggered
zero_crossing.direction = -1      # only when decreasing (negative to zero)

sol = solve_ivp(f, t_span, y0, events=zero_crossing)

# sol.t_events[0] — time(s) when the event fired
# sol.y_events[0] — state(s) at those times
print("Event at t =", sol.t_events[0])
\`\`\``,
    },
    {
      heading: 'Convert your ODE code now',
      body: `The \`ode45\` → \`solve_ivp\` migration is one of the more mechanical MATLAB-to-Python conversions: the structure maps nearly 1-to-1, the main adjustments are scalar→array state, transposed output, and result-object access.

Paste your MATLAB ODE code — including the RHS function, \`tspan\`, and solver call — into the [free converter at mtopython.com/convert](/convert) to get working Python output in under a second. The converter handles \`ode45\`, \`ode23\`, \`ode15s\`, \`ode113\`, and \`ode23s\` automatically.`,
    },
  ],
}
