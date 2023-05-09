/*
    Stack creates the a new VPC
*/

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import { IpAddresses } from 'aws-cdk-lib/aws-ec2';
import config = require('config');
import * as CONSTANT from './constant';

export class MyVpcStack extends cdk.Stack {
    myVPC: ec2.Vpc;
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const author = 'nbkhoi';
        const purpose = 'demo';

        // Step1: Create a VPC and things related to VPC
        this.myVPC = new ec2.Vpc(this, `VPC`, {
            ipAddresses: IpAddresses.cidr(config.get('vpc.cidr')),
            maxAzs: Number(config.get('vpc.maxazs')),
            natGateways: Number(config.get('vpc.maxnatgateways')),
            subnetConfiguration: [
                {
                    name: `public`,
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask: config.get('vpc.subnet.cidrmask'),
                },
                {
                    name: `private`,
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: config.get('vpc.subnet.cidrmask')
                }
            ],
            vpcName: `${CONSTANT.ENVIRONMENT_PREFIX}-vpc`,
        });
        this.myVPC.applyRemovalPolicy(config.get('defaultRemovalPolicy'));

        // Step2: Re-tagging for publicSubnets
        for (const publicSubnet of this.myVPC.publicSubnets) {
            cdk.Aspects.of(publicSubnet).add(
                new cdk.Tag('Name', `${CONSTANT.ENVIRONMENT_PREFIX}-${publicSubnet.node.id.replace(/Subnet[0-9]$/, '')}-${publicSubnet.availabilityZone}`)
            );
            cdk.Aspects.of(publicSubnet).add(
                new cdk.Tag('author', author)
            );
            cdk.Aspects.of(publicSubnet).add(
                new cdk.Tag('purpose', purpose)
            );
            cdk.Aspects.of(publicSubnet).add(
                new cdk.Tag('env', CONSTANT.ENVIRONMENT_NAME)
            );
        }

        // Step3: Re-tagging for privateSubnets
        for (const privateSubnet of this.myVPC.privateSubnets) {
            cdk.Aspects.of(privateSubnet).add(
                new cdk.Tag('Name', `${CONSTANT.ENVIRONMENT_PREFIX}-${privateSubnet.node.id.replace(/Subnet[0-9]$/, '')}-${privateSubnet.availabilityZone}`)
            );
            cdk.Aspects.of(privateSubnet).add(
                new cdk.Tag('author', author)
            );
            cdk.Aspects.of(privateSubnet).add(
                new cdk.Tag('purpose', purpose)
            );
            cdk.Aspects.of(privateSubnet).add(
                new cdk.Tag('env', CONSTANT.ENVIRONMENT_NAME)
            );
        }

        //Step4: Re-tagging for VPC
        cdk.Aspects.of(this.myVPC).add(
            new cdk.Tag('author', author)
        );
        cdk.Aspects.of(this.myVPC).add(
            new cdk.Tag('purpose', purpose)
        );
        cdk.Aspects.of(this.myVPC).add(
            new cdk.Tag('env', CONSTANT.ENVIRONMENT_NAME)
        );
    }
}
