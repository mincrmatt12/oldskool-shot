/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {SelectArea, Flashspot} from 'resource:///org/gnome/shell/ui/screenshot.js'

import St from 'gi://St';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import GLib from 'gi://GLib';

const SCHEMA = `
<node>
	<interface name="xyz.mm12.oldskoolshot.Screenshot">
		<method name="SelectShot">
			<arg type="b" direction="out" name="success" />
		</method>
		<method name="WindowShot">
			<arg type="b" direction="out" name="success" />
		</method>
	</interface>
</node>
`;

class ShotIface {
	constructor() {
		this._shooters = new Map();
	}

	_createScreenshot(invocation) {
		const sender = invocation.get_sender();
		if (this._shooters.has(sender)) {
			invocation.return_error_literal(
				Gio.IOErrorEnum, Gio.IOErrorEnum.BUSY,
				'There is an ongoing screenshot for this sender');
			return null;
		}

		const shooter = new Shell.Screenshot();
		shooter._watchNameId = Gio.bus_watch_name(Gio.BusType.SESSION,
			sender, 0, null, this._onNameVanished.bind(this));
		this._shooters.set(sender, shooter);

		return shooter;
	}

	_onNameVanished(connection, name) {
		const shooter = this._shooters.get(name);
		if (!shooter)
			return;

		Gio.bus_unwatch_name(shooter._watchNameId);
		this._shooters.delete(name);
	}

	_flashAsync(shooter) {
        return new Promise((resolve, _reject) => {
            shooter.connect('screenshot_taken', (s, area) => {
                const flashspot = new Flashspot(area);
                flashspot.fire(resolve);

                global.display.get_sound_player().play_from_theme(
                    'screen-capture', 'Screenshot taken', null);
            });
        });
    }

	_sendToClipboard(stream) {
		stream.close(null);
		const bytes = stream.steal_as_bytes();
		const clipboard = St.Clipboard.get_default();
		clipboard.set_content(St.ClipboardType.CLIPBOARD, 'image/png', bytes);
	}

	async WindowShotAsync(params, invocation) {
		const shot = this._createScreenshot(invocation);
		if (!shot)
			return;

		let stream = Gio.MemoryOutputStream.new_resizable();

		try {
			await Promise.all([
				this._flashAsync(shot),
				shot.screenshot_window(true, true, stream)
			]);
			this._sendToClipboard(stream);
		}
		catch {
			invocation.return_value(new GLib.Variant('(b)', [false]));
			return;
		}
		finally {
			this._onNameVanished(null, invocation.get_sender());
		}

		invocation.return_value(new GLib.Variant('(b)', [true]));
	}

	async SelectShotAsync(params, invocation) {
		const shot = this._createScreenshot(invocation);
		if (!shot)
			return;

		const selectArea = new SelectArea();

		let stream = Gio.MemoryOutputStream.new_resizable();

		try {
			const area = await selectArea.selectAsync();
			await Promise.all([
				this._flashAsync(shot),
				shot.screenshot_area(area.x, area.y, area.width, area.height, stream)
			]);
			this._sendToClipboard(stream);
		}
		catch {
			invocation.return_value(new GLib.Variant('(b)', [false]));
			return;
		}
		finally {
			this._onNameVanished(null, invocation.get_sender());
		}

		invocation.return_value(new GLib.Variant('(b)', [true]));
	}
}

export default class OldSkoolScreenshot extends Extension {
	constructor(meta) {
		super(meta);

		this._dbus = null;
	}

	_busAcquired(connection, name) {
		this._dbus = Gio.DBusExportedObject.wrapJSObject(SCHEMA, new ShotIface());
		this._dbus.export(
			connection,
			"/xyz/mm12/oldskoolshot/Screenshot"
		);
	}

	_nameAcquired(connection, name) {}
	_nameLost(connection, name) {}

    enable() {
		this._dbusOwner = Gio.bus_own_name(
			Gio.BusType.SESSION,
			'xyz.mm12.oldskoolshot',
			Gio.BusNameOwnerFlags.NONE,
			this._busAcquired.bind(this),
			this._nameAcquired.bind(this),
			this._nameLost.bind(this)
		)
    }

    disable() {
		Gio.bus_unown_name(this._dbusOwner);

		if (this._dbus) {
			this._dbus.flush();
			this._dbus.unexport();
			this._dbus = null;
		}

		this._dbusOwner = null;
    }
}
