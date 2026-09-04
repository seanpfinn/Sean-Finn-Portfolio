# ROMs

This directory is intentionally empty — **no game ROMs are committed to this repo.**

The Arcade page reads its library from `arcade-games.json`. Each entry names a
`rom` path that resolves to this folder. To make a cartridge playable, drop the
matching file in here using the exact filename from the manifest:

    assets/roms/pokemon-ruby.gba
    assets/roms/boktai.gba

Supported: raw `.gba` files (also `.zip`/`.7z` containing one).

The page checks whether each ROM exists before booting. A cartridge whose file is
missing still renders in the 3D library and is still rotatable — selecting it just
shows a "cartridge not inserted" state on the console screen instead of starting.

Note that anything placed here is served publicly from the site's own domain.
