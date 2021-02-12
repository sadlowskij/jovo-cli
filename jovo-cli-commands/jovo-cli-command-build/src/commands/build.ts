import { flags } from '@oclif/command';
import { Input } from '@oclif/command/lib/flags';
import { existsSync, mkdirSync } from 'fs';
import {
  BaseCommand,
  validateLocale,
  promptForPlatform,
  JovoCliPluginContext,
  JovoCliError,
  Task,
  printSubHeadline,
  TADA,
  wait,
  JovoCli,
} from 'jovo-cli-core';

const jovo: JovoCli = JovoCli.getInstance();

export interface BuildEvents {
  'before.build': JovoCliPluginContext;
  'build': JovoCliPluginContext;
  'after.build': JovoCliPluginContext;
  'reverse.build': JovoCliPluginContext;
}

export class Build extends BaseCommand<BuildEvents> {
  static id: string = 'build';
  static description: string =
    'Build platform-specific language models based on jovo models folder.';
  static examples: string[] = ['jovo build --platform alexaSkill', 'jovo build --target zip'];
  static flags: Input<any> = {
    clean: flags.boolean({
      description:
        'Deletes all platform folders and executes a clean build. If --platform is specified, it deletes only the respective platforms folder.',
    }),
    deploy: flags.boolean({
      char: 'd',
      description: 'Runs deploy after build.',
    }),
    force: flags.boolean({
      description: 'Forces overwrite of existing project for reverse build.',
      dependsOn: ['reverse'],
    }),
    locale: flags.string({
      char: 'l',
      description: 'Locale of the language model.\n<en|de|etc>',
    }),
    platform: flags.string({
      char: 'p',
      description: 'Specifies a build platform.',
      options: jovo.getPlatforms(),
    }),
    reverse: flags.boolean({
      char: 'r',
      description: 'Builds Jovo language model from platform specific language model.',
    }),
    stage: flags.string({
      description: 'Takes configuration from specified stage.',
    }),
    target: flags.string({
      char: 't',
      description: 'Target of build.',
      // options: [TARGET_ALL, TARGET_INFO, TARGET_MODEL, TARGET_ZIP, ...deployTargets.getAllPluginTargets()],
    }),
  };
  static args = [];

  async run() {
    const { args, flags } = this.parse(Build);

    await this.$emitter!.run('parse', { command: Build.id, flags, args });

    this.log(`\n jovo build: ${Build.description}`);
    this.log(printSubHeadline('Learn more: https://jovo.tech/docs/cli/build\n'));

    // Platform-independent validation.
    validateLocale(flags.locale);

    // Build plugin context, containing information about the current command environemnt.
    const context: JovoCliPluginContext = {
      command: Build.id,
      locales: flags.locale ? [flags.locale] : jovo.$project!.getLocales(),
      platforms: flags.platform ? [flags.platform] : jovo.getPlatforms(),
      flags,
      args,
    };

    // If --reverse flag has been set and more than one platform has been specified, prompt for one.
    if (flags.reverse) {
      if (context.platforms.length !== 1) {
        const { platform } = await promptForPlatform(
          'Please select the platform you want to reverse build from:',
          jovo.getPlatforms(),
        );
        context.platforms = [platform];
      }

      await this.$emitter!.run('reverse.build', context);
      return;
    }

    await this.$emitter!.run('before.build', context);

    // Create "fake" tasks for more verbose logs.
    const initTask: Task = new Task(`${TADA} Initializing build process`);

    const collectConfigTask: Task = new Task(
      'Collecting platform configuration from project.js.',
      async () => {
        await wait(500);
        return `Platforms: ${context.platforms.join(',')}`;
      },
    );
    const collectModelsTask: Task = new Task(
      `Collecting Jovo language model files from ./${jovo.$project!.getModelsDirectory()} folder.`,
      async () => {
        await wait(500);
        return `Locales: ${context.locales.join(',')}`;
      },
    );

    initTask.add(collectConfigTask, collectModelsTask);

    await initTask.run();

    // Create build/ folder depending on user config.
    const buildPath: string = jovo.$project!.getBuildPath();
    if (!existsSync(buildPath)) {
      mkdirSync(buildPath);
    }

    await this.$emitter!.run('build', context);
    await this.$emitter!.run('after.build');

    this.log();
    this.log('  Build completed.');
    this.log();
  }

  async catch(error: JovoCliError) {
    this.error(`There was a problem:\n${error}`);
  }
}