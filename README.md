# The Crooked Moon Clock

A FoundryVTT module that provides a custom clock widget for tracking time in
the Crooked Moon setting.

Not affiliated with Avantris Entertainment nor Dragon Clan Studio.
Check out their amazing Foundry VTT module [here](https://foundryvtt.com/packages/the-crooked-moon-2014).

## Features

- Six-segment clock widget with GM time controls.
- Per-user show/hide control in the Token Scene Controls.
- Per-user clock scale, transition sound and sound volume settings.
- A short creaking/ticking sound when advancing to the next segment.
- Optional scene lighting integration with serialized, latest-wins transitions.
- Lighting transitions start from the currently applied scene environment and stop safely when the scene or target changes.

The clock is currently a narrative clock independent of Foundry's `game.time` calendar. Advancing the widget does not automatically advance the D&D5e calendar.

## Preview
![Clock Widget](readme-assets/clock.png)

### Clock Animation
https://github.com/user-attachments/assets/40599cd9-5760-4aab-805f-6947707cee9c

### Settings
![Settings Panel](readme-assets/settings.png)

## Use

The clock is shown by default for each user. Use **Token Scene Controls → Toggle CM Clock** to hide or show it for your own user. The GM can advance or rewind the time segments from the controls in the widget.

Sound can be disabled or its volume adjusted in the module settings. Lighting integration is disabled by default because it overwrites the active scene's ambient environment.

## Compatibility

This fork targets **Foundry VTT 14** and is intended to work alongside **D&D5e 6.0.0**. The module does not use D&D5e-specific APIs or modify the system calendar.

## Support

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/breno-hof/tcm-clock/issues)
- **Source**: [breno-hof/tcm-clock](https://github.com/breno-hof/tcm-clock)

## License

Licensed under either of the following, at your choice:

- [Apache License, Version 2.0](https://github.com/breno-hof/tcm-clock/blob/master/LICENSE-APACHE.txt), or
- [MIT license](https://github.com/breno-hof/tcm-clock/blob/master/LICENSE-MIT.txt)

The original work is by Klaas-Jan Boon. This fork is maintained by `breno-hof`; modified files should retain the original attribution and identify the fork's changes when redistributed under Apache 2.0.

Unless explicitly stated otherwise, contributions intentionally submitted for inclusion in this repository are dual-licensed as above, without additional terms or conditions.

