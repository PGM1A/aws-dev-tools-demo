import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as cplAction from 'aws-cdk-lib/aws-codepipeline-actions';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as CONSTANT from './constant';

import config = require('config');
import { MyVpcStack } from './my-vpc-stack';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
export interface MyCodePipelineStackProps extends cdk.StackProps {
    vpc?: ec2.IVpc
};
export class MyCodePipelineStack extends cdk.Stack {
    myVpc: ec2.IVpc;
    constructor(scope: Construct, id: string, props?: MyCodePipelineStackProps) {
        super(scope, id, props);

        if (props?.vpc != null) {
            this.myVpc = props.vpc;
        } else {
            this.myVpc = new MyVpcStack(this, 'MyVpcStack', {}).myVPC as ec2.IVpc;
        }

        const projectName = config.get<string>('projectName');
        // Create CodePipeline Role
        const myCplPolicy = new iam.ManagedPolicy(this, 'MyCodePipelineRolePolicy', {
            managedPolicyName: `${CONSTANT.ENVIRONMENT_PREFIX}-${projectName}-cpl-role`,
            statements: [
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['iam:PassRole'],
                    resources: ['*'],
                    conditions: {
                        StringEqualsIfExists: {
                            'iam:PassedToService': [
                                'cloudformation.amazonaws.com',
                                'elasticbeanstalk.amazonaws.com',
                                'ec2.amazonaws.com',
                                'ecs-tasks.amazonaws.com'
                            ]
                        }
                    }
                }),
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['codestar-connections:UseConnection'],
                    resources: ['*']
                }),
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        'elasticbeanstalk:*',
                        'ec2:*',
                        'elasticloadbalancing:*',
                        'autoscaling:*',
                        'cloudwatch:*',
                        's3:*',
                        'sns:*',
                        'cloudformation:*',
                        'rds:*',
                        'sqs:*',
                        'ecs:*'
                    ],
                    resources: ['*']
                }),
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        'codebuild:BatchGetBuilds',
                        'codebuild:StartBuild',
                        'codebuild:BatchGetBuildBatches',
                        'codebuild:StartBuildBatch'
                    ],
                    resources: ['*']
                }),
            ]
        });
        const myCplRole = new iam.Role(this, "MyCodePipelineRole", {
            roleName: `${CONSTANT.ENVIRONMENT_PREFIX}-${projectName}-cpl-role`,
            assumedBy: new iam.ServicePrincipal("codepipeline.amazonaws.com"),
            managedPolicies: [
                myCplPolicy
            ]
        });

        // Create code build role
        const myCbRole = new iam.Role(this, 'MyCbRole', {
            roleName: `${CONSTANT.ENVIRONMENT_PREFIX}-${projectName}-cb-role`,
            assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com')
        });
        myCbRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'));
        myCbRole.applyRemovalPolicy(config.get('defaultRemovalPolicy'));
        // Create code pipelines role
        const mySourceOutput = new codepipeline.Artifact('MySourceOutput');

        // Create CodePipelines Source Action
        // const mySourceAction = new cplAction.CodeStarConnectionsSourceAction({
        //     actionName: 'Source',
        //     owner: 'PGM1A',
        //     repo: 'my-app',
        //     output: mySourceOutput,
        //     connectionArn: 'arn:aws:codestar-connections:ap-southeast-2:021492533335:connection/3c92ec80-5eca-4ae7-8c02-d7f3aadb358d'
        // });

        const myRepository = new codecommit.Repository(this, 'MyCcRepository', {
            repositoryName: projectName
        });
        myRepository.applyRemovalPolicy(config.get('defaultRemovalPolicy'));
        const mySourceAction = new cplAction.CodeCommitSourceAction({
            actionName: 'Source',
            repository: myRepository,
            branch: 'develop',
            output: mySourceOutput,
        });

        // Create CodeBuild Project
        const myCbProject = new codebuild.PipelineProject(this, 'MyCbProject', {
            projectName: `${CONSTANT.ENVIRONMENT_PREFIX}-${projectName}`,
            buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
            environment: {
                buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
                privileged: true,
                computeType: codebuild.ComputeType.SMALL
            },
            role: myCbRole,
            vpc: this.myVpc,
            subnetSelection: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            },
            logging: {
                cloudWatch: {
                    enabled: true,
                    logGroup: new logs.LogGroup(this, "LogGroup", {
                        logGroupName: `codebuild/${CONSTANT.ENVIRONMENT_PREFIX}-${projectName}`,
                        retention: logs.RetentionDays.ONE_DAY,
                        removalPolicy: config.get('defaultRemovalPolicy')
                    })
                }
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
            role: myCplRole,
            pipelineName: `${CONSTANT.ENVIRONMENT_PREFIX}-${projectName}-cpl`,
            stages: [
                // Add Soủce state
                {
                    stageName: 'Source',
                    actions: [mySourceAction]
                },
                // Add Build state
                {
                    stageName: 'Build',
                    actions: [myBuildAction]
                },
                // Add Deploy state
                // {
                //     stageName: 'Deploy',
                //     actions: [myDeployAction]
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

        // Tags for CodeBuild Project
        cdk.Aspects.of(myRepository).add(
            new cdk.Tag('author', CONSTANT.AUTHOR_TAG_VALUE)
        );
        cdk.Aspects.of(myRepository).add(
            new cdk.Tag('purpose', CONSTANT.PURPOSE_TAG_VALUE)
        );
        cdk.Aspects.of(myRepository).add(
            new cdk.Tag('env', CONSTANT.ENVIRONMENT_NAME)
        );

    }
}