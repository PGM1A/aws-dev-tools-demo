import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";

export class GreetingService extends Construct {
  private lambdaFn: lambda.IFunction;
  private restApi: apigateway.IRestApi;
  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.lambdaFn = new lambda.Function(this, "GreetingHandler", {
      functionName: `greeting-handler-fn`,
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromInline('exports.handler = async (event) => { console.log(event); return { statusCode: 200 } }'),
      handler: "greetings.handler",
      logRetention: logs.RetentionDays.ONE_WEEK
    });

    // const handler = lambda.Function.fromFunctionArn(this, "GreetingHandler", "arn:aws:lambda:ap-southeast-2:021492533335:function:greeting-handler-fn");
    const api = new apigateway.RestApi(this, "GreetingServiceApi", {
      restApiName: "greeting-service",
      description: "This service serves greetings."
    });

    let getGreetingsIntegration = new apigateway.LambdaIntegration(this.lambdaFn, {});

    api.root.addMethod("GET", getGreetingsIntegration); // GET /

    api.root.addResource("{id}").addMethod("GET", getGreetingsIntegration);
  }

  /**
   * getLambdaFn
   */
  public getLambdaFn() {
    return this.lambdaFn;
  }

  /**
   * getRestApi
   */
  public getRestApi() {
    return this.restApi;
  }
}