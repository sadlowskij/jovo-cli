import { execAsync, JovoCliError, MarketplacePlugin } from '@jovotech/cli-core';
import downloadGH from 'download-git-repo';

/**
 * Downloads and extracts a template.
 * @param projectPath - Path to download and extract the template to.
 */
export async function downloadTemplate(projectPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    downloadGH('jovotech/jovo-v4-template', projectPath, (error: Error) => {
      if (error) {
        return reject(error);
      }

      resolve();
    });
  });
}

export async function runNpmInstall(projectPath: string): Promise<void> {
  try {
    await execAsync('npm install', { cwd: projectPath });
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // Suppress NPM warnings.
    throw new JovoCliError({ message: error.stderr, module: 'NewCommand' });
  }
}

/**
 * Inserts a substring into a provided string at an index.
 * @param substr - Substring to be inserted.
 * @param str - String to insert the substring into.
 * @param index - Position of where to insert the substring.
 */
export function insert(substr: string, str: string, index: number): string {
  return str.substring(0, index) + substr + str.substring(index);
}

/**
 * Gets plugins from Jovo Marketplace.
 */
export function fetchMarketPlace(): MarketplacePlugin[] {
  // TODO: Fetch from API.
  const plugins: MarketplacePlugin[] = [
    {
      name: 'FileDb',
      module: 'FileDb',
      package: '@jovotech/db-filedb',
      description: 'Store user data in a local JSON file for fast prototyping and debugging',
      tags: 'databases',
    },
    {
      name: 'DynamoDb',
      module: 'DynamoDb',
      package: '@jovotech/db-dynamodb',
      description: 'Store user data to AWS DynamoDb',
      tags: 'databases',
    },
    {
      name: 'Jovo Core Platform',
      module: 'CorePlatform',
      package: '@jovotech/platform-core',
      description: 'Build voice experiences for custom devices',
      tags: 'platforms',
    },
    {
      name: 'Amazon Alexa',
      module: 'AlexaPlatform',
      cliModule: 'AlexaCli',
      package: '@jovotech/platform-alexa',
      description: 'Build apps for Amazon Alexa',
      tags: 'platforms',
    },
    {
      name: 'Google Assistant',
      module: 'GoogleAssistantPlatform',
      cliModule: 'GoogleAssistantCli',
      package: '@jovotech/platform-googleassistant',
      description: 'Build apps for Google Assistant',
      tags: 'platforms',
    },
    {
      name: 'Facebook Messenger',
      module: 'FacebookMessengerPlatform',
      package: '@jovotech/platform-facebookmessenger',
      description: 'Build apps for Facebook Messenger',
      tags: 'platforms',
    },
    {
      name: 'Google Business Messages',
      module: 'GoogleBusinessPlatform',
      package: '@jovotech/platform-googlebusiness',
      description: 'Build apps for Google Business Messages',
      tags: 'platforms',
    },
    {
      name: 'ExpressJs',
      module: 'express',
      package: '@jovotech/server-express',
      description: 'ExpressJs Server',
      tags: 'server',
    },
    {
      name: 'AWS Lambda',
      module: 'lambda',
      package: '@jovotech/server-lambda',
      description: 'Serverless hosting solution by AWS',
      tags: 'server',
    },
  ];

  // Convert tags into arrays.
  for (const plugin of plugins) {
    plugin.tags = (plugin.tags as string).replace(/\s/g, '').split(',');
  }

  return plugins;
}
