# oldskool-shot

Extremely braindead GNOME extension that re-exports just enough functionality that `gnome-screenshot` used to use to let you implement
`Ctrl-Shift-PrintScreen` and `Ctrl-Alt-PrintScreen` (that is, copy region of screen to clipboard or copy active window to clipboard) out to
DBus.

## Installation

Install the extension, then notice a new DBus interface under `xyz.mm12.oldskoolshot.Screenshot`. It has two methods, which
take no arguments and return a boolean for success:

- `SelectShot`: interactively select an area on screen and copy it to the clipboard
- `WindowShot`: capture the active window and copy it to the clipboard

Specifically, something like

```
$ gdbus call --session --dest xyz.mm12.oldskoolshot --object-path /xyz/mm12/oldskoolshot/Screenshot --method xyz.mm12.oldskoolshot.Screenshot.SelectShot
```

can be set as a custom shortcut for `Ctrl-Shift-PrintScreen`, and similarly for `WindowShot`.

## License

Released under the GPL (v2 or later), because nontrivial parts of it are copied wholesale from upstream `gnome-shell` (`js/ui/screenshot.js`).
