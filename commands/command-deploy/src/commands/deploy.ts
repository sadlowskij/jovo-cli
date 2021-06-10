import {
  checkForProjectDirectory,
  Log,
  PluginCommand,
  printSubHeadline,
  TADA,
} from '@jovotech/cli-core';
import { DeployPlatformEvents } from './deploy.platform';
import { DeployCodeEvents } from './deploy.code';

export type DeployEvents = 'before.deploy' | 'deploy' | 'after.deploy';

export class Deploy extends PluginCommand<DeployEvents | DeployPlatformEvents | DeployCodeEvents> {
  static id = 'deploy';
  static description = 'Deploys the project to the voice platform.';
  static examples: string[] = ['jovo deploy'];

  install(): void {
    this.middlewareCollection = {
      'before.deploy': [this.beforeDeploy.bind(this)],
      'deploy': [this.deploy.bind(this)],
      'after.deploy': [this.afterDeploy.bind(this)],
    };
  }

  async beforeDeploy(): Promise<void> {
    await this.$emitter.run('before.deploy:platform');
    await this.$emitter.run('before.deploy:code');
  }

  async deploy(): Promise<void> {
    await this.$emitter.run('deploy:platform');
    await this.$emitter.run('deploy:code');
  }

  async afterDeploy(): Promise<void> {
    await this.$emitter.run('after.deploy:platform');
    await this.$emitter.run('after.deploy:code');
  }

  async run(): Promise<void> {
    checkForProjectDirectory(this.$cli.isInProjectDirectory());

    Log.spacer();
    Log.info(`jovo deploy: ${Deploy.description}`);
    Log.info(printSubHeadline('Learn more: https://jovo.tech/docs/cli/deploy\n'));

    await this.$emitter.run('before.deploy');
    await this.$emitter.run('deploy');
    await this.$emitter.run('after.deploy');

    Log.spacer();
    Log.info(`${TADA} Deployment completed.`);
    Log.spacer();
  }
}
