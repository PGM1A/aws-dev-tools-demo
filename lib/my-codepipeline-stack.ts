import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as cplAction from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as CONSTANT from './constant';

import config = require('config');
import { MyVpcStack } from './my-vpc-stack';
import { MyCodeBuildStack } from './my-codebuild-stack';

export class MyCodePipelineStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        const myVpc = new MyVpcStack(this, 'MyVpcStack', {}).myVPC as ec2.IVpc;
        const projectName = config.get<string>('projectName');

        // Create code pipelines
        const mySourceOutput = new codepipeline.Artifact('MySourceOutput');

        // Create CodePipelines Source Action
        const mySourceAction = new cplAction.CodeStarConnectionsSourceAction({
            actionName: 'Source',
            owner: 'PGM1A',
            repo: 'my-app',
            output: mySourceOutput,
            connectionArn: 'arn:aws:codestar-connections:ap-southeast-2:021492533335:connection/3c92ec80-5eca-4ae7-8c02-d7f3aadb358d'
        });

        // Create CodeBuild Project
        const myCbProject = new codebuild.PipelineProject(this, 'MyCbProject', {
            projectName: `${CONSTANT.ENVIRONMENT_PREFIX}-${projectName}`,
            buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
            environment: {
                buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
                privileged: true,
                computeType: codebuild.ComputeType.SMALL,
            },
            vpc: myVpc,
            subnetSelection: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            }
        });
        myCbProject.applyRemovalPolicy(config.get('defaultRemovalPolicy'));

        const myBuildOutput = new codepipeline.Artifact('MyBuildOutput');

        // Create CodePipelines Build Action
        const myBuildAction = new cplAction.CodeBuildAction({
            actionName: "Build",
            type: cplAction.CodeBuildActionType.BUILD,
            input: mySourceOutput,
            extraInputs: [mySourceOutput],
            project: myCbProject,
            outputs: [myBuildOutput]
        });

        // Create CodePipelines
        const myCodePipelines = new codepipeline.Pipeline(this, 'MyCodePipeline', {
            pipelineName: `${CONSTANT.ENVIRONMENT_PREFIX}-${projectName}-cpl`,
            stages: [
                {
                    stageName: 'Source',
                    actions: [mySourceAction]
                },
                {
                    stageName: 'Build',
                    actions: [myBuildAction]
                },
                // Add Deploy state
                // {
                //     stageName: 'Deploy',
                //     actions: [deployAction]
                // }
            ]
        });
        const pipelineCfn = myCodePipelines.node.defaultChild as cdk.CfnResource;
        // addDeletionOverride  removes the property from the cloudformation itself
        // Delete action arn for every stage and action created
        pipelineCfn.addDeletionOverride("Properties.Stages.1.Actions.0.RoleArn");
        pipelineCfn.addDeletionOverride("Properties.Stages.2.Actions.0.RoleArn");
        pipelineCfn.addDeletionOverride("Properties.Stages.3.Actions.0.RoleArn");
        myCodePipelines.applyRemovalPolicy(config.get('defaultRemovalPolicy'));

    }
}