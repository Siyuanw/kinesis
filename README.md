# Kinesis - Location Spoofing for iOS 17

Built with `pymobiledevice3` and `leaflet`.

## Run

Install pip3 dependencies

```shell
pip3 install -r requirements.txt
```

Have your device connected, USB connection is required

Run below command and you should get `RSD Address` and `RSD Port`

```shell
sudo python3 -m pymobiledevice3 remote start-quic-tunnel
```

Update the `RSD Address` and `RSD Port` in the `main.py`

Start project

```shell
python3 main.py
```

Browse [http://localhost:3000](http://localhost:3000)

## TODO

- [ ] Run with one-click
- [ ] Electron (?)
- [ ] Better UI
- [ ] Randomized location
- [ ] Adjustable and randomized speed
- [ ] Closed path
- [ ] OSRM Routing (?)
- [ ] Saved route
- [ ] Get out of vanilla js before it's too late
