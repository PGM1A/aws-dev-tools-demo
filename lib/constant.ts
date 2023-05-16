import config = require('config');
export const ENVIRONMENT_NAME = config.get<string>('env');
export const ENVIRONMENT_PREFIX = ENVIRONMENT_NAME.toLowerCase();
export const ARTIFACTS_S3_BUCKET_NAME = config.get<string>('artifactS3Bucket.name');
export const CLOUDFORMATION_TEMPLATE_S3_BUCKET_NAME = config.get<string>('cfnTplS3Bucket.name');
export const GITHUB_CREDENTIAL_TOKEN_SECRET_NAME = 'github-credential-token';
export const AUTHOR_TAG_VALUE = config.get<string>('authorTagValue');
export const PURPOSE_TAG_VALUE = config.get<string>('purposeTagValue');