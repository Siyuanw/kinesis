const socket = io();

const sendLocation = (latlng) => {
    console.log(`emit location ${latlng}`);
    socket.emit('location', latlng);
}


const center = L.latLng(53.338228, -6.259323);


const map = L.map('map', {
    center: center,
    zoom: 12,
    doubleClickZoom: false,
});


const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);


// L.Routing.control({
//     waypoints: [
//         L.latLng(53.338228, -6.259323),
//         L.latLng(53.344275, -6.272076)
//     ],
//     routeWhileDragging: true
// }).addTo(map);


let marker = null;
let markerLastPos = null;
let markerShadowPos = null; // TODO

let path = L.polyline([], {color: 'red'}).addTo(map);
let stepIndex = 1; // index of next step of path
let speed = 1; // speed unit meter per second
let loop = 'off'; // off; loop; uturn
let pause = false;

let tickInterval = 1000;


let tick = setInterval(function() {
    if (!pause) {
        navigate();
    } else {
        // if not moving, try to refresh location
        move(L.latLng(0, 0), 0); // simply move 0 meter towards (0, 0)
    }
}, tickInterval);


const updateRadio = (name, value) => {
    document.getElementsByName(name).forEach((element) => {
        element.checked = element.value == value;
    });
}


const setSpeed = (v) => {
    updateRadio('speedChoice', v);
    speed = v;
}
setSpeed(speed);


const setLoop = (v) => {
    updateRadio('loopChoice', v);
    loop = v;
}
setLoop(loop);


const setPause = (v) => {
    document.getElementById('pauseSwitch').checked = v;
    pause = v;
}
setPause(pause);


document.getElementById('undoButton').addEventListener('click', deleteStep);
document.getElementById('stopButton').addEventListener('click', clearSteps);

document.getElementById('pauseSwitch').addEventListener('change', () => {
    pause = document.getElementById('pauseSwitch').checked;
    console.log(`pause ${pause}`)
});

document.getElementsByName('speedChoice').forEach((element) => {
    element.addEventListener('click', () => {
        speed = element.value;
        console.log(`speed ${speed}`)
    });
});

document.getElementsByName('loopChoice').forEach((element) => {
    element.addEventListener('click', () => {
        loop = element.value;
        console.log(`loop ${loop}`)
    });
});


map.on('click', function(e) {
    if (!initMain(e)) {
        addStep(e.latlng)
    }
});


// return true if initialized marker, false if already initialized
function initMain(e) {
    if (marker === null) {
        marker = L.marker(e.latlng, {draggable: true});
        if (teleport(e.latlng)) {
            marker.addTo(map);

            marker.on('mousedown', function(e) {
                markerLastPos = e.latlng;
            });

            marker.on('mouseup', function(e) {
                if (!teleport(e.latlng)) {
                    marker.setLatLng(markerLastPos);
                }
            });

        } else {
            // rollback so we can init it again
            marker = null;
        }
        return true;
    }
    return false
}


// return true if teleported, false if canceled teleportation
function teleport(latlng) {
    if (confirm('Teleport?')) {
        marker.setLatLng(latlng);
        markerShadowPos = latlng;
        sendLocation(`${markerShadowPos.lat},${markerShadowPos.lng}`)
        return true;
    }
    return false;
}


// move towards target with distance meters
function move(target, distance) {
    if (marker === null) {
        return false;
    }
    const start = markerShadowPos;
    const newPos = geolib.computeDestinationPoint(start, distance, geolib.getGreatCircleBearing(start, target))
    const newLatlng = L.latLng(newPos.latitude, newPos.longitude);

    // check if it's too far
    const dis1 = map.distance(start, target);
    const dis2 = map.distance(start, newLatlng);

    if (dis2 > dis1) {
        // we just move to destination
        markerShadowPos = target;
    } else {
        markerShadowPos = newLatlng;
    }

    sendLocation(`${markerShadowPos.lat},${markerShadowPos.lng}`)
    marker.setLatLng(markerShadowPos);
}


function addStep(latlng) {
    console.log(`add ${latlng.lat},${latlng.lng}`);
    if (path.isEmpty()) {
        // set the start point
        path.addLatLng(marker.getLatLng());
    }
    path.addLatLng(latlng);
}


function deleteStep() {
    const pathLatlngs = path.getLatLngs();
    // TODO
    if (pathLatlngs.length > 1 && stepIndex !== pathLatlngs.length - 1) {
        const deleted = pathLatlngs.pop();
        console.log(`deleted ${deleted.lat},${deleted.lng}`);
        path.setLatLngs([...pathLatlngs]);
    }
}


function clearSteps() {
    console.log(`clear path and stop`);
    path.setLatLngs([]);
    markerShadowPos = marker.getLatLng(); // start point
    stepIndex = 1;
}


function navigate() {
    if (!pause) {
        const pathLatlngs = path.getLatLngs();
        if (stepIndex < pathLatlngs.length) {
            stepLatlng = pathLatlngs[stepIndex];
            move(stepLatlng, speed * tickInterval / 1000)
            // after moved, check if we reached the goal
            if (stepLatlng.equals(markerShadowPos)) {
                stepIndex += 1; // proceed with next step
                if (stepIndex >= pathLatlngs.length) {
                    switch (loop) {
                        case 'loop':
                            console.log(`loop: move to start`);
                            stepIndex = 0;
                            break;
                        case 'uturn':
                            console.log(`loop: make uturn`);
                            pathLatlngs.reverse();
                            path.setLatLngs([...pathLatlngs]);
                            stepIndex = 1;
                            break;
                        case 'off':
                        default:
                            console.log(`loop: off`);
                            stepIndex -= 1; // make it valid
                            break;
                    }
                }
            }
        }
    }
}
