#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MyCodePipeline } from '../lib/my-codepipeline';
import { Vpc } from '../lib/my-vpc-stack';
import { MyCodeCommitStack } from '../lib/my-codecommit-stack';
import { MyGreetingServiceStack } from '../lib/my-greeting-service-stack';
import { MyCicdStack } from '../lib/my-cicd-stack';
const defaultEnv = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
};
const app = new cdk.App();
new MyCicdStack(app, 'MyCicdStack', {
    env: defaultEnv
});