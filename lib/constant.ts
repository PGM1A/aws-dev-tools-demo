import config = require('config');
export const ENVIRONMENT_NAME = config.get<string>('env');
export const ENVIRONMENT_PREFIX = ENVIRONMENT_NAME.toLowerCase();
