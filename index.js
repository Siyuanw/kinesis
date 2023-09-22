const socket = io();


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


//L.Routing.control({
//    waypoints: [
//        L.latLng(53.271039, -6.205128),
//        L.latLng(53.271408, -6.203002)
//    ],
//    routeWhileDragging: true
//}).addTo(map);


var marker = null;
var markerLastPos = null;
var markerShadowPos = null;

var path = L.polyline([], {color: 'red'}).addTo(map);
var stepIndex = 0; // index of next step of path
var speed = 2; // speed unit meter per second
var moving = false;
var pause = false;

var tickInterval = 1000;


var tick = setInterval(function() {
    if (moving && !pause) {
        navigate();
    } else {
        // if not moving, try to refresh location
        move(L.latLng(0, 0), 0); // simply move 0 meter towards (0, 0)
    }
}, tickInterval);


map.on('click', function(e) {
    if (!initMain(e)) {
        if (!moving) {
            addStep(e.latlng)
        }
        L.popup()
            .setLatLng(e.latlng)
            .setContent(`<p><button onclick="clearSteps()">Clear</button><button onclick="navigate()">Navigate</button></p>`)
            .openOn(map);
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
        console.log(`emit location ${latlng.lat},${latlng.lng}`);
        socket.emit('location', `${latlng.lat},${latlng.lng}`);
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
    const newPos = geolib.computeDestinationPoint(markerShadowPos, distance, geolib.getGreatCircleBearing(markerShadowPos, target))
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

    console.log(`emit location ${markerShadowPos.lat},${markerShadowPos.lng}`);
    socket.emit('location', `${markerShadowPos.lat},${markerShadowPos.lng}`);
    marker.setLatLng(markerShadowPos);
}


function addStep(latlng) {
    console.log(`add ${latlng.lat},${latlng.lng}`);
    if (path.isEmpty()) {
        // set the start point
        path.addLatLng(marker.getLatLng());
    }
    path.addLatLng(latlng);
    map.closePopup();
}


function clearSteps() {
    console.log(`clear path and stop`);
    path.setLatLngs([]);
    moving = false;
    stepIndex = 0;
    map.closePopup();
}


function navigate() {
    console.log(`navigate`);

    if (!moving) {
        map.closePopup();
        markerShadowPos = marker.getLatLng(); // start point
        stepIndex = 1; // move towards 1st step
        moving = true;
        pause = false;
    }

    if (moving && !pause) {
        const pathLatlngs = path.getLatLngs();
        stepLatlng = pathLatlngs[stepIndex];
        move(stepLatlng, speed * tickInterval / 1000)
        // after moved, check if we reached the goal
        if (stepLatlng.equals(markerShadowPos)) {
            stepIndex += 1; // proceed with next step
            if (stepIndex >= pathLatlngs.length) {
                pause = true; // stop but not clear path
            }
        }
    }
}
