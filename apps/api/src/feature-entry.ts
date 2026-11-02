// Dedicated production graph entry. It is bundled separately from server.ts
// so TypeScript's narrow API shell config stays intact while esbuild resolves
// worker-owned extensionless imports and emits one Node-runnable artifact.
import * as accounts from './accounts/index.js';
import * as quota from './quota/index.js';
import * as jobs from './jobs/index.js';
import * as runner from './runner/index.js';
import * as groups from './groups/index.js';
import * as campaigns from './campaigns/index.js';
import * as posts from './posts/index.js';
import * as friends from './friends/routes.js';
import * as interactions from './interactions/routes.js';
import * as autoComment from './auto-comment/routes.js';
import * as fanpage from './fanpage/routes.js';

export { accounts, quota, jobs, runner, groups, campaigns, posts, friends, interactions, autoComment, fanpage };
