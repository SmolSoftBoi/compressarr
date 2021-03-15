import { homedir } from 'os';
import { join, resolve } from 'path';

export class User {

    /** Custom Storage Path? */
    private static customStoragePath?: string;

    /** Storagge Accessed? */
    private static storageAccessed = false;

    /**
     * Configuration Path
     * @returns Configuration Path
     */
    static configPath(): string {
        return join(User.storagePath(), 'config.json');
    }

    /**
     * Job Path
     * @returns Job Path
     */
     static jobPath(): string {
        return join(User.storagePath(), 'jobs');
    }

    /**
     * Persist Path
     * @returns Persist Path
     */
    static persistPath(): string {
        return join(User.storagePath(), 'persist');
    }

    /**
     * Cached Job Actions Path
     * @returns Cached Job Actions Path
     */
    static cachedJobActionsPath(): string {
        return join(User.storagePath(), 'job actions');
    }

    /**
     * Storage Path
     * @returns Storage Path
     */
    static storagePath(): string {
        User.storageAccessed = true;
    
        return User.customStoragePath ? User.customStoragePath : join(homedir(), '.compressarr');
    }

    /**
     * Set Storage Path
     * @param storagePathSegments Storage Path Segments
     */
    public static setStoragePath(...storagePathSegments: string[]): void {
        if (User.storageAccessed) {
            throw new Error('Storage path was already accessed and cannot be changed anymore. Try initializing your custom storage path earlier!');
        }
    
        User.customStoragePath = resolve(...storagePathSegments);
    }
}