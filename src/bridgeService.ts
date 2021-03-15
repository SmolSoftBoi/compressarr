import { Logger } from '@epickris/node-logger';

import { JobActionIdentifier, JobActionName, LibraryName, PluginIdentifier } from './api';
import { BaseDirectory } from './fileService';

/** Log */
const log = Logger.internal;

/** Job Actionn Configuration */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface JobActionConfig extends Record<string, any> {

    /** Job Action */
    jobAction: JobActionName | JobActionIdentifier;

    /** Name */
    name: string;
}

/** Job Configuraton */
export interface JobConfig {

    /** Name */
    name: string;

    /** Source Path */
    srcPath: string;

    /** Temperary Path */
    tempPath: string;
}

/** Library Configuration */
export interface LibraryConfig {

    /** Library */
    library: BaseDirectory,

    /** Name */
    name: string;
}

/** Compressarr Configuration */
export interface CompressarrConfig {
  
    /** Job Actions */
    jobActions: JobActionConfig[];
  
    /**
     * Array to define set of active plugins.
     */
    plugins?: PluginIdentifier[];
  
    /**
     * Array of disabled plugins.
     * Unlike the plugins[] config which prevents plugins from being initialised at all,
     * disabled plugins still have their alias loaded so we can match config blocks of disabled plugins and show an appropriate message in the logs.
     */
    disabledPlugins?: PluginIdentifier[];

    /** Libraries */
    libraries: LibraryConfig[];

    /** Disabled Libraries */
    disabledLibraries?: LibraryName[];
}