import { extname, join } from 'path';

import { Logging } from '@epickris/node-logger';
import { existsSync, remove } from 'fs-extra';

import { JobIdentifier } from './api';
import { JobConfig } from './bridgeService';

/** Job */
export class Job {

    /** Log */
    private readonly log: Logging;

    /** Name */
    private readonly name: string;

    /** Source Path */
    private readonly srcPath: string;

    /** Temporary Path */
    private readonly tempPath: string;

    /** Identifier */
    public readonly identifier: JobIdentifier;

    /** Temporary Source Path */
    private tempSrcPath: string | undefined;

    /** Temporary Destination Path */
    private tempDestPath: string | undefined;

    /**
     * @param log Log
     * @param config Job Configuration
     * @param api API
     */
    constructor(log: Logging, config: JobConfig) {
        this.log = log;
        this.name = config.name;
        this.srcPath = config.srcPath;
        this.tempPath = config.tempPath;
        this.identifier = this.srcPath;

        log.info('Job finished initializing!');
    }

    /**
     * Get Source Path
     * @returns Source Path
     */
    getSrcPath(): string {
        if (this.tempSrcPath) return this.tempSrcPath;

        return this.srcPath;
    }

    /**
     * Get Source Extension
     * @returns Source Extension
     */
    getSrcExt(): string {
        return extname(this.getSrcPath());
    }

    /**
     * Get Destination Path
     * @returns Destination Path
     */
    getDestPath(ext?: string): string {
        if (!this.tempDestPath) this.tempDestPath = this.nextAvailableDest(this.tempPath);

        if (ext) {
            ext.replace(/^\.+/, '');

            return `${this.tempDestPath}.${ext}`;
        }

        return this.tempDestPath;
    }

    /**
     * Set Path
     * @param path Path
     */
    setPath(path: string) {
        if (this.tempSrcPath) remove(this.tempSrcPath);

        this.tempSrcPath = undefined;
        this.tempDestPath = undefined;
        this.tempSrcPath = join(this.tempPath, path);
    }

    /**
     * Next Available Destination
     * @param path Path
     * @param i I
     * @returns Next Available Destination
     */
    private nextAvailableDest(path: string, i: number = 1): string {
        const dest = join(path, `${this.name}-${i}`);

        if (existsSync(dest)) {
            return this.nextAvailableDest(path, i++);
        } else {
            return dest;
        }
    }
}