import { TCM_CONSTANTS } from './constants.js';
import { TCMUtils } from './utils.js';

export class TCMClockLighting {
	constructor() {
		this.transitionId = 0;
		this.currentEnvironment = null;
		this.pendingUpdate = null;
		this.updateWorkerRunning = false;
		this.interpolationDuration = TCM_CONSTANTS.ANIMATION.INTERPOLATION_DURATION;
		this.interpolationInterval = TCM_CONSTANTS.ANIMATION.INTERPOLATION_INTERVAL;
	}

	initialize(scene = TCMUtils.getActiveScene()) {
		this.cleanup();
		this.currentEnvironment = TCMUtils.getSceneEnvironment(scene);
	}

	_isCurrentTransition(transitionId, scene) {
		return transitionId === this.transitionId
			&& scene === TCMUtils.getActiveScene()
			&& TCMUtils.isGM()
			&& TCMUtils.getSetting('lightingIntegration');
	}

	async _drainSceneUpdates() {
		if (this.updateWorkerRunning) return;
		this.updateWorkerRunning = true;

		try {
			while (this.pendingUpdate) {
				const request = this.pendingUpdate;
				this.pendingUpdate = null;

				if (!TCMUtils.isGM() || request.scene !== TCMUtils.getActiveScene()) {
					request.resolve(false);
					continue;
				}

				try {
					await TCMUtils.updateScene(request.environment, request.scene);
					request.resolve(true);
				} catch (error) {
					console.warn('TCM Clock: Could not update scene lighting:', error);
					request.resolve(false);
				}
			}
		} finally {
			this.updateWorkerRunning = false;
			if (this.pendingUpdate) void this._drainSceneUpdates();
		}
	}

	_updateSceneLighting(environment, scene) {
		if (!TCMUtils.isGM() || !scene || scene !== TCMUtils.getActiveScene()) {
			return Promise.resolve(false);
		}

		return new Promise((resolve) => {
			if (this.pendingUpdate) this.pendingUpdate.resolve(false);
			this.pendingUpdate = { environment: { ...environment }, scene, resolve };
			this.currentEnvironment = { ...environment };
			void this._drainSceneUpdates();
		});
	}

	async handleLightingChange(newSegment, oldSegment = null) {
		this.cleanup();

		if (!TCMUtils.getSetting('lightingIntegration') || !TCMUtils.isGM()) return false;

		const scene = TCMUtils.getActiveScene();
		const newSegmentEnv = TCMUtils.getSegmentEnvironment(newSegment);
		if (!scene || !newSegmentEnv) return false;

		const fromEnv = this.currentEnvironment
			|| TCMUtils.getSceneEnvironment(scene)
			|| (oldSegment === null ? null : TCMUtils.getSegmentEnvironment(oldSegment));
		this.currentEnvironment = fromEnv ? { ...fromEnv } : null;

		const transitionId = this.transitionId;
		if (oldSegment === null || !fromEnv) {
			return this._updateSceneLighting(newSegmentEnv, scene);
		}

		return this._interpolateLighting(fromEnv, newSegmentEnv, scene, transitionId);
	}

	async _interpolateLighting(fromEnv, toEnv, scene, transitionId) {
		const startedAt = globalThis.performance?.now?.() ?? Date.now();
		let progress = 0;

		while (this._isCurrentTransition(transitionId, scene)) {
			const now = globalThis.performance?.now?.() ?? Date.now();
			progress = Math.min((now - startedAt) / this.interpolationDuration, 1);
			const easedProgress = TCMUtils.easeInOutQuad(progress);
			const interpolatedEnv = {
				hue: TCMUtils.lerpHue(fromEnv.hue, toEnv.hue, easedProgress),
				luminosity: TCMUtils.lerp(fromEnv.luminosity, toEnv.luminosity, easedProgress),
				saturation: TCMUtils.lerp(fromEnv.saturation, toEnv.saturation, easedProgress),
				shadows: TCMUtils.lerp(fromEnv.shadows, toEnv.shadows, easedProgress),
				intensity: TCMUtils.lerp(fromEnv.intensity, toEnv.intensity, easedProgress)
			};

			const applied = await this._updateSceneLighting(interpolatedEnv, scene);
			if (!applied || !this._isCurrentTransition(transitionId, scene)) return false;
			if (progress >= 1) return true;

			const remaining = this.interpolationDuration * (1 - progress);
			await new Promise((resolve) => setTimeout(resolve, Math.min(this.interpolationInterval, remaining)));
		}

		return false;
	}

	cleanup() {
		this.transitionId += 1;
		if (this.pendingUpdate) {
			this.pendingUpdate.resolve(false);
			this.pendingUpdate = null;
		}
	}
}
