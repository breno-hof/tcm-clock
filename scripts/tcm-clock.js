import { TCMClockSettings } from './settings.js';
import { TCMClockLighting } from './lighting.js';
import { TCMClockAnimations } from './animations.js';
import { TCM_CONSTANTS } from './constants.js';
import { TCMUtils } from './utils.js';

const { ApplicationV2 } = foundry.applications.api;

class TCMClock extends ApplicationV2 {
	static ID = TCM_CONSTANTS.MODULE_ID;
	static instance = null;

	constructor(options = {}) {
		super(options);

		this.socket = `module.${TCM_CONSTANTS.MODULE_ID}`;
		this.lighting = new TCMClockLighting();
		this.animations = new TCMClockAnimations();
		this.previousSegment = null;
		this.timeMutation = Promise.resolve();
		this.visibilityMutation = Promise.resolve();
	}

	static getInstance() {
		if (!TCMClock.instance) {
			const scale = TCMUtils.getSetting('clockScale');

			TCMClock.instance = new TCMClock({
				id: TCMClock.ID,
				window: { frame: false, positioned: true },
				position: {
					width: 512,
					height: 512,
					top: 50,
					left: 150,
					scale,
				}
			});
		}
		return TCMClock.instance;
	}

	initialize() {
		this.previousSegment = TCMUtils.getSetting('currentSegment');
		game.socket.on(this.socket, this._onSocketMessage.bind(this));

		Hooks.on('canvasReady', async () => {
			this.lighting.initialize();
			await this._syncClockVisibility();

			if (TCMUtils.isGM()) {
				const currentSegment = TCMUtils.getSetting('currentSegment');
				await this.lighting.handleLightingChange(currentSegment);
			}
		});

		Hooks.on('updateSetting', (setting) => {
			if (!setting.key.startsWith(`${TCM_CONSTANTS.MODULE_ID}.`)) return;
			void this._handleSettingUpdate(setting.key);
		});

		Hooks.on('getSceneControlButtons', (controls) => {
			if (!controls.tokens?.tools) return;

			const currentVisibility = TCMUtils.getSetting('clockVisible');
			controls.tokens.tools['tcm-clock'] = {
				name: 'tcm-clock',
				button: true,
				title: game.i18n.localize('TCMCLOCK.controls.toggleClock'),
				icon: 'fa-solid fa-clock',
				order: Object.keys(controls.tokens.tools).length,
				active: currentVisibility,
				onChange: () => this.toggleClockVisibility()
			};
		});
	}

	async _handleSettingUpdate(settingKey) {
		if (settingKey.endsWith('.clockVisible')) {
			await this._syncClockVisibility();
			return;
		}

		if (TCMUtils.getSetting('clockVisible') && this.rendered) {
			await this.render({ force: true });
		}

		if (settingKey.endsWith('.lightingIntegration') && TCMUtils.isGM()) {
			const currentSegment = TCMUtils.getSetting('currentSegment');
			void this.lighting.handleLightingChange(currentSegment).catch((error) => {
				console.warn('TCM Clock: Could not synchronize lighting integration:', error);
			});
		}
	}

	async _syncClockVisibility() {
		this.visibilityMutation = this.visibilityMutation
			.catch(() => {})
			.then(async () => {
				const visible = TCMUtils.getSetting('clockVisible');
				if (visible) {
					if (!this.rendered) await this.render({ force: true });
				} else if (this.rendered) {
					await this.close({ animate: false });
				}
			});

		return this.visibilityMutation;
	}

	async _prepareContext(_options = {}) {
		return {};
	}

	async _renderHTML(_context, _options) {
		return null;
	}

	_postRender() {
		this._setupDraggable(this.element);
	}

	_replaceHTML(_result, content, _options) {
		this._updateDynamicContent(content);
	}

	async _renderFrame(options) {
		const context = await this._prepareContext(options);
		const frame = await super._renderFrame(options);

		const target = this.hasFrame ? frame.querySelector('.window-content') : frame;
		if (!target) return frame;

		const overlayContainer = this._createOverlayContainer();
		overlayContainer.innerHTML = this._generateStaticFrameHTML();
		this._attachEventListeners(overlayContainer);
		target.appendChild(overlayContainer);

		await this._renderHTML(context, options);
		this._replaceHTML(null, overlayContainer);

		return frame;
	}

	_generateStaticFrameHTML() {
		const currentSegment = TCMUtils.getSetting('currentSegment');
		const currentNight = TCMUtils.getSetting('currentNight');
		const rotation = currentSegment * 60;

		return `
	<div class="clock-container">
	<div class="clock-face">
	<div class="clock-arrow" id="clock-arrow-overlay" style="transform: translate(-50%, -100%) rotate(${rotation}deg);"></div>
	</div>
	<div class="night-counter">
	Night <span class="night-number" id="night-number-overlay">${currentNight}</span>
	</div>
	${TCMUtils.isGM() ? `
	<div class="gm-controls">
	<button id="prev-time" title="${game.i18n.localize('TCMCLOCK.controls.previousTime')}">◄</button>
	<button id="next-time" title="${game.i18n.localize('TCMCLOCK.controls.nextTime')}">►</button>
	</div>
	` : ''}
	</div>
	`;
	}

	_attachEventListeners(container) {
		if (!TCMUtils.isGM()) return;

		const prevBtn = container.querySelector('#prev-time');
		const nextBtn = container.querySelector('#next-time');
		const nightCounter = container.querySelector('.night-counter');

		if (prevBtn) prevBtn.onclick = () => void this.changeTime(-1);
		if (nextBtn) nextBtn.onclick = () => void this.changeTime(1);
		if (nightCounter) nightCounter.onclick = () => void this.editNightCounter();
	}

	_createOverlayContainer() {
		const overlayContainer = document.createElement('div');
		overlayContainer.id = 'tcm-clock-overlay';
		overlayContainer.className = 'tcm-clock-overlay';
		overlayContainer.style.pointerEvents = 'auto';
		overlayContainer.style.userSelect = 'none';
		return overlayContainer;
	}

	_updateDynamicContent(container) {
		const existingArrow = container.querySelector('#clock-arrow-overlay');
		const existingNightNumber = container.querySelector('#night-number-overlay');

		if (existingArrow) {
			const currentSegment = TCMUtils.getSetting('currentSegment');
			this.animations.handleArrowUpdate(existingArrow, this.previousSegment, currentSegment);
			this.previousSegment = currentSegment;
		}

		if (existingNightNumber) {
			existingNightNumber.textContent = TCMUtils.getSetting('currentNight');
		}
	}

	_setupDraggable(element) {
		const dragHandle = element?.querySelector('.clock-face');
		if (dragHandle) new foundry.applications.ux.Draggable(this, element, dragHandle);
	}

	changeTime(direction) {
		if (!TCMUtils.isGM()) return Promise.resolve();

		this.timeMutation = this.timeMutation
			.catch(() => {})
			.then(() => this._changeTime(direction));

		return this.timeMutation.catch((error) => {
			console.warn('TCM Clock: Could not change time:', error);
		});
	}

	async _changeTime(direction) {
		let currentSegment = TCMUtils.getSetting('currentSegment');
		let currentNight = TCMUtils.getSetting('currentNight');
		const nightIncrementSegment = TCMUtils.getSetting('nightIncrementSegment');
		const incrementSegmentIndex = TCMUtils.getSegmentIndex(nightIncrementSegment);
		const oldSegment = currentSegment;

		currentSegment += direction;
		if (currentSegment < 0) currentSegment = TCM_CONSTANTS.SEGMENTS.length - 1;
		if (currentSegment >= TCM_CONSTANTS.SEGMENTS.length) currentSegment = 0;

		if (direction > 0 && currentSegment === incrementSegmentIndex) currentNight++;
		if (direction < 0) {
			const previousSegmentIndex = (incrementSegmentIndex - 1 + TCM_CONSTANTS.SEGMENTS.length)
				% TCM_CONSTANTS.SEGMENTS.length;
			if (currentSegment === previousSegmentIndex) currentNight = Math.max(1, currentNight - 1);
		}

		await TCMUtils.setSetting('currentSegment', currentSegment);
		await TCMUtils.setSetting('currentNight', currentNight);

		void this.lighting.handleLightingChange(currentSegment, oldSegment).catch((error) => {
			console.warn('TCM Clock: Could not change scene lighting:', error);
		});

		if (direction > 0) void this._playTransitionSound();

		TCMUtils.emitSocket({
			action: 'updateTime',
			segment: currentSegment,
			night: currentNight
		});
	}

	async _playTransitionSound() {
		if (!TCMUtils.getSetting('clockSound')) return;

		try {
			await foundry.audio.AudioHelper.play({
				src: TCM_CONSTANTS.AUDIO.TRANSITION_SRC,
				channel: 'interface',
				volume: TCMUtils.getSetting('clockSoundVolume'),
				autoplay: true
			}, true);
		} catch (error) {
			console.warn('TCM Clock: Could not play transition sound:', error);
		}
	}

	async editNightCounter() {
		if (!TCMUtils.isGM()) return;

		const currentNight = TCMUtils.getSetting('currentNight');
		const newNight = await foundry.applications.api.DialogV2.prompt({
			window: { title: game.i18n.localize('TCMCLOCK.dialog.editNightCounter.title') },
			content: `<p>${game.i18n.localize('TCMCLOCK.dialog.editNightCounter.content')}</p><input type="number" name="night" value="${currentNight}" min="1" style="width: 100%;">`,
			ok: {
				label: game.i18n.localize('TCMCLOCK.dialog.editNightCounter.change'),
				callback: (_event, button, _dialog) => button.form.elements.night.valueAsNumber
			}
		});

		if (Number.isFinite(newNight) && newNight !== currentNight) {
			const normalizedNight = Math.max(1, newNight);
			await TCMUtils.setSetting('currentNight', normalizedNight);
			TCMUtils.emitSocket({ action: 'updateNight', night: normalizedNight });
		}
	}

	async toggleClockVisibility() {
		await TCMUtils.setSetting('clockVisible', !TCMUtils.getSetting('clockVisible'));
		await this._syncClockVisibility();
	}

	_onSocketMessage(data) {
		if (!TCMUtils.isGM()) return;

		this.timeMutation = this.timeMutation
			.catch(() => {})
			.then(async () => {
				if (data.action === 'updateTime') {
					const oldSegment = TCMUtils.getSetting('currentSegment');
					await TCMUtils.setSetting('currentSegment', data.segment);
					await TCMUtils.setSetting('currentNight', data.night);
					void this.lighting.handleLightingChange(data.segment, oldSegment).catch((error) => {
						console.warn('TCM Clock: Could not apply socket lighting update:', error);
					});
				} else if (data.action === 'updateNight') {
					await TCMUtils.setSetting('currentNight', Math.max(1, Number(data.night)));
				}
			});
	}
}

Hooks.once('init', () => {
	TCMClockSettings.register();
	TCMClock.getInstance().initialize();
});
