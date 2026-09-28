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

		this.lighting = new TCMClockLighting();
		this.animations = new TCMClockAnimations();
		this.previousSegment = null;
		this.displaySegment = null;
		this.displayDay = null;
		this.lastWorldTime = null;
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
		this.previousSegment = TCMUtils.getSegmentFromWorldTime();
		this.lastWorldTime = TCMUtils.getWorldTime();

		Hooks.on('canvasReady', async () => {
			this.lighting.initialize();
			await this._handleWorldTimeUpdate(TCMUtils.getWorldTime());
			await this._syncClockVisibility();

			if (TCMUtils.isGM()) {
				const currentSegment = TCMUtils.getSetting('currentSegment');
				await this.lighting.handleLightingChange(currentSegment);
			}
		});

		Hooks.on('updateWorldTime', (worldTime) => {
			void this._handleWorldTimeUpdate(worldTime);
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
		if (settingKey.endsWith('.clockScale')) {
			if (this.rendered) this.setPosition({ scale: TCMUtils.getSetting('clockScale') });
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

	async _handleWorldTimeUpdate(worldTime) {
		const nextSegment = TCMUtils.getSegmentFromWorldTime(worldTime);
		const nextDay = TCMUtils.getCalendarDay(worldTime);
		const previousSegment = this.displaySegment ?? this.previousSegment ?? nextSegment;
		this.displaySegment = nextSegment;
		this.displayDay = nextDay;
		this.lastWorldTime = Number(worldTime);

		if (TCMUtils.isGM()) {
			if (TCMUtils.getSetting('currentSegment') !== nextSegment) {
				await TCMUtils.setSetting('currentSegment', nextSegment);
			}
			if (TCMUtils.getSetting('currentNight') !== nextDay) {
				await TCMUtils.setSetting('currentNight', nextDay);
			}
			if (nextSegment !== previousSegment) {
				void this.lighting.handleLightingChange(nextSegment, previousSegment).catch((error) => {
					console.warn('TCM Clock: Could not synchronize calendar lighting:', error);
				});
			}
		}

		if (this.rendered) await this.render({ force: true });
		this.previousSegment = nextSegment;
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
		const currentSegment = this.displaySegment ?? TCMUtils.getSegmentFromWorldTime();
		const currentDay = this.displayDay ?? TCMUtils.getCalendarDay();
		const rotation = currentSegment * 60;

		return `
	<div class="clock-container">
	<div class="clock-face">
	<div class="clock-arrow" id="clock-arrow-overlay" style="transform: translate(-50%, -100%) rotate(${rotation}deg);"></div>
	</div>
	<div class="night-counter">
	${game.i18n.localize('TCMCLOCK.calendar.day')} <span class="night-number" id="day-number-overlay">${currentDay}</span>
	</div>
		<button id="toggle-clock" class="clock-toggle" type="button" title="${game.i18n.localize('TCMCLOCK.controls.toggleClock')}" aria-pressed="${TCMUtils.getSetting('clockVisible')}">◉</button>
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
			const prevBtn = container.querySelector('#prev-time');
			const nextBtn = container.querySelector('#next-time');
			const toggleButton = container.querySelector('#toggle-clock');

			if (toggleButton) toggleButton.onclick = () => void this.toggleClockVisibility();
			if (!TCMUtils.isGM()) return;

			if (prevBtn) prevBtn.onclick = () => void this.changeTime(-1);
			if (nextBtn) nextBtn.onclick = () => void this.changeTime(1);
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
				const currentSegment = this.displaySegment ?? TCMUtils.getSegmentFromWorldTime();
				this.animations.handleArrowUpdate(existingArrow, this.previousSegment, currentSegment);
				this.previousSegment = currentSegment;
			}

			const existingDayNumber = container.querySelector('#day-number-overlay');
			if (existingDayNumber) {
				existingDayNumber.textContent = this.displayDay ?? TCMUtils.getCalendarDay();
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
		const delta = Math.sign(direction) * TCM_CONSTANTS.TIME.STEP_SECONDS;
		const worldTime = await TCMUtils.advanceWorldTime(delta);
		await this._handleWorldTimeUpdate(worldTime);

		// Rewinding is intentionally silent; only forward movement plays audio.
		if (direction > 0) void this._playTransitionSound();
	}

	async _playTransitionSound() {
		if (!TCMUtils.getSetting('clockSound')) return;

		try {
			await new Promise((resolve) => setTimeout(resolve, TCM_CONSTANTS.AUDIO.START_DELAY_MS));
			if (!TCMUtils.getSetting('clockSound')) return;
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

	async toggleClockVisibility() {
		await TCMUtils.setSetting('clockVisible', !TCMUtils.getSetting('clockVisible'));
		await this._syncClockVisibility();
	}
}

Hooks.once('init', () => {
	TCMClockSettings.register();
	TCMClock.getInstance().initialize();
});
