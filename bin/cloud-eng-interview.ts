#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TacoService } from '../lib/taco-service';

const app = new cdk.App();
new TacoService(app, 'taco-service', {
    env:{
        region: 'us-east-1'
    }
});