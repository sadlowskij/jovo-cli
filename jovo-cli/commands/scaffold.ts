import * as Listr from 'listr';
import * as Vorpal from 'vorpal';
import { addBaseCliOptions } from '../utils/Utils';
import { scaffold } from '../utils/Scaffolder';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { JovoCliRenderer } from '../utils/JovoRenderer';
import { ListrOptionsExtended } from '../src';
import { promptOverwriteHandler, ANSWER_SEPERATE, ANSWER_CANCEL } from '../utils/Prompts';
import { getProject } from 'jovo-cli-core';

const project = getProject();
const srcPath = './models/';
let destPath = './src/app.js';

module.exports = (vorpal: Vorpal) => {
    const vorpalInstance = vorpal
        .command('scaffold')
        // @ts-ignore
        .description('Build a scaffold handler out of your existing language model.')
        .option('--overwrite', 'Forces overwriting of an existing handler file.');

    addBaseCliOptions(vorpalInstance);

    vorpalInstance
        .validate(() => {
            return isValidModel();
        })
        .action(async (args: Vorpal.Args) => {

            const isTs = await project.isTypeScriptProject();
            if (isTs) {
                destPath = './src/app.ts';
            }

            if (!args.options.overwrite && existsSync(destPath)) {
                const answers = await promptOverwriteHandler();
                if (answers.overwriteHandler === ANSWER_SEPERATE) {
                    if (isTs) {
                        destPath = './src/app.scaffold.ts';
                    } else {
                        destPath = './src/app.scaffold.js';
                    }
                }

                if (answers.overwriteHandler === ANSWER_CANCEL) {
                    return Promise.resolve();
                }
            }
            const tasks = new Listr(
                [{
                    title: `Scaffolding handler in ${destPath}`,
                    async task() {
                        await new Promise((res) => setTimeout(() => {
                            const models = readdirSync(srcPath);
                            // Array to temporarily save all intents to counter adding an intent twice.
                            const intents: string[] = [];

                            // This is the basic handler, where intents get added to. Once finished, it gets written into the app.js file.
                            let handler = '{';
                            handler += '\n\tLAUNCH() {\n\n\t},';
                            for (const file of models) {
                                const model = JSON.parse(readFileSync(`${srcPath}${file}`, { encoding: 'utf-8' }));
                                for (const { name } of model.intents) {
                                    if (!intents.includes(name)) {
                                        intents.push(name);
                                        handler += `\n\n\t${name}() {\n\n\t},`;
                                    }
                                }
                            }
                            handler += '\n\n\tEND() {\n\n\t},\n}';

                            const model = scaffold({ handler, type: isTs ? 'ts' : 'js' });

                            writeFileSync(destPath, model);
                            res();
                        }, 500));
                    }
                }],
                // @ts-ignore
                {
                    renderer: JovoCliRenderer,
                    collapse: false,
                } as ListrOptionsExtended
            );

            try {
                await tasks.run();
                console.log(`\n\nSuccessfully scaffolded your handler in '${destPath}'.`);
            } catch (err) {
                process.exit(1);
            }
        });
};

function isValidModel() {
    if (existsSync(srcPath)) {
        if (readdirSync(srcPath).length > 0) {
            return true;
        }
    }
    console.log(`No language model available in '${srcPath}'. Please create at least one language model.`);
    return false;
}