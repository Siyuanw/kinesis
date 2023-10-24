# Kinesis - Location Spoofing for iOS 17 - [Siyuanw/kinesis](https://github.com/Siyuanw/kinesis)

Built with `pymobiledevice3` and `leaflet`.

## Requirements

- Python version 3.11.X
- iOS Device in [developer mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)

## Run

Install pip3 dependencies

```shell
pip3 install -r requirements.txt
```

Have your device connected, **USB connection is required**

Start project

```shell
sudo python3 main.py
```

Browse [http://localhost:3000](http://localhost:3000)

## TODO

- [x] Run with one-command
- [ ] Better UI
- [x] Randomized location
- [x] Adjustable speed -> Choose between 3 speeds
- [x] Randomized speed
- [x] Closed path -> Use "loop" mode
- [x] Persist zoom and center
- [ ] OSRM Routing (?)
- [ ] Saved route
- [ ] ~~Electron~~ (why bother)
- [ ] ~~Get out of vanilla js before it's too late~~  (why bother)
