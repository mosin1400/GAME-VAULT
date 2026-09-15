export type PlatformRole = 'user' | 'moderator' | 'system_admin';
export type ProjectRole = 'owner' | 'maintainer' | 'developer' | 'viewer';
export type GrantedRole = ProjectRole | 'public';
export type ProjectVisibility = 'private' | 'members' | 'unlisted' | 'public';
export type ProjectAction = 'read_metadata' | 'read_source' | 'edit_source' | 'manage_members' | 'publish_release' | 'transfer_ownership';

export interface Actor {
  userId: string;
  platformRole: PlatformRole;
}

export interface ProjectAccessRecord {
  id: string;
  ownerUserId: string;
  visibility: ProjectVisibility;
  members: ReadonlyMap<string, Exclude<ProjectRole, 'owner'>>;
}

export interface ProjectGrant {
  projectId: string;
  userId: string | null;
  role: GrantedRole;
  action: ProjectAction;
}

export class ProjectAccessError extends Error {
  readonly statusCode = 404;
  readonly code = 'PROJECT_NOT_FOUND';
}

function deny(): never {
  throw new ProjectAccessError('Project not found');
}

function roleFor(actor: Actor | null, project: ProjectAccessRecord): GrantedRole | null {
  if (actor?.userId === project.ownerUserId) return 'owner';
  if (actor) return project.members.get(actor.userId) ?? null;
  return null;
}

function allowed(role: GrantedRole, action: ProjectAction): boolean {
  if (role === 'owner') return true;
  if (role === 'maintainer') return action !== 'transfer_ownership';
  if (role === 'developer') return action === 'read_metadata' || action === 'read_source' || action === 'edit_source';
  if (role === 'viewer') return action === 'read_metadata' || action === 'read_source';
  return action === 'read_metadata';
}

export function requireProjectAction(actor: Actor | null, project: ProjectAccessRecord, action: ProjectAction): ProjectGrant {
  const memberRole = roleFor(actor, project);
  const role: GrantedRole | null = memberRole ?? ((project.visibility === 'public' || project.visibility === 'unlisted') ? 'public' : null);
  if (!role || !allowed(role, action)) return deny();
  return { projectId: project.id, userId: actor?.userId ?? null, role, action };
}

export function assertMemberRoleChange(actor: Actor, project: ProjectAccessRecord, requestedRole: ProjectRole): void {
  const grant = requireProjectAction(actor, project, 'manage_members');
  if (requestedRole === 'owner') deny();
  if (grant.role === 'maintainer' && requestedRole === 'maintainer') deny();
}
