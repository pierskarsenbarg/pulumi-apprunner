// Copyright 2016-2021, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as docker from "@pulumi/docker";

export interface AppRunnerArgs {
  pathToDocker: string;
}

const typeToken = "apprunner:index:AppRunner";

export class AppRunner extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: AppRunnerArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super(typeToken, name, opts);

    const role = new aws.iam.Role(
      `${name}-appRunnerEcrRole`,
      {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
          Service: "build.apprunner.amazonaws.com",
        }),
      },
      { parent: this }
    );

    const ecrPolicy = new aws.iam.Policy(
      `${name}-appRunnerEcrPolicy`,
      {
        policy: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:DescribeImages",
              ],
              Resource: "*",
            },
          ],
        },
      },
      { parent: this }
    );

    new aws.iam.RolePolicy(
      `${name}-rolePolicy`,
      {
        policy: ecrPolicy.policy,
        role: role,
      },
      { parent: this }
    );

    const repo = new aws.ecr.Repository(
      `${name}-imagerepository`,
      {},
      { parent: this }
    );

    const credentials = repo.registryId.apply(async (registryId) => {
      const credentials = await aws.ecr.getCredentials({
        registryId,
      });
      const decodedCredentials = Buffer.from(
        credentials.authorizationToken,
        "base64"
      ).toString();
      const [username, password] = decodedCredentials.split(":");
      return { server: credentials.proxyEndpoint, username, password };
    });

    const image = new docker.Image(
      "myapp",
      {
        imageName: repo.repositoryUrl,
        build: "./app",
        registry: credentials,
      },
      { parent: this }
    );
  }
}
