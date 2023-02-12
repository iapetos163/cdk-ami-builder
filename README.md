# AMI Builder

AWS CDK construct for creating AMIs using HashiCorp Packer.

This construct enables you to define a Packer build environment
as part of your CDK project and use the built instances.

## Usage

```ts
import { resolve } from 'path';
import { Duration } from 'aws-cdk-lib';
import { Schedule } from 'aws-cdk-lib/aws-events';
import { AmiBuilder } from 'cdk-ami-builder';

// ... within a construct

const builder = new AmiBuilder(this, 'MyCoolImageBuilder', {
    buildEnvDir: resolve(__dirname, '../my-image-build-env'),
    packerFileName: 'build.pkr.hcl',
    imagePrefix: 'my-cool-image',
    // Optional schedule for automated builds
    schedule: Schedule.rate(Duration.days(7)),
});

// This might be null if fhe first build hasn't completed yet
const myCoolImage = builder.latestImage;
if (myCoolImage) {
  new Instance(this, 'MyCoolInstance', {
    machineImage: myCoolImage,
  });
}

```

## Construct Props

TODO

[Refer to source](src/index.ts)
