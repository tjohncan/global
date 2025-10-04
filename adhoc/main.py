import json
import math

from constants import COLORS, TERRAIN

import csv
import time


# run sub-routines
import adhoc.input.cover_sphere
import adhoc.input.add_color as add_color
add_color.main()


TERRAIN_OUTPUT_FILE = '../xyz_points.json'
SPOTS_OUTPUT_FILE = '../spots.json'

OBLATENESS = 0.00336413942215


# result ( color enumeration , group enumeration , points )
# type color_enum = tuple[int, str, str]             # [ ( color # , name , rgb string ) ]
# type group_enum = tuple[int, str]                  # [ ( group # , group name ) ]
# type point = tuple[int, float, float, float, int]  # [ ( group # , X co-ordinate , Y , Z , color # ) ]
def generate_xyz_points() -> tuple[
    list[tuple[int, str, str]],
    list[tuple[int, str]],
    list[tuple[int, float, float, float, int]]
]:
    """Calculate important x,y,z points."""
    output_color_enum = [
        (idx, key, value) for idx, (key, value) in enumerate(COLORS.items())
    ]
    color_map = {a[1]: a[0] for a in output_color_enum}
    output_group_enum = [
        (1, 'earth_terrain'),    # geographic features (land and sea)
        (2, 'earth_latitudes'),  # Earth's major latitudes (5 rings) around a unit sphere + poles
        (3, 'special_spots'),    # significant places
    ]
    output_points = []

    # !!
    group = 1

    # terrain
    for _degrees_north, _degrees_east, _color_name in TERRAIN:

        _radians_east = math.radians(_degrees_east)
        _radians_north = math.radians(_degrees_north)
        _z = math.sin(_radians_north)
        _oblate_spheroid_adjustment = 1.0 + OBLATENESS * (1.0 - abs(_z))
        _radius = math.cos(_radians_north) * _oblate_spheroid_adjustment

        output_points.append((
            group,
            round(math.cos(_radians_east) * _radius, 7),
            round(math.sin(_radians_east) * _radius, 7),
            round(_z, 7),
            color_map[_color_name],
        ))

    # !!
    group = 2

    # poles
    output_points.append((group, 0, 0, 1, color_map['gold']))   # north pole
    output_points.append((group, 0, 0, -1, color_map['white'])) # south pole

    # equator, circles and tropics
    for _degrees_height, _color in [
        (-66.6, 'white'),  # antarctic circle
        (-23.4, 'gold'),   # tropic of capricorn
        (0, 'red'),        # equator
        (23.4, 'gold'),    # tropic of cancer
        (66.6, 'white'),   # arctic circle
    ]:
        _radians_height = math.radians(_degrees_height)
        _z = math.sin(_radians_height)
        _oblate_spheroid_adjustment = 1.0 + OBLATENESS * (1.0 - abs(_z))
        _radius = math.cos(_radians_height) * _oblate_spheroid_adjustment

        for _degrees_circumference in range(5, 360, 10):
            _radians_circumference = math.radians(_degrees_circumference)
            output_points.append((
                group,
                round(_radius * math.cos(_radians_circumference), 7),
                round(_radius * math.sin(_radians_circumference), 7),
                round(_z, 7),
                color_map[_color],
            ))

    return output_color_enum, output_group_enum, output_points


def generate_places() -> list[dict]:
    """Generate places data for rendering and table display."""
    color_map = {key: idx for idx, key in enumerate(COLORS.keys())}
    places = []
    group = 3

    with open('input/spots.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            place_name = row['Place Name']
            lat = float(row['Latitude'])
            lon = float(row['Longitude'])
            note = row['Note']

            _radians_east = math.radians(lon)
            _radians_north = math.radians(lat)
            _z = math.sin(_radians_north)
            _oblate_spheroid_adjustment = 1.0 + OBLATENESS * (1.0 - abs(_z))
            _radius = math.cos(_radians_north) * _oblate_spheroid_adjustment

            lat_dir = 'N' if lat >= 0 else 'S'
            lon_dir = 'E' if lon >= 0 else 'W'
            lat_display = f"{abs(lat):.1f}° {lat_dir}"
            lon_display = f"{abs(lon):.1f}° {lon_dir}"

            places.append({
                'group': group,
                'x': round(math.cos(_radians_east) * _radius, 7),
                'y': round(math.sin(_radians_east) * _radius, 7),
                'z': round(_z, 7),
                'color': color_map['silver'],
                'place': place_name,
                'latitude': lat_display,
                'longitude': lon_display,
                'note': note,
                'jump_lat': lat,
                'jump_lon': lon,
            })

    return places


def save_to_file(data, filename, pretty=False):
    """Save data as a file."""
    with open(filename, 'w') as f:
        if pretty:
            json.dump(data, f, indent=2)
        else:
            json.dump(data, f)


if __name__ == "__main__":
    print(f'GENERATING X,Y,Z POINTS FOR PLANET EARTH SURFACE MODEL')

    start_time = time.time()
    print(f'Start: {time.ctime(start_time)}')

    xyz = generate_xyz_points()
    places = generate_places()

    print(f'# of Terrain Points: {len(xyz[2])}')
    print(f'# of Places: {len(places)}')

    print(f"Saving files . . .")
    save_to_file(xyz, TERRAIN_OUTPUT_FILE)
    print(f"Saved: {TERRAIN_OUTPUT_FILE}")
    save_to_file(places, SPOTS_OUTPUT_FILE, True)
    print(f"Saved: {SPOTS_OUTPUT_FILE}")
    print(f"Complete !!")

    end_time = time.time()
    print(f'Finish: {time.ctime(end_time)} ({round(end_time-start_time,3)} seconds)')
