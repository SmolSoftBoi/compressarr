import assert from 'assert';
import { join } from 'path';

import { Logger } from '@epickris/node-logger';
import { satisfies } from 'semver';

import { API, JobActionIdentifier, JobActionName, JobActionPluginConstructor, PluginIdentifier, PluginInitializer, PluginName } from './api';
import getVersion from './version';
import { PackageJSON, PluginManager } from './pluginManager';

/** Log */
const log = Logger.internal;

/**
 * Represents a loaded Compressarr plugin.
 */
export class Plugin {

    /** Plugin Name */
    private readonly pluginName: PluginName;

    /**
     * Package scope.
     */
    private readonly scope?: string;

    /** Plugin Path */
    private readonly pluginPath: string;

    /**
     * mark the plugin as disabled.
     */
    public disabled = false;

    /** Version */
    readonly version: string;

    /** Main */
    private readonly main: string;

    /**
     * Used to store data for a limited time until the load method is called, will be reset afterwards.
     */
    private loadContext?: {
        engines?: Record<string, string>;
        dependencies?: Record<string, string>;
    }

    /**
     * Default exported function from the plugin that initializes it.
     */
    private pluginInitializer?: PluginInitializer;

    /** Registered Job Actions */
    private readonly registeredJobActions: Map<JobActionName, JobActionPluginConstructor> = new Map();

    /**
     * @param name Plugin name
     * @param path Path
     * @param packageJSON Package JSON
     * @param scope Scope?
     */
    constructor(name: PluginName, path: string, packageJSON: PackageJSON, scope?: string) {
        this.pluginName = name;
        this.scope = scope;
        this.pluginPath = path;
        this.version = packageJSON.version || '0.0.0';
        this.main = packageJSON.main || './index.js';

        if (packageJSON.peerDependencies && (!packageJSON.engines || !packageJSON.engines.compressarr)) {
            packageJSON.engines = packageJSON.engines || {};
            packageJSON.engines.compressarr = packageJSON.peerDependencies.compressarr;
        }

        this.loadContext = {
            engines: packageJSON.engines,
            dependencies: packageJSON.dependencies,
        };
    }

    /**
     * Get Plugin Identifier
     * @returns Return full plugin name with scope prefix.
     */
    public getPluginIdentifier(): PluginIdentifier {
        return (this.scope? this.scope + '/': '') + this.pluginName;
    }

    /**
     * Get Plugin Path
     * @returns Plugin Path
     */
    public getPluginPath(): string {
        return this.pluginPath;
    }

    /**
     * Register Job Action
     * @param name Job Action Name
     * @param constructor Job Action Plugin Constructor
     */
    public registerJobAction(name: JobActionName, constructor: JobActionPluginConstructor): void {
        if (this.registeredJobActions.has(name)) {
            throw new Error(`Plugin '${this.getPluginIdentifier()}' tried to register a job action '${name}' which has already been registered!`);
        }
    
        if (!this.disabled) {
            log.info(`Registering accessory '${this.getPluginIdentifier()}.${name}'`);
        }
    
        this.registeredJobActions.set(name, constructor);
    }

    /**
     * Get Job action Constructor
     * @param jobActionIdentifier Job Action Identifier
     * @returns Job Action Plugin Constructor
     */
    public getJobActionConstructor(jobActionIdentifier: JobActionIdentifier | JobActionName): JobActionPluginConstructor {
        const name: JobActionName = PluginManager.getJobActionName(jobActionIdentifier);

        const constructor = this.registeredJobActions.get(name);

        if (!constructor) {
            throw new Error(`The requested accessory '${name}' was not registered by the plugin '${this.getPluginIdentifier()}'.`);
        }
    
        return constructor;
    }

    /** Load */
    public load(): void {
        const context = this.loadContext!;

        assert(context, 'Reached illegal state. Plugin state is undefined!');

        this.loadContext = undefined;

        if (!context.engines || !context.engines.compressarr) {
            throw new Error(`Plugin ${this.pluginPath} does not contain the 'compressarr' package in 'engines'.`);
        }

        const versionRequired = context.engines.compressarr;
        const nodeVersionRequired = context.engines.node;

        if (!satisfies(getVersion(), versionRequired, { includePrerelease: true })) {
            log.error(`The plugin "${this.pluginName}" requires a Compressarr version of ${versionRequired} which does not satisfy the current Compressarr version of ${getVersion()}. \
                You may need to update this plugin (or Compressarr) to a newer version. \
                You may face unexpected issues or stability problems running this plugin.`);
        }

        if (nodeVersionRequired && !satisfies(process.version, nodeVersionRequired)) {
            log.warn(`The plugin "${this.pluginName}" requires Node.js version of ${nodeVersionRequired} which does not satisfy the current Node.js version of ${process.version}. \
                You may need to upgrade your installation of Node.js.`);
        }

        const dependencies = context.dependencies || {};

        if (dependencies.compressarr) {
            log.error(`The plugin "${this.pluginName}" defines 'compressarr' in their 'dependencies' section, meaning they carry an additional copy of compressarr. \
                This not only wastes disk space, but also can cause major incompatibility issues and thus is considered bad practice. \
                Please inform the developer to update their plugin!`);
        }

        const mainPath = join(this.pluginPath, this.main);
        const pluginModules = require(mainPath);

        if (typeof pluginModules === 'function') {
            this.pluginInitializer = pluginModules;
        } else if (pluginModules && typeof pluginModules.default === 'function') {
            this.pluginInitializer = pluginModules.default;
        } else {
            throw new Error(`Plugin ${this.pluginPath} does not export an initializer function from main.`);
        }
    }

    /**
     * Iniitiialize
     * @param api API
     */
    public initialize(api: API): void {
        if (!this.pluginInitializer) {
            throw new Error('Tried to initialize a plugin which hasn\'t been loaded yet!');
        }
    
        this.pluginInitializer(api);
    }
}