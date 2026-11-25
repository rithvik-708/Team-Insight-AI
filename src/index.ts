/**
 * Forge function entry points referenced from manifest.yml.
 *   resolver               -> Custom UI dashboard (jira:globalPage)
 *   *Action                -> Rovo actions (also exposed as MCP tools via rovo:mcp)
 */
export { handler as resolver } from './handlers/resolver';
export {
  myWorkSummaryAction as myWorkSummary,
  teamWorkloadAction as teamWorkload,
  issuePeopleAction as issuePeople,
  relatedWorkAction as relatedWork,
  blockedWorkAction as blockedWork,
  relatedDocsAction as relatedDocs,
} from './handlers/rovoActions';
