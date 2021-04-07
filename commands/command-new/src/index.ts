import { JovoCliPlugin, PluginType } from '@jovotech/cli-core';
import { New } from './commands';
import { NewStage } from './commands/new.stage';

export * from './commands';

export class NewCommand extends JovoCliPlugin {
  id: string = 'new';
  type: PluginType = 'command';

  getCommands() {
    return [New, NewStage];
  }
}

export default NewCommand;