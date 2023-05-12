#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MyCodePipelineStack } from '../lib/my-codepipeline-stack';
import { MyVpcStack } from '../lib/my-vpc-stack';
import { MyCodeCommitStack } from '../lib/my-codecommit-stack';
const defaultEnv = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
};
const app = new cdk.App();
const myVpcStack = new MyVpcStack(app, 'MyVpcStack', {
    env: defaultEnv
});
new MyCodeCommitStack(app, 'MyCodeCommitStack', {
    env:defaultEnv
});
new MyCodePipelineStack(app, 'MyCodePipelineStack', {
    vpc: myVpcStack.myVPC,
    env: defaultEnv
});