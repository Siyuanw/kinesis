from pymobiledevice3.cli.remote import get_device_list
from pymobiledevice3.cli.cli_common import prompt_device_list
from pymobiledevice3.remote.common import TunnelProtocol
from pymobiledevice3.remote.remote_service_discovery import RemoteServiceDiscoveryService
from pymobiledevice3.remote.module_imports import MAX_IDLE_TIMEOUT, start_tunnel, verify_tunnel_imports
from pymobiledevice3.services.dvt.dvt_secure_socket_proxy import DvtSecureSocketProxyService
from pymobiledevice3.services.dvt.instruments.location_simulation import LocationSimulation
from pymobiledevice3.exceptions import NoDeviceConnectedError

import click
import asyncio
import eventlet
import socketio
from multiprocessing import Process
from typing import List, TextIO
import logging
import sys
import os

logger = logging.getLogger(__name__)

def server(tunnel_host, tunnel_port):
    clients = {}
    sio = socketio.Server(cors_allowed_origins='*')
    app = socketio.WSGIApp(sio, static_files={
        '/': os.path.join(os.path.dirname(__file__), 'index.html'),
        '/index.js': os.path.join(os.path.dirname(__file__), 'index.js'),
        '/main.css': os.path.join(os.path.dirname(__file__), 'main.css'),
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

# Reference: https://github.com/doronz88/pymobiledevice3/blob/master/pymobiledevice3/cli/remote.py
async def tunnel_task(
        service_provider: RemoteServiceDiscoveryService, secrets: TextIO = None,
        script_mode: bool = False, max_idle_timeout: float = MAX_IDLE_TIMEOUT,
        protocol: TunnelProtocol = TunnelProtocol.QUIC) -> None:
    if start_tunnel is None:
        raise NotImplementedError('failed to start the QUIC tunnel on your platform')

    async with start_tunnel(service_provider, secrets=secrets, max_idle_timeout=max_idle_timeout,
                            protocol=protocol) as tunnel_result:
        logger.info('tunnel created')
        if script_mode:
            print(f'{tunnel_result.address} {tunnel_result.port}')
        else:
            if secrets is not None:
                print(click.style('Secrets: ', bold=True, fg='magenta') +
                      click.style(secrets.name, bold=True, fg='white'))
            print(click.style('UDID: ', bold=True, fg='yellow') +
                  click.style(service_provider.udid, bold=True, fg='white'))
            print(click.style('ProductType: ', bold=True, fg='yellow') +
                  click.style(service_provider.product_type, bold=True, fg='white'))
            print(click.style('ProductVersion: ', bold=True, fg='yellow') +
                  click.style(service_provider.product_version, bold=True, fg='white'))
            print(click.style('Interface: ', bold=True, fg='yellow') +
                  click.style(tunnel_result.interface, bold=True, fg='white'))
            print(click.style('Protocol: ', bold=True, fg='yellow') +
                  click.style(tunnel_result.protocol, bold=True, fg='white'))
            print(click.style('RSD Address: ', bold=True, fg='yellow') +
                  click.style(tunnel_result.address, bold=True, fg='white'))
            print(click.style('RSD Port: ', bold=True, fg='yellow') +
                  click.style(tunnel_result.port, bold=True, fg='white'))
            print(click.style('Use the follow connection option:\n', bold=True, fg='yellow') +
                  click.style(f'--rsd {tunnel_result.address} {tunnel_result.port}', bold=True, fg='cyan'))
        sys.stdout.flush()

        # Bind socket
        ui = Process(target=server, args=(tunnel_result.address, tunnel_result.port))
        ui.start()

        await tunnel_result.client.wait_closed()
        logger.info('tunnel was closed')

def create_tunnel():
    """ start quic tunnel """
    if not verify_tunnel_imports():
        return
    devices = get_device_list()

    if not devices:
        # no devices were found
        raise NoDeviceConnectedError()
    if len(devices) == 1:
        # only one device found
        rsd = devices[0]
    else:
        # several devices were found
        rsd = prompt_device_list(devices)

    asyncio.run(tunnel_task(rsd))

if __name__ == '__main__':
    try:
        create_tunnel()
    except KeyboardInterrupt:
        pass
