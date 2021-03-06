readPrefs(init);

function init() {
	initOnce();
	if(!prefs.enabled)
		return updateState();
	browser.runtime.onMessage.addListener(onMessageFromContent);
	if(prefs.updateNotice) setTimeout(function() {
		browser.storage.local.set({
			updateNotice: false
		});
		browser.runtime.openOptionsPage();
	}, 500);
	return updateState();
}
function initOnce() {
	initOnce = function() {};
	setTimeout(createMenus, 50);
	updateHotkey();
}
function destroy() {
	browser.runtime.onMessage.removeListener(onMessageFromContent);
	updateState();
}
function toggle(enable) {
	if(enable)
		init();
	else
		destroy();
	updateMenus();
}
function onPrefChanged(key, newVal) {
	prefs[key] = newVal;
	if(key == "enabled")
		toggle(newVal);
	else if(
		key == "enabledLeft"
		|| key == "loadInBackgroundLeft"
		|| key == "enabledRight"
		|| key == "loadInBackgroundRight"
	)
		updateMenus();
	else if(key == "toggleKey")
		updateHotkey(250);
}
function updateState() {
	setTimeout(setState, 0, prefs.enabled);
}
function setState(enabled) {
	_log("setState(" + enabled + ")");
	var key = enabled ? "" : "-off";
	browser.browserAction.setIcon({
		path: {
			16: "icon16" + key + ".png",
			24: "icon24" + key + ".png"
		}
	});
}

browser.browserAction.onClicked.addListener(function() {
	_log("browserAction.onClicked");
	browser.storage.local.set({
		enabled: !prefs.enabled
	});
});

function createMenus() {
	// Note: browser.contextMenus.ACTION_MENU_TOP_LEVEL_LIMIT == 6
	browser.contextMenus.create({
		id: "enabledLeft",
		title: browser.i18n.getMessage("longLeftClick"),
		type: "checkbox",
		contexts: ["browser_action"]
	});
	browser.contextMenus.create({
		id: "loadInBackgroundLeft",
		title: browser.i18n.getMessage("loadInBackground"),
		type: "checkbox",
		contexts: ["browser_action"]
	});

	browser.contextMenus.create({
		id: "enabledRight",
		title: browser.i18n.getMessage("rightClick"),
		type: "checkbox",
		contexts: ["browser_action"]
	});
	browser.contextMenus.create({
		id: "loadInBackgroundRight",
		title: browser.i18n.getMessage("loadInBackground"),
		type: "checkbox",
		contexts: ["browser_action"]
	});

	browser.contextMenus.create({
		id: "optionsSeparator",
		type: "separator",
		contexts: ["browser_action"]
	});
	browser.contextMenus.create({
		id: "options",
		title: browser.i18n.getMessage("options"),
		icons: {
			"16": "icon16.png",
			"24": "icon24.png"
		},
		contexts: ["browser_action"]
	});

	browser.contextMenus.onClicked.addListener(function(info, tab) {
		var miId = info.menuItemId;
		if(miId == "options") {
			_log("contextMenus.onClicked(): " + miId);
			browser.runtime.openOptionsPage();
		}
		else if(
			miId == "enabledLeft"
			|| miId == "loadInBackgroundLeft"
			|| miId == "enabledRight"
			|| miId == "loadInBackgroundRight"
		) {
			_log("contextMenus.onClicked(): " + miId + " -> " + info.checked);
			browser.storage.local.set({
				[miId]: info.checked
			});
		}
	});

	setTimeout(updateMenus, 50);
}
function updateMenus() {
	browser.contextMenus.update("enabledLeft", {
		checked: prefs.enabledLeft,
		enabled: prefs.enabled
	});
	browser.contextMenus.update("loadInBackgroundLeft", {
		checked: prefs.loadInBackgroundLeft,
		enabled: prefs.enabled && prefs.enabledLeft
	});
	browser.contextMenus.update("enabledRight", {
		checked: prefs.enabledRight,
		enabled: prefs.enabled
	});
	browser.contextMenus.update("loadInBackgroundRight", {
		checked: prefs.loadInBackgroundRight,
		enabled: prefs.enabled && prefs.enabledRight
	});
}
function updateHotkey(delay = 0) {
	if(!("update" in browser.commands)) // Firefox 60+
		return;
	if(updateHotkey.timer || 0)
		return;
	updateHotkey.timer = setTimeout(function() {
		updateHotkey.timer = 0;
		if(prefs.toggleKey) {
			browser.commands.update({
				name: "_execute_browser_action",
				shortcut: prefs.toggleKey
			});
		}
		else {
			browser.commands.reset("_execute_browser_action");
		}
	}, delay);
}

function onMessageFromContent(msg, sender, sendResponse) {
	if(msg.action == "openURI") {
		if(msg.uri instanceof Blob) // Should be converted here to prevent security errors
			msg.uri = URL.createObjectURL(msg.uri);
		if(msg.loadIn == 1)
			openURIInWindow(sender.tab, msg);
		else
			openURIInTab(sender.tab, msg);
	}
}
function openURIInTab(sourceTab, data) {
	_log("openURIInTab(), inBG: " + data.inBG + ", URI: " + data.uri);
	var opts = {
		url: data.uri,
		active: !data.inBG,
		openerTabId: sourceTab.id
	};
	try {
		browser.tabs.create(opts).catch(notifyError);
	}
	catch(e) {
		// Type error for parameter createProperties (Property "openerTabId" is unsupported by Firefox) for tabs.create.
		if((e + "").indexOf('"openerTabId" is unsupported') == -1)
			throw e;
		_log("openURIInTab(): openerTabId property not supported, will use workaround");
		delete opts.openerTabId;
		opts.index = sourceTab.index + 1;
		browser.tabs.create(opts).catch(notifyError);
	}
}
function openURIInWindow(sourceTab, data) {
	_log("openURIInWindow(), inBG: " + data.inBG + ", URI: " + data.uri);
	var opts = {
		url: data.uri,
		focused: !data.inBG
	};
	try {
		browser.windows.create(opts).catch(notifyError);
	}
	catch(e) {
		// Type error for parameter createData (Property "focused" is unsupported by Firefox) for windows.create.
		if((e + "").indexOf('"focused" is unsupported') == -1)
			throw e;
		_log("openURIInWindow(): focused property not supported");
		delete opts.focused;
		browser.windows.create(opts).catch(notifyError);
	}
}
function notifyError(err) {
	browser.notifications.create({
		type: "basic",
		iconUrl: browser.extension.getURL("icon24-off.png"),
		title: browser.i18n.getMessage("extensionName"),
		message: "" + err
	});
}