import { resolve } from 'path';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { AmiBuilder } from '../src/index';

it('Synthesizes', () => {
  const app = new App();
  const stack = new Stack(app, 'TestStack');

  new AmiBuilder(stack, 'TestBuilder', {
    buildEnvDir: resolve(__dirname, '../example-build-env'),
    packerFileName: 'example.pkr.hcl',
    imagePrefix: 'my-cool-image',
    buildEnvVars: {
      PLAIN: 'plain',
      SECRET: new Secret(stack, 'MySecret'),
      PARAMETER: new StringParameter(stack, 'MyParameter', {
        stringValue: 'param',
      }),
    },
  });

  const template = Template.fromStack(stack);

  expect(template).toBeDefined();
});
