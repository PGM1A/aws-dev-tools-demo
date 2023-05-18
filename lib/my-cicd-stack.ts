import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as greetingservice from './greeting-service';
import * as vpc from './my-vpc-stack';
import * as pipeline from './my-codepipeline';

export class MyCicdStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);
    const myVPC = new vpc.Vpc(this, 'Vpc');
    new pipeline.MyCodePipeline(this, 'MyCodePipeline', {
      vpc: myVPC.myVPC
    });
  }
}
