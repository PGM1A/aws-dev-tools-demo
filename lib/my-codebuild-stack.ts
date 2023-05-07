import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as CONSTANT from './constant';

import { IpAddresses } from 'aws-cdk-lib/aws-ec2';
import config = require('config');
import { MyVpcStack } from './my-vpc-stack';


export interface MyCodeBuildStackProps extends cdk.StackProps {
    vpcname?: string
};

export class MyCodeBuildStack extends cdk.Stack {
    myVpc: ec2.IVpc;
    myProjectName: string;
    constructor(scope: Construct, id: string, props?: MyCodeBuildStackProps) {
        super(scope, id, props);
        if (props?.vpcname != null) {
            this.myVpc = ec2.Vpc.fromLookup(this, 'VPC', {
                vpcName: props.vpcname,
            });
        } else {
            this.myVpc = new MyVpcStack(this, 'MyVpcStack',{}).myVPC as ec2.IVpc;
        }
        this.myProjectName = config.get<string>('projectName');
                // Create code build
                const myCbRole = new iam.Role(this, 'MyCbRole', {
                    roleName: `${CONSTANT.ENVIRONMENT_PREFIX}-${this.myProjectName}-cb-role`,
                    assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com')
                });
                myCbRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'));
                myCbRole.applyRemovalPolicy(config.get('defaultremovalpolicy'));
        
                const myCbSource = codebuild.Source.gitHub({
                    owner: 'nbkhoi',
                    repo: 'my',
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
        
                //Use existing bucket ARN
                const artifactBucket = s3.Bucket.fromBucketArn(this, 'S3ArtifactsBucket', 'arn:aws:s3:::developer-tool-artifacts');
                const myCodeBuildArtifacts = codebuild.Artifacts.s3({
                    bucket: artifactBucket,
                    includeBuildId: false,
                    packageZip: true,
                    path: CONSTANT.ENVIRONMENT_NAME,
                    encryption: true
                });
        
                const myCbProject = new codebuild.Project(this, 'MyCbProject', {
                    buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
                    artifacts: myCodeBuildArtifacts,
                    source: myCbSource,
                    environment: {
                        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_4,
                        computeType: codebuild.ComputeType.SMALL,
                        privileged: true,
                    },
                    vpc: this.myVpc,
                    subnetSelection: {
                        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
                    },
                    role: myCbRole,
                    projectName: `${CONSTANT.ENVIRONMENT_PREFIX}-${this.myProjectName}`,
                });
                myCbProject.applyRemovalPolicy(config.get('defaultremovalpolicy'));
        
    };
};