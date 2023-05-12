import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import { Construct } from 'constructs';
import config = require('config');
import * as CONSTANT from './constant';

export class MyCodeCommitStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        const repo = new codecommit.Repository(this, 'MyRepository', {
            repositoryName: `${config.get('projectName')}`,
        });
        repo.applyRemovalPolicy(config.get('defaultRemovalPolicy'));

        // Tags for CodeBuild Project
        cdk.Aspects.of(repo).add(
            new cdk.Tag('author', CONSTANT.AUTHOR_TAG_VALUE)
        );
        cdk.Aspects.of(repo).add(
            new cdk.Tag('purpose', CONSTANT.PURPOSE_TAG_VALUE)
        );
        cdk.Aspects.of(repo).add(
            new cdk.Tag('env', CONSTANT.ENVIRONMENT_NAME)
        );
    };

}