from pymobiledevice3.remote.remote_service_discovery import RemoteServiceDiscoveryService
from pymobiledevice3.services.dvt.dvt_secure_socket_proxy import DvtSecureSocketProxyService
from pymobiledevice3.services.dvt.instruments.location_simulation import LocationSimulation

import eventlet
import socketio


# find the host and port by running
# sudo python3 -m pymobiledevice3 remote start-quic-tunnel
host = '::1'
port = 65535


sio = socketio.Server(cors_allowed_origins='*')
app = socketio.WSGIApp(sio, static_files={
    '/': 'index.html',
    '/index.js': 'index.js',
    '/main.css': 'main.css',
})


clients = {}


@sio.event
def connect(sid, environ):
    print('connect', sid)
    rsd = RemoteServiceDiscoveryService((host, port))
    rsd.connect()
    dvt = DvtSecureSocketProxyService(rsd)
    dvt.perform_handshake()
    loc = LocationSimulation(dvt)
    clients[sid] = [rsd, loc]


@sio.event
def location(sid, data):
    print('sid', sid, 'location', data)
    la, lo = list(map(lambda x: float(x), data.split(',')))
    clients[sid][1].simulate_location(la, lo)


@sio.event
def disconnect(sid):
    print('disconnect ', sid)
    clients[sid][0].service.close()


if __name__ == '__main__':
    eventlet.wsgi.server(eventlet.listen(('localhost', 3000)), app)
