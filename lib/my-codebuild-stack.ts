import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as CONSTANT from './constant';

import config = require('config');
import { Vpc } from './my-vpc-stack';


export interface MyCodeBuildStackProps extends cdk.StackProps {
    vpc?: ec2.IVpc
};

export class MyCodeBuildStack extends cdk.Stack {
    myVpc: ec2.IVpc;
    constructor(scope: Construct, id: string, props?: MyCodeBuildStackProps) {
        super(scope, id, props);
        if (props?.vpc != null) {
            this.myVpc = props.vpc;
        } else {
            this.myVpc = new Vpc(scope, 'MyVpcStack').myVPC as ec2.IVpc;
        }
        const projectName = config.get<string>('projectName');
        // Create code build
        const myCbRole = new iam.Role(this, 'MyCbRole', {
            roleName: `${CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1)}-${projectName}-cb-role`,
            assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com')
        });
        myCbRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'));
        myCbRole.applyRemovalPolicy(config.get('defaultRemovalPolicy'));

        // Create credential for GitHub
        new codebuild.GitHubSourceCredentials(this, 'MyCodeBuildGitHubCreds', {
            accessToken: cdk.SecretValue.secretsManager(config.get<string>('codebuild.githubCredentialTokenSecretName')),
        });

        // create CodeBuild Source
        const myCbSource = codebuild.Source.gitHub({
            owner: 'PGM1A',
            repo: 'my-app',
            branchOrRef: 'develop',
            webhook: true,
            webhookTriggersBatchBuild: false,
            webhookFilters: [
                codebuild.FilterGroup
                    .inEventOf(codebuild.EventAction.PUSH)
                    .andBranchIs('develop'),
                codebuild.FilterGroup
                    .inEventOf(codebuild.EventAction.PULL_REQUEST_MERGED)
                    .andHeadRefIs('^refs/heads/*$')
                    .andBaseRefIs('^refs/heads/develop$')
            ],
        });

        // Create a new s3 bucket to store the CodeBuild Artifacts
        const myArtifactS3Bucket = new s3.Bucket(this, "MyArtifactS3Bucket", {
            bucketName: CONSTANT.ARTIFACTS_S3_BUCKET_NAME,
            removalPolicy: config.get('defaultRemovalPolicy'),
            autoDeleteObjects: config.get('artifactS3Bucket.autoDeleteObjects'),
            publicReadAccess: config.get('artifactS3Bucket.publicReadAccess'),
            blockPublicAccess: new s3.BlockPublicAccess({
                blockPublicAcls: config.get('artifactS3Bucket.blockPublicAccess.blockPublicAcls'),
                blockPublicPolicy: config.get('artifactS3Bucket.blockPublicAccess.blockPublicPolicy'),
                ignorePublicAcls: config.get('artifactS3Bucket.blockPublicAccess.ignorePublicAcls'),
                restrictPublicBuckets: config.get('artifactS3Bucket.blockPublicAccess.restrictPublicBuckets'),
            })
        });

        // Create S3 Bucket for CodeBuild Artifacts
        const myCodeBuildArtifacts = codebuild.Artifacts.s3({
            bucket: myArtifactS3Bucket,
            includeBuildId: false,
            packageZip: true,
            path: CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1).charAt(0).toUpperCase() + CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1).slice(1),
            encryption: true
        });

        //Create CodeBuild Project
        const myCbProject = new codebuild.Project(this, 'MyCbProject', {
            buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
            artifacts: myCodeBuildArtifacts,
            source: myCbSource,
            environment: {
                buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
                computeType: codebuild.ComputeType.SMALL,
                privileged: true,
            },
            vpc: this.myVpc,
            subnetSelection: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            },
            role: myCbRole,
            projectName: `${CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1)}-${projectName}`,
        });
        myCbProject.applyRemovalPolicy(config.get('defaultRemovalPolicy'));

        // Tags for Artifacts S3 Bucket
        cdk.Aspects.of(myArtifactS3Bucket).add(
            new cdk.Tag('author', CONSTANT.AUTHOR_TAG_VALUE)
        );
        cdk.Aspects.of(myArtifactS3Bucket).add(
            new cdk.Tag('purpose', CONSTANT.PURPOSE_TAG_VALUE)
        );
        cdk.Aspects.of(myArtifactS3Bucket).add(
            new cdk.Tag('env', CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1))
        );
        // Tags for CodeBuild Project
        cdk.Aspects.of(myCbProject).add(
            new cdk.Tag('author', CONSTANT.AUTHOR_TAG_VALUE)
        );
        cdk.Aspects.of(myCbProject).add(
            new cdk.Tag('purpose', CONSTANT.PURPOSE_TAG_VALUE)
        );
        cdk.Aspects.of(myCbProject).add(
            new cdk.Tag('env', CONSTANT.ENVIRONMENT.charAt(0) + CONSTANT.ENVIRONMENT.slice(1))
        );

    }
};