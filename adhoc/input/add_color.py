import csv
from PIL import Image

from pathlib import Path

WORLD_MAP = Path(__file__).absolute().parent/"texture.png"  # equirectangular projection image with limited colors

# key (r, g, b) colors expected in the picture, mapped to string color name values
PALETTE = {
    (254, 254, 254): "white",
    (0, 102, 204): "blue",
    (64, 224, 208): "turquoise",
    (34, 139, 34): "green",
    (210, 180, 140): "beige"
}

INPUT_FILE = Path(__file__).absolute().parent/"sphere_cover.csv"  # input CSV with lat,lon pairs (no header)

OUTPUT_FILE = Path(__file__).absolute().parent/'terrain.csv'


def latlon_to_pixel(_lat, _lon, _width, _height):
    """Convert lat/lon to pixel co-ords in Plate Carrée (EPSG:4326)."""
    x = (_lon + 180.0) * (_width / 360.0)
    y = (90.0 - _lat) * (_height / 180.0)
    return int(x) % _width, max(0, min(int(y), _height - 1))


def build_color_lookup(image_path):
    """Return a function: (lat, lon) -> color name."""
    img = Image.open(image_path).convert("RGB")
    width, height = img.size
    pixels = img.load()

    def _lookup(_lat, _lon):
        x, y = latlon_to_pixel(_lat, _lon, width, height)
        rgb = pixels[x, y]
        if rgb in PALETTE:
            return PALETTE[rgb]
        # fallback: nearest from palette (in case colors don't match exactly)
        diffs = {name: sum((c1 - c2) ** 2 for c1, c2 in zip(rgb, pal_rgb))
                 for pal_rgb, name in PALETTE.items()}
        return min(diffs, key=diffs.get)

    return _lookup


def main():
    lookup = build_color_lookup(WORLD_MAP)

    print(f'ADDING COLOR')

    with open(INPUT_FILE, newline="") as infile, open(OUTPUT_FILE, "w", newline="") as outfile:
        reader = csv.reader(infile)
        writer = csv.writer(outfile)
        writer.writerow(["lat", "lon", "color"])  # add header to output

        number_of_points = 0

        for row in reader:
            number_of_points += 1
            lat, lon = map(float, row)
            color = lookup(lat, lon)
            if color == 'white' and abs(lat) < 60:
                color = 'beige'
            writer.writerow([lat, lon, color])

        print(f'# of Points: {number_of_points}')

    print(f"Saved: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
