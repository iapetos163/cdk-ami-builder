import { resolve } from 'path';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AmiBuilder } from '../src/index';

it('Synthesizes', () => {
  const app = new App();
  const stack = new Stack(app, 'TestStack');

  new AmiBuilder(stack, 'TestBuilder', {
    buildEnvDir: resolve(__dirname, '../example-build-env'),
    packerFileName: 'example.pkr.hcl',
    imagePrefix: 'my-cool-image',
  });

  const template = Template.fromStack(stack);

  expect(template).toBeDefined();
});
