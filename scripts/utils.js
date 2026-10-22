import { TCM_CONSTANTS } from './constants.js';

export class TCMUtils {
	static getSetting(key) {
		return game.settings.get(TCM_CONSTANTS.MODULE_ID, key);
	}

	static async setSetting(key, value) {
		return await game.settings.set(TCM_CONSTANTS.MODULE_ID, key, value);
	}

	static getSegmentIndex(segmentName) {
		return TCM_CONSTANTS.SEGMENTS.indexOf(segmentName);
	}

	static getSegmentName(index) {
		return TCM_CONSTANTS.SEGMENTS[index];
	}

	static getSegmentEnvironment(segmentIndex) {
		const segmentName = this.getSegmentName(segmentIndex);
		if (!segmentName) return null;

		return {
			hue: this.getSetting(`${segmentName}BaseHue`),
			luminosity: this.getSetting(`${segmentName}BaseLuminosity`),
			saturation: this.getSetting(`${segmentName}BaseSaturation`),
			shadows: this.getSetting(`${segmentName}BaseShadows`),
			intensity: this.getSetting(`${segmentName}BaseIntensity`),
			darkness: this.getSetting(`${segmentName}Darkness`)
		};
	}

	static capitalizeFirst(str) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	static clamp(value, min, max) {
		return Math.min(Math.max(value, min), max);
	}

	static lerp(start, end, progress) {
		return start + (end - start) * progress;
	}

	static lerpHue(startHue, endHue, progress) {
		const normalizeHue = (hue) => ((hue % 1) + 1) % 1;
		const start = normalizeHue(startHue);
		const end = normalizeHue(endHue);

		let diff = end - start;
		if (diff > 0.5) diff -= 1;
		if (diff < -0.5) diff += 1;

		return normalizeHue(start + diff * progress);
	}

	static easeInOutQuad(t) {
		return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
	}

	static isEnabled() {
		return this.getSetting('moduleEnabled');
	}

	static isGM() {
		return game.user.isGM;
	}

	static getActiveScene() {
		return game.scenes.active;
	}

	static getWorldTime() {
		return Number(game.time?.worldTime ?? 0);
	}

	static getCalendarTimeConfig() {
		const days = game.time?.calendar?.days;
		const secondsPerMinute = Number(days?.secondsPerMinute) || 60;
		const minutesPerHour = Number(days?.minutesPerHour) || 60;
		const hoursPerDay = Number(days?.hoursPerDay) || 24;
		const secondsPerHour = secondsPerMinute * minutesPerHour;

		return {
			secondsPerHour,
			secondsPerDay: secondsPerHour * hoursPerDay,
			segmentSeconds: secondsPerHour * TCM_CONSTANTS.TIME.SEGMENT_HOURS,
			segmentOffsetSeconds: secondsPerHour * TCM_CONSTANTS.TIME.FIRST_SEGMENT_START_HOUR
		};
	}

	// Number of whole segments elapsed since the first dusk (11am of day one); may be negative.
	static getSegmentPosition(worldTime = this.getWorldTime()) {
		const { segmentSeconds, segmentOffsetSeconds } = this.getCalendarTimeConfig();
		return Math.floor((Number(worldTime) - segmentOffsetSeconds) / segmentSeconds);
	}

	static getSegmentFromWorldTime(worldTime = this.getWorldTime()) {
		const segment = this.getSegmentPosition(worldTime);
		return ((segment % TCM_CONSTANTS.SEGMENTS.length) + TCM_CONSTANTS.SEGMENTS.length)
			% TCM_CONSTANTS.SEGMENTS.length;
	}

	// Seconds needed to land exactly on the start of the next (or previous) segment.
	static getSegmentStepDelta(direction, worldTime = this.getWorldTime()) {
		const { segmentSeconds, segmentOffsetSeconds } = this.getCalendarTimeConfig();
		const targetPosition = this.getSegmentPosition(worldTime) + Math.sign(direction);
		return segmentOffsetSeconds + targetPosition * segmentSeconds - Number(worldTime);
	}

	static getCalendarDay(worldTime = this.getWorldTime()) {
		const { secondsPerDay } = this.getCalendarTimeConfig();
		return Math.floor(Number(worldTime) / secondsPerDay) + 1;
	}

	static async advanceWorldTime(deltaSeconds) {
		if (!game.time?.advance) throw new Error('Foundry GameTime API is unavailable');
		return game.time.advance(Number(deltaSeconds));
	}

	static getSceneEnvironment(scene = this.getActiveScene()) {
		const base = scene?.environment?.base;
		if (!base) return null;

		const environment = {
			hue: Number(base.hue),
			luminosity: Number(base.luminosity),
			saturation: Number(base.saturation),
			shadows: Number(base.shadows),
			intensity: Number(base.intensity),
			darkness: Number(scene.environment.darknessLevel)
		};

		return Object.values(environment).every(Number.isFinite) ? environment : null;
	}

	static toSceneEnvironmentUpdate(environment) {
		return {
			'environment.base.hue': environment.hue,
			'environment.base.luminosity': environment.luminosity,
			'environment.base.saturation': environment.saturation,
			'environment.base.shadows': environment.shadows,
			'environment.base.intensity': environment.intensity,
			'environment.darknessLevel': environment.darkness
		};
	}

	static async updateScene(updateData, scene = this.getActiveScene()) {
		if (!scene) return;

		try {
			await scene.update(updateData);
		} catch (error) {
			console.warn("TCM Clock: Could not update scene:", error);
			throw error;
		}
	}

	static emitSocket(data) {
		game.socket.emit(`module.${TCM_CONSTANTS.MODULE_ID}`, data);
	}

	static querySelector(parent, selector) {
		return parent.querySelector(selector);
	}

	static createTimeoutManager() {
		const timeouts = [];

		return {
			add: (timeoutId) => timeouts.push(timeoutId),
			remove: (timeoutId) => {
				const index = timeouts.indexOf(timeoutId);
				if (index > -1) timeouts.splice(index, 1);
			},
			clear: () => {
				timeouts.forEach(id => clearTimeout(id));
				timeouts.length = 0;
			}
		};
	}
}
