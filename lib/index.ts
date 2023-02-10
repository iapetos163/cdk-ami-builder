// import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface CdkAmiBuilderProps {
  // Define construct properties here
}

export class CdkAmiBuilder extends Construct {

  constructor(scope: Construct, id: string, props: CdkAmiBuilderProps = {}) {
    super(scope, id);

    // Define construct contents here

    // example resource
    // const queue = new sqs.Queue(this, 'CdkAmiBuilderQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
