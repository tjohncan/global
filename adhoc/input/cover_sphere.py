import math
import csv
import time

from pathlib import Path

start_time = time.time()
print(f'COVERING SPHERE')
print(f'Start: {time.ctime(start_time)}')

N = 500  # number of points along the equator
R = int(round(N/2))-1  # number of "rungs", starting from the equator, climbing up or down the sphere, excluding poles
polar_points = []

OUTPUT_FILE = Path(__file__).absolute().parent/'sphere_cover.csv'

half_pi = math.pi / 2


class PolarPoint:
    """ordered R^2 pair: sigma and psi, in radians"""
    def __init__(self, _sig, _psi):
        self.sig, self.psi = _sig, _psi


# generate a list of "evenly spaced" angle pairs to cover a sphere

psi_step = half_pi / (R+1)  # incremental vertical angle between "rungs"
next_sig_start = 0  # updated in following loop
for rung in range(R):
    psi = psi_step * rung
    n_rung = max(3, int(round(math.cos(psi) * N)))
    sig_halfstep = math.pi / n_rung
    sig_step = 2 * sig_halfstep  # incremental horizontal angle between points on the rung
    sig_start = next_sig_start

    next_psi = psi_step * (rung + 1)
    next_n_rung = max(3, int(round(math.cos(next_psi) * N)))

    # space at least one of the next rung's points evenly between two current rung neighbors, and shuffle to avoid lines
    next_sig_start_raw = (sig_start
                          + ((-1) ** (rung % 2)) * sig_halfstep
                          + (2*math.pi/7.777777 if next_n_rung < n_rung else 0)
                          + (sig_step * round((333.4444 * 2 * math.pi / R) / sig_step, 0))) % (2 * math.pi)
    next_sig_start = next_sig_start_raw if next_sig_start_raw <= math.pi else -2*math.pi + next_sig_start_raw

    for i in range(n_rung):
        sig_raw = (sig_step * i + sig_start) % (2 * math.pi)
        sig = sig_raw if sig_raw <= math.pi else -2*math.pi + sig_raw
        polar_points.append(PolarPoint(sig, psi))
        if rung > 0:
            polar_points.append(PolarPoint(-sig, -psi))

# add poles
polar_points.append(PolarPoint(0, half_pi))
polar_points.append(PolarPoint(0, -half_pi))


print(f'# of Points: {len(polar_points)}')

# output list of calculated "polar points", in degrees latitude and longitude
with open(OUTPUT_FILE, 'w', newline='') as csvfile:
    wtr = csv.writer(csvfile, delimiter=',', lineterminator='\n')
    for w in polar_points:
        wtr.writerow([
            round(w.psi * 180 / math.pi, 4),
            round(w.sig * 180 / math.pi, 4)
        ])

end_time = time.time()
print(f'Finish: {time.ctime(end_time)} ({round(end_time-start_time,3)} seconds)')
