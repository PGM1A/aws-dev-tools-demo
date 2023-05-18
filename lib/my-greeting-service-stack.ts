import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as greetingservice from './greeting-service';

export class MyGreetingServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const myGreetingService = new greetingservice.GreetingService(this, 'GreetingService');
  }
}
