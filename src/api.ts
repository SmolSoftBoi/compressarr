import { EventEmitter } from 'events';

import { Logger, Logging } from '@epickris/node-logger';
import { gte } from 'semver';

import { JobActionConfig, JobConfig } from './bridgeService';
import getVersion from './version';
import { Job } from './job';

/** Log */
const log = Logger.internal;

/** Plugin Identifier */
export type PluginIdentifier = PluginName | ScopedPluginName;

/** Plugin Name */
export type PluginName = string;

/** Scoped Plugin Name */
export type ScopedPluginName = string;

/** Job Action Name */
export type JobActionName = string;

/** Job Action Identifier */
export type JobActionIdentifier = string;

/** Job Identifier */
export type JobIdentifier = string;

/** Library Name */
export type LibraryName = string;

/** Plugin Type */
export const enum PluginType {
    JOB_ACTION = 'jobAction'
}

/**
 * The {PluginInitializer} is a method which must be the default export for every compressarr plugin.
 * It is called once the plugin is loaded from disk.
 */
export interface PluginInitializer {

    /**
     * When the initializer is called the plugin must use the provided API instance and call the appropriate register methods
     * - {@link API.registerAccessory} or {@link API.registerPlatform}
     * - in order to correctly register for the following startup sequence.
     *
     * @param {API} API
     */
    (api: API): void;
}

/** Job Action */
export interface JobActionPluginConstructor {
    new(logger: Logging, config: JobActionConfig, api: API): JobActionPlugin;
}

/** Job Action Plugin */
export interface JobActionPlugin {

    /**
     * Start
     * @param job Job
     */
    start(job: Job): Promise<Job>;

    /**
     * Kill
     * @param identifier Job Identifier
     */
    kill(identifier: JobIdentifier): Promise<void>;
}

/** API Event */
export const enum APIEvent {

    /**
     * Event is fired once compressarr has finished with booting up and initializing all components and plugins.
     */
    DID_FINISH_LAUNCHING = 'didFinishLaunching',

    /**
     * This event is fired when compressarr got shutdown. This could be a regular shutdown or an unexpected crash.
     * At this stage all Job Actions are already unpublished!
     */
    SHUTDOWN = 'shutdown'
}

/** Internal API Event */
export const enum InternalAPIEvent {

    /** Register Job Action */
    REGISTER_JOB_ACTION = 'registerJobAction',

    /** Register Job */
    REGISTER_JOB = 'registerJob',

    /** Unregister Job */
    UNREGISTER_JOB = 'unregisterJob',

    /** Publish Job */
    PUBLISH_JOB = 'publishJob',

    /** Register Media */
    REGISTER_MEDIA = 'registerMedia',

    /** Update Media */
    UPDATE_MEDIA = 'updateMedia',

    /** Unregister Media */
    UNREGISTER_MEDIA = 'unregisterMedia'
}

/** API */
export interface API {

    /**
     * The compressarr API version as a floating point number.
     */
    readonly version: number;

    /**
     * The current compressar semver version.
     */
    readonly serverVersion: string;

    /**
     * Returns true if the current running compressarr version is greater or equal to the passed version string.
     *
     * Example:
     * We assume the compressarr version 1.3.0-beta.12 ({@link serverVersion}) and the following example calls below
     * ```
     *  versionGreaterOrEqual('1.2.0'); // will return true
     *  versionGreaterOrEqual('1.3.0'); // will return false (the RELEASE version 1.3.0 is bigger than the BETA version 1.3.0-beta.12)
     *  versionGreaterOrEqual('1.3.0-beta.8'); // will return true
     * ```
     *
     * @param version Version
     */
    versionGreaterOrEqual(version: string): boolean;

    /**
     * Register Job Action
     * @param jobActionName Job Action Name
     * @param constructor Job Action Plugin Constructor
     */
    registerJobAction(jobActionName: JobActionName, constructor: JobActionPluginConstructor): void;

    /**
     * Register Job
     * @param jobPath Job Path
     * @param jobConfig Job Configuration
     */
    registerJob(jobPath: string, jobConfig: JobConfig): void;

    /**
     * Unregister Job
     * @param jobPath Job Path
     */
    unregisterJob(jobPath: string): void;

    /**
     * Publish Job
     * @param jobPath Job Path
     */
    publishJob(jobPath: string): void;

    /**
     * Register Media
     * @param libraryPath Library Path
     * @param mediaPath Media Path
     */
    registerMedia(libraryPath: string, mediaPath: string): void;

    /**
     * Update Media
     * @param libraryPath Library Path
     * @param mediaPath Media Path
     */
    updateMedia(libraryPath: string, mediaPath: string): void;

    /**
     * Unregister Media
     * @param libraryPath Library Path
     * @param mediaPath Media Path
     */
    unregisterMedia(libraryPath: string, mediaPath: string): void;

    /**
     * On Did Finish Launching
     * @param event Did Finish Launching Event
     * @param listener Listener
     */
    on(event: 'didFinishLaunching', listener: () => void): this;

    /**
     * On Shutdown
     * @param event Shutdown Event
     * @param listener Listener
     */
    on(event: 'shutdown', listener: () => void): this;
}

/** Compressarr APi */
export declare interface CompressarrAPI {

    /**
     * On Did Finish Launching
     * @param event Did Finish Launching Event
     * @param listener Listener
     */
    on(event: 'didFinishLaunching', listener: () => void): this;

    /**
     * On Shutdown
     * @param event Shutdown Event
     * @param listener Listener
     */
    on(event: 'shutdown', listener: () => void): this;

    /**
     * On Register Job Action
     * @param event Register Job Action Event
     * @param listener Listener
     */
    on(event: InternalAPIEvent.REGISTER_JOB_ACTION, listener: (jobActionName: JobActionName, jobActionConstructor: JobActionPluginConstructor, pluginIdentifier?: PluginIdentifier) => void): this;

    /**
     * On Register Job
     * @param event Register Job Event
     * @param listener Listener
     */
    on(event: InternalAPIEvent.REGISTER_JOB, listener: (jobPath: string, jobConfig: JobConfig) => void): this;

    /**
     * On Unregister Job
     * @param event Unregister Job Event
     * @param listener Listener
     */
    on(event: InternalAPIEvent.UNREGISTER_JOB, listener: (jobPath: string) => void): this;

    /**
     * On Publish Job
     * @param event Publish Job Event
     * @param listener Listener
     */
    on(event: InternalAPIEvent.PUBLISH_JOB, listener: (jobPath: string) => void): this;

    /**
     * On Register Media
     * @param event Register Media Event
     * @param listener Listener
     */
    on(event: InternalAPIEvent.REGISTER_MEDIA, listener: (libraryPath: string, mediaPath: string) => void): this;

    /**
     * On Update Media
     * @param event Update Media Event
     * @param listener Listener
     */
    on(event: InternalAPIEvent.UPDATE_MEDIA, listener: (libraryPath: string, mediaPath: string) => void): this;

    /**
     * On Unregister Media
     * @param event Unregister Media Event
     * @param listener Listener
     */
    on(event: InternalAPIEvent.UNREGISTER_MEDIA, listener: (libraryPath: string, mediaPath: string) => void): this;

    /**
     * Emit Did Finish Launching
     * @param event Did Finish Launching Event
     */
    emit(event: 'didFinishLaunching'): boolean;

    /**
     * Emit Shutdown
     * @param event Shutdown Event
     */
    emit(event: 'shutdown'): boolean;

    /**
     * Emit Register Job Action
     * @param event Register Job Action Event
     * @param jobActionName Job Action Name
     * @param jobActionConstructor Job Action Plugin Constructor
     * @param pluginIdentifier Plugin Identifier
     */
    emit(event: InternalAPIEvent.REGISTER_JOB_ACTION, jobActionName: JobActionName, jobActionConstructor: JobActionPluginConstructor, pluginIdentifier?: PluginIdentifier): boolean;

    /**
     * Emit Register Job
     * @param event Register Job Event
     * @param jobPath Job Path
     * @param jobConfig Job Configuration
     */
    emit(event: InternalAPIEvent.REGISTER_JOB, jobPath: string, jobConfig: JobConfig): boolean;

    /**
     * Emit Unregister Job
     * @param event Unregister Job Event
     * @param jobPath Job Path
     */
    emit(event: InternalAPIEvent.UNREGISTER_JOB, jobPath: string): boolean;

    /**
     * Emit Publish Job
     * @param event Publish Job Event
     * @param jobPath Job Path
     */
    emit(event: InternalAPIEvent.PUBLISH_JOB, jobPath: string): boolean;

    /**
     * Emit Register Media
     * @param event Register Media Event
     * @param libraryPath Library Path
     * @param mediaPath Media Path
     */
    emit(event: InternalAPIEvent.REGISTER_MEDIA, libraryPath: string, mediaPath: string): boolean;

    /**
     * Emit Update Media
     * @param event Update Media Event
     * @param libraryPath Library Path
     * @param mediaPath Media Path
     */
    emit(event: InternalAPIEvent.UPDATE_MEDIA, libraryPath: string, mediaPath: string): boolean;

    /**
     * Emit Unregister Media
     * @param event Unregister Media Event
     * @param libraryPath Library Path
     * @param mediaPath Media Path
     */
    emit(event: InternalAPIEvent.UNREGISTER_MEDIA, libraryPath: string, mediaPath: string): boolean;
}

/** Compressarr API */
export class CompressarrAPI extends EventEmitter implements API {

    /**
     * Compressarr API version.
     */
    public readonly version = 0.1;

    /**
     * Compressarr node module version.
     */
    public readonly serverVersion = getVersion();

    /**
     * Version Greater or Equal
     * @param version Version
     * @returns Version Greater or Equal?
     */
    public versionGreaterOrEqual(version: string): boolean {
        return gte(this.serverVersion, version);
    }

    /** Signal Finished */
    signalFinished(): void {
        this.emit(APIEvent.DID_FINISH_LAUNCHING);
    }

    /** Signal Shutdown */
    signalShutdown(): void {
        this.emit(APIEvent.SHUTDOWN);
    }

    /**
     * Register Job Action
     * @param jobActionName Job Action Name
     * @param constructor Job Action Plugin Constructor
     */
    registerJobAction(jobActionName: JobActionName, constructor: JobActionPluginConstructor): void {
        this.emit(InternalAPIEvent.REGISTER_JOB_ACTION, jobActionName, constructor);
    }

    /**
     * Register Jobb
     * @param jobPath Job Path
     * @param jobConfig Job Configuration
     */
    registerJob(jobPath: string, jobConfig: JobConfig): void {
        this.emit(InternalAPIEvent.REGISTER_JOB, jobPath, jobConfig);
    }

    /**
     * Unnregister Job
     * @param jobPath Job Path
     */
    unregisterJob(jobPath: string): void {
        this.emit(InternalAPIEvent.UNREGISTER_JOB, jobPath);
    }

    /**
     * Publish Job
     * @param jobPath Job Path
     */
    publishJob(jobPath: string): void {
        this.emit(InternalAPIEvent.PUBLISH_JOB, jobPath);
    }

    /**
     * Register Media
     * @param libraryPath Library Path
     * @param mediaPath Media Path
     */
    registerMedia(libraryPath: string, mediaPath: string): void {
        this.emit(InternalAPIEvent.REGISTER_MEDIA, libraryPath, mediaPath);
    }

    /**
     * Update Media
     * @param libraryPath Library Path
     * @param mediaPath Media Path
     */
    updateMedia(libraryPath: string, mediaPath: string): void {
        this.emit(InternalAPIEvent.UPDATE_MEDIA, libraryPath, mediaPath);
    }

    /**
     * Unregister Media
     * @param libraryPath Library Path
     * @param mediaPath Media Path
     */
    unregisterMedia(libraryPath: string, mediaPath: string): void {
        this.emit(InternalAPIEvent.UNREGISTER_MEDIA, libraryPath, mediaPath);
    }
}