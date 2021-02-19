import { flags } from '@oclif/command';
import { Input as InputFlags } from '@oclif/command/lib/flags';
import chalk from 'chalk';
import { existsSync } from 'fs';
import {
  JovoCli,
  JovoCliError,
  JovoCliPluginContext,
  PluginCommand,
  TARGET_ALL,
  TARGET_INFO,
  TARGET_MODEL,
} from 'jovo-cli-core';

const jovo: JovoCli = JovoCli.getInstance();

export interface DeployPlatformPluginContext extends JovoCliPluginContext {
  target: typeof TARGET_ALL | typeof TARGET_INFO | typeof TARGET_MODEL;
  src: string;
}

export interface DeployPlatformEvents {
  'before.deploy:platform': DeployPlatformPluginContext;
  'deploy:platform': DeployPlatformPluginContext;
  'after.deploy:platform': DeployPlatformPluginContext;
}

export class DeployPlatform extends PluginCommand<DeployPlatformEvents> {
  static id: string = 'deploy:platform';
  static description: string = 'Deploys platform configuration.';

  static examples: string[] = [
    'jovo deploy --locale en-US --platform alexaSkill --stage dev',
    'jovo deploy --target zip',
  ];

  static flags: InputFlags<any> = {
    locale: flags.string({
      char: 'l',
      description: 'Locale of the language model.\n<en|de|etc>',
      multiple: true,
    }),
    // ToDo: Get deploy targets from JovoCli. Allow to be set multiple times?
    platform: flags.string({
      char: 'p',
      description: 'Specifies a build platform.',
      options: jovo.getPlatforms(),
    }),
    stage: flags.string({
      description: 'Takes configuration from specified stage.',
    }),
    target: flags.string({
      char: 't',
      description: 'Deploy target.',
      options: [TARGET_ALL, TARGET_INFO, TARGET_MODEL],
      default: TARGET_ALL,
    }),
    src: flags.string({
      char: 's',
      description: 'Location of model files.',
    }),
  };
	static args = [];

  install() {
    this.actionSet = {
      'before.deploy:platform': [this.checkForPlatformsFolder.bind(this)],
    };
  }

  checkForPlatformsFolder() {
    if (!existsSync(jovo.$project!.getBuildPath())) {
      throw new JovoCliError(
        "Couldn't find a platform folder.",
        'jovo-cli',
        'Please use "jovo build" to create platform-specific files.',
      );
    }
  }

  async run() {
    const { args, flags } = this.parse(DeployPlatform);

    await this.$emitter!.run('parse', { command: DeployPlatform.id, flags, args });

    this.log(`\n jovo deploy: ${DeployPlatform.description}`);
    this.log(chalk.grey('   >> Learn more: https://jovo.tech/docs/cli/deploy\n'));

    const context: DeployPlatformPluginContext = {
      command: DeployPlatform.id,
      platforms: flags.platform ? [flags.platform] : jovo.getPlatforms(),
      locales: flags.locale ? [flags.locale] : jovo.$project!.getLocales(),
      target: flags.target,
      src: flags.src || jovo.$project!.getBuildDirectory(),
      flags,
      args,
    };

    await this.$emitter.run('before.deploy:platform', context);
    await this.$emitter.run('deploy:platform', context);
    await this.$emitter.run('after.deploy:platform', context);

    this.log();
    this.log('  Build completed.');
    this.log();
  }

  async catch(error: JovoCliError) {
    this.error(`There was a problem:\n${error}`);
  }
}