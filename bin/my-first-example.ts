#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MyCodePipelineStack } from '../lib/my-codepipeline-stack';

const app = new cdk.App();
// new MyVpcStack(app, 'MyVpcStack', {});
new MyCodePipelineStack(app, 'MyCodePipelineStack', {});