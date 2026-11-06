# Skyflap species calls + heavy splash. Procedural, modelled on each species' real vocalisations.
import numpy as np, subprocess, os, json, base64
from scipy.signal import butter, sosfilt, fftconvolve
SR = 32000
OUT = 'calls_out'; os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1)

def env(n, a=.01, r=.06, shape=1.0):
    t = np.arange(n) / SR; d = n / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.minimum(1, np.maximum(0, (d - t)) / max(r, 1e-4))
    return e ** shape

def contour(n, pts):
    """pts: list of (fraction, freq) -> per-sample f0 (log interp)"""
    x = np.linspace(0, 1, n); fx = [p[0] for p in pts]; fy = np.log([p[1] for p in pts])
    return np.exp(np.interp(x, fx, fy))

def bp(y, lo, hi, order=2):
    hi = min(hi, SR / 2 * .95); lo = max(lo, 20)
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), y)
def lp(y, f, order=2): return sosfilt(butter(order, min(f, SR/2*.95), 'low', fs=SR, output='sos'), y)
def hp(y, f, order=2): return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), y)

def voice(dur, pts, harm=(1, .2, .06), vib=(0, 0), am=(0, 0), jit=0.0, noise=0.0, nb=None,
          formants=None, a=.01, r=.05, eshape=1.0, tilt=None, nh=None):
    """Harmonic source following an f0 contour. tilt -> sawtooth-like rich source (harsh calls)."""
    n = int(dur * SR); f = contour(n, pts)
    t = np.arange(n) / SR
    if vib[0]: f = f * (1 + vib[1] * np.sin(2 * np.pi * vib[0] * t + rng.uniform(0, 6)))
    if jit:   # random pitch perturbation -> roughness
        j = lp(rng.standard_normal(n), 300) * jit * 6; f = f * (1 + j)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.zeros(n)
    if tilt is not None:
        K = nh or 40
        for k in range(1, K + 1):
            m = (k * f) < SR / 2 * .9
            y += m * np.sin(k * ph) / k ** tilt * (1 + (rng.uniform(-.3, .3) if jit else 0))
    else:
        for k, A in enumerate(harm, 1):
            m = (k * f) < SR / 2 * .9; y += A * m * np.sin(k * ph)
    if noise:
        z = rng.standard_normal(n)
        z = bp(z, *(nb or (500, 6000)))
        y = y * (1 - noise) + z * noise * 2.2 * (np.std(y) / (np.std(z) + 1e-9) if np.std(y) > 0 else 1)
    if formants:
        out = np.zeros(n)
        for fc, bw, g in formants: out += g * bp(y, fc - bw / 2, fc + bw / 2)
        y = out
    if am[0]:
        y *= 1 - am[1] * (.5 + .5 * np.sin(2 * np.pi * am[0] * t))
    y *= env(n, a, r, eshape)
    return y / (np.max(np.abs(y)) + 1e-9)

def noiseb(dur, lo, hi, a=.003, r=.05, eshape=1.0):
    n = int(dur * SR); y = bp(rng.standard_normal(n), lo, hi); y *= env(n, a, r, eshape)
    return y / (np.max(np.abs(y)) + 1e-9)

def click(f=4000, dur=.012):
    return voice(dur, [(0, f * 1.4), (1, f * .7)], harm=(1, .3), a=.0008, r=.009)

def wings(dur=.35, beats=5, lo=300, hi=2500):
    n = int(dur * SR); y = np.zeros(n)
    for i in range(beats):
        s = int((i / beats) * n * .9 + rng.uniform(0, .01) * SR); b = noiseb(rng.uniform(.04, .07), lo, hi, .004, .04)
        b *= rng.uniform(.6, 1); e = min(n, s + len(b)); y[s:e] += b[:e - s]
    return y

class Seq:
    def __init__(s, dur): s.y = np.zeros(int(dur * SR) + SR)
    def add(s, t, sig, g=1.0):
        a = int(t * SR); e = a + len(sig)
        if e > len(s.y): s.y = np.concatenate([s.y, np.zeros(e - len(s.y))])
        s.y[a:e] += sig * g; return s
    def done(s, verb=.18, dist=0.0):
        y = s.y
        nz = np.where(np.abs(y) > 1e-4)[0]; y = y[:nz[-1] + 1] if len(nz) else y
        # small outdoor reverb (forest edge): decaying filtered noise IR
        L = int(.55 * SR); ir = rng.standard_normal(L) * np.exp(-np.arange(L) / SR / .13); ir = lp(ir, 5000)
        ir[:int(.012 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum())
        w = fftconvolve(y, ir)[:len(y) + int(.22 * SR)]
        y = np.concatenate([y, np.zeros(len(w) - len(y))])
        y = y + verb * w
        if dist: y = lp(y, 9000 - dist * 4000)
        y = hp(y, 90)
        f = min(len(y)//3, int(.18 * SR)); y[-f:] *= np.linspace(1, 0, f) ** 2
        return y

J = lambda v=.05: 1 + rng.uniform(-v, v)

# ------------------------------------------------------------------ species
def robin(ev):     # European robin: liquid warbling song, 'tic' alarm, thin 'tsee'
    s = Seq(2)
    if ev == 'hs':
        t = 0; k = J()
        for i in range(rng.integers(9, 13)):
            d = rng.uniform(.04, .11); f1, f2 = rng.uniform(2400, 6800) * k, rng.uniform(2400, 7200) * k
            if rng.random() < .3:   # little trill
                s.add(t, voice(d * 1.6, [(0, f1), (1, f1 * .9)], harm=(1, .1), am=(rng.uniform(35, 60), .9)), .7)
                t += d * 1.6 + .02
            else:
                s.add(t, voice(d, [(0, f1), (.5, (f1 + f2) / 2 * J(.2)), (1, f2)], harm=(1, .12), a=.004, r=.02), rng.uniform(.5, 1))
                t += d + rng.uniform(.01, .05)
        return s.done(.22)
    if ev == 'ten':
        f = 7400 * J(); s.add(0, voice(.28, [(0, f), (1, f * .96)], harm=(1, .05), a=.03, r=.1), .6)
        s.add(.34, voice(.08, [(0, 3600*J()), (.4, 5200), (1, 4100)], harm=(1, .15), a=.005, r=.03))
        return s.done()
    t = 0
    for i in range(rng.integers(4, 7)):
        s.add(t, click(rng.uniform(4200, 5400), .016), 1); t += rng.uniform(.07, .12)
    s.add(t + .05, voice(.3, [(0, 7800), (1, 7200)], harm=(1,), a=.04, r=.15), .35)
    return s.done()

def pigeon(ev):    # rock dove: soft rolling 'oo-ROO-coo', wing clatter on alarm
    s = Seq(2); b = 300 * J()
    coo = lambda d, pts, g=1: voice(d, pts, harm=(1, .55, .2, .08), am=(rng.uniform(22, 32), .35), noise=.12, nb=(200, 1500), a=.05, r=.12)
    if ev == 'hs':
        s.add(0, wings(.4, 6, 400, 3000), .5)
        s.add(.45, coo(.35, [(0, b * 1.1), (.4, b * 1.5), (1, b * 1.2)]))
        s.add(.85, coo(.55, [(0, b * 1.2), (.3, b * 1.6), (.7, b * 1.45), (1, b)]))
        s.add(1.45, coo(.3, [(0, b * 1.15), (1, b * .95)]), .8)
        return s.done(.15)
    if ev == 'ten':
        s.add(0, coo(.42, [(0, b), (.35, b * 1.55), (1, b * 1.1)])); return s.done(.12)
    s.add(0, wings(.45, 7, 300, 2600), 1)
    s.add(.05, voice(.18, [(0, b * 1.3), (1, b * .8)], tilt=1.2, jit=.04, noise=.3, nb=(200, 1800), a=.01, r=.08), .55)
    return s.done(.1)

def sparrow(ev):   # house sparrow: 'chirrup' / 'cheep', rattling 'churr' alarm
    s = Seq(2)
    chirp = lambda f: voice(rng.uniform(.07, .11), [(0, f * .8), (.3, f * 1.15), (1, f * .85)], harm=(1, .45, .2), jit=.01, a=.004, r=.03)
    if ev == 'hs':
        t = 0
        for i in range(rng.integers(6, 9)):
            f = rng.uniform(3000, 4300); s.add(t, chirp(f), rng.uniform(.6, 1)); t += rng.uniform(.13, .22)
        return s.done(.2)
    if ev == 'ten':
        f = 3600 * J(); s.add(0, chirp(f)); s.add(.15, chirp(f * 1.08)); return s.done()
    s.add(0, voice(.45, [(0, 4200 * J()), (1, 3000)], harm=(1, .5, .25), am=(rng.uniform(28, 36), .95), jit=.03, noise=.25, nb=(2000, 7000), a=.005, r=.08))
    return s.done()

def crow(ev):      # carrion crow: harsh 'kraa' caws
    s = Seq(3)
    caw = lambda d, f, g=1, n=.35: voice(d, [(0, f * 1.05), (.3, f * 1.12), (1, f * .82)], tilt=.9, jit=.05, noise=n, nb=(600, 4000),
                                     formants=[(1150, 700, 1), (2300, 900, .6), (3600, 1200, .25)], a=.015, r=.06)
    if ev == 'hs':
        t = 0; f = 480 * J()
        for i in range(4):
            s.add(t, caw(rng.uniform(.24, .32), f * J(.06))); t += rng.uniform(.38, .48)
        return s.done(.25)
    if ev == 'ten':
        f = 500 * J(); s.add(0, caw(.22, f)); s.add(.34, caw(.24, f * .96)); return s.done(.25)
    s.add(0, caw(.62, 430 * J(), n=.5)); return s.done(.25)

def gull(ev):      # herring gull: long call 'kyow ... ha-ha-ha'
    s = Seq(3)
    kyow = lambda d, f: voice(d, [(0, f * .7), (.25, f * 1.25), (1, f * .8)], tilt=1.1, jit=.025, noise=.15, nb=(800, 5000),
                              formants=[(1400, 900, 1), (2800, 1200, .55)], a=.02, r=.1)
    ha = lambda f: voice(.085, [(0, f * 1.1), (1, f * .9)], tilt=1.1, jit=.02, formants=[(1500, 900, 1), (3000, 1000, .4)], a=.006, r=.03)
    if ev == 'hs':
        f = 1000 * J(); s.add(0, kyow(.42, f)); s.add(.48, kyow(.36, f * 1.05))
        t = .95
        for i in range(rng.integers(5, 8)):
            s.add(t, ha(f * 1.15 * J(.04)), .8); t += .13 - i * .006
        return s.done(.25)
    if ev == 'ten':
        s.add(0, kyow(.4, 1050 * J())); return s.done(.22)
    t = 0; f = 1300 * J()
    for i in range(4):
        s.add(t, voice(.1, [(0, f), (1, f * .85)], tilt=1, jit=.04, noise=.2, formants=[(1700, 1000, 1), (3200, 1200, .5)], a=.005, r=.03)); t += .14
    return s.done(.22)

def booby(ev):     # blue-footed booby: male plaintive whistle, female honk
    s = Seq(3)
    wh = lambda d, f: voice(d, [(0, f * .85), (.2, f), (1, f * .72)], harm=(1, .08), vib=(7, .01), noise=.08, nb=(1000, 4000), a=.03, r=.12)
    if ev == 'hs':
        t = 0; f = 2300 * J()
        for i in range(5):
            s.add(t, wh(.32, f * (1 - i * .035))); t += .4
        return s.done(.22)
    if ev == 'ten':
        f = 2200 * J(); s.add(0, wh(.3, f)); s.add(.38, wh(.3, f * .94)); return s.done(.2)
    s.add(0, voice(.42, [(0, 230 * J()), (.3, 260), (1, 190)], tilt=.8, jit=.04, noise=.25, nb=(200, 2500),
                   formants=[(600, 400, 1), (1300, 600, .7), (2500, 900, .3)], a=.02, r=.1))
    s.add(.5, voice(.3, [(0, 220), (1, 180)], tilt=.8, jit=.04, noise=.25, formants=[(600, 400, 1), (1300, 600, .7)], a=.02, r=.1), .7)
    return s.done(.15)

def macaw(ev):     # scarlet macaw: raucous 'RAAAH' squawks
    s = Seq(3)
    sq = lambda d, f, n=.45: voice(d, [(0, f * .9), (.25, f * 1.1), (1, f * .8)], tilt=.75, jit=.07, noise=n, nb=(800, 7000),
                                   formants=[(1500, 900, 1), (2900, 1400, .8), (4400, 1500, .4)], a=.02, r=.07)
    if ev == 'hs':
        t = 0
        for i in range(rng.integers(3, 5)):
            s.add(t, sq(rng.uniform(.3, .45), rng.uniform(650, 900))); t += rng.uniform(.45, .6)
        return s.done(.3)
    if ev == 'ten':
        s.add(0, sq(.32, 800 * J())); return s.done(.3)
    s.add(0, voice(.7, [(0, 1300 * J()), (.2, 1500), (1, 700)], tilt=.7, jit=.09, noise=.55, nb=(1000, 8000),
                   formants=[(1800, 1200, 1), (3400, 1600, .8)], a=.01, r=.12))
    return s.done(.3)

def vulture(ev):   # bearded vulture: shrill whistled trill, hiss
    s = Seq(3)
    if ev == 'hs':
        f = 3000 * J()
        s.add(0, voice(1.1, [(0, f * .9), (.15, f * 1.08), (.8, f), (1, f * .8)], harm=(1, .1), am=(rng.uniform(14, 18), .8), vib=(5, .01), a=.03, r=.2))
        s.add(1.2, voice(.35, [(0, f), (1, f * .75)], harm=(1, .1), a=.02, r=.15), .7)
        return s.done(.3, .3)
    if ev == 'ten':
        f = 3100 * J(); s.add(0, voice(.18, [(0, f * .9), (1, f * 1.05)], harm=(1, .1), a=.01, r=.05))
        s.add(.24, voice(.24, [(0, f * 1.05), (1, f * .82)], harm=(1, .1), a=.01, r=.1)); return s.done(.3)
    s.add(0, noiseb(.55, 2500, 8000, .02, .2), .7)
    s.add(.05, voice(.4, [(0, 200), (1, 150)], tilt=1, jit=.08, noise=.4, nb=(200, 1500), formants=[(500, 400, 1), (1100, 500, .5)], a=.03, r=.15), .5)
    return s.done(.2)

def pitta(ev):     # Gurney's pitta: explosive 'lilip', harsh 'skyeew'
    s = Seq(3)
    def lilip(f):
        q = Seq(.3); q.add(0, voice(.05, [(0, f * .85), (1, f)], harm=(1, .15), a=.004, r=.02))
        q.add(.07, voice(.07, [(0, f * .95), (.5, f * 1.22), (1, f * 1.1)], harm=(1, .15), a=.004, r=.03)); return q.y
    if ev == 'hs':
        t = 0; f = 2300 * J()
        for i in range(4): s.add(t, lilip(f * J(.02))); t += rng.uniform(.4, .5)
        return s.done(.3, .2)
    if ev == 'ten':
        f = 2300 * J(); s.add(0, lilip(f)); s.add(.3, lilip(f)); return s.done(.3, .2)
    s.add(0, voice(.32, [(0, 3600 * J()), (.2, 3900), (1, 2100)], tilt=1.2, jit=.04, noise=.35, nb=(1500, 7000),
                   formants=[(2600, 1500, 1), (4500, 1500, .5)], a=.01, r=.08))
    return s.done(.25)

def jay(ev):       # blue jay: bell-like 'queedle', harsh 'jay!' jeer
    s = Seq(3)
    jeer = lambda d, f: voice(d, [(0, f * 1.1), (.2, f * 1.15), (1, f * .8)], tilt=1, jit=.04, noise=.3, nb=(1500, 7000),
                              formants=[(2400, 1200, 1), (4200, 1400, .5)], a=.01, r=.06)
    def queedle(f):
        return voice(.42, [(0, f), (.3, f * 1.4), (.6, f * 1.05), (1, f * 1.3)], harm=(1, .4, .2, .1), am=(rng.uniform(16, 22), .7), a=.01, r=.12)
    if ev == 'hs':
        f = 1500 * J(); s.add(0, queedle(f)); s.add(.55, queedle(f * 1.03)); s.add(1.1, jeer(.22, 2700 * J()), .7); s.add(1.42, jeer(.22, 2600 * J()), .7)
        return s.done(.25)
    if ev == 'ten':
        f = 2800 * J(); s.add(0, jeer(.2, f)); s.add(.28, jeer(.2, f * .97)); return s.done(.22)
    s.add(0, jeer(.6, 3000 * J())); return s.done(.25)

def frigate(ev):   # magnificent frigatebird: throat-pouch drumming, bill rattling, whinny
    s = Seq(3)
    def drum(d, f, rate):
        return voice(d, [(0, f), (1, f * .9)], harm=(1, .5, .25), am=(rate, 1), noise=.1, nb=(80, 800), a=.04, r=.15)
    def rattle(d, rate=24):
        n = int(d * SR); y = np.zeros(n); t = 0
        while t < d - .02:
            c = noiseb(.012, 1500, 6000, .0005, .008); a = int(t * SR); e = min(n, a + len(c)); y[a:e] += c[:e - a] * rng.uniform(.5, 1); t += 1 / rate * J(.15)
        return y * env(n, .02, .08)
    if ev == 'hs':
        s.add(0, drum(1.3, 140 * J(), rng.uniform(11, 14)))
        s.add(.3, voice(.9, [(0, 900), (.3, 1100), (1, 700)], harm=(1, .3), am=(rng.uniform(9, 12), .9), vib=(6, .03), a=.05, r=.2), .35)
        return s.done(.25)
    if ev == 'ten':
        s.add(0, rattle(.4, rng.uniform(22, 28))); return s.done(.2)
    s.add(0, rattle(.5, 30)); s.add(.12, drum(.45, 110, 9), .7); return s.done(.2)

def flamingo(ev):  # greater flamingo: goose-like honking, grunts
    s = Seq(3)
    honk = lambda d, f: voice(d, [(0, f * .9), (.3, f * 1.08), (1, f * .85)], tilt=.85, jit=.035, noise=.18, nb=(300, 3000),
                              formants=[(700, 450, 1), (1500, 700, .8), (2700, 900, .35)], a=.015, r=.06)
    if ev == 'hs':
        for i in range(rng.integers(7, 10)):   # small flock chorus
            s.add(rng.uniform(0, 1.3), honk(rng.uniform(.16, .26), rng.uniform(340, 520)), rng.uniform(.4, 1))
        return s.done(.35)
    if ev == 'ten':
        f = 430 * J(); s.add(0, honk(.2, f)); s.add(.27, honk(.22, f * .94)); return s.done(.25)
    s.add(0, voice(.6, [(0, 260 * J()), (.3, 300), (1, 170)], tilt=.8, jit=.07, noise=.3, nb=(200, 2000), am=(rng.uniform(24, 30), .5),
                   formants=[(550, 400, 1), (1200, 600, .7)], a=.02, r=.12))
    return s.done(.22)

def tern(ev):      # arctic tern: grating 'kee-arr', 'kik-kik' chatter
    s = Seq(3)
    keearr = lambda d, f: voice(d, [(0, f * .9), (.15, f * 1.15), (.5, f), (1, f * .62)], tilt=1, jit=.05, noise=.3, nb=(1500, 8000),
                                formants=[(3000, 1600, 1), (5200, 1600, .4)], a=.01, r=.08)
    kik = lambda f: voice(.05, [(0, f * 1.1), (1, f * .9)], tilt=1.1, jit=.02, formants=[(3200, 1500, 1)], a=.003, r=.02)
    if ev == 'hs':
        s.add(0, keearr(.45, 3400 * J())); t = .55
        for i in range(rng.integers(6, 9)): s.add(t, kik(3600 * J(.05)), .8); t += .085
        s.add(t + .1, keearr(.4, 3300 * J()), .9); return s.done(.3)
    if ev == 'ten':
        t = 0; f = 3600 * J()
        for i in range(3): s.add(t, kik(f), .9); t += .09
        return s.done(.25)
    s.add(0, keearr(.7, 3200 * J())); return s.done(.3)

def kingfisher(ev):  # dwarf kingfisher: very high thin 'tsriet'
    s = Seq(3)
    ts = lambda d, f: voice(d, [(0, f * .9), (.3, f * 1.05), (1, f * .95)], harm=(1, .06), am=(rng.uniform(55, 75), .5), a=.004, r=.03)
    if ev == 'hs':
        t = 0; f = 7600 * J(.03)
        for i in range(10): s.add(t, ts(.07, f * (1 + .01 * i)), .9); t += .16 - i * .008
        return s.done(.25)
    if ev == 'ten':
        f = 7800 * J(.03); s.add(0, ts(.12, f)); s.add(.18, ts(.12, f * .98)); return s.done(.25)
    s.add(0, voice(.42, [(0, 8800 * J(.02)), (.2, 9200), (1, 6200)], harm=(1, .05), vib=(30, .02), a=.005, r=.12)); return s.done(.25)

def toucan(ev):    # keel-billed toucan: frog-like creaking 'krrrk', bill clacks
    s = Seq(3)
    def croak(d, f):
        return voice(d, [(0, f), (.5, f * 1.15), (1, f * .9)], tilt=.6, jit=.06, am=(rng.uniform(45, 60), .95),
                     formants=[(900, 600, 1), (1900, 800, .6), (3000, 1000, .25)], noise=.15, nb=(400, 4000), a=.01, r=.05)
    def clack(): return noiseb(.02, 1200, 4500, .0006, .015)
    if ev == 'hs':
        t = 0
        for i in range(rng.integers(5, 7)): s.add(t, croak(rng.uniform(.18, .24), 150 * J(.12))); t += rng.uniform(.28, .34)
        s.add(t, clack(), .8); s.add(t + .08, clack(), .6); return s.done(.3, .2)
    if ev == 'ten':
        s.add(0, croak(.22, 160 * J())); s.add(.32, croak(.22, 170 * J())); return s.done(.25, .2)
    s.add(0, clack()); s.add(.06, clack(), .8); s.add(.15, croak(.55, 130 * J()), 1); return s.done(.25, .2)

def beeeater(ev):  # European bee-eater: liquid rolling 'prruip'
    s = Seq(3)
    pr = lambda f, d=.2: voice(d, [(0, f * .82), (.6, f * 1.08), (1, f * .95)], harm=(1, .3, .1), am=(rng.uniform(38, 50), .9), a=.01, r=.05)
    if ev == 'hs':
        for i in range(rng.integers(8, 11)): s.add(rng.uniform(0, 1.4), pr(rng.uniform(2500, 3200), rng.uniform(.17, .23)), rng.uniform(.35, 1))
        return s.done(.35, .25)
    if ev == 'ten':
        f = 2900 * J(); s.add(0, pr(f)); s.add(.3, pr(f * 1.03)); return s.done(.3, .2)
    s.add(0, voice(.5, [(0, 3300 * J()), (1, 1900)], harm=(1, .4, .2), am=(30, .95), jit=.04, noise=.2, nb=(1500, 6000), a=.01, r=.1))
    return s.done(.25)

def eagle(ev):     # bald eagle: high piping chatter 'kleek-kik-ik-ik' (not a hawk scream)
    s = Seq(3)
    pip = lambda d, f: voice(d, [(0, f * .95), (.3, f * 1.08), (1, f * .9)], tilt=1.4, nh=12, jit=.025, noise=.12, nb=(2000, 7000), a=.005, r=.03)
    if ev == 'hs':
        f = 3100 * J(); s.add(0, voice(.3, [(0, f * .9), (.2, f * 1.1), (1, f * .95)], tilt=1.4, nh=12, jit=.03, noise=.15, a=.01, r=.08)); t = .38
        for i in range(rng.integers(7, 10)): s.add(t, pip(.06, f * (1 - i * .025)), .85 - i * .04); t += .095
        return s.done(.32, .2)
    if ev == 'ten':
        f = 3000 * J(); t = 0
        for i in range(3): s.add(t, pip(.06, f * (1 - i * .03)), 1); t += .1
        return s.done(.3, .2)
    s.add(0, voice(.65, [(0, 2800 * J()), (.15, 3400), (1, 2200)], tilt=1.3, nh=12, jit=.05, noise=.2, nb=(1800, 7000), vib=(11, .03), a=.01, r=.15))
    return s.done(.3, .2)

SP = dict(robin=robin, pigeon=pigeon, sparrow=sparrow, crow=crow, gull=gull, booby=booby, macaw=macaw, vulture=vulture, pitta=pitta,
          jay=jay, frigate=frigate, flamingo=flamingo, tern=tern, kingfisher=kingfisher, toucan=toucan, beeeater=beeeater, eagle=eagle)

# ------------------------------------------------------------------ heavy splash ('rock into water')
def load(p, sr=SR):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(float)
def plunk():
    base = load('lav/40-cc0-water-splash-slime-sfx/splash_04.ogg')
    k = .72; idx = np.arange(0, len(base) - 1, k); base = np.interp(idx, np.arange(len(base)), base)   # pitch down ~ -5.7 st
    base /= np.max(np.abs(base))
    s = Seq(2)
    s.add(0, base, .8)
    # deep 'kerplunk': cavity bubble rising in pitch
    s.add(.012, voice(.22, [(0, 95), (.35, 210), (1, 330)], harm=(1, .25), a=.004, r=.12, eshape=1.3), .9)
    s.add(.0, voice(.45, [(0, 70), (1, 48)], harm=(1, .3), a=.002, r=.35, eshape=1.6), .9)      # body thump
    s.add(.0, noiseb(.03, 80, 1200, .0008, .025), .7)                                          # impact
    for i in range(14):                                                                         # trailing bubbles / droplets
        f = rng.uniform(500, 1600); s.add(rng.uniform(.12, .9), voice(rng.uniform(.012, .03), [(0, f), (1, f * 1.6)], harm=(1,), a=.001, r=.01), rng.uniform(.06, .18))
    y = s.done(.12)
    return y

# ------------------------------------------------------------------ encode
def rms(y): return np.sqrt(np.mean(y[np.abs(y) > 1e-3] ** 2)) if np.any(np.abs(y) > 1e-3) else 1
def enc(y, name, target=-17, br='32k'):
    y = y * 10 ** (target / 20) / rms(y); pk = np.max(np.abs(y))
    if pk > .95: y *= .95 / pk
    p = f'{OUT}/{name}.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', br, p],
                   input=y.astype(np.float32).tobytes(), check=True)
    open(f'{OUT}/{name}.f32', 'wb').write(y.astype(np.float32).tobytes())
    return p

if __name__ == '__main__':
    calls = {}; tot = 0
    LV = {'hs': -16, 'ten': -18, 'crash': -16}
    for sp, fn in SP.items():
        calls[sp] = {}
        for ev in ('hs', 'ten', 'crash'):
            lst = []
            for v in range(3):
                p = enc(fn(ev), f'{sp}_{ev}{v}', LV[ev]); b = open(p, 'rb').read(); tot += len(b); lst.append(base64.b64encode(b).decode())
            calls[sp][ev] = lst
    p = enc(plunk(), 'plunk', -14, '48k'); pl = base64.b64encode(open(p, 'rb').read()).decode()
    js = '// Skyflap species calls (procedurally synthesised, original) + heavy splash\nwindow.SKY_CALLS=' + json.dumps(calls, separators=(',', ':')) + \
         ';\nwindow.SKY_PLUNK="' + pl + '";\n'
    open('/home/claude/calls.js', 'w').write(js)
    print('mp3 total', tot // 1024, 'KB; calls.js', len(js) // 1024, 'KB')
