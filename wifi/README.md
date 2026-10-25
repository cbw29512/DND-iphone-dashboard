# Donovan the Fallen — Wi-Fi QR Edition

## Definition of Done

Laptop runs Donovan’s combat buttons. iPhone, connected to the same reachable Wi-Fi, scans a QR code and sees a **display-only** portrait/result screen. Clicking the next action on the laptop overwrites the displayed result. No monster targeting, AC comparisons, or remote DM control. The public GitHub Pages page remains a standalone single-device card.

## State and data schema

- `Snapshot`: latest Donovan `result`, current `hp`, `turn`, `portrait`, remaining `slots`, `channels`, and action/bonus/reaction indicators.
- `RollResult`: `title`, `kind`, `amount`, `roll`, `details`, and `economy`.
- Memory: one **latest** snapshot in RAM; it is replaced for each roll and retrieved by iPhone polling. Laptop browser retains its own saved state. Server does not store monsters or player accounts.

## Windows setup

1. Download and **Extract All** files from the ZIP first.
2. Double-click `Start_Donovan_WiFi_Windows.bat` (Python 3 must be installed).
3. The laptop opens `http://localhost:8765/`; keep the command window running.
4. Connect the iPhone to the **same Wi-Fi** as the laptop. Open the iPhone Camera, scan the QR shown on the laptop, and tap the URL.
5. Tap a spell, Mace, or Channel Divinity button on the laptop. The phone updates automatically and shows that result until the next button press.

The QR links to the laptop’s LAN IPv4 address in the form `http://192.168.x.x:8765/?view=phone`. If the detected address is not your laptop's active Wi-Fi IPv4, run `ipconfig` in Windows Command Prompt, find **Wireless LAN adapter Wi-Fi → IPv4 Address**, enter that address in the pairing panel, then click **Update QR**.

If the iPhone cannot load the URL, keep both devices on the same non-guest Wi-Fi, turn off VPNs temporarily, and allow Python on Windows Firewall's **Private** networks. Guest networks and some routers block devices from reaching each other. A phone on cellular is not on the laptop's local Wi-Fi. The GitHub Pages HTTPS link cannot directly replace the LAN relay: its public static files do not provide this server.

## Safety and design

- Only `localhost` clients can POST results. Wi-Fi clients only get the phone display. No login is included: anyone on the trusted local Wi-Fi could view the display and the QR link.
- Do not port-forward TCP 8765 to the Internet. Use a trusted private Wi-Fi network.
- The QR is generated locally using Python `qrcode` and needs no third-party QR website.
- The latest result is kept in RAM. A laptop server restart clears the last transmitted result; a new button press republishes it.
- Host + browser connectivity on a real Windows laptop and physical iPhone require on-device verification.

## Architecture

- `index.html`: unchanged Donovan combat card; same layout as GitHub Pages.
- `wifi_server.py`: FastAPI relay and presentation state.
- `run_wifi.py`: start the server and open the laptop browser.
- `wifi_network.py`: LAN address discovery and QR generation.
- `wifi_pairing.py`: injects a pairing panel on laptop; never on iPhone.
- `requirements.txt`: server + QR dependencies.
- `Start_Donovan_WiFi_Windows.bat`: install dependencies if necessary and launch.

Keep each Python module under 150 lines where practical. Failures are logged; the iPhone will show `DISCONNECTED` when polling fails.
