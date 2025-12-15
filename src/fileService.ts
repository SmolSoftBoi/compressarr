import { EventEmitter } from 'events';

import { watch } from 'chokidar';
import { Stats } from 'fs-extra';

/** Base Directory */
export type BaseDirectory = string;

/** File Event */
export const enum FileEvent {

    /** File Added */
    FILE_ADDED = 'fileAdded',

    /** File Changed */
    FILE_CHANGED = 'fileChanged',

    /** File Removed */
    FILE_REMOVED = 'fileRemoved'
}

/** File Service */
export declare interface FileService {

    /**
     * On File Added
     * @param event File Added Event
     * @param listener Listener
     */
    on(event: FileEvent.FILE_ADDED, listener: (path: string, stats: Stats) => void): this;

    /**
     * On File Changed
     * @param event File Changed Event
     * @param listener Listener
     */
    on(event: FileEvent.FILE_CHANGED, listener: (path: string, stats: Stats) => void): this;

    /**
     * On File Removed
     * @param event File Removed Event
     * @param listener Listener
     */
    on(event: FileEvent.FILE_REMOVED, listener: (path: string) => void): this;
}

/** File Service */
export class FileService extends EventEmitter {

    /**
     * @param baseDirectories Base Directories
     */
    constructor(
        public baseDirectories: BaseDirectory | BaseDirectory[]
    ) {
        super();
    }

    /**
     * Start the file service listeners.
     */
    public start(): void {
        const watcher = watch(this.baseDirectories, {
            persistent: true,
            ignored: '.*',
            followSymlinks: true,
            alwaysStat: true,
            atomic: true,
            awaitWriteFinish: true
        });

        watcher.on('add', (path, stats) => this.emit(FileEvent.FILE_ADDED, path, stats));
        watcher.on('change', (path, stats) => this.emit(FileEvent.FILE_CHANGED, path, stats));
        watcher.on('unlink', path => this.emit(FileEvent.FILE_REMOVED, path));
    }
}