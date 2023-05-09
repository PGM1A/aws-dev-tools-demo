#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as CONSTANT from '../lib/constant';
import { MyFirstExampleStack } from '../lib/my-first-example-stack';
import { MyVpcStack } from '../lib/my-vpc-stack';
import { MyCodeBuildStack } from '../lib/my-codebuild-stack';

const app = new cdk.App();
// new MyVpcStack(app, 'MyVpcStack', {});
new MyCodeBuildStack(app, 'MyCodeBuildStack', {});