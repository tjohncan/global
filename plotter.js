const twoPi = 2 * Math.PI;

const globe_canvas = document.getElementById("globeCanvas");
const globe_context = globe_canvas.getContext("2d");

let globalPayload = null;
let spotsPayload = null;
let allPoints = null;
let colorArray = null;

function drawRing(x, y, radius, fill_color, stroke_width, stroke_color) {
    globe_context.beginPath();
    globe_context.arc(x, y, radius, 0, twoPi);
    globe_context.fillStyle = fill_color;
    globe_context.fill();
    globe_context.lineWidth = stroke_width;
    globe_context.strokeStyle = stroke_color;
    globe_context.stroke();
}

function centerFocus() {
    drawRing(360, 360, 11, 'rgba(0,0,0,0)', 1, 'rgba(192,192,192,0.76)');
}

async function loadData() {
    if (!globalPayload) {
        const res = await fetch('xyz_points.json');
        globalPayload = await res.json();
    }
    return globalPayload;
}

async function loadSpots() {
    if (!spotsPayload) {
        const res = await fetch('spots.json');
        spotsPayload = await res.json();
    }
    return spotsPayload;
}

function sortPoints(points, transitionType) {
    const sorted = [...points];

    sorted.sort((a, b) => {
        if (a.group !== b.group) return a.group - b.group;

        switch (transitionType) {
            case 'middle-out':
                const centerX = 360, centerY = 360;
                const distA = Math.pow(a.screenX - centerX, 2) + Math.pow(a.screenY - centerY, 2);
                const distB = Math.pow(b.screenX - centerX, 2) + Math.pow(b.screenY - centerY, 2);
                return distA - distB;
            case 'wipe-from-left':
                return a._y - b._y;
            case 'wipe-from-right':
                return b._y - a._y;
            case 'wipe-from-top':
                return b._z - a._z;
            case 'wipe-from-bottom':
                return a._z - b._z;
            default:
                return 0;
        }
    });

    return sorted;
}

let currentTimeouts = [];

function executeTransition(visiblePoints, transitionType, duration = 144, steps = 13) {
    currentTimeouts.forEach(timeout => clearTimeout(timeout));
    currentTimeouts = [];

    if (transitionType === 'instantaneous') {
        globe_context.clearRect(0, 0, globe_canvas.width, globe_canvas.height);
        visiblePoints.forEach(point => {
            drawRing(point.screenX, point.screenY, point.fillSize, point.colorString, point.strokeSize, point.strokeColor);
        });
        centerFocus();
        return;
    }

    const sortedPoints = sortPoints(visiblePoints, transitionType);
    const pointsPerStep = Math.ceil(sortedPoints.length / steps);
    let currentStep = 0;

    globe_context.clearRect(0, 0, globe_canvas.width, globe_canvas.height);

    const stepDuration = duration / steps;

    function drawStep() {
        const stepStart = performance.now();
        const endIndex = Math.min((currentStep + 1) * pointsPerStep, sortedPoints.length);

        for (let i = currentStep * pointsPerStep; i < endIndex; i++) {
            const point = sortedPoints[i];
            drawRing(point.screenX, point.screenY, point.fillSize, point.colorString, point.strokeSize, point.strokeColor);
        }

        currentStep++;

        if (currentStep < steps) {
            const computeTime = performance.now() - stepStart;
            if (computeTime < stepDuration) {
                const timeToWait = stepDuration - computeTime;
                const timeout = setTimeout(drawStep, timeToWait);
                currentTimeouts.push(timeout);
            } else {
                drawStep();
            }
        } else {
            centerFocus();
        }
    }

    drawStep();
}

async function renderGlobe(pitchDegrees = 0, yawDegrees = 0, rotationDegrees = 0, transitionType = 'instantaneous') {
    const rotation = rotationDegrees / 180 * Math.PI;
    const sinRotation = Math.sin(rotation);
    const cosRotation = Math.cos(rotation);

    const alpha = yawDegrees / 180 * Math.PI;
    const gamma = pitchDegrees / 180 * Math.PI;
    const sin_alpha = Math.sin(-alpha);
    const cos_alpha = Math.cos(-alpha);
    const sin_gamma = Math.sin(gamma);
    const cos_gamma = Math.cos(gamma);

    const visiblePoints = [];

    allPoints.forEach(function(xyzc) {
        const _x = xyzc[1] * cos_gamma * cos_alpha - xyzc[2] * cos_gamma * sin_alpha + xyzc[3] * sin_gamma;

        if (_x >= 0.0000001) {
            const _y = xyzc[1] * sin_alpha + xyzc[2] * cos_alpha;
            const _z = -xyzc[1] * sin_gamma * cos_alpha + xyzc[2] * sin_gamma * sin_alpha + xyzc[3] * cos_gamma;

            const _group_num = xyzc[0];
            const _color_num = xyzc[4];

            let fillSize, strokeSize;
            switch (_group_num) {
                case 1: // terrain
                    fillSize = 0.66 + 0.22 * Math.pow(_x, 2);
                    strokeSize = 0.33 + 0.22 * Math.pow(_x, 2);
                    break;
                case 2: // latitudes + poles
                    fillSize = 2 + 3.777 * Math.pow(_x, 2);
                    strokeSize = 1 + 2.777 * Math.pow(_x, 2);
                    break;
                case 3: // "special spots"
                    fillSize = 4 + 2 * Math.pow(_x, 2);
                    strokeSize = 0;
                    break;
                default:
                    fillSize = 1;
                    strokeSize = 0.5;
            }

            const colorString = 'rgb(' + colorArray[_color_num][2] + ')';
            let strokeColor;
            switch (_group_num) {
                case 1: // terrain
                    strokeColor = colorString;
                    break;
                default: // latitudes, poles, spots
                    strokeColor = 'rgb(' + colorArray[6][2] + ')';
            }

            const rotatedY = _y * cosRotation - _z * sinRotation;
            const rotatedZ = _y * sinRotation + _z * cosRotation;

            visiblePoints.push({
                screenX: rotatedY * 330 + 360,
                screenY: -rotatedZ * 330 + 360,
                fillSize,
                colorString,
                strokeSize,
                strokeColor,
                _y: rotatedY,
                _z: rotatedZ,
                group: _group_num
            });
        }
    });

    if (transitionType === 'instantaneous') {
        globe_context.clearRect(0, 0, globe_canvas.width, globe_canvas.height);
    }

    executeTransition(visiblePoints, transitionType);
    window.scrollTo(0, 0);
}

let cumulativePitch = 0;
let cumulativeYaw = 0;
let cumulativeRotation = 0;
let upsideDown = false;
let isCompoundMovement = false;

function degreesToDMS(degrees, isLatitude) {
    const absValue = Math.abs(degrees);
    const deg = Math.floor(absValue);
    const minFloat = (absValue - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = Math.round((minFloat - min) * 60);

    let direction;
    if (isLatitude) {
        direction = degrees >= 0 ? 'N' : 'S';
    } else {
        direction = degrees >= 0 ? 'E' : 'W';
    }

    return `(${deg}\u00B0 ${min}' ${sec}" ${direction})`;
}

function updateDisplayText() {
    let lat = cumulativePitch;
    let lon = cumulativeYaw;

    lat = (((lat + 90) % 360) + 360) % 360 - 90;
    if (lat > 90) {
        lat = 180 - lat;
        lon += 180;
    }

    lon = (((lon + 180) % 360) + 360) % 360 - 180;
    if (lon === 180) lon = -180;

    lat = Math.round(lat * 1000) / 1000;
    lon = Math.round(lon * 1000) / 1000;

    const atNorthPole = Math.abs(lat - 90) < 0.001;
    const atSouthPole = Math.abs(lat + 90) < 0.001;

    if (atNorthPole || atSouthPole) {
        lon = 0.000;
    }

    document.getElementById('currentLat').textContent = lat.toFixed(3);
    document.getElementById('currentLon').textContent = lon.toFixed(3);
    document.getElementById('currentLatDMS').textContent = degreesToDMS(lat, true);
    document.getElementById('currentLonDMS').textContent = degreesToDMS(lon, false);
}

function navigate(pitch, yaw, transition = 'instantaneous') {
    if (isCompoundMovement) {
        return;
    }

    const rotation = ((Math.round(cumulativeRotation) % 360) + 360) % 360;
    let transformedPitch, transformedYaw;

    if (rotation === 90) {
        transformedPitch = -yaw;
        transformedYaw = pitch;
    } else if (rotation === 180) {
        transformedPitch = -pitch;
        transformedYaw = -yaw;
    } else if (rotation === 270) {
        transformedPitch = yaw;
        transformedYaw = -pitch;
    } else {
        transformedPitch = pitch;
        transformedYaw = yaw;
    }

    const currentDisplayLat = -cumulativePitch;
    let displayLat = currentDisplayLat;
    displayLat = (((displayLat + 90) % 360) + 360) % 360 - 90;
    if (displayLat > 90) displayLat = 180 - displayLat;
    displayLat = Math.round(displayLat * 1000) / 1000;

    const atNorthPole = Math.abs(displayLat - 90) < 0.001;
    const atSouthPole = Math.abs(displayLat + 90) < 0.001;

    // edge-case compound movements for escaping poles
    if ((atNorthPole || atSouthPole) && transformedYaw !== 0 && transformedPitch === 0) {
        isCompoundMovement = true;  // lock

        const moveAmount = Math.abs(transformedYaw);

        if (atNorthPole) {
            updateState(moveAmount, 0, 'silent');
            updateState(0, transformedYaw, 'silent');
            updateState(0, transformedYaw, 'silent');
        } else {
            updateState(moveAmount, 0, 'silent');
            updateState(0, transformedYaw, 'silent');
            updateState(0, transformedYaw, 'silent');
        }

        cumulativeRotation += (transformedYaw > 0 ? -90 : 90);
        updateDisplayText();
        renderGlobe(cumulativePitch, cumulativeYaw, cumulativeRotation, transition);

        isCompoundMovement = false;  // unlock
        return;
    }

    updateState(transformedPitch, transformedYaw, transition);
}

function updateState(pitch, yaw, transition = 'instantaneous') {
    const oldPitch = cumulativePitch;
    const newPitch = cumulativePitch + pitch;

    // detect pole crossing
    if (Math.floor((oldPitch - 90) / 180) !== Math.floor((newPitch - 90) / 180)) {
        upsideDown = !upsideDown;
    }

    cumulativePitch += pitch;
    const adjustedYaw = upsideDown ? -yaw : yaw;
    cumulativeYaw += adjustedYaw;

    if (Math.abs(cumulativePitch) > 999999999) cumulativePitch = cumulativePitch > 0 ? 999999999 : -999999999;
    if (Math.abs(cumulativeYaw) > 999999999) cumulativeYaw = cumulativeYaw > 0 ? 999999999 : -999999999;

    if (transition !== 'silent') {
        updateDisplayText();
        renderGlobe(cumulativePitch, cumulativeYaw, cumulativeRotation, transition);
    }
}


function rotate90Left() {
    cumulativeRotation += 90;
    if (Math.abs(cumulativeRotation) > 999999999) cumulativeRotation = cumulativeRotation > 0 ? 999999999 : -999999999;
    updateDisplayText();
    renderGlobe(cumulativePitch, cumulativeYaw, cumulativeRotation, 'instantaneous');
}

function rotate90Right() {
    cumulativeRotation -= 90;
    if (Math.abs(cumulativeRotation) > 999999999) cumulativeRotation = cumulativeRotation > 0 ? 999999999 : -999999999;
    updateDisplayText();
    renderGlobe(cumulativePitch, cumulativeYaw, cumulativeRotation, 'instantaneous');
}

function jumpToCoordinates() {
    const lat = parseFloat(document.getElementById('inputLat').value);
    const lon = parseFloat(document.getElementById('inputLon').value);

    if (isNaN(lat) || isNaN(lon)) {
        alert('ERROR: Invalid (non-numeric) input.');
        return;
    }

    cumulativePitch = lat;
    cumulativeYaw = lon;
    cumulativeRotation = 0;
    upsideDown = false;
    updateDisplayText();
    renderGlobe(cumulativePitch, cumulativeYaw, cumulativeRotation, 'middle-out');
}

function clearCoordinates() {
    document.getElementById('inputLat').value = '0';
    document.getElementById('inputLon').value = '0';
}

document.getElementById('up45').onclick = () => navigate(45, 0, 'wipe-from-top');
document.getElementById('up90').onclick = () => navigate(90, 0, 'wipe-from-top');
document.getElementById('down45').onclick = () => navigate(-45, 0, 'wipe-from-bottom');
document.getElementById('down90').onclick = () => navigate(-90, 0, 'wipe-from-bottom');
document.getElementById('left45').onclick = () => navigate(0, -45, 'wipe-from-left');
document.getElementById('left90').onclick = () => navigate(0, -90, 'wipe-from-left');
document.getElementById('right45').onclick = () => navigate(0, 45, 'wipe-from-right');
document.getElementById('right90').onclick = () => navigate(0, 90, 'wipe-from-right');
document.getElementById('jumpButton').onclick = jumpToCoordinates;
document.getElementById('clearButton').onclick = clearCoordinates;
document.getElementById('rotateLeft').onclick = rotate90Left;
document.getElementById('rotateRight').onclick = rotate90Right;

document.getElementById('inputLat').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') jumpToCoordinates();
});
document.getElementById('inputLon').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') jumpToCoordinates();
});

function populatePlacesTable() {
    const tbody = document.getElementById('placesTableBody');

    spotsPayload.forEach(spot => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid rgba(192,192,192,0.3)';

        const placeCell = document.createElement('td');
        placeCell.style.padding = '4px';
        const placeLink = document.createElement('span');
        placeLink.className = 'place-link';
        placeLink.textContent = spot.place;
        placeLink.onclick = () => {
            cumulativePitch = spot.jump_lat;
            cumulativeYaw = spot.jump_lon;
            cumulativeRotation = 0;
            upsideDown = false;
            updateDisplayText();
            renderGlobe(cumulativePitch, cumulativeYaw, cumulativeRotation, 'middle-out');
        };
        placeCell.appendChild(placeLink);

        const latCell = document.createElement('td');
        latCell.style.padding = '4px';
        latCell.textContent = spot.latitude;

        const lonCell = document.createElement('td');
        lonCell.style.padding = '4px';
        lonCell.textContent = spot.longitude;

        const noteCell = document.createElement('td');
        noteCell.style.padding = '4px';
        noteCell.textContent = spot.note;

        row.appendChild(placeCell);
        row.appendChild(latCell);
        row.appendChild(lonCell);
        row.appendChild(noteCell);
        tbody.appendChild(row);
    });
}

async function initializeData() {
    const payload = await loadData();
    const spots = await loadSpots();

    colorArray = payload[0];
    const pointArray = payload[2];

    // convert special spots to main points array format and append
    const spotsAsPoints = spots.map(s => [s.group, s.x, s.y, s.z, s.color]);
    allPoints = [...pointArray, ...spotsAsPoints];

    updateDisplayText();
    populatePlacesTable();
    renderGlobe(cumulativePitch, cumulativeYaw, cumulativeRotation, 'middle-out');
}

initializeData();
