// https://github.com/aws/constructs/blob/10.x/API.md#constructs-construct
import {type Construct} from 'constructs'
// https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib-readme.html
import * as cdk from 'aws-cdk-lib'
// https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs-readme.html
import * as ecs from 'aws-cdk-lib/aws-ecs'
// https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2-readme.html
import * as ec2 from 'aws-cdk-lib/aws-ec2'
// https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2-readme.html
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import {TargetType} from 'aws-cdk-lib/aws-elasticloadbalancingv2'

export class TacoService extends cdk.Stack {
  constructor (scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const vpc = this.addVpc()
    const cluster = this.addEcsCluster(vpc)
    const lb = this.addLoadBalancer(vpc)
    this.addTacosServer(cluster, vpc, lb)

    new cdk.CfnOutput(this, 'lb-endpoint', {
      value: lb.loadBalancerDnsName,
      description: 'service endpoint'
    })
  }

  private addTacosServer (cluster: ecs.Cluster, vpc: ec2.Vpc, lb: elb.ApplicationLoadBalancer): void {
    const taskDefinition = new ecs.TaskDefinition(this, 'api', {
      cpu: '512',
      compatibility: ecs.Compatibility.EC2
    })

    taskDefinition.addContainer('tacos-server', {
      image: ecs.ContainerImage.fromRegistry('pagarme/static-response-server'),
      environment: {
        CONTENT_TYPE: 'text/plain',
        CONTENT_BODY: 'Tacos are the best'
      },
      portMappings: [{
        containerPort: 8080,
        hostPort: 25111
      }],
      memoryLimitMiB: 256,
      essential: true
    })

    const service = new ecs.Ec2Service(this, 'service', {
      cluster,
      taskDefinition
    })

    const applicationTargetGroup = new elb.ApplicationTargetGroup(this, 'app-target-group', {
      vpc,
      port: 25111,
      targetType: TargetType.INSTANCE,
      protocol: elb.ApplicationProtocol.HTTP
    })
    service.attachToApplicationTargetGroup(applicationTargetGroup)

    const applicationListener = lb.addListener('app', {
      port: 80,
      protocol: elb.ApplicationProtocol.HTTP,
      defaultAction: elb.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody: 'Taco not found'
      })
    })
    applicationListener.addAction('tacos', {
      priority: 5,
      conditions: [
        elb.ListenerCondition.pathPatterns(['/folded/*']),
        elb.ListenerCondition.httpRequestMethods(
          ['GET']
        )],
      action: elb.ListenerAction.forward([applicationTargetGroup])
    })
  }

  private addLoadBalancer (vpc: ec2.Vpc): elb.ApplicationLoadBalancer {
    const lb = new elb.ApplicationLoadBalancer(this, 'LB', {
      vpc,
      internetFacing: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      }
    })
    return lb
  }

  private addEcsCluster (vpc: ec2.Vpc): ecs.Cluster {
    const cluster = new ecs.Cluster(this, 'cluster', {
      vpc,
      capacity: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
        maxCapacity: 2,
        minCapacity: 2,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
          onePerAz: true
        }
      }
    })
    return cluster
  }

  private addVpc (): ec2.Vpc {
    const vpc = new ec2.Vpc(this, 'vpc', {
      maxAzs: 3,
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: 'public'
        }
      ],
      natGateways: 0 // https://www.lastweekinaws.com/blog/the-aws-managed-nat-gateway-is-unpleasant-and-not-recommended/ :)
    })
    return vpc
  }
}
