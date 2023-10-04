from cryptography.hazmat.primitives.asymmetric import rsa
from pymobiledevice3.cli.remote import get_device_list
from pymobiledevice3.remote.core_device_tunnel_service import create_core_device_tunnel_service
from pymobiledevice3.remote.remote_service_discovery import RemoteServiceDiscoveryService
from pymobiledevice3.services.dvt.dvt_secure_socket_proxy import DvtSecureSocketProxyService
from pymobiledevice3.services.dvt.instruments.location_simulation import LocationSimulation

import asyncio
import eventlet
import socketio
from multiprocessing import Process


def server(tunnel_host, tunnel_port):

    clients = {}
    sio = socketio.Server(cors_allowed_origins='*')
    app = socketio.WSGIApp(sio, static_files={
        '/': 'index.html',
        '/index.js': 'index.js',
        '/main.css': 'main.css',
    })

    @sio.event
    def connect(sid, environ):
        rsd = RemoteServiceDiscoveryService((tunnel_host, tunnel_port))
        rsd.connect()
        dvt = DvtSecureSocketProxyService(rsd)
        dvt.perform_handshake()
        loc = LocationSimulation(dvt)
        clients[sid] = [rsd, loc]

    @sio.event
    def location(sid, data):
        la, lo = list(map(lambda x: float(x), data.split(',')))
        clients[sid][1].simulate_location(la, lo)

    @sio.event
    def disconnect(sid):
        clients[sid][1].stop()
        clients[sid][0].service.close()
        clients.pop(sid)

    s = eventlet.listen(('localhost', 3000))
    [ip, port] = s.getsockname()
    print('--port', port)
    eventlet.wsgi.server(s, app)


async def start_quic_tunnel(service_provider: RemoteServiceDiscoveryService) -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with create_core_device_tunnel_service(service_provider, autopair=True) as service:
        async with service.start_quic_tunnel(private_key) as tunnel_result:
            print('UDID:', service_provider.udid)
            print('ProductType:', service_provider.product_type)
            print('ProductVersion:', service_provider.product_version)
            print('Interface:', tunnel_result.interface)
            print('--rsd', tunnel_result.address, tunnel_result.port)

            ui = Process(target=server, args=(tunnel_result.address, tunnel_result.port))
            ui.start()

            while True:
                await asyncio.sleep(.5)

def create_tunnel():
    devices = get_device_list()
    if not devices:
        # no devices were found
        raise Exception('NoDeviceConnectedError')
    if len(devices) == 1:
        # only one device found
        rsd = devices[0]
    else:
        # several devices were found
        raise Exception('TooManyDevicesConnectedError')

    asyncio.run(start_quic_tunnel(rsd))


if __name__ == '__main__':
    try:
        create_tunnel()
    except KeyboardInterrupt:
        pass
