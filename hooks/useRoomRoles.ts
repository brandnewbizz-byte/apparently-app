import { useMemo } from 'react';
import { useRoom, RoomRole } from '@/contexts/RoomContext';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ──
export interface RolePermissions {
  canEditPlan: boolean;
  canCreateTasks: boolean;
  canUploadResources: boolean;
  canManageRoom: boolean;
  canApproveRequests: boolean;
  canRequestControl: boolean;
  canAddIdeas: boolean;
  canAddResources: boolean;
  canComment: boolean;
  canUpdateTasks: boolean;
  canSpeak: boolean;
  canBrowse: boolean;
  canFollow: boolean;
  canStartPresentation: boolean;
  canEditSections: boolean;
  canDeleteTasks: boolean;
  canManageBudget: boolean;
  canManageVotes: boolean;
  canAddTimeline: boolean;
  canAssignTasks: boolean;
}

// ── Role-to-permissions mapping ──
const ROLE_PERMISSIONS: Record<RoomRole, RolePermissions> = {
  host: {
    canEditPlan: true,
    canCreateTasks: true,
    canUploadResources: true,
    canManageRoom: true,
    canApproveRequests: true,
    canRequestControl: true,
    canAddIdeas: true,
    canAddResources: true,
    canComment: true,
    canUpdateTasks: true,
    canSpeak: true,
    canBrowse: true,
    canFollow: true,
    canStartPresentation: true,
    canEditSections: true,
    canDeleteTasks: true,
    canManageBudget: true,
    canManageVotes: true,
    canAddTimeline: true,
    canAssignTasks: true,
  },
  co_host: {
    canEditPlan: true,
    canCreateTasks: true,
    canUploadResources: true,
    canManageRoom: true,
    canApproveRequests: true,
    canRequestControl: true,
    canAddIdeas: true,
    canAddResources: true,
    canComment: true,
    canUpdateTasks: true,
    canSpeak: true,
    canBrowse: true,
    canFollow: true,
    canStartPresentation: true,
    canEditSections: true,
    canDeleteTasks: true,
    canManageBudget: true,
    canManageVotes: true,
    canAddTimeline: true,
    canAssignTasks: true,
  },
  editor: {
    canEditPlan: true,
    canCreateTasks: true,
    canUploadResources: true,
    canManageRoom: false,
    canApproveRequests: false,
    canRequestControl: true,
    canAddIdeas: true,
    canAddResources: true,
    canComment: true,
    canUpdateTasks: true,
    canSpeak: true,
    canBrowse: true,
    canFollow: true,
    canStartPresentation: false,
    canEditSections: true,
    canDeleteTasks: true,
    canManageBudget: true,
    canManageVotes: false,
    canAddTimeline: true,
    canAssignTasks: true,
  },
  contributor: {
    canEditPlan: false,
    canCreateTasks: false,
    canUploadResources: false,
    canManageRoom: false,
    canApproveRequests: false,
    canRequestControl: false,
    canAddIdeas: true,
    canAddResources: true,
    canComment: true,
    canUpdateTasks: true,
    canSpeak: false,
    canBrowse: true,
    canFollow: true,
    canStartPresentation: false,
    canEditSections: false,
    canDeleteTasks: false,
    canManageBudget: false,
    canManageVotes: false,
    canAddTimeline: false,
    canAssignTasks: false,
  },
  viewer: {
    canEditPlan: false,
    canCreateTasks: false,
    canUploadResources: false,
    canManageRoom: false,
    canApproveRequests: false,
    canRequestControl: false,
    canAddIdeas: false,
    canAddResources: false,
    canComment: false,
    canUpdateTasks: false,
    canSpeak: false,
    canBrowse: true,
    canFollow: true,
    canStartPresentation: false,
    canEditSections: false,
    canDeleteTasks: false,
    canManageBudget: false,
    canManageVotes: false,
    canAddTimeline: false,
    canAssignTasks: false,
  },
};

// ── Hook ──
export function useRoomRoles() {
  const { user } = useAuth();
  const { currentRoom, getUserRole } = useRoom();

  const role = useMemo((): RoomRole => {
    if (!currentRoom || !user) return 'viewer';
    // Creator is always host
    if (currentRoom.creatorId === user.id) return 'host';
    return getUserRole();
  }, [currentRoom, user, getUserRole]);

  const permissions = useMemo((): RolePermissions => {
    return ROLE_PERMISSIONS[role];
  }, [role]);

  const canPerformAction = useMemo(() => {
    return (action: keyof RolePermissions): boolean => {
      return permissions[action] ?? false;
    };
  }, [permissions]);

  const isAtLeast = useMemo(() => {
    return (minRole: RoomRole): boolean => {
      const roleOrder: RoomRole[] = ['host', 'co_host', 'editor', 'contributor', 'viewer'];
      const currentIdx = roleOrder.indexOf(role);
      const minIdx = roleOrder.indexOf(minRole);
      return currentIdx <= minIdx;
    };
  }, [role]);

  return {
    role,
    permissions,
    canPerformAction,
    isAtLeast,
    isHost: role === 'host',
    isCoHostOrAbove: role === 'host' || role === 'co_host',
    isEditorOrAbove: role === 'host' || role === 'co_host' || role === 'editor',
  };
}

// ── Safe hook that doesn't throw ──
export function useRolePermissionsSafe(): RolePermissions | null {
  const { user } = useAuth();
  const { currentRoom } = useRoom();

  return useMemo(() => {
    if (!currentRoom || !user) return null;
    let role: RoomRole = 'viewer';
    if (currentRoom.creatorId === user.id) role = 'host';
    else {
      const p = currentRoom.participants.find(pp => pp.userId === user.id);
      role = p?.role || 'viewer';
    }
    return ROLE_PERMISSIONS[role];
  }, [currentRoom, user]);
}
