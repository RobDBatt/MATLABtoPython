import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// Toolbox coverage sweep: exact-signature scipy/skimage/control/sympy matches
// map silently; known differences carry explicit flags; Simulink/codegen are
// UNSUPPORTED-flagged, never guessed.
function out(m: string): string {
  return convert(m).python
}
function flags(m: string): string {
  return convert(m).report.flags.map((f: any) => f.message).join(' | ').toLowerCase()
}

describe('Statistics toolbox', () => {
  it('random generation maps to numpy.random', () => {
    expect(out('r = unifrnd(a, b);')).toContain('np.random.uniform(a, b)')
    expect(out('r = gamrnd(a, b);')).toContain('np.random.gamma(a, b)')
    expect(out('r = mvnrnd(mu, S);')).toContain('np.random.multivariate_normal(mu, S)')
  })
  it('distribution family rewrites with correct scale handling', () => {
    expect(out('p = betapdf(x, a, b);')).toContain('stats.beta.pdf(x, a, b)')
    expect(out('p = gampdf(x, a, b);')).toContain('stats.gamma.pdf(x, a, scale=b)')
    expect(out('p = exppdf(x, mu);')).toContain('stats.expon.pdf(x, scale=mu)')
    expect(out('p = poisspdf(k, lam);')).toContain('stats.poisson.pmf(k, lam)')
    expect(out('q = tinv(p, nu);')).toContain('stats.t.ppf(p, nu)')
    expect(out('p = wblpdf(x, a, b);')).toContain('stats.weibull_min.pdf(x, b, scale=a)')
    expect(out('p = lognpdf(x, mu, s);')).toContain('stats.lognorm.pdf(x, s, scale=np.exp(mu))')
    expect(out('p = unifcdf(x, a, b);')).toContain('stats.uniform.cdf(x, loc=a, scale=(b) - (a))')
  })
  it('nan-aware + clustering/distance', () => {
    expect(out('m = nanmean(x);')).toContain('np.nanmean(x)')
    expect(out('d = pdist(X);')).toContain('spatial.distance.pdist(X)')
    expect(out('Z = linkage(X);')).toContain('cluster.hierarchy.linkage(X)')
  })
  it('zscore adds ddof=1', () => {
    expect(out('z = zscore(x);')).toContain('stats.zscore(x, ddof=1)')
  })
  it('kmeans maps with a swapped-returns warning', () => {
    const m = '[idx, C] = kmeans(X, k);'
    expect(out(m)).toContain('cluster.vq.kmeans2(X, k)')
    expect(flags(m)).toMatch(/swapped/)
  })
})

describe('Signal Processing toolbox', () => {
  it('exact-name matches', () => {
    expect(out('[n, Wn] = buttord(wp, ws, rp, rs);')).toContain('signal.buttord(wp, ws, rp, rs)')
    expect(out('y = medfilt1(x, k);')).toContain('signal.medfilt(x, k)')
    expect(out('y = detrend(x);')).toContain('signal.detrend(x)')
    expect(out('y = sinc(x);')).toContain('np.sinc(x)')
  })
  it('fir1 order becomes n+1 taps', () => {
    expect(out('b = fir1(48, 0.5);')).toContain('signal.firwin(49, 0.5)')
    expect(out('b = fir1(n, Wn);')).toContain('signal.firwin(n + 1, Wn)')
  })
  it("dct gains norm='ortho'", () => {
    expect(out('y = dct(x);')).toContain("sfft.dct(x, norm='ortho')")
  })
  it('sgolayfilt swaps window/order args', () => {
    expect(out('y = sgolayfilt(x, 3, 11);')).toContain('signal.savgol_filter(x, 11, 3)')
  })
  it('downsample becomes a stride slice', () => {
    expect(out('y = downsample(x, 4);')).toContain('x[::4]')
  })
})

describe('Image Processing toolbox', () => {
  it('morphology + labels map to skimage', () => {
    expect(out('bw2 = imopen(bw, se);')).toContain('morphology.opening(bw, se)')
    expect(out('bw2 = bwareaopen(bw, 50);')).toContain('morphology.remove_small_objects(bw, 50)')
    expect(out('rgb = label2rgb(L);')).toContain('color.label2rgb(L)')
  })
  it("strel('disk', r) → morphology.disk(r)", () => {
    expect(out("se = strel('disk', 3);")).toContain('morphology.disk(3)')
  })
  it("imfill(bw, 'holes') → ndi.binary_fill_holes", () => {
    expect(out("bw2 = imfill(bw, 'holes');")).toContain('ndi.binary_fill_holes(bw)')
  })
  it('imbinarize applies otsu inline', () => {
    expect(out('bw = imbinarize(I);')).toContain('(I > filters.threshold_otsu(I))')
  })
})

describe('Control Systems toolbox', () => {
  it('lqr/place/ctrb map to python-control', () => {
    expect(out('[K, S, e] = lqr(A, B, Q, R);')).toContain('control.lqr(A, B, Q, R)')
    expect(out('K = place(A, B, p);')).toContain('control.place(A, B, p)')
    expect(out('Co = ctrb(A, B);')).toContain('control.ctrb(A, B)')
  })
})

describe('Rotations (scipy.spatial.transform)', () => {
  it('eul2rotm uses ZYX Euler order', () => {
    expect(out('R = eul2rotm(eul);')).toContain("Rotation.from_euler('ZYX', eul).as_matrix()")
  })
  it('quat2rotm converts and warns about quaternion order', () => {
    const m = 'R = quat2rotm(q);'
    expect(out(m)).toContain('Rotation.from_quat(q).as_matrix()')
    expect(flags(m)).toMatch(/w x y z/)
  })
})

describe('Symbolic Math toolbox', () => {
  it('dsolve/vpa/collect map to sympy', () => {
    expect(out('S = dsolve(eqn, cond);')).toContain('sp.dsolve(eqn, cond)')
    expect(out('v = vpa(x, 8);')).toContain('sp.N(x, 8)')
  })
})

describe('Simulink / codegen — UNSUPPORTED, never guessed', () => {
  it('sim() is flagged as unconvertible with an explanation', () => {
    const m = "out = sim('my_model');"
    expect(out(m)).toContain("sim('my_model')")
    expect(flags(m)).toMatch(/block diagram|no python equivalent/)
  })
  it('set_param flagged', () => {
    expect(flags("set_param('m/Gain', 'Gain', '5');")).toMatch(/no python equivalent/)
  })
})

describe('Financial toolbox — flagged with formula hints', () => {
  it('pv gets a closed-form TODO', () => {
    expect(flags('v = pv(rate, n, p);')).toMatch(/closed form/)
  })
})

describe('New unsupported toolboxes — flagged with recommendations', () => {
  it('serial/gpib/daq are flagged as unsupported with libraries', () => {
    expect(flags("s = serial('COM1');")).toMatch(/pyserial/)
    expect(flags('g = gpib(vendor, board, address);')).toMatch(/pyvisa/)
    expect(flags('d = daq(vendor);')).toMatch(/nidaqmx|pydaqmx/)
  })
  it('uifigure/uicontrol/msgbox are flagged', () => {
    expect(flags('fig = uifigure();')).toMatch(/pyqt6|pyside6|tkinter/)
    expect(flags('btn = uicontrol();')).toMatch(/pyqt6|pyside6|tkinter/)
    expect(flags("msgbox('Done');")).toMatch(/tkinter.messagebox|qmessagebox/)
  })
})

describe('toolbox conversions never fire inside strings', () => {
  it('lqr mentioned in a disp string survives', () => {
    const o = out("disp('running lqr(A, B) design step');")
    expect(o).toContain('lqr(A, B) design step')
    expect(o).not.toContain('control.lqr(A, B) design')
  })
})
