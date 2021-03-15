import { readFileSync } from 'fs';
import { join } from 'path';

/** Load Package JSON */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadPackageJson(): any {
    const packageJSONPath = join(__dirname, '../package.json');
    return JSON.parse(readFileSync(packageJSONPath, { encoding: 'utf8' }));
}

/** Get Version */
export default function getVersion(): string {
    return loadPackageJson().version;
}

/** Get Required Node Version */
export function getRequiredNodeVersion(): string {
    return loadPackageJson().engines.node;
}