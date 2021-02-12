import { flags } from '@oclif/command';
import { cli as ux } from 'cli-ux';
import { emojify } from 'node-emoji';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join as joinPaths } from 'path';
import _merge from 'lodash.merge';
import _get from 'lodash.get';
import _has from 'lodash.has';
import _mergeWith from 'lodash.mergewith';
import _set from 'lodash.set';
import _uniq from 'lodash.uniq';
import * as yaml from 'yaml';
import {
  InstallEventArguments,
  Hook,
  Task,
  JovoCliPluginContext,
  JovoCliError,
  printStage,
  printSubHeadline,
  Project,
  ParseEventArguments,
  OK_HAND,
  STATION,
} from 'jovo-cli-core';
import { BuildEvents } from 'jovo-cli-command-build';
import { FileBuilder, FileObject } from 'filebuilder';
import { JovoModelData, NativeFileInformation } from 'jovo-model';
import { JovoModelGoogle } from 'jovo-model-google';

import defaultFiles from '../utils/DefaultFiles.json';
import { getPlatformDirectory, getPlatformPath } from '../utils/Paths';
import { GoogleActionActions, GoogleActionProjectLocales } from '../utils';

const project: Project = Project.getInstance();

export class BuildHook extends Hook<BuildEvents> {
  install() {
    this.actionSet = {
      'parse': [this.checkForPlatform.bind(this)],
      'before.build': [this.validateModels.bind(this), this.checkForCleanBuild.bind(this)],
      'build': [this.build.bind(this)],
    };
  }

  checkForPlatform(args: ParseEventArguments) {
    // Check if this plugin should be used or not.
    if (args.flags.platform && args.flags.platform !== this.$config.pluginId!) {
      this.uninstall();
    }
  }

  async validateModels(ctx: JovoCliPluginContext) {
    // Validate Jovo model.
    const validationTask: Task = new Task(
      emojify(`${OK_HAND} Validating Google Assistant model files`),
    );

    for (const locale of ctx.locales) {
      const localeTask = new Task(locale, async () => {
        project.validateModel(locale, JovoModelGoogle.getValidator());
        await ux.wait(500);
      });

      validationTask.add(localeTask);
    }

    await validationTask.run();
  }

  checkForCleanBuild(ctx: JovoCliPluginContext) {
    // If --clean has been set, delete the respective platform folders before building.
    if (ctx.flags.clean) {
      // @ts-ignore
      rmdirSync(getPlatformPath(), { recursive: true });
    }
  }

  async build(ctx: JovoCliPluginContext) {
    const taskStatus: string = project.hasPlatform(getPlatformDirectory())
      ? 'Updating'
      : 'Creating';

    const buildTaskTitle =
      emojify(
        `${STATION} ${taskStatus} Google Conversational Action project files${printStage(
          project.getStage(),
        )}\n`,
      ) + printSubHeadline(`Path: ./${project.getBuildDirectory()}${getPlatformDirectory()}`);

    // Define main build task.
    const buildTask: Task = new Task(buildTaskTitle);

    // Update or create Google Conversational Action project files, depending on whether it has already been built or not.
    const projectFilesTask: Task = new Task(
      `${taskStatus} Project Files`,
      this.createGoogleProjectFiles.bind(this, ctx),
    );

    const buildInteractionModelTask: Task = new Task(
      `${taskStatus} Interaction Model`,
      this.createInteractionModel(ctx),
    );
    // If no model files for the current locales exist, do not build interaction model.
    if (!project.hasModelFiles(ctx.locales)) {
      buildInteractionModelTask.disable();
    }

    buildTask.add(projectFilesTask, buildInteractionModelTask);

    await buildTask.run();
  }

  createGoogleProjectFiles(ctx: JovoCliPluginContext) {
    const files: FileObject = FileBuilder.normalizeFileObject(
      _get(this.$config, 'options.files', {}),
    );
    const projectLocales: GoogleActionProjectLocales = this.resolveProjectLocales(ctx);
    // If platforms folder doesn't exist, take default files and parse them with project.js config into FileBuilder.
    const projectFiles: FileObject = project.hasPlatform(getPlatformDirectory())
      ? files
      : _merge(defaultFiles, files);
    // Get default locale.
    const defaultLocale: string = this.getDefaultLocale(ctx.locales);
    // Merge global project.js properties with platform files.
    // Set endpoint.
    const endpoint: string = this.getPluginEndpoint();
    const webhookPath: string = 'webhooks/["ActionsOnGoogleFulfillment.yaml"]';

    if (endpoint && !_has(projectFiles, webhookPath)) {
      const defaultHandler = {
        handlers: [
          {
            name: 'Jovo',
          },
        ],
        httpsEndpoint: {
          baseUrl: this.getPluginEndpoint(),
        },
      };

      _set(projectFiles, webhookPath, defaultHandler);
    }

    // Set default settings, such as displayName.
    for (const [modelLocale, resolvedLocales] of Object.entries(projectLocales)) {
      for (const locale of resolvedLocales) {
        const settingsPathArr: string[] = ['settings/'];

        if (locale !== defaultLocale) {
          settingsPathArr.push(`${locale}/`);
        }

        settingsPathArr.push('["settings.yaml"]');

        const settingsPath: string = settingsPathArr.join('.');

        // Set default settings.
        if (locale === defaultLocale) {
          if (!_has(projectFiles, `${settingsPath}.defaultLocale`)) {
            _set(projectFiles, `${settingsPath}.defaultLocale`, defaultLocale);
          }

          if (!_has(projectFiles, `${settingsPath}.projectId`)) {
            _set(projectFiles, `${settingsPath}.projectId`, this.getProjectId(ctx));
          }
        }

        // Set minimal required localized settings, such as displayName and pronunciation.
        const localizedSettingsPath: string = `${settingsPath}.localizedSettings`;

        const invocationName: string = this.getInvocationName(modelLocale);
        if (!_has(projectFiles, `${localizedSettingsPath}.displayName`)) {
          _set(projectFiles, `${localizedSettingsPath}.displayName`, invocationName);
        }
        if (!_has(projectFiles, `${localizedSettingsPath}.pronunciation`)) {
          _set(projectFiles, `${localizedSettingsPath}.pronunciation`, invocationName);
        }
      }
    }

    FileBuilder.buildDirectory(projectFiles, getPlatformPath());
  }

  /**
   * Creates and returns tasks for each locale to build the interaction model for Google Assistant.
   * @param ctx - JovoCliPluginContext, containing context-sensitive information such as what locales to use.
   */
  createInteractionModel(ctx: JovoCliPluginContext): Task[] {
    const tasks: Task[] = [];
    const projectLocales: GoogleActionProjectLocales = this.resolveProjectLocales(ctx);
    const defaultLocale: string = this.getDefaultLocale();
    for (const [modelLocale, resolvedLocales] of Object.entries(projectLocales)) {
      for (const locale of resolvedLocales) {
        const localeTask: Task = new Task(locale, async () => {
          this.buildLanguageModel(modelLocale, locale, defaultLocale);
          await ux.wait(500);
        });
        tasks.push(localeTask);
      }
    }
    return tasks;
  }

  /**
   * Builds and saves Google Conversational Action model from Jovo model.
   * @param {string} locale
   * @param {string} stage
   */
  buildLanguageModel(modelLocale: string, resolvedLocale: string, defaultLocale: string) {
    const model = this.getModel(modelLocale);
    const jovoModel = new JovoModelGoogle(model, resolvedLocale, defaultLocale);
    const modelFiles: NativeFileInformation[] = jovoModel.exportNative()!;

    const actions: GoogleActionActions = {
      custom: {
        'actions.intent.MAIN': {},
      },
    };

    for (const file of modelFiles) {
      const fileName = file.path.pop()!;
      const modelPath = joinPaths(getPlatformPath(), ...file.path);

      // Check if the path for the current model type (e.g. intent, types, ...) exists.
      if (!existsSync(modelPath)) {
        mkdirSync(modelPath, { recursive: true });
      }

      // Register actions.
      if (file.path.includes('intents')) {
        actions.custom[fileName.replace('.yaml', '')] = {};
      }

      writeFileSync(joinPaths(modelPath, fileName), file.content);
    }

    // Merge existing actions file with configuration in project.js.
    _merge(actions, this.getProjectActions());

    const actionsPath: string = joinPaths(getPlatformPath(), 'actions');
    if (!existsSync(actionsPath)) {
      mkdirSync(actionsPath, { recursive: true });
    }
    writeFileSync(joinPaths(actionsPath, 'actions.yaml'), yaml.stringify(actions));
  }

  /**
   * Gets configured actions from project.js
   */
  getProjectActions() {
    const actions = _get(this.$config, 'options.actions/');
    return actions;
  }

  /**
   * Gets the default locale for the current Conversational Action.
   * @param locales - An optional array of locales to choose the default locale from, if provided.
   */
  getDefaultLocale(locales?: string[]): string {
    const defaultLocale: string =
      _get(this.$config, 'options.files.settings/["settings.yaml"].defaultLocale') ||
      _get(this.$config, 'options.defaultLocale');

    if (!defaultLocale && locales) {
      // If locales includes an english model, take english as default automatically.
      for (const locale of locales) {
        if (locale.includes('en')) {
          return 'en';
        }
      }

      // Get default locale from Jovo Models.
      return locales[0].substring(0, 2);
    }

    if (!defaultLocale) {
      throw new JovoCliError(
        'Could not find a default locale.',
        this.$config.name,
        'Try adding the property "defaultLocale" to your project.js.',
      );
    }

    return defaultLocale;
  }

  /**
   * Resolves project locales. Since Google Conversational Actions require at least one specific locale (e.g. en-US for en),
   * we need to resolve any generic locales to more specific ones.
   * @param ctx - Current JovoCliPluginContext.
   */
  resolveProjectLocales(ctx: JovoCliPluginContext): GoogleActionProjectLocales {
    const projectLocales: GoogleActionProjectLocales = {};

    // Get project locales to build.
    // Since Google Conversational Actions require at least one specific locale (e.g. en-US for en),
    // we need to resolve any generic locales to more specific ones.
    for (const locale of ctx.locales) {
      const localePrefix = locale.substring(0, 2);
      const locales: string[] = this.getProjectLocales(locale) || [];
      // Add the main locale to the array of locales, as well as the locale prefix.
      locales.unshift(locale);
      locales.unshift(localePrefix);

      // Unify locales to remove duplicates.
      projectLocales[locale] = _uniq(locales);
    }

    return projectLocales;
  }

  /**
   * Try to get locale resolution (en -> en-US) from project.js.
   * @param locale - The locale to get the resolution from.
   */
  getProjectLocales(locale: string): string[] {
    return _get(this.$config, `options.locales.${locale}`) as string[];
  }

  /**
   * Returns the project id for the Google Conversational Action.
   * @param ctx - Current JovoCliPluginContext.
   */
  getProjectId(ctx: JovoCliPluginContext): string {
    const projectId: string = ctx.flags?.projectId || _get(this.$config, 'options.projectId');
    return projectId;
  }

  /**
   * Get plugin-specific endpoint.
   */
  getPluginEndpoint(): string {
    const config = project.getConfig();
    const endpoint = _get(this.$config, 'options.endpoint') || _get(config, 'endpoint');

    return project.resolveEndpoint(endpoint);
  }

  /**
   * Gets the invocation name for the specified locale.
   * @param locale - The locale of the Jovo model to fetch the invocation name from.
   */
  getInvocationName(locale: string): string {
    const { invocation } = this.getModel(locale);

    if (typeof invocation === 'object') {
      const platformInvocation: string = invocation[this.$config.pluginId!];

      if (!platformInvocation) {
        throw new JovoCliError(
          `Can\'t find invocation name for locale ${locale}.`,
          this.$config.name,
        );
      }

      return platformInvocation;
    }

    return invocation;
  }

  /**
   * Loads a Jovo model specified by a locale and merges it with plugin-specific models.
   * @param locale - The locale that specifies which model to load.
   */
  getModel(locale: string): JovoModelData {
    const model: JovoModelData = project.getModel(locale);

    // Create customizer to concat model arrays instead of overwriting them.
    const mergeCustomizer: Function = (objValue: any[], srcValue: any) => {
      // Since _.merge simply overwrites the original array, concatenate them instead.
      if (Array.isArray(objValue)) {
        return objValue.concat(srcValue);
      }
    };

    // Merge model with configured language model in project.js.
    _mergeWith(
      model,
      project.$configReader.getConfigParameter(`languageModel.${locale}`) || {},
      mergeCustomizer,
    );
    // Merge model with configured, platform-specific language model in project.js.
    _mergeWith(model, _get(this.$config, `options.languageModel.${locale}`, {}), mergeCustomizer);

    return model;
  }
}