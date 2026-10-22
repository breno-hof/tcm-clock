export const TCM_CONSTANTS = {
	MODULE_ID: 'tcm-clock',

	SEGMENTS: ['dusk', 'nightfall', 'evening', 'midnight', 'witching', 'twilight'],

	get SEGMENT_CHOICES() {
		return {
			midnight: game.i18n.localize('TCMCLOCK.segments.midnight'),
			witching: game.i18n.localize('TCMCLOCK.segments.witching'),
			twilight: game.i18n.localize('TCMCLOCK.segments.twilight'),
			dusk: game.i18n.localize('TCMCLOCK.segments.dusk'),
			nightfall: game.i18n.localize('TCMCLOCK.segments.nightfall'),
			evening: game.i18n.localize('TCMCLOCK.segments.evening')
		};
	},

	DEFAULT_BASE_HUES: {
		dusk: 0.075,
		nightfall: 0.011111,
		evening: 0.363888,
		midnight: 0.630555,
		witching: 0.758333,
		twilight: 0.886611
	},

	DEFAULT_BASE_ENV: {
		dusk: { luminosity: -0.3, saturation: -0.15, shadows: 0.15, intensity: 0.6, darkness: 0 },
		nightfall: { luminosity: -0.3, saturation: -0.4, shadows: 0.25, intensity: 0.5, darkness: 0.35 },
		evening: { luminosity: -0.6, saturation: -0.6, shadows: 0.55, intensity: 0.25, darkness: 0.75 },
		midnight: { luminosity: -1, saturation: -0.5, shadows: 0.75, intensity: 0.3, darkness: 1 },
		witching: { luminosity: -0.9, saturation: -0.4, shadows: 0.65, intensity: 0.45, darkness: 0.85 },
		twilight: { luminosity: -0.6, saturation: -0.35, shadows: 0.6, intensity: 0.45, darkness: 0.25 }
	},

	ANIMATION: {
		TRANSITION_DURATION: 1500,
		VIBRATION_DURATION: 600,
		INTERPOLATION_DURATION: 7500,
		INTERPOLATION_INTERVAL: 50
	},

	TIME: {
		SEGMENT_HOURS: 4,
		// Dusk (segment 0) starts at 11am; twilight (segment 5) covers 7am-11am.
		FIRST_SEGMENT_START_HOUR: 11
	},

	AUDIO: {
		TRANSITION_SRC: 'modules/tcm-clock/assets/clock-ticking.mp3',
		DEFAULT_VOLUME: 0.8,
		START_DELAY_MS: 20
	},

	SCALE_LIMITS: {
		MIN: 0.25,
		MAX: 2.0,
		STEP: 0.1
	}
};
