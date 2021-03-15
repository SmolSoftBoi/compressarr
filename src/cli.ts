import 'source-map-support/register';

import commander from 'commander';
import { satisfies } from 'semver';
import { Logger } from '@epickris/node-logger';

import { CompressarrOptions, Server } from './server';
import { User } from './user';
import getVersion, { getRequiredNodeVersion } from './version';

/** Log */
const log = Logger.internal;

/** Required Node Version */
const requiredNodeVersion = getRequiredNodeVersion();

if (requiredNodeVersion && !satisfies(process.version, requiredNodeVersion)) {
  log.warn(`Compressar requires Node.js version of ${requiredNodeVersion} which does not satisfy the current Node.js version of ${process.version}. \
    You may need to upgrade your installation of Node.js`);
}

/** CLI */
export = function cli(): void {

    /** Custom Plugin Path */
    let customPluginPath: string | undefined = undefined;

    /** Custom Job Path */
    let customJobPath: string | undefined = undefined;

    /** Debug Mode Enabled */
    let debugModeEnabled = false;

    /** Force Color Logging */
    let forceColorLogging = false;

    /** Custom Storage Path */
    let customStoragePath: string | undefined = undefined;

    /** Instances */
    let instances: number | undefined = undefined;

    /** Shutting Down? */
    let shuttingDown = false;

    commander
        .version(getVersion())
        .option('-C, --color', 'Force color in logging.', () => forceColorLogging = true)
        .option('-D, --debug', 'Turn on debug level logging.', () => debugModeEnabled = true)
        .option('-I, --instances', 'Instances.', number => instances = parseInt(number))
        .option('-J, --job-path [path]', 'Job path.', path => customJobPath = path)
        .option('-P, --plugin-path [path]', 'Look for plugins installed at [path] as well as the default locations ([path] can also point to a single plugin).', path => customPluginPath = path)
        .option('-U, --user-storage-path [path]', 'Look for compressar user files at [path] instead of the default location (~/.compressar).', path => customStoragePath = path)
        .parse(process.argv);

    if (debugModeEnabled) {
        Logger.setDebugEnabled(true);
    }

    if (forceColorLogging) {
        Logger.forceColor();
    }

    if (customStoragePath) {
        User.setStoragePath(customStoragePath);
    }

    const options: CompressarrOptions = {
        customPluginPath: customPluginPath,
        customJobPath: customJobPath,
        debugModeEnabled: debugModeEnabled,
        forceColorLogging: forceColorLogging,
        customStoragePath: customStoragePath,
        instances: instances
    };

    const server = new Server(options);

    const signalHandler = (signal: NodeJS.Signals, signalNum: number): void => {
        if (shuttingDown) {
            return;
        }

        shuttingDown = true;
    
        log.info(`Got ${signal}, shutting down Compressarr...`);
        setTimeout(() => process.exit(128 + signalNum), 5000);
    
        server.teardown();
    };

    process.on('SIGINT', signalHandler.bind(undefined, 'SIGINT', 2));
    process.on('SIGTERM', signalHandler.bind(undefined, 'SIGTERM', 15));

    const errorHandler = (error: Error): void => {
        if (error.stack) {
            log.error(error.stack);
        }
    
        if (!shuttingDown) {
            process.kill(process.pid, 'SIGTERM');
        }
    };

    process.on('uncaughtException', errorHandler);

    server.start().catch(errorHandler);
}