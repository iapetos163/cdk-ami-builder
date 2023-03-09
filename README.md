# AMI Builder

AWS CDK construct for creating AMIs using
[HashiCorp Packer](https://developer.hashicorp.com/packer/docs).

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

## Force CDK to use the latest image version

By default, CDK will cache the AMI ID for `builder.latestImage` in `cdk.context.json`.
You can override this behavior by running this command before `cdk deploy`:

```
cdk context -f --reset ami:*
```

This will force CDK to check for the latest image each time it synthesizes.

## Construct Props

### buildEnvDir

• **buildEnvDir**: `string`

The path of the directory containing the Packer file
and any build assets

See [example-build-env](./example-build-env/)
for an example

___

### buildEnvVars

• `Optional` **buildEnvVars**: `Record<string, string | ISecret | IParameter>`

Additional environment variables to expose to Packer.
The values may be plain strings, Secrets Manager secrets, or SSM parameters.

---

### buildInstanceSubnet

• `Optional` **buildInstanceSubnet**: `ISubnet`

The VPC subnet in which the Packer build instance should be launched

**`Default`**

No restriction on the subnet

___

### imagePrefix

• **imagePrefix**: `string`

A prefix string for the names of the built AMIs

___

### packerFileName

• **packerFileName**: `string`

The name of the [Packer file](https://developer.hashicorp.com/packer/docs/templates/hcl_templates),
relative to `buildEnvDir`

See [example.pkr.hcl](./example-build-env/example.pkr.hcl)
for an example

___

### rootDeviceName

• `Optional` **rootDeviceName**: `string`

The name of the block device to which the root volume is mapped.
In most cases this can be left unspecified.

**`Default`**

`'/dev/sda1'`

___

### schedule

• `Optional` **schedule**: `Schedule`

A schedule on which new image versions should be built automatically

**`Default`**

New versions are built only when the build definition changes
