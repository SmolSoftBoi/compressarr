import { parse, sep } from 'path';

import getInfo, { FFProbeResult } from 'ffprobe';
import ffprobeStatic from 'ffprobe-static';
import { Stats } from 'fs-extra';
import { Logger, Logging } from '@epickris/node-logger';

import { API, LibraryName } from './api';
import { BaseDirectory, FileEvent, FileService } from './fileService';

/**
 * Represents a loaded Compressarr library.
 */
export class Library {

    /** Library Name */
    private readonly libraryName: LibraryName;

    /** Library Path */
    private readonly libraryPath: BaseDirectory;

    /**
     * Mark the library as disabled.
     */
    public disabled = false;

    /** File Service */
    private readonly fileService: FileService;

    /** Log */
    public readonly log: Logging;

    /** API */
    public readonly api: API;

    /**
     * @param name Library Name
     * @param path Path
     */
    constructor(name: LibraryName, path: string, api: API) {
        this.log = Logger.withPrefix(name);
        this.libraryName = name;
        this.libraryPath = path;
        this.api = api;
        this.fileService = new FileService(this.libraryPath);
    }

    /**
     * Get Library Name
     * @returns Full library name.
     */
    public getLibraryName(): LibraryName {
        return this.libraryName;
    }

    /**
     * Get Library Path
     * @returns Library Path
     */
    public getLibraryPath(): BaseDirectory {
        return this.libraryPath;
    }

    /**
     * Initialize
     * @param api API
     * @param logger Logger
     */
    public initialize(): void {
        this.fileService.start();
    
        this.fileService.on(FileEvent.FILE_ADDED, this.fileAdded.bind(this));
        this.fileService.on(FileEvent.FILE_CHANGED, this.fileChanged.bind(this));
        this.fileService.on(FileEvent.FILE_REMOVED, this.fileRemoved.bind(this));
    }

    /**
     * File Added
     * @param path Path
     * @param stats Stats
     */
    async fileAdded(path: string, stats: Stats) {
        const info = await this.getInfo(path);

        if (!info) return;

        path = path.slice(this.libraryPath.length - path.length + sep.length);

        this.log.info('Media added:', path);

        this.api.registerMedia(this.libraryPath, path);
    }

    /**
     * File Changed
     * @param path Path
     * @param stats Stats
     */
    async fileChanged(path: string, stats: Stats) {
        const parsedPath = parse(path);
        const info = await this.getInfo(path);

        if (!info) return;

        this.log.info('Media changed:', parsedPath.base);

        this.api.updateMedia(this.libraryPath, path);
    }

    /**
     * File Removed
     * @param path Path
     */
    async fileRemoved(path: string) {
        const parsedPath = parse(path);
        const info = await this.getInfo(path);

        if (!info) return;

        this.log.info('Media removed:', parsedPath.base);

        this.api.unregisterMedia(this.libraryPath, path);
    }

    /**
     * Get Info
     * @param path Path
     * @returns Probe Result?
     */
    private async getInfo(path: string): Promise<FFProbeResult | void> {
        try {
            return await getInfo(path, {
                path: ffprobeStatic.path
            });
        } catch (error) {
            return;
        }
    }
}