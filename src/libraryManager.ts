import { Logger, getError } from '@epickris/node-logger';
import { existsSync } from 'fs-extra';

import { CompressarrAPI, InternalAPIEvent, LibraryName } from './api';
import { LibraryConfig } from './bridgeService';
import { BaseDirectory } from './fileService';
import { Library } from './library';

/** Log */
const log = Logger.internal;

/** Library Manager Options */
export interface LibraryManagerOptions {

    /**
     * When defined, only libraries specified here will be initialized.
     */
    activeLibraries?: LibraryName[];

    /**
     * Libraries that are marked as disabled and whos corresponding config blocks should be ignored.
     */
    disabledLibraries?: LibraryName[];
}

/** Library Manager */
export class LibraryManager {

    /** Compressarr API */
    private readonly api: CompressarrAPI;

    /** Active Libraries */
    private readonly activeLibraries?: LibraryName[];

    /** Disabled Libraries */
    private readonly disabledLibraries?: LibraryName[];

    /** Libraries */
    private readonly libraries: Map<LibraryName, Library> = new Map();

    /**
     * @param api Compressarr API
     * @param options Library Manager Options
     */
    constructor(api: CompressarrAPI, options?: LibraryManagerOptions) {
        this.api = api;

        if (options) {      
            this.activeLibraries = options.activeLibraries;
            this.disabledLibraries = Array.isArray(options.disabledLibraries) ? options.disabledLibraries : undefined;
        }
    }

    /**
     * Initialize Libraries
     * @param configs Library Configurations
     */
    public initializeLibraries(configs: LibraryConfig[]): void {
        log.info('---');
    
        this.loadLibraries(configs);
    
        this.libraries.forEach((library: Library, name: LibraryName) => {
            if (this.disabledLibraries && this.disabledLibraries.includes(name)) {
                library.disabled = true;
            }
        
            if (library.disabled) {
                log.warn(`Disabled library: ${name} @ ${library.getLibraryPath()}`);
            } else {
                log.info(`Loaded library: ${name} @ ${library.getLibraryPath()}`);
            }
        
            log.info('---');
        });
    }

    /**
     * Get Library
     * @param libraryName Library Name
     * @returns Library
     */
    public getLibrary(libraryName: LibraryName): Library {
        const library = this.libraries.get(libraryName);

        if (!library) {
            throw new Error(`No library was found for the library "${libraryName}" in your config.json. Please make sure the corresponding library is configured correctly.`);
        }
    
        return library;
    }

    /**
     * Loads all libraries in the library configurations.
     * @param configs Library Configurations
     */
    private loadLibraries(configs: LibraryConfig[]): void {
        configs.forEach(config => {
            if (!existsSync(config.library)) {
                return;
            }

            try {
                this.loadLibrary(config);
            } catch (error) {
                log.warn(getError(error));

                return;
            }


        });

        if (this.libraries.size === 0) {
            log.warn('No libraries found. See the README for information on configuring libraries.');
        }
    }

    /**
     * Load Library
     * @param config Library Configuration
     * @returns Library
     */
    public loadLibrary(config: LibraryConfig): Library {
        const alreadyInstalled = this.libraries.get(config.name);

        if (alreadyInstalled) {
            throw new Error(`Warning: skipping library '${config.library}' since we already loaded the same library name from '${alreadyInstalled.getLibraryPath()}'.`);
        }
    
        const library = new Library(config.name, config.library, this.api);

        this.libraries.set(config.name, library);

        return library;
    }
}