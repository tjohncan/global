COLORS = {  # "r,g,b"
    "white": "230,239,245",
    "blue": "131,212,245",
    "beige": "189,173,158",
    "turquoise": "94,255,222",
    "green": "52,144,24",
    "red": "143,27,27",
    "black": "7,1,24",
    "gold": "224,190,130",
    "silver": "192,192,192",
}

TERRAIN = []

with open("input/terrain.csv") as f:
    header, *rows = f.read().splitlines()
    for row in rows:
        if not row:  # skip blanks
            continue
        lat, lon, color = row.split(",")
        TERRAIN.append((float(lat), float(lon), color))
