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
import { Vpc } from './my-vpc-stack';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
export interface MyCodePipelineStackProps extends cdk.StackProps {
    vpc: ec2.IVpc
};
export class MyCodePipeline extends Construct {
    myVpc: ec2.IVpc;
    constructor(scope: Construct, id: string, props: MyCodePipelineStackProps) {
        super(scope, id);
        this.myVpc = props.vpc;
        const projectName = config.get<string>('projectName');
        // Create CodePipeline Role
        const myCplPolicy = new iam.ManagedPolicy(this, 'MyCodePipelineRolePolicy', {
            managedPolicyName: `${CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1)}-${projectName}-cpl-role`,
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
            roleName: `${CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1)}-${projectName}-cpl-role`,
            assumedBy: new iam.ServicePrincipal("codepipeline.amazonaws.com"),
            managedPolicies: [
                myCplPolicy
            ]
        });

        // Create CodeDeploy Role
        const myCdPolicy = new iam.ManagedPolicy(this, 'MyCodeDeployRolePolicy', {
            managedPolicyName: `${CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1)}-${projectName}-cd-role`,
            statements: [
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        "apigateway:*",
                        "codedeploy:*",
                        "lambda:*",
                        "cloudformation:CreateChangeSet",
                        "iam:GetRole",
                        "iam:CreateRole",
                        "iam:DeleteRole",
                        "iam:PutRolePolicy",
                        "iam:AttachRolePolicy",
                        "iam:DeleteRolePolicy",
                        "iam:DetachRolePolicy",
                        "iam:PassRole",
                        "s3:GetObject",
                        "s3:GetObjectVersion",
                        "s3:GetBucketVersioning",
                        "dynamodb:*"
                    ],
                    resources: ['*']
                })
            ]
        });
        const myCdRole = new iam.Role(this, "MyCodeDeployRole", {
            roleName: `${CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1)}-${projectName}-cd-role`,
            assumedBy: new iam.ServicePrincipal("cloudformation.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AWSLambdaExecute'),
                myCdPolicy
            ]
        });

        // Create code build role
        const myCbRole = new iam.Role(this, 'MyCbRole', {
            roleName: `${CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1)}-${projectName}-cb-role`,
            assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com')
        });
        myCbRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'));
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
        // Create a new s3 bucket to store the AWS CloudFormation template
        const myCfnTplS3Bucket = new s3.Bucket(this, "MyCfnTplBucket", {
            bucketName: CONSTANT.CLOUDFORMATION_TEMPLATE_S3_BUCKET_NAME,
            removalPolicy: config.get('defaultRemovalPolicy'),
            autoDeleteObjects: config.get('cfnTplS3Bucket.autoDeleteObjects'),
            publicReadAccess: config.get('cfnTplS3Bucket.publicReadAccess'),
            blockPublicAccess: new s3.BlockPublicAccess({
                blockPublicAcls: config.get('cfnTplS3Bucket.blockPublicAccess.blockPublicAcls'),
                blockPublicPolicy: config.get('cfnTplS3Bucket.blockPublicAccess.blockPublicPolicy'),
                ignorePublicAcls: config.get('cfnTplS3Bucket.blockPublicAccess.ignorePublicAcls'),
                restrictPublicBuckets: config.get('cfnTplS3Bucket.blockPublicAccess.restrictPublicBuckets'),
            })
        });
        myCfnTplS3Bucket.grantReadWrite(myCbRole);

        // Create CodeBuild Project
        const myCbProject = new codebuild.PipelineProject(this, 'MyCbProject', {
            projectName: `${CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1)}-${projectName}`,
            buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
            // buildSpec: codebuild.BuildSpec.fromObject(this.getBuildSpecContent()),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
                privileged: true,
                computeType: codebuild.ComputeType.SMALL,
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
                        logGroupName: `codebuild/${CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1)}-${projectName}`,
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
            environmentVariables: {
                BUCKET: {
                    value: CONSTANT.CLOUDFORMATION_TEMPLATE_S3_BUCKET_NAME
                }
            },
            outputs: [myBuildOutput]
        });

        const changeSetName = 'StagedChangeSet';
        const stackName = 'sam-serverless-api';
        const createReplaceChangeSetAction = new cplAction.CloudFormationCreateReplaceChangeSetAction({
            actionName: "PrepareChanges",
            stackName: stackName,
            changeSetName: changeSetName,
            
            templatePath: myBuildOutput.atPath('outputtemplate.yml'),
            cfnCapabilities: [
                cdk.CfnCapabilities.NAMED_IAM,
                cdk.CfnCapabilities.AUTO_EXPAND
            ],
            adminPermissions: false,
            deploymentRole: myCdRole,
            runOrder: 1
        });

        const executeChangeSetAction = new  cplAction.CloudFormationExecuteChangeSetAction({
            actionName: "ExecuteChanges",
            changeSetName:changeSetName,
            stackName: stackName,
            runOrder: 2
        });

        // Create CodePipelines
        const myCodePipelines = new codepipeline.Pipeline(this, 'MyCodePipeline', {
            role: myCplRole,
            pipelineName: `${CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1)}-${projectName}-cpl`,
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
                {
                    stageName: 'Deploy',
                    actions: [
                        createReplaceChangeSetAction,
                        executeChangeSetAction
                    ]
                }
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
            new cdk.Tag('env', CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1))
        );

    }
    // private getBuildSpecContent(): { [key: string]: any; } {
    //     return {
    //         version: '0.2',
    //         env: {
    //             variables: {
    //                 BUCKET: CONSTANT.CLOUDFORMATION_TEMPLATE_S3_BUCKET_NAME
    //             }
    //         },
    //         phases: {
    //             install: {
    //                 'runtime-versions': {
    //                     nodejs: '12'
    //                 }
    //             },
    //             pre_build: {
    //                 commands: [
    //                     'echo build start'
    //                 ]
    //             },
    //             build: {
    //                 commands: [
    //                     'echo Build started on `date`',
    //                     'echo Build started on `date`',
    //                     'sam build',
    //                     'sam package --s3-bucket $BUCKET --output-template-file outputtemplate.yml',
    //                     'echo Build completed on `date`'
    //                 ]
    //             }
    //         },
    //         artifacts: {
    //             type: 'zip',
    //             files: [
    //                 'template.yml',
    //                 'outputtemplate.yml'
    //             ]
    //         }
    //     };
    // }
}