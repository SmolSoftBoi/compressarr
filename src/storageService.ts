import { ensureDirSync } from 'fs-extra';

/** Storage Service */
export class StorageService {

    /**
     * @param baseDirectory Base Directory
     */
    constructor(
        public baseDirectory: string,
    ) {}

    /** Inititialize Sync */
    public initSync(): void {
        return ensureDirSync(this.baseDirectory);
    }
}