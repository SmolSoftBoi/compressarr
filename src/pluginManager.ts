import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { delimiter, join, resolve } from 'path';

import { Logger } from '@epickris/node-logger';

import { CompressarrAPI, InternalAPIEvent, JobActionIdentifier, JobActionName, JobActionPluginConstructor, PluginIdentifier, PluginName } from './api';
import { Plugin } from './plugin';
import { FFProbeResult } from 'ffprobe';
import { Job } from './job';
import EventEmitter from 'node:events';

/** Log */
const log = Logger.internal;

/**
 * Incomplete type for package.json (just stuff we use here).
 */
export interface PackageJSON {

    /** Name */
    name: string;

    /** Version */
    version: string;

    /** Keywords */
    keywords?: string[];
  
    /** Main */
    main?: string;
  
    /** Engines */
    engines?: Record<string, string>;

    /** Dependencies */
    dependencies?: Record<string, string>;

    /** Dev Dependencies */
    devDependencies?: Record<string, string>;

    /** Peer Dependencies */
    peerDependencies?: Record<string, string>;
}

/** Plugin Maager Options */
export interface PluginManagerOptions {

    /**
     * Additional path to search for plugins in.
     * Specified relative to the current working directory.
     */
    customPluginPath?: string;

    /**
     * When defined, only plugins specified here will be initialized.
     */
    activePlugins?: PluginIdentifier[];

    /**
     * Plugins that are marked as disabled and whos corresponding config blocks should be ignored.
     */
    disabledPlugins?: PluginIdentifier[];
}

/** Plugin Manager */
export class PluginManager {

    /**
     * Name must be prefixed with 'compressarr-' or '@scope/compressarr-'.
     */
    private static readonly PLUGIN_IDENTIFIER_PATTERN = /^((@[\w-]*)\/)?(compressarr-[\w-]*)$/;

    /** Compressarr API */
    private readonly api: CompressarrAPI;

    /**
     * Unique set of search paths we will use to discover installed plugins.
     */
    private readonly searchPaths: Set<string> = new Set();

    /** Active Plugins */
    private readonly activePlugins?: PluginIdentifier[];

    /** Disabled Plugins */
    private readonly disabledPlugins?: PluginIdentifier[];

    /** Plugins */
    private readonly plugins: Map<PluginIdentifier, Plugin> = new Map();

    /**
     * We have some plugins which simply pass a wrong or misspelled plugin name to the API calls, this translation tries to mitigate this.
     */
    private readonly pluginIdentifierTranslation: Map<PluginIdentifier, PluginIdentifier> = new Map();

    /** Job Action to Plugin Map */
    private readonly jobActionToPluginMap: Map<JobActionName, Plugin[]> = new Map();

    /**
     * Used to match registering plugins, see `handleRegisterJobAction`.
     */
    private currentInitializingPlugin?: Plugin;

    /**
     * @param api Compressar API
     * @param options Plugin Manager Options
     */
    constructor(api: CompressarrAPI, options?: PluginManagerOptions) {
        this.api = api;
    
        if (options) {
            if (options.customPluginPath) {
                this.searchPaths.add(resolve(process.cwd(), options.customPluginPath));
            }
        
            this.activePlugins = options.activePlugins;
            this.disabledPlugins = Array.isArray(options.disabledPlugins) ? options.disabledPlugins : undefined;
        }
    
        this.api.on(InternalAPIEvent.REGISTER_JOB_ACTION, this.handleRegisterJobAction.bind(this));
    }

    /**
     * Is Qualified Plugin Identifier?
     * @param identifier Identifier
     * @returns Qualifieed Plugin Identifier?
     */
    public static isQualifiedPluginIdentifier(identifier: string): boolean {
        return PluginManager.PLUGIN_IDENTIFIER_PATTERN.test(identifier);
    }

    /**
     * Extract plugin name without "@scope/"" prefix.
     * @param name Name
     * @returns Plugin Name
     */
    public static extractPluginName(name: string): PluginName {
        return name.match(PluginManager.PLUGIN_IDENTIFIER_PATTERN)![3];
    }

    /**
     * Extract the "@scope" of a npm module name.
     * @param name Name
     * @returns Plugin Scope
     */
    public static extractPluginScope(name: string): string {
        return name.match(PluginManager.PLUGIN_IDENTIFIER_PATTERN)![2];
    }

    /**
     * Get Job Action Name
     * @param identifier Job Action Identifier
     * @returns Job action Name
     */
    public static getJobActionName(identifier: JobActionIdentifier): JobActionName {
        if (identifier.indexOf('.') === -1) {
            return identifier;
        }
    
        return identifier.split('.')[1];
    }

    /**
     * Get Plugin Identifier
     * @param identifier Identifier
     * @returns Plugin Identifier
     */
    public static getPluginIdentifier(identifier: JobActionIdentifier): PluginIdentifier {
        return identifier.split('.')[0];
    }

    /** Initialize Installed Plugins */
    public initializeInstalledPlugins(): void {
        log.info('---');
    
        this.loadInstalledPlugins();
    
        this.plugins.forEach((plugin: Plugin, identifier: PluginIdentifier) => {
            try {
                plugin.load();
            } catch (error) {
                log.error('====================');
                log.error(`ERROR LOADING PLUGIN ${identifier}:`);
                log.error(error.stack);
                log.error('====================');
        
                this.plugins.delete(identifier);

                return;
            }
        
            if (this.disabledPlugins && this.disabledPlugins.includes(plugin.getPluginIdentifier())) {
                plugin.disabled = true;
            }
        
            if (plugin.disabled) {
                log.warn(`Disabled plugin: ${identifier}@${plugin.version}`);
            } else {
                log.info(`Loaded plugin: ${identifier}@${plugin.version}`);
            }
        
            this.initializePlugin(plugin, identifier);
        
            log.info('---');
        });
    
        this.currentInitializingPlugin = undefined;
    }

    /**
     * Initiallize Plugin
     * @param plugin Plugin
     * @param identifier Identifier
     */
    public initializePlugin(plugin: Plugin, identifier: string): void {
        try {
            this.currentInitializingPlugin = plugin;
            plugin.initialize(this.api);
        } catch (error) {
          log.error('====================');
          log.error(`ERROR INITIALIZING PLUGIN ${identifier}:`);
          log.error(error.stack);
          log.error('====================');
    
          this.plugins.delete(identifier);

          return;
        }
    }

    /**
     * Handle Register Job Action
     * @param name Job Action Name
     * @param constructor Job Action Plugin Constructor
     * @param pluginIdentifier Plugin Identifier
     */
    private handleRegisterJobAction(name: JobActionName, constructor: JobActionPluginConstructor, pluginIdentifier?: PluginIdentifier): void {
        if (!this.currentInitializingPlugin) {
            throw new Error(`Unexpected job action registration. Plugin ${pluginIdentifier? `'${pluginIdentifier}' `: ''}tried to register outside the initializer function!`);
        }
    
        if (pluginIdentifier && pluginIdentifier !== this.currentInitializingPlugin.getPluginIdentifier()) {
            log.info(`Plugin '${this.currentInitializingPlugin.getPluginIdentifier()}' tried to register with an incorrect plugin identifier: '${pluginIdentifier}'. Please report this to the developer!`);
            this.pluginIdentifierTranslation.set(pluginIdentifier, this.currentInitializingPlugin.getPluginIdentifier());
        }
    
        this.currentInitializingPlugin.registerJobAction(name, constructor);
    
        let plugins = this.jobActionToPluginMap.get(name);
        if (!plugins) {
            plugins = [];
            this.jobActionToPluginMap.set(name, plugins);
        }

        plugins.push(this.currentInitializingPlugin);
    }

    /**
     * Get Plugin for Job Action
     * @param jobActionIdentifier Job Action Identifieer
     * @returns Plugin
     */
    public getPluginForJobAction(jobActionIdentifier: JobActionIdentifier | JobActionName): Plugin {
        let plugin: Plugin;
        if (jobActionIdentifier.indexOf('.') === -1) {
            let found = this.jobActionToPluginMap.get(jobActionIdentifier);
        
            if (!found) {
                throw new Error(`No plugin was found for the job action "${jobActionIdentifier}" in your config.json. Please make sure the corresponding plugin is installed correctly.`);
            }
        
            if (found.length > 1) {
                const options = found.map(plugin => `${plugin.getPluginIdentifier()}.${jobActionIdentifier}`).join(', ');

                found = found.filter(plugin => !plugin.disabled);
                if (found.length !== 1) {
                    throw new Error(`The requested accessory '${jobActionIdentifier}' has been registered multiple times. Please be more specific by writing one of: ${options}`);
                }
            } 
        
            plugin = found[0];
            jobActionIdentifier = `${plugin.getPluginIdentifier()}.${jobActionIdentifier}`;
        
        } else {
            const pluginIdentifier = PluginManager.getPluginIdentifier(jobActionIdentifier);
            if (!this.hasPluginRegistered(pluginIdentifier)) {
                throw new Error(`The requested plugin '${pluginIdentifier}' was not registered.`);
            }
        
            plugin = this.getPlugin(pluginIdentifier)!;
        }
    
        return plugin;
    }

    /**
     * Has Plugin Registered?
     * @param pluginIdentifier Plugin Identifier
     * @returns Plugin Registered?
     */
    public hasPluginRegistered(pluginIdentifier: PluginIdentifier): boolean {
        return this.plugins.has(pluginIdentifier) || this.pluginIdentifierTranslation.has(pluginIdentifier);
    }

    /**
     * Get Plugin
     * @param pluginIdentifier Plugin Identifier
     * @returns Plugin?
     */
    public getPlugin(pluginIdentifier: PluginIdentifier): Plugin | undefined {
        const plugin = this.plugins.get(pluginIdentifier);

        if (plugin) {
            return plugin;
        } else {
            const translation = this.pluginIdentifierTranslation.get(pluginIdentifier);

            if (translation) {
                return this.plugins.get(translation);
            }
        }
    
        return undefined;
    }

    /**
     * Gets all plugins installed on the local system.
     */
    private loadInstalledPlugins(): void {
        this.loadDefaultPaths();
    
        this.searchPaths.forEach(searchPath => {
            if (!existsSync(searchPath)) {
                return;
            }
        
            if (existsSync(join(searchPath, 'package.json'))) {
                try {
                    this.loadPlugin(searchPath);
                } catch (error) {
                    log.warn(error.message);

                    return;
                }
            } else {
                const relativePluginPaths = readdirSync(searchPath).filter(relativePath => {
                    try {
                        return statSync(resolve(searchPath, relativePath)).isDirectory();
                    } catch (error) {
                        log.debug(`Ignoring path ${resolve(searchPath, relativePath)} - ${error.message}`);

                        return false;
                    }
                });
        
                relativePluginPaths.slice().filter(path => path.charAt(0) === '@').forEach(scopeDirectory => {
                    const index = relativePluginPaths.indexOf(scopeDirectory);
                    relativePluginPaths.splice(index, 1);
        
                    const absolutePath = join(searchPath, scopeDirectory);

                    readdirSync(absolutePath).filter(name => PluginManager.isQualifiedPluginIdentifier(name)).filter(name => {
                        try {
                            return statSync(resolve(absolutePath, name)).isDirectory();
                        } catch (error) {
                            log.debug(`Ignoring path ${resolve(absolutePath, name)} - ${error.message}`);

                            return false;
                        }
                    }).forEach(name => relativePluginPaths.push(`${scopeDirectory}/${name}`));
                });
        
                relativePluginPaths.filter(pluginIdentifier => {
                    return PluginManager.isQualifiedPluginIdentifier(pluginIdentifier) && (!this.activePlugins || this.activePlugins.includes(pluginIdentifier));
                }).forEach(pluginIdentifier => {
                    try {
                        const absolutePath = resolve(searchPath, pluginIdentifier);

                        this.loadPlugin(absolutePath);
                    } catch (error) {
                        log.warn(error.message);

                        return;
                    }
                });
            }
        });
    
        if (this.plugins.size === 0) {
            log.warn('No plugins found. See the README for information on installing plugins.');
        }
    }

    /**
     * Load Plugin
     * @param absolutePath Absolute Path
     * @returns plugin
     */
    public loadPlugin(absolutePath: string): Plugin {
        const packageJson: PackageJSON = PluginManager.loadPackageJSON(absolutePath);
    
        const identifier: PluginIdentifier = packageJson.name;
        const name: PluginName = PluginManager.extractPluginName(identifier);
        const scope = PluginManager.extractPluginScope(identifier);
    
        const alreadyInstalled = this.plugins.get(identifier);

        if (alreadyInstalled) {
            throw new Error(`Warning: skipping plugin found at '${absolutePath}' since we already loaded the same plugin from '${alreadyInstalled.getPluginPath()}'.`);
        }
    
        const plugin = new Plugin(name, absolutePath, packageJson, scope);

        this.plugins.set(identifier, plugin);

        return plugin;
    }

    /**
     * Load Package JSON
     * @param pluginPath Plugin Path
     * @returns Package JSON
     */
    private static loadPackageJSON(pluginPath: string): PackageJSON {
        const packageJsonPath = join(pluginPath, 'package.json');

        let packageJson: PackageJSON;
    
        if (!existsSync(packageJsonPath)) {
            throw new Error(`Plugin ${pluginPath} does not contain a package.json.`);
        }
    
        try {
            packageJson = JSON.parse(readFileSync(packageJsonPath, { encoding: "utf8" })); // attempt to parse package.json
        } catch (error) {
            throw new Error(`Plugin ${pluginPath} contains an invalid package.json. Error: ${error}`);
        }
    
        if (!packageJson.name || !PluginManager.isQualifiedPluginIdentifier(packageJson.name)) {
            throw new Error(`Plugin ${pluginPath} does not have a package name that begins with 'compressarr-' or '@scope/compressarr-'.`);
        }
    
        if (!packageJson.keywords || !packageJson.keywords.includes('compressarr-plugin')) {
            throw new Error(`Plugin ${pluginPath} package.json does not contain the keyword 'compressarr-plugin'.`);
        }
    
        return packageJson;
    }

    /** Load Default Paths */
    private loadDefaultPaths(): void {
        if (require.main) {
            require.main.paths.forEach(path => this.searchPaths.add(path));
        }

        if (process.env.NODE_PATH) {
            process.env.NODE_PATH.split(delimiter).filter(path => !!path).forEach(path => this.searchPaths.add(path));
        } else {
            if (process.platform === 'win32') {
                this.searchPaths.add(join(process.env.APPDATA!, 'npm/node_modules'));
            } else {
                this.searchPaths.add('/usr/local/lib/node_modules');
                this.searchPaths.add('/usr/lib/node_modules');
                this.searchPaths.add(execSync('/bin/echo -n "$(npm --no-update-notifier -g prefix)/lib/node_modules"').toString('utf8'));
            }
        }
    }
}