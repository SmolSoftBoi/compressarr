import { join, parse } from 'path';

import { Logger } from '@epickris/node-logger';

import { CompressarrAPI, InternalAPIEvent } from './api';
import { Job } from './job';
import { User } from './user';
import { JobConfig } from './bridgeService';

/** Job */
const log = Logger.internal;

/** Job Manager Options */
export interface JobManagerOptions {

    /**
     * Path for jobs.
     */
    customJobPath?: string;

    /** Instances */
    instances?: number;
}

/**
 * Utility which exposes methods for jobs.
 */
export class JobManager {

    /** Compressarr API */
    private readonly api: CompressarrAPI;

    /**
     * Unique path we will use for jobs.
     */
    private readonly jobPath: string;

    /** Instances */
    private readonly instances: number = 1;

    /** Jobs */
    private jobs: Map<string, JobConfig> = new Map();

    /** Active Jobs */
    private activeJobs: Map<string, JobConfig> = new Map();

    /**
     * @param api Compressarr API
     * @param options Job Manager Options
     */
    constructor(api: CompressarrAPI, options?: JobManagerOptions) {
        this.api = api;
        this.jobPath = User.jobPath();

        if (options) {
            if (options.customJobPath) {
                this.jobPath = options.customJobPath;
            }

            if (options.instances) {
                this.instances = options.instances;
            }
        }

        this.api.on(InternalAPIEvent.PUBLISH_JOB, this.handlePublishJob.bind(this));
        this.api.on(InternalAPIEvent.REGISTER_MEDIA, this.handleRegisterMedia.bind(this));
        this.api.on(InternalAPIEvent.UPDATE_MEDIA, this.handleUpdateMedia.bind(this));
        this.api.on(InternalAPIEvent.UNREGISTER_MEDIA, this.handleUnregisterMedia.bind(this));
    }

    /**
     * Handle Publish Job
     * @param path Path
     */
    handlePublishJob(path: string): void {
        this.jobs.delete(path);
        this.activeJobs.delete(path);
        this.next();
    }

    /**
     * Handle Register Media
     * @param libraryPath Library Path
     * @param mediaPath Media Path
     */
    handleRegisterMedia(libraryPath: string, mediaPath: string): void {
        const parsedPath = parse(mediaPath);
        const srcPath = join(libraryPath, mediaPath);
        const tempPath = join(this.jobPath, mediaPath);
        const parsedTempPath = parse(tempPath);
        const jobConfig = {
            name: parsedPath.name,
            srcPath: srcPath,
            tempPath: join(parsedTempPath.dir, parsedTempPath.name)
        };

        this.jobs.set(srcPath, jobConfig);

        this.next();
    }

    /**
     * Handle Register Media
     * @param libraryPath Library Path
     * @param mediaPath Media Path
     */
    handleUpdateMedia(libraryPath: string, mediaPath: string): void {
        const parsedPath = parse(mediaPath);
        const srcPath = join(libraryPath, mediaPath);
        const tempPath = join(this.jobPath, mediaPath);
        const parsedTempPath = parse(tempPath);
        const jobConfig = {
            name: parsedPath.name,
            srcPath: srcPath,
            tempPath: join(parsedTempPath.dir, parsedTempPath.name)
        };

        this.jobs.set(srcPath, jobConfig);
        this.activeJobs.delete(srcPath);
        this.api.emit(InternalAPIEvent.UNREGISTER_JOB, srcPath);
        this.next();
    }

    /**
     * Handle Register Media
     * @param libraryPath Library Path
     * @param mediaPath Media Path
     */
    handleUnregisterMedia(libraryPath: string, mediaPath: string): void {
        const srcPath = join(libraryPath, mediaPath);

        this.jobs.delete(srcPath);
        this.activeJobs.delete(srcPath);
        this.api.emit(InternalAPIEvent.UNREGISTER_JOB, srcPath);
        this.next();
    }

    /** Next */
    private next() {
        if (this.jobs.size === 0 || this.activeJobs.size >= this.instances) return;

        const key = this.jobs.entries().next().value[0];
        const job = this.jobs.get(key);

        if (job) {
            this.jobs.delete(key);
            this.activeJobs.set(key, job);
            
            this.api.registerJob(key, job);

            this.next();
        }
    }
}