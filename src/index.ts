import { Arn, Stack } from 'aws-cdk-lib';
import {
  BuildEnvironmentVariable,
  BuildEnvironmentVariableType,
  BuildSpec,
  LinuxBuildImage,
  Project,
  Source,
} from 'aws-cdk-lib/aws-codebuild';
import {
  IMachineImage,
  ISubnet,
  LookupMachineImageProps,
  MachineImage,
} from 'aws-cdk-lib/aws-ec2';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { CodeBuildProject } from 'aws-cdk-lib/aws-events-targets';
import {
  CfnInstanceProfile,
  IGrantable,
  IPrincipal,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

const buildSpec = BuildSpec.fromObject({
  version: '0.2',
  phases: {
    install: {
      commands: [
        'wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor > /usr/share/keyrings/hashicorp-archive-keyring.gpg',
        'echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" > /etc/apt/sources.list.d/hashicorp.list',
        'apt update',
        'apt install -y packer',
      ],
    },
    pre_build: {
      commands: ['packer init "$PACKER_FILE_NAME"'],
    },
    build: {
      commands: ['packer build "$PACKER_FILE_NAME"'],
    },
  },
});

export interface AmiBuilderProps {
  /**
   * The path of the directory containing the Packer file
   * and any build assets
   *
   * See [example-build-env](https://github.com/iapetos163/cdk-ami-builder/tree/main/example-build-env)
   * for an example
   */
  readonly buildEnvDir: string;

  /**
   * The VPC subnet in which the Packer build instance should be launched
   *
   * Default: no restriction on the subnet
   */
  readonly buildInstanceSubnet?: ISubnet;

  /**
   * A prefix string for the names of the built AMIs
   */
  readonly imagePrefix: string;

  /**
   * The name of the Packer file, relative to `buildEnvDir`
   *
   * See [example.pkr.hcl](https://github.com/iapetos163/cdk-ami-builder/tree/main/example-build-env/example.pkr.hcl)
   * for an example
   */
  readonly packerFileName: string;

  /**
   * The name of the block device to which the root volume is mapped.
   * In most cases this can be left unspecified.
   * @default '/dev/sda1'
   */
  readonly rootDeviceName?: string;

  /**
   * A schedule on which new image versions should be built automatically
   *
   * Default: New versions are built only when the build definition changes
   */
  readonly schedule?: Schedule;
}

export class AmiBuilder extends Construct implements IGrantable {
  public readonly grantPrincipal: IPrincipal;
  public readonly instanceRole: Role;
  public readonly buildProject: Project;
  private readonly imagePrefix: string;
  private readonly accountId?: string;

  private getStatements() {
    return [
      new PolicyStatement({
        actions: ['ec2:RunInstances'],
        resources: [
          Arn.format(
            {
              account: '',
              service: 'ec2',
              resource: 'image',
              resourceName: '*',
            },
            Stack.of(this),
          ),
          Arn.format(
            {
              service: 'ec2',
              resource: '*',
            },
            Stack.of(this),
          ),
        ],
      }),
      new PolicyStatement({
        actions: ['ec2:CreateImage', 'ec2:ModifyImageAttribute'],
        resources: [
          Arn.format(
            {
              account: '',
              service: 'ec2',
              resource: 'image',
              resourceName: '*',
            },
            Stack.of(this),
          ),
          Arn.format(
            {
              service: 'ec2',
              resource: 'instance',
              resourceName: '*',
            },
            Stack.of(this),
          ),
          Arn.format(
            {
              account: '',
              service: 'ec2',
              resource: 'snapshot',
              resourceName: '*',
            },
            Stack.of(this),
          ),
        ],
      }),
      new PolicyStatement({
        actions: ['ec2:CreateSnapshot'],
        resources: [
          Arn.format(
            {
              service: 'ec2',
              resource: 'volume',
              resourceName: '*',
            },
            Stack.of(this),
          ),
          Arn.format(
            {
              account: '',
              service: 'ec2',
              resource: 'snapshot',
              resourceName: '*',
            },
            Stack.of(this),
          ),
        ],
      }),
      new PolicyStatement({
        actions: ['ec2:AttachVolume', 'ec2:DetachVolume'],
        resources: [
          Arn.format(
            {
              service: 'ec2',
              resource: 'volume',
              resourceName: '*',
            },
            Stack.of(this),
          ),
          Arn.format(
            {
              service: 'ec2',
              resource: 'instance',
              resourceName: '*',
            },
            Stack.of(this),
          ),
        ],
      }),
      new PolicyStatement({
        actions: ['ec2:DeleteVolume'],
        resources: [
          Arn.format(
            {
              service: 'ec2',
              resource: 'volume',
              resourceName: '*',
            },
            Stack.of(this),
          ),
        ],
      }),
      new PolicyStatement({
        actions: [
          'ec2:CopyImage',
          'ec2:DeregisterImage',
          'ec2:RegisterImage',
          'ec2:DescribeImageAttribute',
        ],
        resources: [
          Arn.format(
            {
              account: '',
              service: 'ec2',
              resource: 'image',
              resourceName: '*',
            },
            Stack.of(this),
          ),
        ],
      }),
      new PolicyStatement({
        actions: [
          'ec2:GetPasswordData',
          'ec2:StopInstances',
          'ec2:TerminateInstances',
        ],
        resources: [
          Arn.format(
            {
              service: 'ec2',
              resource: 'instance',
              resourceName: '*',
            },
            Stack.of(this),
          ),
        ],
      }),
      new PolicyStatement({
        actions: ['ec2:AuthorizeSecurityGroupIngress'],
        resources: [
          Arn.format(
            {
              service: 'ec2',
              resource: 'security-group',
              resourceName: '*',
            },
            Stack.of(this),
          ),
          Arn.format(
            {
              service: 'ec2',
              resource: 'security-group-rule',
              resourceName: '*',
            },
            Stack.of(this),
          ),
        ],
      }),
      new PolicyStatement({
        actions: ['ec2:DeleteSnapshot'],
        resources: [
          Arn.format(
            {
              account: '',
              service: 'ec2',
              resource: 'snapshot',
              resourceName: '*',
            },
            Stack.of(this),
          ),
        ],
      }),
      new PolicyStatement({
        actions: ['ec2:CreateKeypair', 'ec2:DeleteKeyPair'],
        resources: [
          Arn.format(
            {
              service: 'ec2',
              resource: 'key-pair',
              resourceName: '*',
            },
            Stack.of(this),
          ),
        ],
      }),
      new PolicyStatement({
        actions: ['ec2:CreateSecurityGroup', 'ec2:DeleteSecurityGroup'],
        resources: [
          Arn.format(
            {
              service: 'ec2',
              resource: 'vpc',
              resourceName: '*',
            },
            Stack.of(this),
          ),
          Arn.format(
            {
              service: 'ec2',
              resource: 'security-group',
              resourceName: '*',
            },
            Stack.of(this),
          ),
        ],
      }),
      new PolicyStatement({
        actions: ['ec2:CreateTags'],
        resources: [
          Arn.format(
            {
              service: 'ec2',
              resource: '*',
            },
            Stack.of(this),
          ),
        ],
      }),
      new PolicyStatement({
        actions: [
          'ec2:DescribeImages',
          'ec2:DescribeInstances',
          'ec2:DescribeInstanceStatus',
          'ec2:DescribeRegions',
          'ec2:DescribeSecurityGroups',
          'ec2:DescribeSnapshots',
          'ec2:DescribeSubnets',
          'ec2:DescribeVolumes',
          'ec2:DescribeTags',
        ],
        resources: ['*'],
      }),
    ];
  }

  constructor(scope: Construct, id: string, props: AmiBuilderProps) {
    super(scope, id);

    const {
      packerFileName,
      buildEnvDir,
      imagePrefix,
      buildInstanceSubnet,
      schedule,
      rootDeviceName = '/dev/sda1',
    } = props;
    this.imagePrefix = imagePrefix;
    this.accountId = Stack.of(this).account;

    const buildRole = new Role(this, 'BuildRole', {
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
    });
    this.getStatements().forEach((statement) => {
      buildRole.addToPolicy(statement);
    });

    const instanceRole = new Role(this, 'InstanceRole', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
    });
    this.grantPrincipal = instanceRole;
    this.instanceRole = instanceRole;
    instanceRole.grantPassRole(buildRole);
    const instanceProfile = new CfnInstanceProfile(this, 'InstanceProfile', {
      roles: [instanceRole.roleName],
      instanceProfileName: instanceRole.roleName,
    });
    buildRole.addToPolicy(
      new PolicyStatement({
        actions: ['iam:GetInstanceProfile'],
        resources: [instanceProfile.attrArn],
      }),
    );

    const asset = new Asset(this, 'Env', {
      path: buildEnvDir,
    });
    asset.grantRead(buildRole);

    const environmentVariables: Record<string, BuildEnvironmentVariable> = {
      IMAGE_NAME_PREFIX: {
        type: BuildEnvironmentVariableType.PLAINTEXT,
        value: imagePrefix,
      },
      INSTANCE_PROFILE_NAME: {
        type: BuildEnvironmentVariableType.PLAINTEXT,
        value: instanceRole.roleName,
      },
      PACKER_FILE_NAME: {
        type: BuildEnvironmentVariableType.PLAINTEXT,
        value: packerFileName,
      },
      ROOT_DEVICE_NAME: {
        type: BuildEnvironmentVariableType.PLAINTEXT,
        value: rootDeviceName,
      },
    };

    if (buildInstanceSubnet) {
      environmentVariables['INSTANCE_SUBNET_ID'] = {
        type: BuildEnvironmentVariableType.PLAINTEXT,
        value: buildInstanceSubnet.subnetId,
      };
    }

    const project = new Project(this, 'Build', {
      role: buildRole,
      buildSpec,
      source: Source.s3({
        bucket: asset.bucket,
        path: asset.s3ObjectKey,
      }),
      environmentVariables,
      environment: {
        buildImage: LinuxBuildImage.STANDARD_6_0,
      },
    });
    this.buildProject = project;
    const buildTarget = new CodeBuildProject(project);

    if (schedule) {
      new Rule(this, 'Rule', {
        targets: [buildTarget],
        schedule,
      });
    }

    const sourceParameter = new StringParameter(this, 'SourceParam', {
      stringValue: asset.s3ObjectKey,
    });
    sourceParameter.node.addDependency(project);

    new Rule(this, 'SourceChange', {
      eventPattern: {
        source: ['aws.ssm'],
        detail: {
          name: [sourceParameter.parameterName],
          operation: ['Create', 'Update'],
        },
      },
      targets: [buildTarget],
    });
  }

  public get latestImage(): IMachineImage | null {
    const lookup: LookupMachineImageProps & { owners?: string[] } = {
      name: `${this.imagePrefix}*`,
    };
    if (this.accountId) {
      lookup.owners = [this.accountId];
    }
    return MachineImage.lookup(lookup);
  }
}
