import { Logger, getError, getErrorMessage } from '@epickris/node-logger';
import { existsSync, moveSync, readFileSync } from 'fs-extra';
import rimraf from 'rimraf';

import { CompressarrAPI, InternalAPIEvent, JobActionIdentifier, JobActionName, JobActionPlugin, JobActionPluginConstructor, LibraryName } from './api';
import { CompressarrConfig, JobConfig } from './bridgeService';
import { KillError } from './errors';
import { Job } from './job';
import { JobManager, JobManagerOptions } from './jobManager';
import { Library } from './library';
import { LibraryManager, LibraryManagerOptions } from './libraryManager';
import { Plugin } from './plugin';
import { PluginManager, PluginManagerOptions } from './pluginManager';
import { StorageService } from './storageService';
import { User } from './user';

/** Log */
const log = Logger.internal;

/** Compressarr Options */
export interface CompressarrOptions {

    /** Custom Plugin Path? */
    customPluginPath?: string;

    /** Custom Job Path? */
    customJobPath?: string;

    /** Debug Mode Enabled? */
    debugModeEnabled?: boolean;

    /** Force Color Logging? */
    forceColorLogging?: boolean;

    /** Custom Storage Path? */
    customStoragePath?: string;

    /** Instances? */
    instances?: number;
}

/** Server */
export class Server {

    /** Compressarr API */
    private readonly api: CompressarrAPI;

    /** Plugin Manager */
    private readonly pluginManager: PluginManager;

    /** Job Manager */
    private readonly jobManager: JobManager;

    /** Library Manager */
    private readonly libraryManager: LibraryManager;

    /** Storage Service */
    private readonly storageService: StorageService;

    /** Compressarr Configuration */
    private readonly config: CompressarrConfig;

    /** Job Actions Instances */
    private readonly jobActionsInstances: JobActionPlugin[] = [];

    /** Active Jobs */
    private readonly activeJobs: Map<string, JobConfig> = new Map();

    /**
     * @param options Compressarr Options
     */
    constructor(
        private options: CompressarrOptions = {},
    ) {
        this.config = Server.loadConfig();
    
        this.api = new CompressarrAPI(); 
        this.storageService = new StorageService(User.storagePath());
        this.storageService.initSync();
    
        const pluginManagerOptions: PluginManagerOptions = {
            activePlugins: this.config.plugins,
            disabledPlugins: this.config.disabledPlugins,
            customPluginPath: options.customPluginPath,
        };

        this.pluginManager = new PluginManager(this.api, pluginManagerOptions);

        const libraryManagerOptions: LibraryManagerOptions = {
            activeLibraries: this.config.libraries.map(libraryConfig => libraryConfig.name),
            disabledLibraries: this.config.disabledLibraries
        }

        this.libraryManager = new LibraryManager(this.api, libraryManagerOptions);

        const jobManagerOptions: JobManagerOptions = {
            customJobPath: options.customJobPath,
            instances: options.instances
        }

        this.jobManager = new JobManager(this.api, jobManagerOptions);

        this.api.on(InternalAPIEvent.REGISTER_JOB, async (path, jobConfig) => {
            this.activeJobs.set(path, jobConfig);

            const logger = Logger.withPrefix(jobConfig.name);

            let job = new Job(logger, jobConfig);
            let hasJob;

            for (const jobActionInstance of this.jobActionsInstances) {
                hasJob = this.activeJobs.has(path);

                if (hasJob) {

                    try {
                        job = await jobActionInstance.start(job);
                    } catch (error) {
                        if (error instanceof KillError) {
                            log.debug(error.message);

                            return;
                        }

                        log.error(getError(error));
                    }
                } else {
                    jobActionInstance.kill(path);

                    break;
                }
            }

            hasJob = this.activeJobs.has(path);

            if (hasJob) {
                const srcPath = job.getSrcPath();

                if (srcPath !== path) {
                    moveSync(job.getSrcPath(), path, {
                        overwrite: true
                    });
                }

                this.activeJobs.delete(path);

                rimraf(jobConfig.tempPath, () => {});

                this.api.publishJob(path);
            }
        });

        this.api.on(InternalAPIEvent.UNREGISTER_JOB, (path) => {
            for (const jobActionInstance of this.jobActionsInstances) {
                jobActionInstance.kill(path);
            }

            this.activeJobs.delete(path);
        });
    }

    /** Start */
    public async start(): Promise<void> {
        const promises: Promise<void>[] = [];

        this.pluginManager.initializeInstalledPlugins();
        this.libraryManager.initializeLibraries(this.config.libraries);

        if (this.config.jobActions.length > 0) {
            this.loadJobActions();
        }

        if (this.config.libraries.length > 0) {
            this.loadLibraries();
        }
    
        this.api.signalFinished();
    
        await Promise.all(promises);
    }

    /** Teardown */
    public teardown(): void {}

    /**
     * Load Configuration
     * @returns Compressarr Configuration
     */
    private static loadConfig(): CompressarrConfig {
        const configPath = User.configPath();

        if (!existsSync(configPath)) {
            log.warn(`config.json (${configPath}) not found.`);

            return {
                libraries: [],
                jobActions: []
            };
        }
    
        let config: Partial<CompressarrConfig>;
        try {
            config = JSON.parse(readFileSync(configPath, { encoding: 'utf8' }));
        } catch (error) {
            log.error('There was a problem reading your config.json file.');
            log.error('Please try pasting your config.json file here to validate it: http://jsonlint.com');
            log.error('');

            throw error;
        }
    
        config.libraries = config.libraries || [];
        config.jobActions = config.jobActions || [];

        log.info(`Loaded config.json with ${config.libraries.length} libraries and ${config.jobActions.length} job actions.`);
    
        return config as CompressarrConfig;
    }

    /** Load Job Actions */
    private loadJobActions(): void {
        log.info(`Loading ${this.config.jobActions.length} job actions...`);
    
        this.config.jobActions.forEach((jobActionConfig, index) => {
            if (!jobActionConfig.jobAction) {
                log.warn(`our config.json contains an illegal job action configuration object at position ${index + 1}. \
                    Missing property 'jobAction'. Skipping entry...`);

                return;
            }
        
            const jobActionIdentifier: JobActionName | JobActionIdentifier = jobActionConfig.jobAction;
            const displayName = jobActionConfig.name;

            if (!displayName) {
                log.warn(`Could not load job action ${jobActionIdentifier} at position ${index + 1} as it is missing the required 'name' property!`);

                return;
            }
        
            let plugin: Plugin;
            let constructor: JobActionPluginConstructor;
        
            try {
                plugin = this.pluginManager.getPluginForJobAction(jobActionIdentifier);
            } catch (error) {
                log.error(getErrorMessage(error));

                return;
            }
        
            if (plugin.disabled) {
                log.warn(`Ignoring config for the job action "${jobActionIdentifier}" in your config.json as the plugin "${plugin.getPluginIdentifier()}" has been disabled.`);

                return;
            }
        
            try {
                constructor = plugin.getJobActionConstructor(jobActionIdentifier);
            } catch (error) {
                log.error(`Error loading the job action "${jobActionIdentifier}" requested in your config.json at position ${index + 1} - this is likely an issue with the "${plugin.getPluginIdentifier()}" plugin.`);
                log.error(getError(error));

                return;
            }
        
            const logger = Logger.withPrefix(displayName);

            logger(`Initializing ${jobActionIdentifier} job action...`);
        
            const jobActionInstance: JobActionPlugin = new constructor(logger, jobActionConfig, this.api);

            this.jobActionsInstances.push(jobActionInstance);
        });
    }

    /** Load Libraries */
    private loadLibraries(): void {
        log.info(`Loading ${this.config.libraries.length} libraries...`);
    
        this.config.libraries.forEach((libraryConfig, index) => {
            if (!libraryConfig.library) {
                log.warn(`Your config.json contains an illegal library configuration object at position ${index + 1}. \
                    Missing property 'library'. Skipping entry...`);

                return;
            }
        
            const libraryName: LibraryName = libraryConfig.name;
            const displayName = libraryConfig.name;

            if (!displayName) {
                log.warn(`Could not load library ${libraryName} at position ${index + 1} as it is missing the required 'name' property!`);

                return;
            }
        
            let library: Library;
        
            try {
                library = this.libraryManager.getLibrary(libraryName);
            } catch (error) {
                log.error(getErrorMessage(error));

                return;
            }
        
            if (library.disabled) {
                log.warn(`Ignoring config for the library "${libraryName}" in your config.json as the library "${library.getLibraryName()}" has been disabled.`);

                return;
            }
        
            const logger = library.log;

            logger(`Initializing ${libraryName} library...`);

            library.initialize();
        });
    }
}